import { describe, expect, it, vi } from "vitest";
import { countBackupMismatches, fetchAllPages } from "@/lib/backup-integrity";
import { createHash } from "node:crypto";

describe("countBackupMismatches", () => {
  it("reads tables from the backup data envelope", () => {
    const jobs = [{ id: 1 }];
    const payments: unknown[] = [];
    expect(
      countBackupMismatches(
        {
          meta: {
            schema_version: 1,
            table_sha256: {
              jobs: createHash("sha256").update(JSON.stringify(jobs)).digest("hex"),
              payments: createHash("sha256").update(JSON.stringify(payments)).digest("hex"),
            },
          },
          data: { jobs, payments },
        },
        { jobs: 1, payments: 0 }
      )
    ).toEqual({ totalRows: 1, mismatches: [], integrityErrors: [] });
  });

  it("reports a missing or truncated table", () => {
    expect(
      countBackupMismatches({ meta: {}, data: { jobs: [] } }, { jobs: 2 })
    ).toEqual({
      totalRows: 0,
      mismatches: [{ table: "jobs", expected: 2, actual: 0 }],
      integrityErrors: [
        "Unsupported or missing backup schema version.",
        "Checksum mismatch for jobs.",
      ],
    });
  });

  it("detects same-length table corruption via checksums", () => {
    const result = countBackupMismatches(
      {
        meta: { schema_version: 1, table_sha256: { jobs: "invalid" } },
        data: { jobs: [{ id: 1 }] },
      },
      { jobs: 1 }
    );
    expect(result.mismatches).toEqual([]);
    expect(result.integrityErrors).toEqual(["Checksum mismatch for jobs."]);
  });
});

describe("fetchAllPages", () => {
  it("keeps fetching until a short page is returned", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([{ id: 3 }, { id: 4 }])
      .mockResolvedValueOnce([{ id: 5 }]);

    await expect(fetchAllPages(fetchPage, 2)).resolves.toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
    ]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, 0, 1);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2, 3);
    expect(fetchPage).toHaveBeenNthCalledWith(3, 4, 5);
  });

  it("propagates a table fetch failure instead of creating an empty backup", async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error("database unavailable"));
    await expect(fetchAllPages(fetchPage, 1000)).rejects.toThrow("database unavailable");
  });
});
