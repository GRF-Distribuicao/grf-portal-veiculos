import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, ArrowLeft } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/grf/chrome";
import { Field } from "@/components/grf/field";
import { StatusBadge } from "@/components/grf/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackRegistration } from "@/lib/grf.functions";
import { formatDoc, formatDateTime, prettyPlate, STATUS_LABEL } from "@/lib/grf-domain";

export const Route = createFileRoute("/consulta")({
  head: () => ({
    meta: [
      { title: "Consultar protocolo – Portal GRF" },
      {
        name: "description",
        content: "Acompanhe o andamento do seu cadastro de veículo na GRF usando protocolo e CPF/CNPJ.",
      },
      { property: "og:title", content: "Consultar protocolo – Portal GRF" },
      { property: "og:description", content: "Acompanhe a análise do seu cadastro de veículo." },
    ],
  }),
  component: Consulta,
});

type Result = Awaited<ReturnType<typeof trackRegistration>>;

function Consulta() {
  const track = useServerFn(trackRegistration);
  const [protocol, setProtocol] = useState("");
  const [doc, setDoc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      setResult(await track({ data: { protocol, doc } }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Consultar andamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe o protocolo recebido no envio e o CPF/CNPJ do transportador.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-lg border border-border bg-card p-5">
          <Field label="Protocolo" required>
            <Input
              value={protocol}
              onChange={(e) => setProtocol(e.target.value.toUpperCase())}
              placeholder="GRF-2026-XXXXXX"
            />
          </Field>
          <Field label="CPF / CNPJ" required>
            <Input value={doc} onChange={(e) => setDoc(formatDoc(e.target.value))} placeholder="000.000.000-00" />
          </Field>
          <Button type="submit" disabled={loading} className="w-full">
            <Search className="size-4" /> {loading ? "Consultando..." : "Consultar"}
          </Button>
        </form>

        {result && !result.ok && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm font-medium text-destructive">
            {result.error}
          </p>
        )}

        {result?.ok && (
          <div className="mt-6 rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-bold">{result.registration.protocol}</p>
                <p className="text-sm text-muted-foreground">
                  Placa {prettyPlate(result.registration.plate)} · {result.registration.transporterName}
                </p>
              </div>
              <StatusBadge status={result.registration.status} />
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              Enviado em {formatDateTime(result.registration.submittedAt)} · atualizado em{" "}
              {formatDateTime(result.registration.updatedAt)}
            </p>

            <h2 className="mt-6 text-sm font-bold">Histórico</h2>
            <ol className="mt-3 space-y-3">
              {result.history.map((h, i) => (
                <li key={i} className="border-l-2 border-border pl-4">
                  <p className="text-sm font-semibold">{STATUS_LABEL[h.to_status] ?? h.to_status}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(h.created_at)} · {h.user_name}
                  </p>
                  {h.note && <p className="mt-1 text-sm">{h.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
