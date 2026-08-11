import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/grf/chrome";
import { Field } from "@/components/grf/field";
import { StatusBadge } from "@/components/grf/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPlate, trackRegistration } from "@/lib/grf.functions";
import { formatDoc, formatDateTime, prettyPlate, STATUS_LABEL } from "@/lib/grf-domain";

export const Route = createFileRoute("/consulta")({
  head: () => ({
    meta: [
      { title: "Consulta – Portal GRF" },
      {
        name: "description",
        content: "Consulte uma placa antes do cadastro ou acompanhe seu protocolo de veículo na GRF.",
      },
      { property: "og:title", content: "Consulta – Portal GRF" },
      { property: "og:description", content: "Consulta de placa e acompanhamento de cadastro de veículo." },
    ],
  }),
  component: Consulta,
});

type Result = Awaited<ReturnType<typeof trackRegistration>>;
type PlateResult = Awaited<ReturnType<typeof checkPlate>>;

type Mode = "protocol" | "plate";

function Consulta() {
  const track = useServerFn(trackRegistration);
  const verifyPlate = useServerFn(checkPlate);
  const [mode, setMode] = useState<Mode>("protocol");

  const [protocol, setProtocol] = useState("");
  const [doc, setDoc] = useState("");
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [plateResult, setPlateResult] = useState<PlateResult | null>(null);

  useEffect(() => {
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    setMode(requestedMode === "plate" ? "plate" : "protocol");
  }, []);

  async function onProtocolSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      setResult(await track({ data: { protocol, doc } }));
    } finally {
      setLoading(false);
    }
  }

  async function onPlateSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setPlateResult(null);
    try {
      setPlateResult(await verifyPlate({ data: { plate } }));
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

        <div className="mt-5 inline-flex rounded-lg border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setMode("plate")}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${mode === "plate" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Consultar placa
          </button>
          <button
            type="button"
            onClick={() => setMode("protocol")}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${mode === "protocol" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            Consultar protocolo
          </button>
        </div>

        {mode === "plate" ? (
          <>
            <h1 className="mt-5 text-2xl font-bold">Consultar placa</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Consulte a placa antes de iniciar o cadastro para confirmar se já existe um cadastro no Portal GRF.
            </p>

            <form onSubmit={onPlateSubmit} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <Field label="Placa do veículo" required>
                <Input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="ABC1D23"
                  maxLength={7}
                  autoComplete="off"
                />
              </Field>
              <Button type="submit" disabled={loading || plate.replace(/[^A-Z0-9]/g, "").length < 7} className="w-full">
                <Search className="size-4" /> {loading ? "Consultando..." : "Consultar placa"}
              </Button>
            </form>

            {plateResult?.exists && (
              <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 text-destructive" />
                  <div>
                    <p className="font-bold">Veículo já possui cadastro</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A placa <strong>{prettyPlate(plate)}</strong> já está registrada no Portal GRF.
                    </p>
                    {plateResult.protocol && (
                      <p className="mt-2 text-sm font-semibold">
                        Protocolo: {plateResult.protocol}
                        {plateResult.status ? ` · ${STATUS_LABEL[plateResult.status] ?? plateResult.status}` : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {plateResult && !plateResult.exists && (
              <div className="mt-5 rounded-xl border border-[#00c853]/30 bg-[#00c853]/10 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 text-[#00a844]" />
                  <div>
                    <p className="font-bold">Placa disponível para cadastro</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Não encontramos cadastro para <strong>{prettyPlate(plate)}</strong>. Você pode iniciar o cadastro do veículo.
                    </p>
                    <Button asChild className="mt-4">
                      <Link to="/cadastro">Cadastrar veículo</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="mt-5 text-2xl font-bold">Consultar protocolo</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Informe o protocolo recebido no envio e o CPF/CNPJ do transportador.
            </p>

            <form onSubmit={onProtocolSubmit} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
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
              <div className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
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
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
