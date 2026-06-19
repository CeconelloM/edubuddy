import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import mascot from "@/assets/edubuddy-mascot.png";
import { supabase } from "@/services/supabase";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (err) {
      setError("E-mail ou senha incorretos. Tente novamente.");
    }
    // success: onAuthStateChange in App.tsx takes over
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex flex-1 flex-col justify-center px-6 py-12">
        {/* Mascot */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="grid size-24 place-items-center rounded-3xl bg-brand-green-soft ring-1 ring-brand-green/20">
            <img src={mascot} alt="EduBuddy" width={80} height={80} className="size-20 object-contain" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">
              Bem-vindo ao <span className="text-brand-green">EduBuddy</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Entre com o e-mail cadastrado pela escola.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="h-12 w-full rounded-2xl bg-surface px-4 text-sm text-foreground ring-1 ring-border placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-green/40"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="password">
              Senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPass ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 w-full rounded-2xl bg-surface px-4 pr-12 text-sm text-foreground ring-1 ring-border placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-green/40"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 grid size-7 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-600 ring-1 ring-red-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="mt-2 w-full rounded-2xl bg-brand-green py-4 text-base font-semibold text-primary-foreground shadow-lg shadow-brand-green/20 transition-all enabled:hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>

      <p className="pb-8 text-center text-xs text-muted-foreground/60">
        EduBuddy · sua escola de inglês
      </p>
    </div>
  );
}
