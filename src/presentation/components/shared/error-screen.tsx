"use client";

import { AlertCircle, RefreshCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

interface ErrorScreenProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorScreen({ error, reset }: ErrorScreenProps) {
  useEffect(() => {
    console.error("Route error boundary caught:", error);
  }, [error]);

  return (
    <main className="persona-shell flex items-center justify-center">
      <div className="ambient-orb ambient-orb--violet" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--lavender" aria-hidden="true" />

      <div className="relative z-10 grid text-center gap-5 max-w-[420px] p-8 rounded-[30px] border border-[rgba(253,164,175,0.3)] bg-[rgba(20,15,43,0.85)] backdrop-blur-md shadow-[var(--shadow)]">
        <div className="mx-auto grid w-[52px] h-[52px] place-items-center rounded-2xl text-[var(--danger)] border border-[rgba(253,164,175,0.4)] bg-[rgba(136,19,55,0.2)] shadow-[0_0_35px_rgba(253,164,175,0.2)]">
          <AlertCircle aria-hidden="true" size={24} />
        </div>
        <div className="grid gap-1.5">
          <span className="eyebrow justify-center text-[var(--danger)]">
            <Sparkles aria-hidden="true" size={13} />
            <span>STATIC INTERFERENCE</span>
          </span>
          <h2 className="text-white text-2xl font-bold tracking-tight">The room hit a snag</h2>
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            {error.message || "An unexpected disturbance interrupted the studio transmission. Please try again."}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 mt-2">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-white text-xs font-bold tracking-wider uppercase transition-all duration-180 bg-gradient-to-r from-[#8550e7] to-[#5730bb] hover:brightness-110 shadow-lg shadow-purple-900/30"
            type="button"
            onClick={reset}
          >
            <RefreshCcw aria-hidden="true" size={14} />
            <span>Reconnect Studio</span>
          </button>
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[var(--lavender)] text-xs font-bold tracking-wider uppercase transition-all duration-180 border border-[var(--line)] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)]"
            href="/"
          >
            Return Home
          </Link>
        </div>
      </div>
    </main>
  );
}
