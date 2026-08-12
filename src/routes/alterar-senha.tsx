import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { GrfLogo } from "@/components/grf/chrome";
import { Field } from "@/components/grf/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeFirstPasswordChange } from "@/lib/grf-access.functions";

export const Route = createFileRoute("/alterar-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Alterar senha – Área GRF" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FirstPasswordChangePage,
});

function FirstPasswordChangePage() {
  const navigate = useNavigate();
  const complete = useServerFn(completeFirstPasswordChange);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) {
        void navigate({ to: "/login", replace: true });
        return;
      }

      const { data: role } = await (supabase as any)
        .from("user_roles")
        .select("role, must_change_password")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!role) {
        await supabase.auth.signOut();
        void navigate({ to: "/login", replace: true });
        return;
      }

      if (!role.must_change_password) {
        void navigate({ to: "/admin", replace: true });
        return;
      }
      setChecking(false);
    })();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password === "12345") {
      setError("Escolha uma senha diferente da senha temporária.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError("Não foi possível alterar a senha. Tente novamente.");
      return;
    }

    const result = await complete();
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success("Senha alterada com sucesso.");
    void navigate({ to: "/admin", replace: true });
  }

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="grf-topbar">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/">
            <GrfLogo inverted />
          </Link>
          <span className="text-xs font-semibold tracking-wide uppercase opacity-80">Primeiro acesso</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="size-5" />
            </span>
            <div>
              <h1 className="font-display text-xl font-extrabold">Crie sua nova senha</h1>
              <p className="text-xs text-muted-foreground">
                A senha temporária só pode ser usada no primeiro acesso.
              </p>
            </div>
          </div>

          <div className="mt-5 flex gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p>Por segurança, escolha uma senha pessoal com pelo menos 8 caracteres.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Nova senha" required hint="Mínimo de 8 caracteres.">
              <Input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <Field label="Confirmar nova senha" required>
              <Input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              Salvar nova senha e entrar
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
