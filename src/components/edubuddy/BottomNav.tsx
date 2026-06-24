import { Bot, MessagesSquare, User, BookOpen, ShieldCheck } from "lucide-react";

export type Tab = "tutor" | "community" | "library" | "profile" | "admin";

const BASE_TABS: { id: Tab; label: string; Icon: typeof Bot }[] = [
  { id: "tutor",     label: "My Tutor",  Icon: Bot },
  { id: "community", label: "Community", Icon: MessagesSquare },
  { id: "library",   label: "Library",   Icon: BookOpen },
  { id: "profile",   label: "Profile",   Icon: User },
];

const STAFF_TAB = { id: "admin" as Tab, label: "Admin", Icon: ShieldCheck };

export function BottomNav({
  active,
  onChange,
  userRole = "user",
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  userRole?: string;
}) {
  const isStaff = userRole === "admin" || userRole === "teacher";
  const tabs = isStaff ? [...BASE_TABS, STAFF_TAB] : BASE_TABS;

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-surface/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {tabs.map(({ id, label, Icon }) => {
          const isActive   = active === id;
          const isAdminTab = id === "admin";
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2 transition-colors"
            >
              <span
                className={`grid size-9 place-items-center rounded-xl transition-all ${
                  isActive
                    ? isAdminTab
                      ? "bg-amber-100 text-amber-600"
                      : "bg-brand-green-soft text-brand-green"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="size-5" strokeWidth={2.2} />
              </span>
              <span
                className={`text-[11px] font-medium ${
                  isActive
                    ? isAdminTab ? "text-amber-600" : "text-brand-green"
                    : "text-muted-foreground"
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
