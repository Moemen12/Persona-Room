import { LoaderCircle, Radio, Sparkles } from "lucide-react";

export function LoadingScreen() {
  return (
    <main className="persona-shell flex items-center justify-center">
      <div className="ambient-orb ambient-orb--violet" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--lavender" aria-hidden="true" />

      <div className="relative z-10 grid text-center gap-4 max-w-[360px] p-8 rounded-[30px] border border-[var(--line)] bg-[var(--surface)] backdrop-blur-md shadow-[var(--shadow)]">
        <div className="mx-auto grid w-[48px] h-[48px] place-items-center rounded-2xl text-[var(--violet-bright)] border border-[var(--line-strong)] bg-[rgba(124,76,222,0.17)] shadow-[0_0_32px_rgba(138,88,246,0.25)]">
          <Sparkles aria-hidden="true" size={22} />
        </div>
        <div className="grid gap-1">
          <span className="eyebrow justify-center">
            <Radio aria-hidden="true" size={14} />
            <span>PERSONA ROOM</span>
          </span>
          <h2 className="text-white text-xl font-bold tracking-tight">Tuning Frequencies...</h2>
          <p className="text-[var(--muted)] text-sm leading-relaxed">
            Establishing a secure digital connection to the studio.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 mt-2 text-[var(--violet-bright)] text-xs font-semibold">
          <LoaderCircle aria-hidden="true" size={16} className="spin" />
          <span>Synchronizing memory...</span>
        </div>
      </div>
    </main>
  );
}
