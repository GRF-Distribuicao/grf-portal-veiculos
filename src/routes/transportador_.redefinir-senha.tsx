import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/grf/chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { transporterSupabase } from "@/integrations/supabase/transporter-client";

export const Route = createFileRoute("/transportador/redefinir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha – Área do Transportador" },
      { name: "description", content: "Redefinição de senha da Área do Transportador GRF." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetTransporterPassword,
});

function ResetTransporterPassword() {
  const [checking, setChecking] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let mounted = true;

    const { data: listener } = transporterSupabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
        setChecking(false);
      }
    });

    void transporterSupabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) setHasRecoverySession(true);
      setChecking(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setBusy(true);
    const { error: updateError } = await transporterSupabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      setError("Não foi possível alterar a senha. Solicite um novo link de recuperação.");
      return;
    }

    await transporterSupabase.auth.signOut();
    setDone(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {done ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto size-12 text-success" />
              <h1 className="mt-4 font-display text-xl font-extrabold">Senha alterada com sucesso</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Use a nova senha para entrar na Área do Transportador.
              </p>
              <Button asChild className="mt-6 w-full bg-blue-600 text-white hover:bg-blue-700">
                <Link to="/transportador">Voltar ao login</Link>
              </Button>
            </div>
          ) : checking ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Validando link de recuperação...
            </div>
          ) : !hasRecoverySession ? (
            <div className="text-center">
              <KeyRound className="mx-auto size-10 text-muted-foreground" />
              <h1 className="mt-4 font-display text-xl font-extrabold">Link inválido ou expirado</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Volte à Área do Transportador e solicite um novo link em “Esqueci minha senha”.
              </p>
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link to="/transportador">Voltar</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                  <KeyRound className="size-5" />
                </span>
                <div>
                  <h1 className="font-display text-xl font-extrabold">Criar nova senha</h1>
                  <p className="text-xs text-muted-foreground">Defina uma nova senha para seu acesso.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label>Nova senha</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Confirmar nova senha</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
                </div>
                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700" disabled={busy}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  Salvar nova senha
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
