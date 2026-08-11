import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GrfLogo } from "@/components/grf/chrome";
import { Field } from "@/components/grf/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createFirstGrfAdmin, grfAdminExists } from "@/lib/grf-admin.functions";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Login GRF – Área interna do Portal de Veículos" },
      {
        name: "description",
        content: "Acesso restrito à equipe GRF para análise e aprovação de cadastros de veículos.",
      },
      { property: "og:title", content: "Login GRF – Portal de Veículos" },
      { property: "og:description", content: "Acesso restrito da equipe GRF." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const checkAdmin = useServerFn(grfAdminExists);
  const createAdmin = useServerFn(createFirstGrfAdmin);

  const [mode, setMode] = useState<"login" | "setup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        void navigate({ to: "/admin", replace: true });
        return;
      }
      const r = await checkAdmin();
      if (active && !r.exists) setMode("setup");
    })();
    return () => {
      active = false;
    };
  }, [checkAdmin, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (signInError) {
      setError("Usuário ou senha inválidos.");
      return;
    }
    toast.success("Acesso liberado.");
    void navigate({ to: "/admin", replace: true });
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    setLoading(true);
    const res = await createAdmin({ data: { email: email.trim().toLowerCase(), password } });
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    toast.success("Primeiro acesso criado. Faça login.");
    setMode("login");
    setPassword("");
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="grf-topbar">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/">
            <GrfLogo inverted />
          </Link>
          <span className="text-xs font-semibold tracking-wide uppercase opacity-80">
            Acesso restrito
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              {mode === "login" ? <LockKeyhole className="size-5" /> : <ShieldCheck className="size-5" />}
            </span>
            <div>
              <h1 className="font-display text-xl font-extrabold">
                {mode === "login" ? "Login GRF" : "Primeiro acesso GRF"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {mode === "login"
                  ? "Área interna de análise de cadastros."
                  : "Crie o usuário administrativo inicial da equipe."}
              </p>
            </div>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleSetup} className="mt-6 space-y-4">
            <Field label="Usuário (e-mail)" required>
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@grf.com.br"
                required
              />
            </Field>
            <Field label="Senha" required {...(mode === "setup" ? { hint: "Mínimo de 8 caracteres." } : {})}>
              <Input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar acesso"}
            </Button>
          </form>
        </div>

        <Link to="/" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">
          Voltar ao portal do transportador
        </Link>
      </main>
    </div>
  );
}
