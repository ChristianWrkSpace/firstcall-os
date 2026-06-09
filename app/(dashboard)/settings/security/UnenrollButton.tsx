"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unenrollMfa } from "@/app/actions/mfa";

export default function UnenrollButton({ factorId }: { factorId: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();

  function onClick() {
    if (
      !confirm(
        "Remove this authenticator? You'll only have your password protecting the account."
      )
    )
      return;
    start(async () => {
      const res = await unenrollMfa(factorId);
      if (res?.error) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-ink-3 hover:text-red-700 text-xs disabled:opacity-50"
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}
