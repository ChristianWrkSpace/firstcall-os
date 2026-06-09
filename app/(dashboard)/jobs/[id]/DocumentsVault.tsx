"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  recordJobDocument,
  deleteJobDocument,
  getDocumentSignedUrl,
  getShareLink,
  markDocumentSigned,
  unmarkDocumentSigned,
  updateDocumentMeta,
} from "@/app/actions/documents";
import {
  DOC_TYPE_META,
  CATEGORY_ORDER,
  REQUIRED_DOC_TYPES,
  docTypeMeta,
  formatBytes,
  isPreviewable,
  type DocType,
  type DocCategory,
} from "@/lib/document-types";

const BUCKET = "job-documents";

interface JobDocument {
  id: string;
  doc_type: DocType;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  notes: string | null;
  signed: boolean;
  signed_at: string | null;
  signed_by_name: string | null;
  created_at: string;
}

export default function DocumentsVault({
  jobId,
  documents,
}: {
  jobId: string;
  documents: JobDocument[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingType, setPendingType] = useState<DocType>("aob");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<{ url: string; mime: string; filename: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Group documents by category (via doc_type → meta.category)
  const docsByCategory: Record<DocCategory, JobDocument[]> = {
    "Customer Authorizations": [],
    Insurance: [],
    "Mitigation Records": [],
    Compliance: [],
    Misc: [],
  };
  for (const doc of documents) {
    const cat = docTypeMeta(doc.doc_type).category;
    docsByCategory[cat].push(doc);
  }

  // Required-docs checklist
  const presentRequired = new Set(
    documents.filter((d) => d.signed || !DOC_TYPE_META[d.doc_type]?.trackSignature)
      .map((d) => d.doc_type)
  );
  // For trackSignature docs, only count as present if signed
  const reqStatus = REQUIRED_DOC_TYPES.map((t) => {
    const all = documents.filter((d) => d.doc_type === t);
    const signed = all.filter((d) => d.signed);
    return {
      type: t,
      meta: DOC_TYPE_META[t],
      uploaded: all.length > 0,
      signed: signed.length > 0,
    };
  });
  const missingRequired = reqStatus.filter((r) => !r.signed);

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);
    if (list.length === 0) return;

    setProgress({ done: 0, total: list.length });
    const supabase = createClient();
    let done = 0;
    const failures: string[] = [];

    for (const file of list) {
      try {
        const ext = (file.name.split(".").pop() ?? "bin").toLowerCase();
        const path = `${jobId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: false,
          });
        if (uploadErr) throw uploadErr;

        const recorded = await recordJobDocument(
          jobId,
          path,
          file.name,
          file.type || "application/octet-stream",
          file.size,
          pendingType
        );
        if (recorded.error) throw new Error(recorded.error);
      } catch (err: any) {
        failures.push(`${file.name}: ${err.message ?? "upload failed"}`);
      }

      done += 1;
      setProgress({ done, total: list.length });
    }

    if (failures.length) setError(failures.join("\n"));
    setProgress(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  function onPick(files: FileList | null) {
    if (files) handleFiles(files);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  }

  const uploading = progress !== null;
  const hasDocs = documents.length > 0;

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Required docs checklist */}
        <div className="bg-tint border border-edge2 rounded-lg p-4">
          <p className="text-ink-2 text-xs uppercase tracking-wide font-semibold mb-2">
            Required for Mitigation Work
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {reqStatus.map((r) => (
              <div
                key={r.type}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                  r.signed
                    ? "bg-pine/10 text-pine border border-green-500/20"
                    : r.uploaded
                      ? "bg-honey/10 text-honey border border-yellow-500/20"
                      : "bg-red-500/5 text-red-700 border border-red-500/20"
                }`}
              >
                <span className="text-base leading-none">
                  {r.signed ? "✓" : r.uploaded ? "○" : "✗"}
                </span>
                <span>{r.meta.label}</span>
                {r.uploaded && !r.signed && (
                  <span className="text-[10px] text-honey ml-auto">unsigned</span>
                )}
              </div>
            ))}
          </div>
          {missingRequired.length > 0 && (
            <p className="text-ink-3 text-[10px] mt-2 italic">
              {missingRequired.filter((r) => !r.uploaded).length} missing ·{" "}
              {missingRequired.filter((r) => r.uploaded && !r.signed).length} unsigned
            </p>
          )}
        </div>

        {/* Upload zone */}
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="text-ink-2 text-xs uppercase tracking-wide mb-1 block">
                Upload as
              </label>
              <select
                value={pendingType}
                onChange={(e) => setPendingType(e.target.value as DocType)}
                className="w-full px-3 py-2 rounded-lg bg-shade border border-edge2 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-cta"
              >
                {CATEGORY_ORDER.map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {(Object.keys(DOC_TYPE_META) as DocType[])
                      .filter((k) => DOC_TYPE_META[k].category === cat)
                      .map((k) => (
                        <option key={k} value={k}>
                          {DOC_TYPE_META[k].emoji} {DOC_TYPE_META[k].label}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            disabled={uploading}
            className={`px-4 py-6 rounded-lg border-2 border-dashed transition-colors text-sm flex flex-col items-center justify-center gap-1 ${
              dragOver
                ? "bg-info/10 border-info/50 text-info"
                : uploading
                  ? "bg-shade border-edge2 text-ink-3"
                  : "bg-shade border-edge2 text-ink-2 hover:border-edge2 hover:bg-shade/60"
            }`}
          >
            {uploading ? (
              <>
                <Spinner />
                <span>Uploading {progress!.done}/{progress!.total}…</span>
              </>
            ) : (
              <>
                <span className="text-2xl">📎</span>
                <span>Click to choose files or drag &amp; drop</span>
                <span className="text-ink-3 text-xs">
                  PDFs, images, docs — any size
                </span>
              </>
            )}
          </button>
          {error && (
            <p className="text-red-700 text-xs whitespace-pre-line">{error}</p>
          )}
        </div>

        {/* Documents grouped by category */}
        {hasDocs ? (
          <div className="flex flex-col gap-4">
            {CATEGORY_ORDER.map((cat) => {
              const docs = docsByCategory[cat];
              if (docs.length === 0) return null;
              return (
                <div key={cat}>
                  <p className="text-ink-2 text-xs uppercase tracking-wide font-semibold mb-2">
                    {cat}
                  </p>
                  <div className="flex flex-col gap-2">
                    {docs.map((doc) => (
                      <DocRow
                        key={doc.id}
                        doc={doc}
                        jobId={jobId}
                        onPreview={(url, mime, filename) =>
                          setPreviewing({ url, mime, filename })
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-ink-3 text-sm italic text-center py-3">
            No documents yet. Upload AOB, Direction to Pay, and customer authorization first.
          </p>
        )}
      </div>

      {/* Preview lightbox */}
      {previewing && (
        <PreviewModal
          url={previewing.url}
          mime={previewing.mime}
          filename={previewing.filename}
          onClose={() => setPreviewing(null)}
        />
      )}
    </>
  );
}

function DocRow({
  doc,
  jobId,
  onPreview,
}: {
  doc: JobDocument;
  jobId: string;
  onPreview: (url: string, mime: string, filename: string) => void;
}) {
  const meta = docTypeMeta(doc.doc_type);
  const previewType = isPreviewable(doc.mime_type);
  const [pending, startTransition] = useTransition();
  const [signing, setSigning] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  async function handlePreview() {
    if (!previewType) return;
    const url = await getDocumentSignedUrl(doc.storage_path, 60 * 10);
    if (url) onPreview(url, doc.mime_type ?? "", doc.filename);
  }

  async function handleDownload() {
    const url = await getDocumentSignedUrl(doc.storage_path, 60);
    if (url) window.open(url, "_blank");
  }

  async function handleShare() {
    const res = await getShareLink(doc.id);
    if (res.error || !res.url) return alert(res.error ?? "Failed");
    setShareUrl(res.url);
    try {
      await navigator.clipboard.writeText(res.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {}
  }

  function handleDelete() {
    if (!confirm(`Delete "${doc.filename}"? This cannot be undone.`)) return;
    startTransition(async () => {
      await deleteJobDocument(doc.id, jobId);
    });
  }

  function handleSign() {
    if (!signerName.trim()) return;
    startTransition(async () => {
      const res = await markDocumentSigned(doc.id, signerName, jobId);
      if (!res.error) {
        setSigning(false);
        setSignerName("");
      }
    });
  }

  function handleUnsign() {
    if (!confirm("Mark as unsigned?")) return;
    startTransition(async () => {
      await unmarkDocumentSigned(doc.id, jobId);
    });
  }

  return (
    <div className="bg-tint border border-edge2 rounded-lg p-3 hover:bg-shade/60 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span className="text-xl leading-none mt-0.5">{meta.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-ink text-sm font-medium truncate">
                {doc.filename}
              </p>
              {meta.trackSignature && (
                doc.signed ? (
                  <span className="px-2 py-0.5 bg-pine/10 text-pine text-[10px] rounded font-semibold uppercase tracking-wider">
                    ✓ Signed
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-honey/10 text-honey text-[10px] rounded font-semibold uppercase tracking-wider">
                    Unsigned
                  </span>
                )
              )}
            </div>
            <p className="text-ink-3 text-xs mt-0.5">
              {meta.label} · {formatBytes(doc.size_bytes)} ·{" "}
              {new Date(doc.created_at).toLocaleDateString()}
              {doc.signed && doc.signed_by_name && (
                <> · signed by <span className="text-pine">{doc.signed_by_name}</span></>
              )}
            </p>
            {doc.notes && (
              <p className="text-ink-2 text-xs italic mt-1">{doc.notes}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {previewType && (
            <button
              onClick={handlePreview}
              className="text-ink-2 hover:text-info-deep text-xs px-2 py-1"
              title="Preview"
            >
              👁 view
            </button>
          )}
          <button
            onClick={handleDownload}
            className="text-ink-2 hover:text-info-deep text-xs px-2 py-1"
            title="Download"
          >
            ⬇ dl
          </button>
          <button
            onClick={handleShare}
            className="text-ink-2 hover:text-info-deep text-xs px-2 py-1"
            title="Generate 7-day shareable link"
          >
            {shareCopied ? "✓ copied" : "🔗 share"}
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="text-ink-3 hover:text-red-700 text-xs px-2 py-1"
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Signature row */}
      {meta.trackSignature && (
        <div className="mt-2 pt-2 border-t border-edge2/40">
          {doc.signed ? (
            <button
              onClick={handleUnsign}
              disabled={pending}
              className="text-ink-3 hover:text-red-700 text-[10px]"
            >
              Unmark signed
            </button>
          ) : signing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Signer's name"
                className="flex-1 px-2 py-1 bg-card border border-edge2 rounded text-ink text-xs focus:outline-none focus:ring-1 focus:ring-cta"
                autoFocus
              />
              <button
                onClick={handleSign}
                disabled={pending}
                className="px-2 py-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs rounded"
              >
                {pending ? "…" : "Confirm"}
              </button>
              <button
                onClick={() => {
                  setSigning(false);
                  setSignerName("");
                }}
                className="text-ink-3 hover:text-ink-2 text-xs"
              >
                cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSigning(true)}
              className="text-info hover:text-info-deep text-[10px] font-medium"
            >
              ✍ Mark as signed
            </button>
          )}
        </div>
      )}

      {shareUrl && shareCopied && (
        <p className="mt-2 text-pine text-[10px]">
          ✓ 7-day shareable link copied to clipboard
        </p>
      )}
    </div>
  );
}

function PreviewModal({
  url,
  mime,
  filename,
  onClose,
}: {
  url: string;
  mime: string;
  filename: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 cursor-zoom-out"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card rounded-xl p-3 max-w-5xl w-full max-h-[90vh] flex flex-col cursor-default"
      >
        <div className="flex items-center justify-between px-2 pb-2 border-b border-edge2">
          <p className="text-ink text-sm truncate">{filename}</p>
          <button
            onClick={onClose}
            className="text-ink-2 hover:text-ink text-lg px-2"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-auto mt-2">
          {mime === "application/pdf" ? (
            <iframe src={url} className="w-full h-[80vh] rounded" />
          ) : mime.startsWith("image/") ? (
            <img
              src={url}
              alt={filename}
              className="max-w-full max-h-[80vh] mx-auto"
            />
          ) : (
            <p className="text-ink-3 text-sm text-center py-10">
              Can't preview this file type. Use Download instead.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
