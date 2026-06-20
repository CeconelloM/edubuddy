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
} from "lucide-react";
import { supabase } from "@/services/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

type Book = {
  id: string;
  title: string;
  author: string;
  cover_url: string | null;
  difficulty_level: "beginner" | "intermediate";
  description: string | null;
};

type ChapterMeta = {
  id: string;
  book_id: string;
  chapter_number: number;
  title: string;
};

// ─── Mini translation dictionary ──────────────────────────────────────────────

const DICT: Record<string, string> = {
  the: "o / a", a: "um / uma", an: "um / uma", and: "e", or: "ou",
  but: "mas", in: "em", on: "em cima de", at: "em / às", to: "para",
  of: "de", for: "para / por", with: "com", by: "por", from: "de",
  about: "sobre", is: "é", was: "era / foi", are: "são", were: "eram",
  be: "ser / estar", have: "ter", has: "tem", had: "tinha / teve",
  do: "fazer", does: "faz", did: "fez", will: "irá", would: "iria",
  can: "pode / consegue", could: "poderia", should: "deveria",
  may: "pode (possibilidade)", might: "poderia", not: "não",
  this: "este / esta", that: "aquele / aquela", it: "ele / ela (coisa)",
  he: "ele", she: "ela", they: "eles / elas", we: "nós", you: "você", i: "eu",
  my: "meu / minha", your: "seu / sua", his: "dele", her: "dela",
  their: "deles / delas", our: "nosso / nossa", said: "disse",
  very: "muito", just: "apenas", up: "para cima", out: "fora",
  go: "ir", come: "vir", get: "pegar / obter", know: "saber / conhecer",
  see: "ver", look: "olhar", think: "pensar", like: "gostar / como",
  make: "fazer", good: "bom", new: "novo", first: "primeiro",
  last: "último", long: "longo", little: "pequeno / pouco", own: "próprio",
  old: "velho", right: "certo / direito", big: "grande", high: "alto",
  different: "diferente", small: "pequeno", large: "grande", next: "próximo",
  early: "cedo", young: "jovem", important: "importante",
  people: "pessoas", day: "dia", way: "caminho / jeito", time: "tempo / hora",
  year: "ano", man: "homem", woman: "mulher", child: "criança",
  world: "mundo", life: "vida", hand: "mão", part: "parte", place: "lugar",
  week: "semana", where: "onde", when: "quando", how: "como",
  what: "o que", which: "qual", who: "quem", why: "por que",
  all: "todo / tudo", each: "cada", both: "ambos", between: "entre",
  after: "depois", before: "antes", through: "através", never: "nunca",
  always: "sempre", still: "ainda", again: "novamente", then: "então",
  here: "aqui", there: "lá / ali", now: "agora", back: "de volta",
  home: "lar / casa", house: "casa", door: "porta", street: "rua",
  road: "estrada", name: "nome", night: "noite", morning: "manhã",
  evening: "tarde / noite", water: "água", fire: "fogo", light: "luz",
  dark: "escuro", white: "branco", black: "preto", red: "vermelho",
  green: "verde", blue: "azul", gold: "ouro", silver: "prata",
  run: "correr", walk: "caminhar", speak: "falar", read: "ler",
  write: "escrever", help: "ajudar", find: "encontrar", lost: "perdido",
  found: "encontrou / achou", take: "pegar", give: "dar", put: "colocar",
  turn: "virar", leave: "sair / deixar", move: "mover / se mover",
  keep: "manter", let: "deixar / permitir", stand: "ficar de pé",
  feel: "sentir", seem: "parecer", tell: "contar / dizer",
  ask: "perguntar", answer: "responder", call: "chamar / ligar",
  try: "tentar", work: "trabalhar / funcionar", need: "precisar",
  want: "querer", start: "começar", stop: "parar",
  great: "ótimo / grande", few: "poucos",
  many: "muitos", much: "muito", more: "mais", most: "a maioria",
  only: "apenas / somente", also: "também", too: "também / demais",
  even: "até / mesmo", however: "porém / no entanto", though: "embora",
  although: "embora / apesar de", because: "porque",
  while: "enquanto", until: "até que", unless: "a menos que",
  if: "se", else: "senão / caso contrário", than: "do que",
  so: "então / tão", such: "tal / tão", as: "como / enquanto",
  already: "já", soon: "em breve", yet: "ainda / já",
  ever: "alguma vez / sempre", once: "uma vez", twice: "duas vezes",
  together: "juntos", alone: "sozinho", away: "longe / embora",
  around: "ao redor / por aí", under: "embaixo de", over: "sobre / acima",
  behind: "atrás", ahead: "à frente",
  inside: "dentro", outside: "fora", along: "ao longo de",
};

function cleanWord(raw: string) {
  return raw.replace(/[^a-zA-ZÀ-ÿ'-]/g, "").toLowerCase();
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
  translation: string | null;
  loading: boolean;
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

  async function handleWordClick(raw: string, e: React.MouseEvent<HTMLSpanElement>) {
    e.stopPropagation();
    const word = cleanWord(raw);
    if (!word) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ word, x: rect.left + rect.width / 2, y: rect.top, translation: null, loading: true });
    await new Promise((r) => setTimeout(r, 550));
    const translation = DICT[word] ?? null;
    setTooltip((prev) => (prev?.word === word ? { ...prev, translation, loading: false } : prev));
  }

  const tipX = tooltip ? Math.min(Math.max(tooltip.x, 92), window.innerWidth - 92) : 0;
  const paragraphs = (content ?? "").split("\n\n");

  return (
    <div className="flex min-h-dvh flex-col bg-background">
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
                            onClick={word ? (e) => handleWordClick(raw, e) : undefined}
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

      {/* Translation Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 w-48 rounded-2xl bg-surface px-4 py-3 shadow-2xl ring-1 ring-border"
          style={{ left: tipX, top: tooltip.y - 12, transform: "translate(-50%, -100%)" }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Translation
          </p>
          <p className="mt-0.5 text-[15px] font-bold text-foreground">{tooltip.word}</p>
          {tooltip.loading ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Translating...
            </div>
          ) : (
            <p className={`mt-1 text-sm font-medium ${tooltip.translation ? "text-brand-green" : "text-muted-foreground/60"}`}>
              {tooltip.translation ?? "No translation found"}
            </p>
          )}
          <button className="mt-2.5 text-[11px] font-medium text-muted-foreground/40 transition-colors hover:text-brand-green">
            Ask EduBuddy →
          </button>
          <div className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-border bg-surface" />
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

function DifficultyBadge({ level }: { level: string }) {
  const isIntermediate = level === "intermediate";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isIntermediate ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"
      }`}
    >
      {isIntermediate ? "Intermediate" : "Beginner"}
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

function Section({ title, books, onSelect }: { title: string; books: Book[]; onSelect: (b: Book) => void }) {
  const isIntermediate = title === "Intermediate";
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={`h-3.5 w-1 rounded-full ${isIntermediate ? "bg-purple-500" : "bg-brand-green"}`} />
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

  const beginners = books.filter((b) => b.difficulty_level === "beginner");
  const intermediates = books.filter((b) => b.difficulty_level === "intermediate");

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
