import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft, Send, Users, Plus, Clock, Loader2,
  Sparkles, Film, Plane, Coffee, BookOpen, Music, Gamepad2, Globe,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/services/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

type Topic = {
  id: string;
  title: string;
  description: string;
  icon_type: string;
  created_by: string;
  author_nickname: string;
  created_at: string;
};

type TopicMessage = {
  id: string;
  topic_id: string;
  user_id: string;
  author_nickname: string;
  content: string;
  created_at: string;
};

// ─── Icon config ─────────────────────────────────────────────────────────────

const ICON_OPTIONS = [
  { key: "sparkles", Icon: Sparkles, label: "General", tint: "bg-brand-orange-soft text-brand-orange" },
  { key: "film",     Icon: Film,     label: "Movies",  tint: "bg-brand-blue-soft text-brand-blue" },
  { key: "plane",    Icon: Plane,    label: "Travel",  tint: "bg-brand-green-soft text-brand-green" },
  { key: "coffee",   Icon: Coffee,   label: "Casual",  tint: "bg-brand-orange-soft text-brand-orange" },
  { key: "book",     Icon: BookOpen, label: "Study",   tint: "bg-brand-blue-soft text-brand-blue" },
  { key: "music",    Icon: Music,    label: "Music",   tint: "bg-brand-green-soft text-brand-green" },
  { key: "gamepad",  Icon: Gamepad2, label: "Games",   tint: "bg-brand-orange-soft text-brand-orange" },
  { key: "globe",    Icon: Globe,    label: "Culture", tint: "bg-brand-blue-soft text-brand-blue" },
];

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map((o) => [o.key, o]));

function getIcon(iconType: string) {
  return ICON_MAP[iconType] ?? ICON_MAP["sparkles"];
}

// ─── Avatar color — deterministic hash so each nickname always gets the same color ─

const AVATAR_COLORS = [
  "bg-orange-400", "bg-teal-400", "bg-sky-400", "bg-purple-400",
  "bg-pink-400", "bg-emerald-400", "bg-yellow-400", "bg-red-400",
];

function avatarColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Main component ──────────────────────────────────────────────────────────

export function Community({
  nickname,
  onMessageSent,
}: {
  userId: string;
  nickname: string;
  onMessageSent: () => Promise<boolean>;
}) {
  // List state
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [openTopic, setOpenTopic] = useState<Topic | null>(null);

  // Chat state
  const [topicMessages, setTopicMessages] = useState<TopicMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", icon_type: "sparkles" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchTopics();
  }, []);

  // Load messages whenever a topic is opened; clear them when closed
  useEffect(() => {
    if (!openTopic) {
      setTopicMessages([]);
      return;
    }
    fetchMessages(openTopic.id);
  }, [openTopic]);

  // Scroll to latest message after list updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [topicMessages]);

  async function fetchTopics() {
    setLoading(true);
    setFetchError(null);
    const { data, error } = await supabase
      .from("topics")
      .select("*")
      .order("created_at", { ascending: false });

    setLoading(false);
    if (error) {
      console.error("[Community] fetch topics error:", error);
      setFetchError("Couldn't load topics. Please try again.");
      return;
    }
    setTopics(data ?? []);
  }

  async function fetchMessages(topicId: string) {
    setMessagesLoading(true);
    const { data, error } = await supabase
      .from("topic_messages")
      .select("*")
      .eq("topic_id", topicId)
      .order("created_at", { ascending: true });

    setMessagesLoading(false);
    if (error) {
      console.error("[Community] fetch messages error:", error);
      return;
    }
    setTopicMessages(data ?? []);
  }

  function closeTopic() {
    setOpenTopic(null);
    setTopicMessages([]);
    setChatDraft("");
  }

  function openModal() {
    setForm({ title: "", description: "", icon_type: "sparkles" });
    setFormError(null);
    setShowModal(true);
  }

  async function handleCreateTopic(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    const description = form.description.trim();
    if (!title) return;

    setSubmitting(true);
    setFormError(null);

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser?.id) {
      setFormError("Session expired. Please log in again.");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("topics").insert({
      title,
      description,
      icon_type: form.icon_type,
      created_by: authUser.id,
      author_nickname: nickname,
    });

    setSubmitting(false);

    if (error) {
      console.error("[Community] insert topic error:", error);
      setFormError("Something went wrong. Please try again.");
      return;
    }

    setShowModal(false);
    await fetchTopics();
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = chatDraft.trim();
    if (!content || sending || !openTopic) return;

    setSending(true);

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser?.id) {
      setSending(false);
      return;
    }

    const { data, error } = await supabase
      .from("topic_messages")
      .insert({
        topic_id: openTopic.id,
        user_id: authUser.id,
        author_nickname: nickname,
        content,
      })
      .select()
      .single();

    setSending(false);

    if (!error && data) {
      setChatDraft("");
      setTopicMessages((prev) => [...prev, data]);
      try {
        await onMessageSent();
      } catch {
        // best-effort: don't block the UI if the goal update fails
      }
    }
  }

  // ── Topic chat view ─────────────────────────────────────────────────────────

  if (openTopic) {
    const { Icon, tint } = getIcon(openTopic.icon_type);
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border bg-surface px-4 pt-10 pb-3">
          <button
            onClick={closeTopic}
            className="grid size-9 place-items-center rounded-full hover:bg-muted"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className={`grid size-9 shrink-0 place-items-center rounded-xl ${tint}`}>
            <Icon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground">{openTopic.title}</h2>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="size-3" /> by {openTopic.author_nickname} · community thread
            </p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-5">
          {/* Loading */}
          {messagesLoading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Loading messages…</p>
            </div>
          )}

          {/* Empty state */}
          {!messagesLoading && topicMessages.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="grid size-14 place-items-center rounded-3xl bg-brand-green-soft">
                <Send className="size-6 text-brand-green" />
              </div>
              <p className="text-sm font-semibold text-foreground">No messages yet.</p>
              <p className="text-xs text-muted-foreground">Start the discussion!</p>
            </div>
          )}

          {/* Messages */}
          {!messagesLoading && topicMessages.length > 0 && (
            <div className="space-y-4">
              {topicMessages.map((msg) => {
                const isOwn = msg.author_nickname === nickname;
                if (isOwn) {
                  return (
                    <div key={msg.id} className="flex justify-end">
                      <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-brand-green px-3 py-2 text-sm leading-relaxed text-primary-foreground">
                        {msg.content}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className="flex gap-3">
                    <div
                      className={`grid size-9 shrink-0 place-items-center rounded-full ${avatarColor(msg.author_nickname)} text-xs font-bold text-white`}
                    >
                      {msg.author_nickname.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-muted-foreground">
                        {msg.author_nickname}
                      </p>
                      <div className="mt-1 inline-block rounded-2xl rounded-tl-sm bg-surface px-3 py-2 text-sm leading-relaxed text-foreground ring-1 ring-border">
                        {msg.content}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Scroll anchor — always at the bottom of main */}
          <div ref={bottomRef} />
        </main>

        <form
          onSubmit={handleSendMessage}
          className="sticky bottom-16 border-t border-border bg-surface p-3"
        >
          <div className="flex items-center gap-2">
            <input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Say something kind…"
              disabled={sending}
              className="h-11 min-w-0 flex-1 rounded-full bg-muted px-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-green/30 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!chatDraft.trim() || sending}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand-green px-4 text-sm font-semibold text-primary-foreground shadow-md shadow-brand-green/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Topics list ─────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="px-6 pt-10 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Community Hub</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Practice together with fellow learners.
              </p>
            </div>
            <button
              onClick={openModal}
              className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-brand-green/20 transition-all hover:brightness-105"
            >
              <Plus className="size-4" />
              New Topic
            </button>
          </div>
        </header>

        <div className="flex-1 px-6 pb-6">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading community topics…</p>
            </div>
          )}

          {/* Error */}
          {!loading && fetchError && (
            <div className="mt-4 rounded-2xl bg-destructive/10 p-6 text-center ring-1 ring-destructive/20">
              <p className="text-sm text-destructive">{fetchError}</p>
              <button
                onClick={fetchTopics}
                className="mt-3 text-sm font-semibold text-brand-green"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !fetchError && topics.length === 0 && (
            <div className="mt-16 flex flex-col items-center gap-3 text-center">
              <div className="grid size-16 place-items-center rounded-3xl bg-brand-green-soft">
                <Sparkles className="size-7 text-brand-green" />
              </div>
              <p className="text-base font-semibold text-foreground">No active topics yet</p>
              <p className="max-w-[26ch] text-sm text-muted-foreground">
                Be the first to start a conversation!
              </p>
              <button
                onClick={openModal}
                className="mt-2 inline-flex items-center gap-1.5 rounded-2xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-brand-green/20"
              >
                <Plus className="size-4" /> New Topic
              </button>
            </div>
          )}

          {/* Topic cards */}
          {!loading && !fetchError && topics.length > 0 && (
            <div className="space-y-3">
              {topics.map((topic) => {
                const { Icon, tint } = getIcon(topic.icon_type);
                return (
                  <button
                    key={topic.id}
                    onClick={() => setOpenTopic(topic)}
                    className="flex w-full items-center gap-4 overflow-hidden rounded-2xl bg-surface p-4 text-left ring-1 ring-border transition-all hover:ring-brand-green/30"
                  >
                    <div className={`grid size-12 shrink-0 place-items-center rounded-xl ${tint}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 block w-full text-sm font-semibold text-foreground">{topic.title}</p>
                      {topic.description ? (
                        <p className="line-clamp-1 block w-full text-xs text-muted-foreground">{topic.description}</p>
                      ) : null}
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/60">
                        by {topic.author_nickname} ·{" "}
                        {formatDistanceToNow(new Date(topic.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Create Topic Modal ──────────────────────────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => !submitting && setShowModal(false)}
        >
          <div
            className="w-full max-w-sm overflow-y-auto rounded-3xl bg-surface shadow-2xl ring-1 ring-border"
            style={{ maxHeight: "90dvh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="mb-5 text-lg font-semibold text-foreground">Create a New Topic</h2>

              <form onSubmit={handleCreateTopic} className="space-y-4">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Topic Name *
                  </label>
                  <input
                    type="text"
                    autoFocus
                    maxLength={45}
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g., Let's talk about gaming!"
                    className="h-11 w-full rounded-2xl bg-muted px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-green/40"
                  />
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Short Description
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Briefly describe what this topic is about…"
                    className="h-11 w-full rounded-2xl bg-muted px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-green/40"
                  />
                </div>

                {/* Icon picker */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Choose an Icon</label>
                  <div className="grid grid-cols-4 gap-2">
                    {ICON_OPTIONS.map(({ key, Icon, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, icon_type: key }))}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[11px] font-medium transition-all ${
                          form.icon_type === key
                            ? "bg-brand-green-soft text-brand-green ring-1 ring-brand-green/30"
                            : "bg-muted text-muted-foreground hover:bg-muted/70"
                        }`}
                      >
                        <Icon className="size-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expiration warning */}
                <div className="flex items-start gap-2.5 rounded-2xl bg-brand-orange-soft px-3 py-3 ring-1 ring-brand-orange/20">
                  <Clock className="mt-0.5 size-4 shrink-0 text-brand-orange" />
                  <p className="text-xs leading-relaxed text-brand-orange">
                    <strong>Note:</strong> Your topic will remain active in the community for
                    exactly <strong>1 week</strong> and will then be automatically archived.
                  </p>
                </div>

                {/* Form error */}
                {formError && (
                  <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-600 ring-1 ring-red-200">
                    {formError}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={submitting}
                    className="flex-1 rounded-2xl bg-muted py-3 text-sm font-medium text-foreground disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !form.title.trim()}
                    className="flex-1 rounded-2xl bg-brand-green py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-brand-green/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    {submitting ? "Saving…" : "Create Topic"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
