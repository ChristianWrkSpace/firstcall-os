"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExpense } from "@/app/actions/expenses";

export default function DeleteButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function onDelete() {
    if (!confirm("Delete this expense entry?")) return;
    start(async () => {
      await deleteExpense(id);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={pending}
      className="text-zinc-500 hover:text-red-400 text-xs disabled:opacity-50"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
