import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authUser: { id: "user-1", email: "tech@example.com" } as { id: string; email?: string } | null,
  profile: null as {
    id: string;
    name: string;
    email: string | null;
    role: string;
    active: boolean;
  } | null,
  select: vi.fn(),
}));

vi.mock("react", () => ({ cache: <T extends (...args: never[]) => unknown>(fn: T) => fn }));

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mocks.authUser } })),
    },
  })),
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mocks.select.mockImplementation(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: mocks.profile })),
        })),
      })),
    })),
  })),
}));

import { getCurrentUser, requireAuthenticatedUser } from "@/lib/auth-helpers";

describe("getCurrentUser", () => {
  beforeEach(() => {
    mocks.authUser = { id: "user-1", email: "tech@example.com" };
    mocks.profile = {
      id: "user-1",
      name: "Active Tech",
      email: "tech@example.com",
      role: "technician",
      active: true,
    };
    mocks.select.mockClear();
  });

  it("returns the authenticated user only when their profile is active", async () => {
    await expect(getCurrentUser()).resolves.toEqual({
      id: "user-1",
      name: "Active Tech",
      email: "tech@example.com",
      role: "technician",
    });
    expect(mocks.select).toHaveBeenCalledWith("id, name, email, role, active");
  });

  it("returns null for an inactive profile", async () => {
    mocks.profile = { ...mocks.profile!, active: false };

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("returns null instead of synthesizing a fallback for a missing profile", async () => {
    mocks.profile = null;

    await expect(getCurrentUser()).resolves.toBeNull();
  });
});

describe("requireAuthenticatedUser", () => {
  beforeEach(() => {
    mocks.authUser = { id: "user-1", email: "tech@example.com" };
    mocks.profile = {
      id: "user-1",
      name: "Active Tech",
      email: "tech@example.com",
      role: "technician",
      active: true,
    };
  });

  it("returns the project's standard user result for an active user", async () => {
    await expect(requireAuthenticatedUser()).resolves.toEqual({
      user: {
        id: "user-1",
        name: "Active Tech",
        email: "tech@example.com",
        role: "technician",
      },
    });
  });

  it("returns the project's standard error result without an active user", async () => {
    mocks.profile = { ...mocks.profile!, active: false };

    await expect(requireAuthenticatedUser()).resolves.toEqual({
      error: "Not authenticated.",
    });
  });
});
