import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Send, ChevronRight, AlertCircle } from "lucide-react";
import type { ChatSession } from "@google/generative-ai";
import mascot from "@/assets/edubuddy-mascot.png";
import type { Level } from "./Onboarding";
import { createTutorChat } from "@/services/gemini";

type Message = {
  id: number;
  role: "user" | "ai";
  text: string;
};

const WELCOME: Record<Level, string> = {
  Beginner:
    "Olá! 👋 Eu sou o EduBuddy, seu tutor de inglês! I'm happy (estou feliz) to practice with you! O que você quer aprender (learn) hoje?",
  Intermediate:
    "Hey there! 👋 I'm EduBuddy, your English practice buddy. I'm here to help you build confidence and fluency. What would you like to chat about today?",
  Advanced:
    "Hey! 👋 Great to have you here. I'm EduBuddy — think of me as your language sparring partner. No topic is off-limits. What's on your mind?",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function TypingDots() {
  return (
    <span className="flex items-center gap-0.5 py-0.5">
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
      <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
    </span>
  );
}

export function MyTutor({
  name,
  level,
  onEditLevel,
}: {
  name: string;
  level: Level;
  onEditLevel: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const chatRef = useRef<ChatSession | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      chatRef.current = createTutorChat(level);
      setApiError(null);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Failed to initialize tutor.");
      chatRef.current = null;
    }
    setMessages([{ id: 0, role: "ai", text: WELCOME[level] }]);
  }, [level]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || isStreaming || !chatRef.current) return;

    setDraft("");
    inputRef.current?.focus();

    const userMsg: Message = { id: Date.now(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const aiId = Date.now() + 1;
    setMessages((prev) => [...prev, { id: aiId, role: "ai", text: "" }]);

    try {
      const result = await chatRef.current.sendMessageStream(text);
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        setMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, text: m.text + chunkText } : m)),
        );
      }
      // Await the full response to surface any finish-reason errors (e.g. safety blocks).
      await result.response;
    } catch (err) {
      console.error("[EduBuddy] Gemini error:", err);
      const raw = err instanceof Error ? err.message : String(err);
      const isQuotaError =
        raw.includes("429") ||
        raw.toLowerCase().includes("quota exceeded") ||
        raw.toLowerCase().includes("resourceexhausted");
      const message = isQuotaError
        ? "Olá! 😴 Eu estou um pouco cansado agora e vou tirar um cochilo. Amanhã nós conversamos mais e continuamos praticando, combinado?"
        : `⚠️ ${raw}`;
      setMessages((prev) =>
        prev.map((m) => (m.id === aiId ? { ...m, text: message } : m)),
      );
    } finally {
      setIsStreaming(false);
    }
  }, [draft, isStreaming]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 px-6 pt-10 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-foreground">
              {greeting()}, {name}!
            </h1>
            <button
              onClick={onEditLevel}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-brand-blue-soft px-3 py-1 text-xs font-semibold text-brand-blue transition-colors hover:bg-brand-blue/10"
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

      {/* API key error banner */}
      {apiError && (
        <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-xs text-destructive ring-1 ring-destructive/20">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="flex flex-col gap-3 py-2">
          {messages.map((msg) =>
            msg.role === "user" ? (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-brand-green px-4 py-3 text-sm leading-relaxed text-primary-foreground shadow-sm">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div key={msg.id} className="flex items-end gap-2">
                <div className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-blue-soft ring-1 ring-brand-blue/20">
                  <img
                    src={mascot}
                    alt="EduBuddy"
                    className="size-6 object-contain"
                  />
                </div>
                <div className="max-w-[82%] rounded-2xl rounded-bl-sm bg-surface px-4 py-3 text-sm leading-relaxed text-foreground ring-1 ring-border shadow-sm">
                  {msg.text === "" ? <TypingDots /> : msg.text}
                </div>
              </div>
            ),
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input bar */}
      <div className="sticky bottom-16 z-10 shrink-0 border-t border-border bg-surface/95 px-3 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            aria-label="Upload textbook photo"
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-blue-soft text-brand-blue transition-colors hover:bg-brand-blue/15"
          >
            <Camera className="size-5" />
          </button>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isStreaming || !!apiError}
            placeholder={apiError ? "API key missing…" : "Type your message…"}
            className="h-11 min-w-0 flex-1 rounded-full bg-muted px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-green/30 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!draft.trim() || isStreaming || !!apiError}
            aria-label="Send message"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-green text-primary-foreground shadow-md shadow-brand-green/25 ring-4 ring-brand-green/15 transition-all enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            <Send className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
