import { useState } from "react";
import { Camera, Mic, ChevronRight } from "lucide-react";
import mascot from "@/assets/edubuddy-mascot.png";
import type { Level } from "./Onboarding";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function MyTutor({ name, level, onEditLevel }: { name: string; level: Level; onEditLevel: () => void }) {
  const [draft, setDraft] = useState("");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="px-6 pt-10 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-foreground">
              {greeting()}, {name}!
            </h1>
            <button
              onClick={onEditLevel}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-blue-soft px-3 py-1 text-xs font-semibold text-brand-blue"
            >
              Level: {level}
              <ChevronRight className="size-3" strokeWidth={2.5} />
            </button>
          </div>
          <div className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-orange-soft text-sm font-bold text-brand-orange ring-1 ring-brand-orange/20">
            {name.charAt(0)}
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 pb-4">
        <div className="mx-auto mt-2 flex flex-col items-center">
          <div className="relative">
            <div className="grid size-36 place-items-center rounded-full bg-brand-blue-soft ring-1 ring-brand-blue/20">
              <img src={mascot} alt="EduBuddy AI tutor" width={120} height={120} className="size-32 object-contain" />
            </div>
            <span className="absolute -bottom-1 right-1 rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold text-brand-green shadow-sm ring-1 ring-border">
              ● Online
            </span>
          </div>
          <p className="mt-5 max-w-[28ch] text-center text-sm text-muted-foreground">
            Ready when you are — ask me anything, snap a textbook page, or hold the mic to speak.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent conversations
          </p>
          <button className="flex w-full items-center justify-between rounded-2xl bg-surface p-4 text-left ring-1 ring-border">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Breakfast vocabulary</p>
              <p className="truncate text-xs text-muted-foreground">"I had eggs and coffee this morning…"</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
          <button className="flex w-full items-center justify-between rounded-2xl bg-surface p-4 text-left ring-1 ring-border">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">Past simple practice</p>
              <p className="truncate text-xs text-muted-foreground">"Yesterday I went to the park…"</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </main>

      <div className="sticky bottom-16 z-10 border-t border-border bg-surface/95 p-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            aria-label="Upload textbook photo"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-blue-soft text-brand-blue"
          >
            <Camera className="size-5" />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type your message..."
            className="h-11 min-w-0 flex-1 rounded-full bg-muted px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />
          <button
            aria-label="Hold to record voice note"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-orange text-accent-foreground shadow-lg shadow-brand-orange/30 ring-4 ring-brand-orange/15"
          >
            <Mic className="size-5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
