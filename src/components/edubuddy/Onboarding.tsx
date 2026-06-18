import { useState } from "react";
import { Check } from "lucide-react";
import mascot from "@/assets/edubuddy-mascot.png";

export type Level = "Beginner" | "Intermediate" | "Advanced";

const LEVELS: { id: Level; desc: string }[] = [
  { id: "Beginner", desc: "I'm just starting / 70% PT - 30% EN" },
  { id: "Intermediate", desc: "I can understand, but need practice / 100% Simple EN" },
  { id: "Advanced", desc: "I want to sound like a native / 100% Fluent EN" },
];

export function Onboarding({ onComplete }: { onComplete: (l: Level) => void }) {
  const [selected, setSelected] = useState<Level | null>(null);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex-1 px-6 pt-10 pb-4">
        <div className="mx-auto mb-6 grid size-28 place-items-center rounded-3xl bg-brand-green-soft ring-1 ring-brand-green/20">
          <img src={mascot} alt="EduBuddy mascot" width={96} height={96} className="size-24 object-contain" />
        </div>
        <h1 className="text-center text-3xl font-semibold text-foreground text-balance">
          Welcome to <span className="text-brand-green">EduBuddy</span>
        </h1>
        <p className="mx-auto mt-2 max-w-[32ch] text-center text-base text-muted-foreground text-pretty">
          Your English practice partner — let's start with where you are today.
        </p>

        <div className="mt-10 space-y-3">
          <p className="mb-2 text-sm font-medium text-muted-foreground">What is your English level today?</p>
          {LEVELS.map((lvl) => {
            const active = selected === lvl.id;
            return (
              <button
                key={lvl.id}
                onClick={() => setSelected(lvl.id)}
                className={`w-full rounded-2xl p-4 text-left ring-1 transition-all ${
                  active
                    ? "bg-brand-green-soft ring-brand-green/40"
                    : "bg-surface ring-border hover:ring-brand-green/30"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`font-semibold ${active ? "text-brand-green" : "text-foreground"}`}>
                    {lvl.id}
                  </span>
                  <span
                    className={`grid size-5 place-items-center rounded-full border-2 transition-all ${
                      active ? "border-brand-green bg-brand-green" : "border-border"
                    }`}
                  >
                    {active && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{lvl.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-background via-background to-transparent p-6 pt-8">
        <button
          disabled={!selected}
          onClick={() => selected && onComplete(selected)}
          className="w-full rounded-2xl bg-brand-green py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-brand-green/20 transition-all enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Start Chatting
        </button>
      </div>
    </div>
  );
}
