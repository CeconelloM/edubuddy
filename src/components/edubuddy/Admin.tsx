import { useState, useEffect, useRef } from "react";
import {
  ShieldCheck, ShieldX, BookPlus, CheckCircle2, AlertCircle,
  Loader2, Pencil, Trash2, X, Users, BookOpen, ImageIcon,
  UserPlus, Lock, ChevronDown, ChevronUp,
} from "lucide-react";
import { supabase } from "@/services/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminSection = "books" | "users";
type FormMode     = "import" | "edit";
type Difficulty   = "beginner" | "intermediate" | "advanced";

interface Book {
  id: string; title: string; author: string;
  cover_url: string | null; difficulty_level: string; description: string | null;
}
interface UserProfile {
  id: string; nickname: string | null; email: string | null;
  created_at: string; role: string;
}
interface ImportResult {
  book_id: string; chapters_inserted: number;
  chapters_updated: number; chapters_total: number; message: string;
}
interface BookFormState {
  title: string; author: string; description: string;
  difficulty: Difficulty | ""; gutenberg_url: string;
}

const EMPTY_BOOK_FORM: BookFormState = {
  title: "", author: "", description: "", difficulty: "", gutenberg_url: "",
};

const DIFF_STYLE: Record<string, string> = {
  beginner:     "bg-green-100 text-green-800 border-green-200",
  intermediate: "bg-amber-100 text-amber-800 border-amber-200",
  advanced:     "bg-red-100 text-red-800 border-red-200",
};
const DIFF_LABEL: Record<string, string> = {
  beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced",
};

const ROLE_STYLE: Record<string, string> = {
  admin:   "bg-amber-100 text-amber-800 border-amber-200",
  teacher: "bg-blue-100 text-blue-800 border-blue-200",
  user:    "bg-muted text-muted-foreground border-border",
};

// ── Main ─────────────────────────────────────────────────────────────────────

export function Admin({ role }: { role: string }) {
  const [section, setSection] = useState<AdminSection>("books");
  const isAdmin   = role === "admin";
  const isTeacher = role === "teacher";
  const isStaff   = isAdmin || isTeacher;

  if (!isStaff) return <AccessDenied />;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="grid size-10 place-items-center rounded-xl bg-amber-100">
            <ShieldCheck className="size-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-tight text-foreground">Admin Panel</h1>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Administrador" : "Professor"} · EduBuddy
            </p>
          </div>
        </div>

        <div className="flex gap-1 px-4 pb-3">
          {(["books", "users"] as AdminSection[]).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                section === s ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "books" ? <BookOpen className="size-3.5" /> : <Users className="size-3.5" />}
              {s === "books" ? "Livros" : "Usuários"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {section === "books" && <BooksSection isAdmin={isAdmin} />}
        {section === "users" && <UsersSection userRole={role} />}
      </div>
    </div>
  );
}

// ── Access Denied ─────────────────────────────────────────────────────────────

function AccessDenied() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="grid size-20 place-items-center rounded-full bg-red-50">
        <ShieldX className="size-10 text-red-400" />
      </div>
      <h1 className="text-xl font-bold text-foreground">Acesso Negado</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Esta área é restrita a administradores e professores.
      </p>
    </div>
  );
}

// ── Books Section ─────────────────────────────────────────────────────────────

function BooksSection({ isAdmin }: { isAdmin: boolean }) {
  const [books, setBooks]             = useState<Book[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [mode, setMode]               = useState<FormMode>("import");
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [form, setForm]               = useState<BookFormState>(EMPTY_BOOK_FORM);
  const [coverFile, setCoverFile]     = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState<ImportResult | null>(null);
  const [formError, setFormError]     = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Book | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchBooks(); }, []);

  async function fetchBooks() {
    setBooksLoading(true);
    const { data } = await supabase
      .from("books")
      .select("id, title, author, cover_url, difficulty_level, description")
      .order("title");
    setBooks(data ?? []);
    setBooksLoading(false);
  }

  function setField(f: keyof BookFormState, v: string) {
    setForm((p) => ({ ...p, [f]: v }));
    setResult(null); setFormError(null);
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setResult(null); setFormError(null);
  }

  function startEdit(book: Book) {
    setMode("edit"); setEditingBook(book);
    setForm({ title: book.title, author: book.author,
      description: book.description ?? "", difficulty: book.difficulty_level as Difficulty,
      gutenberg_url: "" });
    setCoverFile(null); setCoverPreview(book.cover_url ?? null);
    setResult(null); setFormError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setMode("import"); setEditingBook(null);
    setForm(EMPTY_BOOK_FORM); setCoverFile(null); setCoverPreview(null);
    setResult(null); setFormError(null);
  }

  async function uploadCover(file: File): Promise<string> {
    const ext = file.name.split(".").pop() ?? "jpg";
    const filename = `cover-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("book-covers").upload(filename, file, { contentType: file.type, upsert: true });
    if (error) throw new Error(`Upload da capa: ${error.message}`);
    return supabase.storage.from("book-covers").getPublicUrl(filename).data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.difficulty) { setFormError("Selecione a dificuldade."); return; }
    setLoading(true); setResult(null); setFormError(null);

    try {
      let coverUrl: string | null = editingBook?.cover_url ?? null;
      if (coverFile) coverUrl = await uploadCover(coverFile);

      if (mode === "edit" && editingBook) {
        const { error } = await supabase.from("books").update({
          title: form.title.trim(), author: form.author.trim(),
          description: form.description.trim() || null,
          difficulty_level: form.difficulty, cover_url: coverUrl,
        }).eq("id", editingBook.id);
        if (error) { setFormError(`Erro ao atualizar: ${error.message}`); return; }
        setBooks((prev) => prev.map((b) =>
          b.id === editingBook.id
            ? { ...b, title: form.title.trim(), author: form.author.trim(),
                description: form.description.trim() || null,
                difficulty_level: form.difficulty as string, cover_url: coverUrl }
            : b
        ));
        cancelEdit();
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke("import-book", {
        body: {
          title: form.title.trim(), author: form.author.trim(),
          description: form.description.trim() || undefined,
          difficulty_level: form.difficulty,
          gutenberg_url: form.gutenberg_url.trim(),
          cover_url: coverUrl ?? undefined,
        },
      });
      if (fnError) {
        const body = await (fnError as { context?: Response }).context?.json().catch(() => null);
        setFormError(body?.error ?? fnError.message ?? "Importação falhou.");
        return;
      }
      if (!data?.success) { setFormError(data?.error ?? "Importação falhou."); return; }
      setResult(data as ImportResult);
      setForm(EMPTY_BOOK_FORM); setCoverFile(null); setCoverPreview(null);
      fetchBooks();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(book: Book) {
    setDeleteLoading(true);
    await supabase.from("book_chapters").delete().eq("book_id", book.id);
    const { error } = await supabase.from("books").delete().eq("id", book.id);
    setDeleteLoading(false);
    if (error) { alert(`Erro ao deletar: ${error.message}`); return; }
    setBooks((prev) => prev.filter((b) => b.id !== book.id));
    setDeleteTarget(null);
    if (editingBook?.id === book.id) cancelEdit();
  }

  return (
    <div className="space-y-6 px-4 py-6">

      {/* Formulário — apenas para Admin */}
      {isAdmin && (
        <div className="rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <BookPlus className="size-4 text-amber-600" />
              <span className="text-sm font-semibold text-foreground">
                {mode === "edit" ? `Editar: ${editingBook?.title}` : "Importar novo livro"}
              </span>
            </div>
            {mode === "edit" && (
              <button onClick={cancelEdit} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
                <X className="size-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5">
            <div className="flex items-start gap-4">
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="group relative flex size-24 shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-amber-400 hover:bg-amber-50"
              >
                {coverPreview
                  ? <img src={coverPreview} alt="Preview" className="absolute inset-0 size-full object-cover" />
                  : <><ImageIcon className="size-6" /><span className="text-[10px]">Capa</span></>
                }
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />

              <div className="flex-1 space-y-3">
                <Field label="Título" required>
                  <Input placeholder="ex: Moby Dick" value={form.title}
                    onChange={(e) => setField("title", e.target.value)} required disabled={loading} />
                </Field>
                <Field label="Autor" required>
                  <Input placeholder="ex: Herman Melville" value={form.author}
                    onChange={(e) => setField("author", e.target.value)} required disabled={loading} />
                </Field>
              </div>
            </div>

            <Field label="Descrição">
              <Textarea placeholder="Sinopse…" value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                disabled={loading} rows={2} className="resize-none" />
            </Field>

            <Field label="Dificuldade" required>
              <Select value={form.difficulty} onValueChange={(v) => setField("difficulty", v)} disabled={loading}>
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {mode === "import" && (
              <Field label="URL do .txt no Project Gutenberg" hint="ex: https://www.gutenberg.org/files/2701/2701-0.txt" required>
                <Input type="url" placeholder="https://www.gutenberg.org/files/…" value={form.gutenberg_url}
                  onChange={(e) => setField("gutenberg_url", e.target.value)} required disabled={loading} />
              </Field>
            )}

            {formError && <ErrorBanner msg={formError} />}
            {result && (
              <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600" />
                <div>
                  <p className="text-xs font-semibold text-green-800">Importado com sucesso!</p>
                  <p className="text-xs text-green-700">{result.message}</p>
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading}
              className="w-full gap-2 rounded-xl bg-amber-500 py-5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
            >
              {loading
                ? <><Loader2 className="size-4 animate-spin" />{mode === "edit" ? "Salvando…" : "Baixando e processando…"}</>
                : <><BookPlus className="size-4" />{mode === "edit" ? "Salvar alterações" : "Importar livro"}</>
              }
            </Button>
          </form>
        </div>
      )}

      {/* Lista de livros */}
      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <span className="text-sm font-semibold text-foreground">
            Biblioteca ({books.length} {books.length === 1 ? "livro" : "livros"})
          </span>
        </div>

        {booksLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : books.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Nenhum livro cadastrado ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {books.map((book) => {
              const diffStyle = DIFF_STYLE[book.difficulty_level] ?? "bg-gray-100 text-gray-700";
              const diffLabel = DIFF_LABEL[book.difficulty_level] ?? book.difficulty_level;
              const isDeleteTarget = deleteTarget?.id === book.id;

              return (
                <li key={book.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {book.cover_url
                        ? <img src={book.cover_url} alt={book.title} className="size-full object-cover" />
                        : <div className="flex size-full items-center justify-center"><BookOpen className="size-5 text-muted-foreground" /></div>
                      }
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{book.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{book.author}</p>
                      <span className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${diffStyle}`}>
                        {diffLabel}
                      </span>
                    </div>
                    {/* Botões só para admin */}
                    {isAdmin && (
                      <div className="flex shrink-0 gap-1.5">
                        <button onClick={() => startEdit(book)}
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-amber-50 hover:text-amber-600">
                          <Pencil className="size-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(book)}
                          className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-500">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {isDeleteTarget && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-semibold text-red-800">
                        Deletar "{book.title}"? Todos os capítulos serão removidos permanentemente.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDeleteTarget(null)}
                          className="h-7 rounded-lg px-3 text-xs">Cancelar</Button>
                        <Button size="sm" onClick={() => handleDelete(book)} disabled={deleteLoading}
                          className="h-7 rounded-lg bg-red-500 px-3 text-xs text-white hover:bg-red-600">
                          {deleteLoading ? <Loader2 className="size-3 animate-spin" /> : "Confirmar exclusão"}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Users Section ─────────────────────────────────────────────────────────────

function UsersSection({ userRole }: { userRole: string }) {
  const isAdmin = userRole === "admin";
  const [users, setUsers]               = useState<UserProfile[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [updatingId, setUpdatingId]     = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserProfile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showCreate, setShowCreate]     = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    setLoading(true); setError(null);
    const { data, error: err } = await supabase
      .from("profiles")
      .select("id, nickname, email, created_at, role")
      .order("created_at", { ascending: false });
    if (err) { setError(err.message); setLoading(false); return; }
    setUsers(data ?? []); setLoading(false);
  }

  async function toggleRole(user: UserProfile) {
    if (user.role === "admin") return; // admin bloqueado
    const newRole = user.role === "teacher" ? "user" : "teacher";
    setUpdatingId(user.id);
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", user.id);
    setUpdatingId(null);
    if (error) { alert(`Erro: ${error.message}`); return; }
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
  }

  async function handleDelete(user: UserProfile) {
    setDeleteLoading(true);
    const { data, error: fnError } = await supabase.functions.invoke("delete-user", {
      body: { user_id: user.id },
    });
    setDeleteLoading(false);
    if (fnError || !data?.success) {
      const body = await (fnError as { context?: Response } | null)?.context?.json().catch(() => null);
      alert(body?.error ?? data?.error ?? "Erro ao deletar usuário.");
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
    setDeleteTarget(null);
  }

  return (
    <div className="px-4 py-6 space-y-4">

      {/* Create User Card */}
      <div className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-amber-600" />
            <span className="text-sm font-semibold text-foreground">Criar novo usuário</span>
          </div>
          {showCreate ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>

        {showCreate && (
          <div className="border-t border-border">
            <CreateUserForm
              callerRole={userRole}
              isAdmin={isAdmin}
              onCreated={(u) => {
                setUsers((prev) => [u, ...prev]);
                setShowCreate(false);
              }}
            />
          </div>
        )}
      </div>

      {/* Users List */}
      <div className="rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-amber-600" />
            <span className="text-sm font-semibold text-foreground">Usuários ({users.length})</span>
          </div>
          <button onClick={fetchUsers} className="text-xs text-muted-foreground hover:text-foreground">
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <div className="flex items-start gap-2 p-5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((user) => {
              const initials = (user.nickname ?? user.email ?? "?").slice(0, 2).toUpperCase();
              const joinedDate = new Date(user.created_at).toLocaleDateString("pt-BR",
                { day: "2-digit", month: "short", year: "numeric" });
              const isTargetAdmin = user.role === "admin";
              const isDelTarget   = deleteTarget?.id === user.id;

              return (
                <li key={user.id} className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold
                      ${user.role === "admin" ? "bg-amber-100 text-amber-700"
                      : user.role === "teacher" ? "bg-blue-100 text-blue-700"
                      : "bg-muted text-muted-foreground"}`}
                    >
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user.nickname ?? <span className="italic text-muted-foreground">sem nickname</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{user.email ?? "—"}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">desde {joinedDate}</p>
                    </div>

                    {/* Role badge + actions */}
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      {isTargetAdmin ? (
                        // Admin é sempre bloqueado
                        <div className="flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5">
                          <Lock className="size-2.5 text-amber-600" />
                          <span className="text-[10px] font-semibold text-amber-800">admin</span>
                        </div>
                      ) : (
                        // user/teacher é clicável
                        <Badge
                          className={`cursor-pointer border text-[10px] font-semibold transition-colors ${ROLE_STYLE[user.role] ?? ROLE_STYLE.user} hover:opacity-80`}
                          onClick={() => !updatingId && toggleRole(user)}
                        >
                          {updatingId === user.id
                            ? <Loader2 className="size-3 animate-spin" />
                            : user.role
                          }
                        </Badge>
                      )}

                      {!isTargetAdmin && (
                        <button
                          onClick={() => setDeleteTarget(user)}
                          className="grid size-6 place-items-center rounded text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Delete confirmation */}
                  {isDelTarget && (
                    <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-xs font-semibold text-red-800">
                        Deletar "{user.nickname ?? user.email}"? Esta ação não pode ser desfeita.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setDeleteTarget(null)}
                          className="h-7 rounded-lg px-3 text-xs">Cancelar</Button>
                        <Button size="sm" onClick={() => handleDelete(user)} disabled={deleteLoading}
                          className="h-7 rounded-lg bg-red-500 px-3 text-xs text-white hover:bg-red-600">
                          {deleteLoading ? <Loader2 className="size-3 animate-spin" /> : "Confirmar exclusão"}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Create User Form ──────────────────────────────────────────────────────────

interface CreateUserFormProps {
  callerRole: string;
  isAdmin: boolean;
  onCreated: (u: UserProfile) => void;
}

function CreateUserForm({ callerRole, isAdmin, onCreated }: CreateUserFormProps) {
  const [form, setForm] = useState({
    full_name: "", email: "", password: "", role: "user" as "user" | "teacher",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function set(field: keyof typeof form, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("create-user", {
      body: {
        full_name: form.full_name.trim() || undefined,
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      },
    });

    setLoading(false);

    if (fnError) {
      const body = await (fnError as { context?: Response }).context?.json().catch(() => null);
      setError(body?.error ?? fnError.message ?? "Erro ao criar usuário.");
      return;
    }
    if (!data?.success) { setError(data?.error ?? "Erro ao criar usuário."); return; }

    onCreated({
      id: data.user_id,
      nickname: null,
      email: form.email.trim(),
      created_at: new Date().toISOString(),
      role: form.role,
    });
    setForm({ full_name: "", email: "", password: "", role: "user" });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-5">
      <Field label="Nome completo">
        <Input placeholder="ex: João Silva" value={form.full_name}
          onChange={(e) => set("full_name", e.target.value)} disabled={loading} />
      </Field>
      <Field label="E-mail" required>
        <Input type="email" placeholder="aluno@email.com" value={form.email}
          onChange={(e) => set("email", e.target.value)} required disabled={loading} />
      </Field>
      <Field label="Senha inicial" required>
        <Input type="password" placeholder="Mínimo 8 caracteres" value={form.password}
          onChange={(e) => set("password", e.target.value)} required disabled={loading} />
      </Field>
      <Field label="Cargo">
        <Select value={form.role} onValueChange={(v) => set("role", v)} disabled={loading}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Aluno</SelectItem>
            {isAdmin && <SelectItem value="teacher">Professor</SelectItem>}
          </SelectContent>
        </Select>
      </Field>

      {error && <ErrorBanner msg={error} />}

      <Button type="submit" disabled={loading}
        className="w-full gap-2 rounded-xl bg-amber-500 py-4 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
      >
        {loading ? <><Loader2 className="size-4 animate-spin" />Criando…</> : <><UserPlus className="size-4" />Criar Usuário</>}
      </Button>
    </form>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-500" />
      <p className="text-xs text-red-700">{msg}</p>
    </div>
  );
}
