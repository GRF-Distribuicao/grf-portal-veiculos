import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, CheckCircle2, Loader2, Search, UserPlus } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/grf/chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { transporterSupabase } from "@/integrations/supabase/transporter-client";
import { lookupTransporterCnpj } from "@/lib/grf-cnpj.functions";
import { createTransporterAccessRequest } from "@/lib/grf-transporter-access.functions";

export const Route = createFileRoute("/transportador/solicitar-acesso")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Solicitar acesso – Área do Transportador" },
      {
        name: "description",
        content: "Solicitação de acesso de transportadoras ao Portal de Veículos GRF.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TransporterAccessRequestPage,
});

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnpj(value: string) {
  const raw = digits(value).slice(0, 14);
  return raw
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

type CnpjLookupInfo = {
  officialName: string | null;
  tradeName: string | null;
  city: string | null;
  uf: string | null;
  cadastralStatus: string | null;
  knownToPortal: boolean;
  publicLookupUnavailable: boolean;
};

function TransporterAccessRequestPage() {
  const createRequest = useServerFn(createTransporterAccessRequest);
  const lookupCnpj = useServerFn(lookupTransporterCnpj);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [cnpjBusy, setCnpjBusy] = useState(false);
  const [cnpjLookup, setCnpjLookup] = useState<CnpjLookupInfo | null>(null);
  const [manualCompanyAllowed, setManualCompanyAllowed] = useState(false);
  const [cnpjError, setCnpjError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleCnpjChange(value: string) {
    setCompanyCnpj(formatCnpj(value));
    setCompanyName("");
    setCnpjLookup(null);
    setManualCompanyAllowed(false);
    setCnpjError(null);
    setError(null);
  }

  async function handleCnpjLookup() {
    setCnpjError(null);
    setError(null);
    setCnpjLookup(null);
    setManualCompanyAllowed(false);

    if (digits(companyCnpj).length !== 14) {
      setCnpjError("Informe o CNPJ completo com 14 dígitos.");
      return;
    }

    setCnpjBusy(true);
    try {
      const result = await lookupCnpj({ data: { cnpj: companyCnpj } });
      if (!result.ok) {
        setCompanyName("");
        setManualCompanyAllowed(Boolean(result.allowManual));
        setCnpjError(result.error);
        return;
      }

      setManualCompanyAllowed(false);
      setCompanyName(result.companyName);
      setCnpjLookup({
        officialName: result.officialName,
        tradeName: result.tradeName,
        city: result.city,
        uf: result.uf,
        cadastralStatus: result.cadastralStatus,
        knownToPortal: result.knownToPortal,
        publicLookupUnavailable: result.publicLookupUnavailable,
      });
    } catch {
      setCompanyName("");
      setCnpjError("Não foi possível consultar o CNPJ agora. Tente novamente.");
    } finally {
      setCnpjBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (digits(companyCnpj).length !== 14) {
      setError("Informe um CNPJ válido com 14 dígitos.");
      return;
    }
    if (!cnpjLookup && !manualCompanyAllowed) {
      setError("Consulte o CNPJ antes de continuar.");
      return;
    }
    if (companyName.trim().length < 2) {
      setError("Informe a razão social da empresa.");
      return;
    }
    if (name.trim().length < 2) {
      setError("Informe o nome do responsável.");
      return;
    }
    if (!normalizedEmail.includes("@")) {
      setError("Informe um e-mail válido.");
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

    setBusy(true);
    const { data: signUp, error: signUpError } = await transporterSupabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/transportador`,
        data: {
          name: name.trim(),
          company_name: companyName.trim(),
          company_cnpj: digits(companyCnpj),
          transporter_access_pending: true,
        },
      },
    });

    if (signUpError || !signUp.user) {
      setBusy(false);
      setError(
        signUpError?.message?.toLowerCase().includes("registered")
          ? "Este e-mail já possui cadastro. Use o login ou a opção de recuperar senha."
          : "Não foi possível criar a solicitação de acesso.",
      );
      return;
    }

    if (Array.isArray(signUp.user.identities) && signUp.user.identities.length === 0) {
      await transporterSupabase.auth.signOut();
      setBusy(false);
      setError("Este e-mail já possui cadastro. Use o login ou a opção de recuperar senha.");
      return;
    }

    const result = await createRequest({
      data: {
        userId: signUp.user.id,
        name: name.trim(),
        email: normalizedEmail,
        companyName: companyName.trim(),
        companyCnpj: digits(companyCnpj),
      },
    });

    await transporterSupabase.auth.signOut();
    setBusy(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-12">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          {success ? (
            <div className="text-center">
              <CheckCircle2 className="mx-auto size-12 text-success" />
              <h1 className="mt-4 font-display text-xl font-extrabold">Solicitação enviada</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                A GRF vai conferir o CNPJ e vincular seu usuário à transportadora correta. Enquanto a solicitação não for aprovada, nenhum veículo fica disponível para este acesso.
              </p>
              <Button asChild className="mt-6 w-full bg-blue-600 text-white hover:bg-blue-700">
                <Link to="/transportador">Voltar ao login</Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                  <UserPlus className="size-5" />
                </span>
                <div>
                  <h1 className="font-display text-xl font-extrabold">Solicitar acesso</h1>
                  <p className="text-xs text-muted-foreground">Área do Transportador</p>
                </div>
              </div>

              <div className="mt-5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-xs leading-5 text-muted-foreground">
                <div className="flex gap-2">
                  <Building2 className="mt-0.5 size-4 shrink-0 text-blue-600" />
                  <p>
                    Informe primeiro o CNPJ. O Portal consulta os dados da empresa e preenche a razão social antes de liberar a solicitação de acesso.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label>CNPJ da empresa</Label>
                  <div className="flex gap-2 max-sm:flex-col">
                    <Input
                      value={companyCnpj}
                      onChange={(event) => handleCnpjChange(event.target.value)}
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00"
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleCnpjLookup()}
                      disabled={cnpjBusy || digits(companyCnpj).length !== 14}
                      className="shrink-0"
                    >
                      {cnpjBusy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                      {cnpjBusy ? "Consultando..." : "Consultar CNPJ"}
                    </Button>
                  </div>
                  {cnpjError && <p className="text-xs font-medium text-destructive">{cnpjError}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Nome / Razão social da empresa</Label>
                  <Input
                    value={companyName}
                    readOnly={Boolean(cnpjLookup)}
                    onChange={(event) => setCompanyName(event.target.value)}
                    placeholder={manualCompanyAllowed ? "Informe a razão social" : "Preenchido após a consulta do CNPJ"}
                    required
                  />
                  {manualCompanyAllowed && !cnpjLookup && (
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
                      A consulta pública está indisponível. Preencha a razão social manualmente; a GRF continuará validando o CNPJ antes de liberar o acesso.
                    </p>
                  )}
                  {cnpjLookup && (
                    <div className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs leading-5 text-muted-foreground">
                      <p className="font-semibold text-foreground">
                        CNPJ localizado{cnpjLookup.knownToPortal ? " · transportadora já cadastrada no Portal GRF" : ""}.
                      </p>
                      {cnpjLookup.tradeName && <p>Nome fantasia: {cnpjLookup.tradeName}</p>}
                      {(cnpjLookup.city || cnpjLookup.uf) && (
                        <p>Localidade: {[cnpjLookup.city, cnpjLookup.uf].filter(Boolean).join(" / ")}</p>
                      )}
                      {cnpjLookup.cadastralStatus && <p>Situação cadastral: {cnpjLookup.cadastralStatus}</p>}
                      {cnpjLookup.publicLookupUnavailable && (
                        <p>Os dados complementares da consulta pública estão temporariamente indisponíveis.</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Nome do responsável</Label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
                </div>

                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Senha</Label>
                    <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirmar senha</Label>
                    <Input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">A senha deve ter no mínimo 8 caracteres.</p>

                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700" disabled={busy || cnpjBusy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                  Enviar solicitação
                </Button>
              </form>

              <div className="mt-5 border-t border-border pt-5 text-center">
                <Link to="/transportador" className="text-sm font-semibold text-blue-600 hover:underline">
                  Já tenho acesso — voltar ao login
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
