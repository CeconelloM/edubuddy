import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { HARRY_POTTER_CH1 } from "@/mocks/harryPotter";

type Book = {
  id: string;
  title: string;
  author: string;
  chapter: string;
  pages: string[];
  cover: string;
};

const BOOKS: Book[] = [
  {
    ...HARRY_POTTER_CH1,
    cover: "bg-brand-blue-soft text-brand-blue",
  },
];

const STORAGE_KEY = "edubuddy_library_progress";

function getProgress(bookId: string): number {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return typeof data[bookId] === "number" ? data[bookId] : 0;
  } catch {
    return 0;
  }
}

function saveProgress(bookId: string, page: number) {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    data[bookId] = page;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// Strip punctuation to get the clean word used for matching/lookup
function cleanWord(raw: string) {
  return raw.replace(/[^a-zA-ZÀ-ÿ'-]/g, "");
}

type WordSelection = { word: string; x: number; y: number };

function ReadingView({ book, onClose }: { book: Book; onClose: () => void }) {
  const [page, setPage] = useState(() => getProgress(book.id));
  const [selected, setSelected] = useState<WordSelection | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const total = book.pages.length;

  // Dismiss tooltip when the reader scrolls
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const dismiss = () => setSelected(null);
    el.addEventListener("scroll", dismiss, { passive: true });
    return () => el.removeEventListener("scroll", dismiss);
  }, []);

  function goTo(next: number) {
    setSelected(null);
    setPage(next);
    saveProgress(book.id, next);
  }

  function handleWordClick(raw: string, e: React.MouseEvent<HTMLSpanElement>) {
    e.stopPropagation(); // prevent main's onClick from clearing immediately
    const word = cleanWord(raw);
    if (!word) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setSelected({ word, x: rect.left + rect.width / 2, y: rect.top });
  }

  // Clamp tooltip horizontally so it never overflows the viewport
  const tipX = selected
    ? Math.min(Math.max(selected.x, 84), window.innerWidth - 84)
    : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-surface px-4 pt-10 pb-3">
        <button
          onClick={onClose}
          className="grid size-9 place-items-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-foreground">{book.title}</h2>
          <p className="text-xs text-muted-foreground">{book.chapter}</p>
        </div>
        <span className="text-xs text-muted-foreground">{page + 1}/{total}</span>
      </header>

      {/* Progress bar */}
      <div className="h-1 w-full bg-muted">
        <div
          className="h-1 bg-brand-green transition-all duration-300"
          style={{ width: `${((page + 1) / total) * 100}%` }}
        />
      </div>

      {/* Page content — clicking the background dismisses the tooltip */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto px-6 py-8"
        onClick={() => setSelected(null)}
      >
        <div className="space-y-4 text-base leading-relaxed text-foreground">
          {/* .split("\n\n") and then .split(" ") run only on the current page */}
          {book.pages[page].split("\n\n").map((paragraph, pi) => (
            <p key={pi}>
              {paragraph.split(" ").map((raw, wi) => {
                const word = cleanWord(raw);
                const isActive = !!selected && word.length > 0 && selected.word === word;
                return (
                  <span
                    key={wi}
                    onClick={word ? (e) => handleWordClick(raw, e) : undefined}
                    className={
                      word
                        ? isActive
                          ? "cursor-pointer font-medium text-brand-green"
                          : "cursor-pointer transition-colors duration-75 hover:text-brand-blue"
                        : undefined
                    }
                  >
                    {raw}{" "}
                  </span>
                );
              })}
            </p>
          ))}
        </div>
      </main>

      {/* Word tooltip — fixed above the tapped word */}
      {selected && (
        <div
          className="fixed z-50 rounded-2xl bg-surface px-3.5 py-2.5 shadow-xl ring-1 ring-border"
          style={{
            left: tipX,
            top: selected.y - 10,
            transform: "translate(-50%, -100%)",
            minWidth: "9rem",
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Tradução
          </p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{selected.word}</p>
          <button className="mt-2 text-[11px] font-medium text-muted-foreground/50 transition-colors hover:text-brand-green">
            Perguntar ao EduBuddy →
          </button>
          {/* Downward-pointing arrow */}
          <div className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-b border-r border-border bg-surface" />
        </div>
      )}

      {/* Pagination controls */}
      <div className="sticky bottom-16 border-t border-border bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => goTo(page - 1)}
            disabled={page === 0}
            className="flex items-center gap-1.5 rounded-2xl bg-muted px-4 py-2.5 text-sm font-medium text-foreground transition-opacity disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
            Anterior
          </button>

          <div className="flex items-center gap-1.5">
            {book.pages.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all ${
                  i === page ? "size-2.5 bg-brand-green" : "size-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => goTo(page + 1)}
            disabled={page === total - 1}
            className="flex items-center gap-1.5 rounded-2xl bg-brand-green px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-brand-green/20 transition-opacity disabled:pointer-events-none disabled:opacity-30"
          >
            Próxima
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Library() {
  const [openBook, setOpenBook] = useState<Book | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const map: Record<string, number> = {};
    BOOKS.forEach((b) => {
      map[b.id] = getProgress(b.id);
    });
    setProgressMap(map);
  }, [openBook]);

  if (openBook) {
    return <ReadingView book={openBook} onClose={() => setOpenBook(null)} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="px-6 pt-10 pb-4">
        <h1 className="text-2xl font-semibold text-foreground">Library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read and track your progress.
        </p>
      </header>

      <div className="flex-1 space-y-3 px-6 pb-6">
        {BOOKS.map((book) => {
          const currentPage = progressMap[book.id] ?? 0;
          const pct = Math.round(((currentPage + 1) / book.pages.length) * 100);

          return (
            <button
              key={book.id}
              onClick={() => setOpenBook(book)}
              className="flex w-full items-center gap-4 rounded-2xl bg-surface p-4 text-left ring-1 ring-border transition-all hover:ring-brand-green/30"
            >
              {/* Cover icon */}
              <div
                className={`grid size-14 shrink-0 place-items-center rounded-xl ${book.cover}`}
              >
                <BookOpen className="size-6" />
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <p className="truncate text-sm font-semibold text-foreground">
                    {book.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{book.author}</p>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {book.chapter}
                    </span>
                    <span className="text-[11px] font-medium text-brand-green">
                      {pct}% read
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-brand-green transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
