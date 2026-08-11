import { Compass, Radio, Sparkles } from "lucide-react";
import Link from "next/link";

export function NotFoundScreen() {
  return (
    <main className="persona-shell flex items-center justify-center">
      <div className="ambient-orb ambient-orb--violet" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--lavender" aria-hidden="true" />

      <div className="relative z-10 grid text-center gap-5 max-w-[420px] p-8 rounded-[30px] border border-[var(--line)] bg-[var(--surface)] backdrop-blur-md shadow-[var(--shadow)]">
        <div className="mx-auto grid w-[52px] h-[52px] place-items-center rounded-2xl text-[var(--violet-bright)] border border-[var(--line-strong)] bg-[rgba(124,76,222,0.17)] shadow-[0_0_35px_rgba(138,88,246,0.25)]">
          <Compass aria-hidden="true" size={24} />
        </div>
        <div className="grid gap-1.5">
          <span className="eyebrow justify-center">
            <Sparkles aria-hidden="true" size={13} />
            <span>FREQUENCY LOST</span>
          </span>
          <h2 className="text-white text-2xl font-bold tracking-tight">Room not found</h2>
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            The studio frequency you are trying to tune into does not exist or has dissolved into static.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 mt-2">
          <Link
            className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-white text-xs font-bold tracking-wider uppercase transition-all duration-180 bg-gradient-to-r from-[#8550e7] to-[#5730bb] hover:brightness-110 shadow-lg shadow-purple-900/30"
            href="/"
          >
            <Radio aria-hidden="true" size={14} />
            <span>Return to Studio</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
