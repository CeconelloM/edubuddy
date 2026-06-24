import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  BookOpen,
  BookMarked,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Bookmark,
  RotateCcw,
  X,
  Sparkles,
} from "lucide-react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/services/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Book = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  difficulty_level: "beginner" | "intermediate" | "advanced";
  description: string | null;
};

type ChapterMeta = {
  id: string;
  book_id: string;
  chapter_number: number;
  title: string;
};

// ─── Gemini Contextual Translation ───────────────────────────────────────────

function cleanWord(raw: string) {
  return raw.replace(/[^a-zA-ZÀ-ÿ'-]/g, "").toLowerCase();
}

async function fetchGeminiTranslation(word: string, context: string) {
  const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();
  if (!apiKey) throw new Error("VITE_GEMINI_API_KEY not defined");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    // SDK serializes responseMimeType correctly — raw fetch was broken because
    // the REST API expects snake_case (response_mime_type), not camelCase.
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `You are an English teacher for Brazilian Portuguese-speaking students.

The student clicked on the word: "${word}"
Full paragraph context: "${context.slice(0, 500)}"

Return ONLY a valid JSON object with exactly these four fields:
{
  "translation": "Portuguese translation of this word in this exact context (avoid wrong literal translations)",
  "explanation": "Very short pedagogical note in Portuguese (max 12 words) explaining why it carries this meaning here",
  "example": "Simple English sentence using the word naturally",
  "example_pt": "Portuguese translation of that example sentence"
}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as {
    translation: string;
    explanation: string;
    example: string;
    example_pt: string;
  };
}

// ─── Book Cover ───────────────────────────────────────────────────────────────

const COVER_GRADIENTS = [
  "from-blue-400 to-indigo-600",
  "from-emerald-400 to-teal-600",
  "from-purple-400 to-pink-600",
  "from-orange-400 to-red-500",
  "from-yellow-400 to-orange-500",
  "from-cyan-400 to-blue-500",
];

function BookCover({ url, title }: { url: string | null; title: string }) {
  const [imgError, setImgError] = useState(false);
  const idx = title.charCodeAt(0) % COVER_GRADIENTS.length;

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt={title}
        className="h-full w-full object-cover"
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${COVER_GRADIENTS[idx]}`}
    >
      <BookOpen className="size-8 text-white/80" />
    </div>
  );
}

// ─── Reading Progress — DB helpers ────────────────────────────────────────────

async function fetchChapterProgress(userId: string, chapterId: string) {
  const { data } = await supabase
    .from("user_reading_progress")
    .select("last_paragraph_index, is_completed")
    .eq("user_id", userId)
    .eq("chapter_id", chapterId)
    .maybeSingle();
  return {
    last_paragraph_index: data?.last_paragraph_index ?? 0,
    is_completed: data?.is_completed ?? false,
  };
}

async function saveChapterProgress(
  userId: string,
  chapterId: string,
  bookId: string,
  patch: { last_paragraph_index?: number; is_completed?: boolean },
) {
  await supabase.from("user_reading_progress").upsert(
    { user_id: userId, chapter_id: chapterId, book_id: bookId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: "user_id,chapter_id" },
  );
}

async function fetchCompletedChapterIds(userId: string, bookId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from("user_reading_progress")
    .select("chapter_id")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .eq("is_completed", true);
  return new Set((data ?? []).map((r) => r.chapter_id as string));
}

// ─── Reading View ─────────────────────────────────────────────────────────────

type Tooltip = {
  word: string;
  x: number;
  y: number;
  yBottom: number;
  translation: string | null;
  explanation: string | null;
  example: string | null;
  example_pt: string | null;
  loading: boolean;
  error?: boolean;
};

function ReadingView({
  chapterMeta,
  book,
  userId,
  onClose,
}: {
  chapterMeta: ChapterMeta;
  book: Book;
  userId: string | null;
  onClose: () => void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [activeParagraphIndex, setActiveParagraphIndex] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [savingComplete, setSavingComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const paragraphRefs = useRef<(HTMLDivElement | null)[]>([]);
  const didScrollRef = useRef(false);

  // Load content + progress in parallel
  useEffect(() => {
    didScrollRef.current = false;
    async function load() {
      setLoadingContent(true);
      const [{ data: chData }, progress] = await Promise.all([
        supabase.from("book_chapters").select("content").eq("id", chapterMeta.id).single(),
        userId
          ? fetchChapterProgress(userId, chapterMeta.id)
          : Promise.resolve({ last_paragraph_index: 0, is_completed: false }),
      ]);
      setContent(chData?.content ?? "");
      setActiveParagraphIndex(
        progress.last_paragraph_index > 0 ? progress.last_paragraph_index : null,
      );
      setIsCompleted(progress.is_completed);
      setLoadingContent(false);
    }
    load();
  }, [chapterMeta.id, userId]);

  // Scroll to saved bookmark once — fires when content finishes rendering
  useEffect(() => {
    if (!loadingContent && content !== null && activeParagraphIndex !== null && activeParagraphIndex > 0 && !didScrollRef.current) {
      didScrollRef.current = true;
      // Small delay lets React commit the paragraph DOM nodes before scrolling
      setTimeout(() => {
        paragraphRefs.current[activeParagraphIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 350);
    }
  }, [loadingContent, content, activeParagraphIndex]);

  // Dismiss tooltip on scroll
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const dismiss = () => setTooltip(null);
    el.addEventListener("scroll", dismiss, { passive: true });
    return () => el.removeEventListener("scroll", dismiss);
  }, []);

  async function handleBookmarkParagraph(clickedIndex: number) {
    // Determine whether this click sets or clears the bookmark
    const clearing = activeParagraphIndex === clickedIndex;
    const nextIndex = clearing ? null : clickedIndex;
    setActiveParagraphIndex(nextIndex);
    if (!userId) return;
    setSavingBookmark(true);
    // Always send both fields so neither overwrites the other in a partial upsert.
    // Use clickedIndex directly (never from state) so a stale closure can't corrupt it.
    await saveChapterProgress(userId, chapterMeta.id, book.id, {
      last_paragraph_index: clearing ? 0 : clickedIndex,
      is_completed: isCompleted,
    });
    setSavingBookmark(false);
  }

  async function handleToggleComplete() {
    const next = !isCompleted;
    setIsCompleted(next); // optimistic — UI updates before the DB round-trip
    setSavingComplete(true);
    if (userId) {
      await saveChapterProgress(userId, chapterMeta.id, book.id, {
        is_completed: next,
        last_paragraph_index: activeParagraphIndex ?? 0,
      });
    }
    setSavingComplete(false);
  }

  async function handleWordClick(raw: string, paragraph: string, e: React.MouseEvent<HTMLSpanElement>) {
    e.stopPropagation();
    const word = cleanWord(raw);
    if (!word) return;
    const wordRect = e.currentTarget.getBoundingClientRect();
    const cRect = containerRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 };
    // Coordinates are relative to the position:relative container, not the viewport
    const x = wordRect.left + wordRect.width / 2 - cRect.left;
    const y = wordRect.top - cRect.top;
    const yBottom = wordRect.bottom - cRect.top;
    setTooltip({ word, x, y, yBottom, translation: null, explanation: null, example: null, example_pt: null, loading: true });
    try {
      const result = await fetchGeminiTranslation(word, paragraph);
      setTooltip((prev) =>
        prev?.word === word
          ? { ...prev, translation: result.translation, explanation: result.explanation, example: result.example, example_pt: result.example_pt, loading: false }
          : prev
      );
    } catch (err) {
      console.error("Erro detalhado do Gemini:", err);
      setTooltip((prev) =>
        prev?.word === word
          ? { ...prev, translation: "Erro ao traduzir", explanation: null, example: null, example_pt: null, loading: false, error: true }
          : prev
      );
    }
  }

  const containerWidth = containerRef.current?.offsetWidth ?? 320;
  const tipX = tooltip ? Math.min(Math.max(tooltip.x, 144), containerWidth - 144) : 0;
  // Show popover below the word when it's too close to the top of the container
  const showBelow = tooltip ? tooltip.y < 260 : false;
  const tipTop = tooltip ? (showBelow ? tooltip.yBottom + 10 : tooltip.y - 12) : 0;
  const tipTransform = showBelow ? "translate(-50%, 0)" : "translate(-50%, -100%)";
  const paragraphs = (content ?? "").split("\n\n");

  return (
    <div ref={containerRef} className="relative flex min-h-dvh flex-col bg-background">
      {/* Header — stays in app theme */}
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 pt-10 pb-3">
        <button
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-foreground">{book.title}</h2>
          <p className="truncate text-xs text-muted-foreground">
            Ch. {chapterMeta.chapter_number} — {chapterMeta.title}
          </p>
        </div>
        {/* Status indicators */}
        <div className="flex shrink-0 items-center gap-2">
          {savingBookmark && <Loader2 className="size-3.5 animate-spin text-muted-foreground/60" />}
          {isCompleted && <CheckCircle2 className="size-5 text-brand-green" />}
        </div>
      </header>

      {/* ── Sepia reading area ── */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto bg-[#fbf6ec] px-8 py-8"
        onClick={() => setTooltip(null)}
      >
        {loadingContent ? (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-[#8a7a60]">
            <Loader2 className="size-4 animate-spin" />
            Loading chapter...
          </div>
        ) : (
          <>
            <h3 className="mb-8 font-serif text-xl font-bold text-gray-800 leading-snug">
              {chapterMeta.title}
            </h3>

            <div className="space-y-5 text-[16.5px] leading-[1.95] text-gray-800">
              {paragraphs.map((paragraph, pi) => {
                const isBookmarked = activeParagraphIndex === pi;
                return (
                  <div
                    key={pi}
                    ref={(el) => { paragraphRefs.current[pi] = el; }}
                    className={`group relative transition-all duration-200 ${
                      isBookmarked
                        ? "border-l-[3px] border-brand-green pl-3"
                        : "border-l-[3px] border-transparent pl-3"
                    }`}
                  >
                    {/* Bookmark icon in left gutter */}
                    <button
                      onClick={() => handleBookmarkParagraph(pi)}
                      title={isBookmarked ? "Remove bookmark" : "Bookmark paragraph"}
                      className={`absolute -left-4 top-1 transition-all duration-150 ${
                        isBookmarked
                          ? "opacity-100 text-brand-green"
                          : "opacity-0 text-[#b0a080] group-hover:opacity-60 hover:!opacity-100"
                      }`}
                    >
                      <Bookmark
                        className="size-3"
                        fill={isBookmarked ? "currentColor" : "none"}
                        strokeWidth={2}
                      />
                    </button>

                    {/* Paragraph background highlight when bookmarked */}
                    {isBookmarked && (
                      <span className="absolute inset-0 -mx-1 rounded-r-md bg-brand-green/5 pointer-events-none" />
                    )}

                    <p className="relative">
                      {paragraph.split(" ").map((raw, wi) => {
                        const word = cleanWord(raw);
                        const isWordActive =
                          !!tooltip && word.length > 0 && tooltip.word === word;
                        return (
                          <span
                            key={wi}
                            onClick={word ? (e) => handleWordClick(raw, paragraph, e) : undefined}
                            className={
                              word
                                ? isWordActive
                                  ? "cursor-pointer rounded px-0.5 font-semibold text-brand-green bg-green-100/60"
                                  : "cursor-pointer rounded px-0.5 transition-colors duration-75 hover:bg-amber-200/70 hover:text-gray-900"
                                : undefined
                            }
                          >
                            {raw}{" "}
                          </span>
                        );
                      })}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* ── End-of-chapter section ── */}
            <div className="mt-14 flex flex-col items-center gap-4 border-t border-[#e8dfc8] pt-8">
              {isCompleted ? (
                // Completed state: outline button that reveals undo on hover
                <button
                  onClick={handleToggleComplete}
                  disabled={savingComplete}
                  className="group flex items-center gap-2 rounded-2xl border-2 border-brand-green px-7 py-3.5 text-sm font-bold text-brand-green transition-all hover:border-red-400 hover:bg-red-50 hover:text-red-500 active:scale-95 disabled:opacity-60"
                >
                  {savingComplete ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="size-4 group-hover:hidden" />
                      <RotateCcw className="hidden size-4 group-hover:block" />
                    </>
                  )}
                  <span className="group-hover:hidden">Completed</span>
                  <span className="hidden group-hover:inline">Mark as not completed</span>
                </button>
              ) : (
                <button
                  onClick={handleToggleComplete}
                  disabled={savingComplete}
                  className="flex items-center gap-2 rounded-2xl bg-brand-green px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-green/25 transition-all hover:brightness-105 active:scale-95 disabled:opacity-60"
                >
                  {savingComplete ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Mark Chapter as Completed
                </button>
              )}
              <p className="text-xs text-[#a09070]">
                {paragraphs.length} paragraph{paragraphs.length !== 1 ? "s" : ""} · Tap any word to translate
              </p>
            </div>
          </>
        )}
      </main>

      {/* AI Translation Popover — absolute within position:relative container */}
      {tooltip && (
        <div
          className="absolute z-50 w-72 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
          style={{ left: tipX, top: tipTop, transform: tipTransform }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header bar */}
          <div className="flex items-center justify-between bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2.5">
            <div className="flex items-center gap-1.5 text-[12px] font-bold tracking-wide text-white">
              <Sparkles className="size-3.5" />
              Tradução EduBuddy
            </div>
            <button
              onClick={() => setTooltip(null)}
              className="grid size-5 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="size-3" />
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Word + translation */}
            <div>
              <p className="text-lg font-bold text-gray-900 leading-tight">{tooltip.word}</p>
              {tooltip.loading ? (
                <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-400">
                  <Loader2 className="size-3.5 animate-spin text-purple-400" />
                  <span>Consultando IA...</span>
                </div>
              ) : (
                <p className={`mt-0.5 text-base font-semibold ${tooltip.error ? "text-red-400" : "text-brand-green"}`}>
                  {tooltip.translation ?? "—"}
                </p>
              )}
            </div>

            {/* Explanation */}
            {!tooltip.loading && tooltip.explanation && (
              <div className="rounded-xl bg-violet-50 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400 mb-1">
                  💡 Por que aqui?
                </p>
                <p className="text-xs leading-relaxed text-gray-700">{tooltip.explanation}</p>
              </div>
            )}

            {/* Example */}
            {!tooltip.loading && tooltip.example && (
              <div className="rounded-xl bg-amber-50 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">
                  📝 Exemplo
                </p>
                <p className="text-xs italic text-gray-700">"{tooltip.example}"</p>
                {tooltip.example_pt && (
                  <p className="mt-0.5 text-xs text-gray-500">"{tooltip.example_pt}"</p>
                )}
              </div>
            )}
          </div>

          {/* Arrow — points down toward word when above, up toward word when below */}
          {showBelow ? (
            <div className="absolute -top-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-t border-l border-black/10 bg-white" />
          ) : (
            <div className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-black/10 bg-white" />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Chapter List View ────────────────────────────────────────────────────────

function ChapterListView({
  book,
  userId,
  onBack,
  onSelectChapter,
}: {
  book: Book;
  userId: string | null;
  onBack: () => void;
  onSelectChapter: (chapter: ChapterMeta) => void;
}) {
  const [chapters, setChapters] = useState<ChapterMeta[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [chapResult, completed] = await Promise.all([
        supabase
          .from("book_chapters")
          .select("id, book_id, chapter_number, title")
          .eq("book_id", book.id)
          .order("chapter_number"),
        userId
          ? fetchCompletedChapterIds(userId, book.id)
          : Promise.resolve(new Set<string>()),
      ]);
      if (chapResult.error) setError("Failed to load chapters. Please try again.");
      else setChapters(chapResult.data ?? []);
      setCompletedIds(completed);
      setLoading(false);
    }
    load();
  }, [book.id, userId]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-surface px-4 pt-10 pb-4">
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Library
        </button>
        <div className="flex items-center gap-3">
          <div className="size-14 shrink-0 overflow-hidden rounded-xl shadow-md">
            <BookCover url={book.cover_url} title={book.title} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground leading-tight">{book.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{book.author}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-8">
        <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Chapters
        </p>

        {loading && (
          <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading chapters...
          </div>
        )}

        {error && <p className="py-10 text-center text-sm text-destructive">{error}</p>}

        {!loading && !error && chapters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <BookMarked className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">No chapters available yet.</p>
          </div>
        )}

        <div className="space-y-2">
          {chapters.map((ch) => {
            const done = completedIds.has(ch.id);
            return (
              <button
                key={ch.id}
                onClick={() => onSelectChapter(ch)}
                className={`flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left ring-1 transition-all hover:shadow-sm ${
                  done
                    ? "ring-brand-green/30 hover:ring-brand-green/50"
                    : "ring-border hover:ring-brand-green/40"
                }`}
              >
                {/* Chapter number badge */}
                <div
                  className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                    done ? "bg-brand-green text-white" : "bg-brand-green/10"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <span className="text-xs font-bold text-brand-green">{ch.chapter_number}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${done ? "text-foreground" : "text-foreground"}`}>
                    {ch.title}
                  </p>
                  <p className={`text-xs ${done ? "font-medium text-brand-green" : "text-muted-foreground"}`}>
                    {done ? "Completed" : "Tap to start reading"}
                  </p>
                </div>

                {done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-brand-green/60" />
                ) : (
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/40" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Library Main View ────────────────────────────────────────────────────────

const DIFF_CONFIG: Record<string, { label: string; className: string }> = {
  beginner:     { label: "Beginner",     className: "bg-green-100 text-green-700" },
  intermediate: { label: "Intermediate", className: "bg-purple-100 text-purple-700" },
  advanced:     { label: "Advanced",     className: "bg-red-100 text-red-700" },
};

function DifficultyBadge({ level }: { level: string }) {
  const cfg = DIFF_CONFIG[level] ?? DIFF_CONFIG.beginner;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function BookCard({ book, onSelect }: { book: Book; onSelect: (b: Book) => void }) {
  return (
    <button
      onClick={() => onSelect(book)}
      className="flex w-full items-start gap-4 rounded-2xl bg-surface p-4 text-left ring-1 ring-border transition-all hover:ring-brand-green/40 hover:shadow-md active:scale-[0.99]"
    >
      <div className="h-24 w-16 shrink-0 overflow-hidden rounded-xl shadow-md">
        <BookCover url={book.cover_url} title={book.title} />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
        <DifficultyBadge level={book.difficulty_level} />
        <p className="text-sm font-bold text-foreground leading-snug">{book.title}</p>
        <p className="text-xs font-medium text-muted-foreground">{book.author}</p>
        {book.description && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground/70">
            {book.description}
          </p>
        )}
      </div>
      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/30" />
    </button>
  );
}

const SECTION_ACCENT: Record<string, string> = {
  Beginner:     "bg-brand-green",
  Intermediate: "bg-purple-500",
  Advanced:     "bg-red-500",
};

function Section({ title, books, onSelect }: { title: string; books: Book[]; onSelect: (b: Book) => void }) {
  const accent = SECTION_ACCENT[title] ?? "bg-brand-green";
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-3.5 w-1 rounded-full ${accent}`} />
        <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">{title}</h2>
        <span className="text-[11px] text-muted-foreground/60">
          {books.length} book{books.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-3">
        {books.map((book) => (
          <BookCard key={book.id} book={book} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function LibraryView({ onSelectBook }: { onSelectBook: (b: Book) => void }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBooks() {
      const { data, error } = await supabase
        .from("books")
        .select("id, title, author, cover_url, difficulty_level, description")
        .order("title");
      if (error) setError("Failed to load books. Please try again.");
      else setBooks(data ?? []);
      setLoading(false);
    }
    fetchBooks();
  }, []);

  const beginners     = books.filter((b) => b.difficulty_level === "beginner");
  const intermediates = books.filter((b) => b.difficulty_level === "intermediate");
  const advanced      = books.filter((b) => b.difficulty_level === "advanced");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="px-5 pt-10 pb-5">
        <h1 className="text-2xl font-bold text-foreground">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">Read in English. Tap any word to translate.</p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {loading && (
          <div className="flex h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-brand-green" />
            Loading library...
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center py-20">
            <BookMarked className="mb-3 size-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}
        {!loading && !error && books.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <BookMarked className="mb-3 size-12 text-muted-foreground/25" />
            <p className="text-sm font-medium text-muted-foreground">No books available yet.</p>
            <p className="mt-1 text-xs text-muted-foreground/50">Check back soon!</p>
          </div>
        )}
        {!loading && !error && books.length > 0 && (
          <div className="space-y-8">
            {beginners.length > 0 && (
              <Section title="Beginner" books={beginners} onSelect={onSelectBook} />
            )}
            {intermediates.length > 0 && (
              <Section title="Intermediate" books={intermediates} onSelect={onSelectBook} />
            )}
            {advanced.length > 0 && (
              <Section title="Advanced" books={advanced} onSelect={onSelectBook} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root — fetches userId, wires views together ──────────────────────────────

type View =
  | { type: "library" }
  | { type: "chapters"; book: Book }
  | { type: "reading"; book: Book; chapter: ChapterMeta };

export function Library() {
  const [view, setView] = useState<View>({ type: "library" });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
    });
  }, []);

  if (view.type === "chapters") {
    return (
      <ChapterListView
        book={view.book}
        userId={userId}
        onBack={() => setView({ type: "library" })}
        onSelectChapter={(chapter) => setView({ type: "reading", book: view.book, chapter })}
      />
    );
  }

  if (view.type === "reading") {
    return (
      <ReadingView
        chapterMeta={view.chapter}
        book={view.book}
        userId={userId}
        onClose={() => setView({ type: "chapters", book: view.book })}
      />
    );
  }

  return <LibraryView onSelectBook={(book) => setView({ type: "chapters", book })} />;
}
