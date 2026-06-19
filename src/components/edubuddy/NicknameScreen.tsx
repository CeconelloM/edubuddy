import { useState } from "react";
import mascot from "@/assets/edubuddy-mascot.png";
import { supabase } from "@/services/supabase";

const NICKNAME_RE = /^[a-zA-Z0-9_]+$/;

export function NicknameScreen({
  userId,
  onComplete,
}: {
  userId: string;
  onComplete: (nickname: string) => void;
}) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const isValid = trimmed.length >= 2 && trimmed.length <= 20 && NICKNAME_RE.test(trimmed);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    setLoading(true);

    const { error: err } = await supabase
      .from("profiles")
      .update({ nickname: trimmed })
      .eq("id", userId);

    setLoading(false);

    if (err) {
      console.error("Erro detalhado do Supabase:", err);
      setError(`Não foi possível salvar. [${err.code}] ${err.message}`);
      return;
    }

    onComplete(trimmed);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col justify-center px-6 py-12">
        {/* Mascot */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="grid size-24 place-items-center rounded-3xl bg-brand-blue-soft ring-1 ring-brand-blue/20">
            <img src={mascot} alt="EduBuddy" width={80} height={80} className="size-20 object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">Crie o seu apelido!</h1>
            <p className="mx-auto mt-2 max-w-[30ch] text-center text-sm text-muted-foreground text-pretty">
              Ele manterá seu anonimato nas salas e na comunidade do app.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="nickname">
              Apelido
            </label>
            <input
              id="nickname"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="ex: Mystery_Fox"
              className="h-12 w-full rounded-2xl bg-surface px-4 text-sm text-foreground ring-1 ring-border placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
            />
            <p className="text-[11px] text-muted-foreground/70">
              2–20 caracteres · letras, números e _ permitidos
            </p>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600 ring-1 ring-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !isValid}
            className="mt-2 w-full rounded-2xl bg-brand-green py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-brand-green/20 transition-all enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {loading ? "Salvando…" : "Salvar e continuar"}
          </button>
        </form>
      </div>

      <p className="pb-8 text-center text-xs text-muted-foreground/60">
        Você pode mudar seu apelido depois nas configurações.
      </p>
    </div>
  );
}
