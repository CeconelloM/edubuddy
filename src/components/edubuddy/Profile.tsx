import { Flame, Settings, Bell, LogOut } from "lucide-react";
import { format } from "date-fns";
import type { Level } from "./Onboarding";

const LEVELS: Level[] = ["Beginner", "Intermediate", "Advanced"];

export function Profile({
  name,
  level,
  onLevelChange,
  onLogout,
  dailyGoal,
  messagesSentToday,
  currentStreak,
  createdAt,
}: {
  name: string;
  level: Level;
  onLevelChange: (l: Level) => void;
  onLogout: () => void;
  dailyGoal: number;
  messagesSentToday: number;
  currentStreak: number;
  createdAt: string;
}) {
  const pct = dailyGoal > 0 ? Math.min(100, Math.round((messagesSentToday / dailyGoal) * 100)) : 0;
  const goalMet = messagesSentToday >= dailyGoal;
  const r = 46;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;

  const memberSince = format(new Date(createdAt), "MMMM yyyy");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="px-6 pt-10 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
      </header>

      <div className="flex-1 space-y-6 px-6 pb-8">
        {/* Avatar card */}
        <div className="flex items-center gap-4 rounded-3xl bg-surface p-5 ring-1 ring-border">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-green-soft text-xl font-bold text-brand-green ring-2 ring-brand-green/20">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Student</p>
            <h2 className="truncate text-lg font-semibold text-foreground">{name}</h2>
            <p className="truncate text-xs text-muted-foreground">Member since {memberSince}</p>
          </div>
        </div>

        {/* Learning level */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Learning Level</h3>
          <div className="space-y-1 rounded-2xl bg-surface p-2 ring-1 ring-border">
            {LEVELS.map((l) => {
              const active = l === level;
              return (
                <button
                  key={l}
                  onClick={() => onLevelChange(l)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition-colors ${
                    active ? "bg-brand-green-soft" : "hover:bg-muted"
                  }`}
                >
                  <span className={`text-sm ${active ? "font-semibold text-brand-green" : "text-foreground"}`}>
                    {l}
                  </span>
                  <span
                    className={`grid size-5 place-items-center rounded-full border-2 ${
                      active ? "border-brand-green" : "border-border"
                    }`}
                  >
                    {active && <span className="size-2.5 rounded-full bg-brand-green" />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Daily goal */}
        <section>
          <h3 className="mb-3 text-sm font-semibold text-foreground">Daily Goal</h3>
          <div className="flex items-center gap-5 rounded-3xl bg-surface p-6 ring-1 ring-border">
            {/* Progress ring */}
            <div className="relative grid size-28 shrink-0 place-items-center">
              <svg viewBox="0 0 100 100" className="size-28 -rotate-90">
                <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="9" />
                <circle
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke={goalMet ? "var(--color-brand-green)" : "var(--color-brand-orange)"}
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${c}`}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <p className="text-xl font-bold text-foreground">{pct}%</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">today</p>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0">
              <p
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  goalMet
                    ? "bg-brand-green-soft text-brand-green"
                    : "bg-brand-orange-soft text-brand-orange"
                }`}
              >
                <Flame className="size-3.5" />
                {currentStreak}-day streak
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                Daily Goal: {dailyGoal} messages
              </p>
              <p className="text-xs text-muted-foreground text-pretty">
                {goalMet
                  ? `Goal complete! ${messagesSentToday} messages sent 🎉`
                  : `${messagesSentToday} of ${dailyGoal} messages — keep going!`}
              </p>
            </div>
          </div>
        </section>

        {/* Settings */}
        <section className="space-y-1 rounded-2xl bg-surface p-2 ring-1 ring-border">
          {[
            { Icon: Bell, label: "Notifications" },
            { Icon: Settings, label: "App settings" },
          ].map(({ Icon, label }) => (
            <button
              key={label}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-foreground hover:bg-muted"
            >
              <Icon className="size-4 text-muted-foreground" />
              {label}
            </button>
          ))}
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-red-500 hover:bg-red-50"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </section>
      </div>
    </div>
  );
}
