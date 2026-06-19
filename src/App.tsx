import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import { Onboarding, type Level } from "@/components/edubuddy/Onboarding";
import { LoginScreen } from "@/components/edubuddy/LoginScreen";
import { NicknameScreen } from "@/components/edubuddy/NicknameScreen";
import { MyTutor } from "@/components/edubuddy/MyTutor";
import { Community } from "@/components/edubuddy/Community";
import { Library } from "@/components/edubuddy/Library";
import { Profile } from "@/components/edubuddy/Profile";
import { BottomNav, type Tab } from "@/components/edubuddy/BottomNav";

type AuthStatus = "loading" | "unauthenticated" | "needs_nickname" | "needs_level" | "ready";

export type ProfileState = {
  userId: string;
  nickname: string;
  englishLevel: Level;
  dailyGoal: number;
  messagesSentToday: number;
  currentStreak: number;
  lastMessageDate: string | null;
  createdAt: string;
};

const PROFILE_SELECT =
  "nickname, english_level, daily_goal, messages_sent_today, current_streak, last_message_date, created_at";

export default function App() {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [tab, setTab] = useState<Tab>("tutor");

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;

      if (!session) {
        sessionStorage.removeItem("edubuddy_chat_session");
        setUser(null);
        setProfile(null);
        setStatus("unauthenticated");
        return;
      }

      setUser(session.user);

      const { data } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", session.user.id)
        .single();

      if (!data?.nickname) {
        setStatus("needs_nickname");
        return;
      }

      setProfile({
        userId: session.user.id,
        nickname: data.nickname,
        englishLevel: (data.english_level as Level) ?? "Beginner",
        dailyGoal: data.daily_goal ?? 5,
        messagesSentToday: data.messages_sent_today ?? 0,
        currentStreak: data.current_streak ?? 0,
        lastMessageDate: data.last_message_date ?? null,
        createdAt: data.created_at,
      });
      setStatus(data.english_level ? "ready" : "needs_level");
    });

    return () => subscription.unsubscribe();
  }, []);

  // After nickname is saved, fetch the rest of the profile from DB
  async function handleNicknameComplete(nick: string) {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("daily_goal, messages_sent_today, current_streak, last_message_date, created_at")
      .eq("id", user.id)
      .single();

    setProfile({
      userId: user.id,
      nickname: nick,
      englishLevel: "Beginner",
      dailyGoal: data?.daily_goal ?? 5,
      messagesSentToday: data?.messages_sent_today ?? 0,
      currentStreak: data?.current_streak ?? 0,
      lastMessageDate: data?.last_message_date ?? null,
      createdAt: data?.created_at ?? new Date().toISOString(),
    });
    setStatus("needs_level");
  }

  async function handleLevelComplete(l: Level) {
    if (!user) return;
    await supabase.from("profiles").update({ english_level: l }).eq("id", user.id);
    setProfile((prev) => (prev ? { ...prev, englishLevel: l } : null));
    setStatus("ready");
  }

  async function handleLevelChange(l: Level) {
    if (!user) return;
    await supabase.from("profiles").update({ english_level: l }).eq("id", user.id);
    setProfile((prev) => (prev ? { ...prev, englishLevel: l } : null));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  // Called by MyTutor after each successful AI response.
  // Returns true the first time the daily goal is crossed (triggers the banner).
  async function handleMessageSent(): Promise<boolean> {
    if (!user || !profile) return false;

    const today = new Date().toISOString().split("T")[0];
    const isNewDay = profile.lastMessageDate !== today;
    const prevCount = isNewDay ? 0 : profile.messagesSentToday;
    const newCount = prevCount + 1;

    const goalJustReached = prevCount < profile.dailyGoal && newCount >= profile.dailyGoal;

    let newStreak = profile.currentStreak;
    if (goalJustReached) {
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
      newStreak = profile.lastMessageDate === yesterday ? profile.currentStreak + 1 : 1;
    }

    const updates: Record<string, unknown> = {
      messages_sent_today: newCount,
      last_message_date: today,
    };
    if (goalJustReached) updates.current_streak = newStreak;

    await supabase.from("profiles").update(updates).eq("id", user.id);

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            messagesSentToday: newCount,
            lastMessageDate: today,
            ...(goalJustReached && { currentStreak: newStreak }),
          }
        : null,
    );

    return goalJustReached;
  }

  if (status === "loading") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-[3px] border-brand-green/20 border-t-brand-green" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-background shadow-xl ring-1 ring-border/50">
      {status === "unauthenticated" && <LoginScreen />}

      {status === "needs_nickname" && user && (
        <NicknameScreen userId={user.id} onComplete={handleNicknameComplete} />
      )}

      {status === "needs_level" && <Onboarding onComplete={handleLevelComplete} />}

      {status === "ready" && profile && (
        <div className="flex min-h-dvh flex-col">
          <div className="flex-1">
            {tab === "tutor" && (
              <MyTutor
                name={profile.nickname}
                level={profile.englishLevel}
                onEditLevel={() => setTab("profile")}
                onMessageSent={handleMessageSent}
              />
            )}
            {tab === "community" && (
              <Community
                userId={profile.userId}
                nickname={profile.nickname}
                onMessageSent={handleMessageSent}
              />
            )}
            {tab === "library" && <Library />}
            {tab === "profile" && (
              <Profile
                name={profile.nickname}
                level={profile.englishLevel}
                onLevelChange={handleLevelChange}
                onLogout={handleLogout}
                dailyGoal={profile.dailyGoal}
                messagesSentToday={profile.messagesSentToday}
                currentStreak={profile.currentStreak}
                createdAt={profile.createdAt}
              />
            )}
          </div>
          <BottomNav active={tab} onChange={setTab} />
        </div>
      )}
    </div>
  );
}
