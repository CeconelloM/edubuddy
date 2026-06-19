import { Bot, MessagesSquare, User, BookOpen } from "lucide-react";

export type Tab = "tutor" | "community" | "library" | "profile";

const TABS: { id: Tab; label: string; Icon: typeof Bot }[] = [
  { id: "tutor", label: "My Tutor", Icon: Bot },
  { id: "community", label: "Community", Icon: MessagesSquare },
  { id: "library", label: "Library", Icon: BookOpen },
  { id: "profile", label: "Profile", Icon: User },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-surface/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors"
            >
              <span
                className={`grid size-9 place-items-center rounded-xl transition-all ${
                  isActive ? "bg-brand-green-soft text-brand-green" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" strokeWidth={2.2} />
              </span>
              <span
                className={`text-[11px] font-medium ${
                  isActive ? "text-brand-green" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
