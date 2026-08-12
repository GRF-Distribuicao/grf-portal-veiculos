import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, LockKeyhole, ShieldCheck, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GrfLogo } from "@/components/grf/chrome";
import { Field } from "@/components/grf/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createGrfAccessRequest } from "@/lib/grf-access.functions";

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

type Mode = "login" | "request";

function LoginPage() {
  const navigate = useNavigate();
  const requestAccess = useServerFn(createGrfAccessRequest);

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;

      const userId = data.session.user.id;
      const { data: role } = await (supabase as any)
        .from("user_roles")
        .select("role, must_change_password")
        .eq("user_id", userId)
        .maybeSingle();

      if (!role) {
        await supabase.auth.signOut();
        return;
      }

      if (role.must_change_password) {
        void navigate({ to: "/alterar-senha", replace: true });
      } else {
        void navigate({ to: "/admin", replace: true });
      }
    })();
  }, [navigate]);

  function resetMessages() {
    setError(null);
    setSuccess(null);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError || !data.user) {
      setLoading(false);
      setError("Usuário ou senha inválidos.");
      return;
    }

    const { data: role } = await (supabase as any)
      .from("user_roles")
      .select("role, must_change_password")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (!role) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Seu acesso à Área GRF ainda não foi aprovado.");
      return;
    }

    setLoading(false);
    if (role.must_change_password) {
      toast.info("Por segurança, altere a senha temporária no primeiro acesso.");
      void navigate({ to: "/alterar-senha", replace: true });
      return;
    }

    toast.success("Acesso liberado.");
    void navigate({ to: "/admin", replace: true });
  }

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    resetMessages();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@grfdistribuicao.com.br")) {
      setError("Use seu e-mail corporativo @grfdistribuicao.com.br.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Informe seu nome.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { name: name.trim(), grf_access_pending: true } },
    });

    if (signUpError || !signUp.user) {
      setLoading(false);
      setError(signUpError?.message?.toLowerCase().includes("registered")
        ? "Este e-mail já possui cadastro ou uma solicitação de acesso."
        : "Não foi possível criar a solicitação de acesso.");
      return;
    }

    // Em projetos com proteção contra enumeração, identities vazio indica e-mail já existente.
    if (Array.isArray(signUp.user.identities) && signUp.user.identities.length === 0) {
      await supabase.auth.signOut();
      setLoading(false);
      setError("Este e-mail já possui cadastro ou uma solicitação de acesso.");
      return;
    }

    const result = await requestAccess({
      data: { userId: signUp.user.id, name: name.trim(), email: normalizedEmail },
    });

    // Uma solicitação pendente jamais deve permanecer autenticada na Área GRF.
    await supabase.auth.signOut();
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccess(
      "Solicitação registrada. Aguarde a aprovação de um dos responsáveis da GRF antes de entrar.",
    );
    if (result.emailSent) {
      toast.success("Solicitação enviada aos responsáveis pela aprovação.");
    } else {
      toast.success("Solicitação de acesso registrada.");
    }
  }

  function changeMode(next: Mode) {
    resetMessages();
    setPassword("");
    setConfirmPassword("");
    setMode(next);
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
              {mode === "login" ? <LockKeyhole className="size-5" /> : <UserPlus className="size-5" />}
            </span>
            <div>
              <h1 className="font-display text-xl font-extrabold">
                {mode === "login" ? "Login GRF" : "Solicitar acesso"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {mode === "login"
                  ? "Área interna de análise de cadastros."
                  : "O acesso só será liberado após aprovação da equipe responsável."}
              </p>
            </div>
          </div>

          <form onSubmit={mode === "login" ? handleLogin : handleRequest} className="mt-6 space-y-4">
            {mode === "request" && (
              <Field label="Nome" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  autoComplete="name"
                  required
                />
              </Field>
            )}

            <Field label="Usuário (e-mail)" required>
              <Input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@grfdistribuicao.com.br"
                required
              />
            </Field>

            <Field
              label="Senha"
              required
              {...(mode === "request" ? { hint: "Mínimo de 8 caracteres." } : {})}
            >
              <Input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>

            {mode === "request" && (
              <Field label="Confirmar senha" required>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </Field>
            )}

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}

            {success && (
              <div className="rounded-md border border-primary/30 bg-primary/10 px-3 py-3 text-sm">
                <div className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p>{success}</p>
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "Entrar" : "Enviar solicitação"}
            </Button>
          </form>

          <div className="mt-5 border-t border-border pt-5 text-center">
            {mode === "login" ? (
              <button
                type="button"
                onClick={() => changeMode("request")}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Solicitar acesso à Área GRF
              </button>
            ) : (
              <button
                type="button"
                onClick={() => changeMode("login")}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Já tenho acesso — voltar ao login
              </button>
            )}
          </div>
        </div>

        <Link to="/" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">
          Voltar ao portal do transportador
        </Link>
      </main>
    </div>
  );
}
