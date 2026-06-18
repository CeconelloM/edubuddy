import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Onboarding, type Level } from "@/components/edubuddy/Onboarding";
import { MyTutor } from "@/components/edubuddy/MyTutor";
import { Community } from "@/components/edubuddy/Community";
import { Profile } from "@/components/edubuddy/Profile";
import { BottomNav, type Tab } from "@/components/edubuddy/BottomNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduBuddy — Your English practice partner" },
      { name: "description", content: "Practice English daily with a friendly AI tutor and a global community." },
      { property: "og:title", content: "EduBuddy" },
      { property: "og:description", content: "Practice English daily with a friendly AI tutor and a global community." },
    ],
  }),
  component: App,
});

function App() {
  const [level, setLevel] = useState<Level | null>(null);
  const [tab, setTab] = useState<Tab>("tutor");
  const name = "Alex";

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-background shadow-xl ring-1 ring-border/50">
      {!level ? (
        <Onboarding onComplete={setLevel} />
      ) : (
        <div className="flex min-h-dvh flex-col">
          <div className="flex-1">
            {tab === "tutor" && (
              <MyTutor name={name} level={level} onEditLevel={() => setTab("profile")} />
            )}
            {tab === "community" && <Community />}
            {tab === "profile" && (
              <Profile name={name} level={level} onLevelChange={setLevel} />
            )}
          </div>
          <BottomNav active={tab} onChange={setTab} />
        </div>
      )}
    </div>
  );
}
