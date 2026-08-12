import { Sparkles } from "lucide-react";

export function LoadingScreen() {
  return (
    <main className="persona-shell flex flex-col items-center justify-center text-center overflow-hidden">
      <div className="ambient-orb ambient-orb--violet animate-pulse" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--lavender animate-pulse" aria-hidden="true" />

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-md px-6">
        <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-[rgba(138,88,246,0.15)] border border-[rgba(255,255,255,0.1)] shadow-[0_0_50px_rgba(138,88,246,0.3)] animate-bounce">
          <div className="absolute inset-0 rounded-full border border-[var(--violet-bright)] opacity-50 animate-ping" />
          <Sparkles className="text-[var(--lavender)]" size={32} />
        </div>

        <div className="grid gap-2">
          <span className="eyebrow justify-center tracking-widest text-[var(--lavender)]">
            PERSONA ROOM
          </span>
          <h2 className="text-white text-3xl font-bold tracking-tight">
            We’ve been waiting for you...
          </h2>
          <p className="text-[var(--muted)] text-sm max-w-xs mx-auto leading-relaxed">
            Lighting the candles, checking the atmosphere, and getting everything ready for your conversation.
          </p>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <span className="w-2 h-2 rounded-full bg-[var(--violet-bright)] animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-2 h-2 rounded-full bg-[var(--violet-bright)] animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-2 h-2 rounded-full bg-[var(--violet-bright)] animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </main>
  );
}
