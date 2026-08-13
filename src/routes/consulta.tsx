import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Search, ArrowLeft, CheckCircle2, AlertCircle, Database, ArrowRight } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/grf/chrome";
import { Field } from "@/components/grf/field";
import { StatusBadge } from "@/components/grf/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPlate, trackRegistration } from "@/lib/grf.functions";
import { lookupSankhyaVehicle } from "@/lib/grf-vehicle-catalog.functions";
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
type MasterResult = Awaited<ReturnType<typeof lookupSankhyaVehicle>>;
type Mode = "protocol" | "plate";

function Consulta() {
  const track = useServerFn(trackRegistration);
  const verifyPlate = useServerFn(checkPlate);
  const lookupVehicle = useServerFn(lookupSankhyaVehicle);
  const [mode, setMode] = useState<Mode>("protocol");

  const [protocol, setProtocol] = useState("");
  const [doc, setDoc] = useState("");
  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [plateResult, setPlateResult] = useState<PlateResult | null>(null);
  const [masterResult, setMasterResult] = useState<MasterResult | null>(null);

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
    setMasterResult(null);
    try {
      const normalizedPlate = plate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
      const [portal, master] = await Promise.all([
        verifyPlate({ data: { plate: normalizedPlate } }),
        lookupVehicle({ data: { plate: normalizedPlate } }),
      ]);
      setPlateResult(portal);
      setMasterResult(master);
    } finally {
      setLoading(false);
    }
  }

  const masterVehicle = masterResult?.found ? masterResult.vehicle : null;

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
              Consulte a placa para saber se o veículo já existe no cadastro mestre da GRF e quais informações ainda precisam ser completadas.
            </p>

            <form onSubmit={onPlateSubmit} className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
              <Field label="Placa do veículo" required>
                <Input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7))}
                  placeholder="ABC1D23"
                  maxLength={7}
                  autoComplete="off"
                  className="font-display text-lg font-bold tracking-widest uppercase"
                />
              </Field>
              <Button type="submit" disabled={loading || plate.replace(/[^A-Z0-9]/g, "").length < 7} className="w-full">
                <Search className="size-4" /> {loading ? "Consultando..." : "Consultar placa"}
              </Button>
            </form>

            {masterVehicle && (
              <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <Database className="mt-0.5 size-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">Veículo encontrado</p>
                      <span className="rounded-full border border-primary/30 bg-background/70 px-2.5 py-1 text-[10px] font-bold tracking-wide text-primary uppercase">
                        Cadastro básico existente
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A placa <strong>{prettyPlate(masterVehicle.plate)}</strong> já está no banco de dados da GRF
                      {masterVehicle.sankhyaRegistered ? " e foi localizada no Sankhya" : ""}. Você não precisa começar do zero.
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <VehicleInfo label="Modelo" value={masterVehicle.model} />
                      <VehicleInfo label="Tipo / classificação" value={masterVehicle.fleetVehicleType} />
                      <VehicleInfo
                        label="Lotação conhecida"
                        value={masterVehicle.capacityKg == null ? null : `${masterVehicle.capacityKg.toLocaleString("pt-BR")} kg`}
                      />
                      <VehicleInfo label="Quantidade de pallets" value={masterVehicle.pallets == null ? null : String(masterVehicle.pallets)} />
                      <VehicleInfo label="Transportadora" value={masterVehicle.transporterName} />
                      <VehicleInfo label="Operação / ponto de apoio" value={[masterVehicle.operation, masterVehicle.supportPoint].filter(Boolean).join(" · ") || null} />
                    </div>

                    {masterVehicle.missingFields.length > 0 && (
                      <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-5">
                        <strong>Cadastro ainda incompleto.</strong> O transportador deverá complementar: {masterVehicle.missingFields.join(", ")} e anexar os documentos/fotos exigidos.
                      </div>
                    )}

                    {!plateResult?.exists && (
                      <Button asChild className="mt-4">
                        <a href={`/completar-cadastro?plate=${encodeURIComponent(masterVehicle.plate)}`}>
                          Terminar cadastro <ArrowRight className="size-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {masterResult && !masterResult.found && !plateResult?.exists && (
              <div className="mt-5 rounded-xl border border-[#00c853]/30 bg-[#00c853]/10 p-5">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-5 text-[#00a844]" />
                  <div>
                    <p className="font-bold">Placa nova no Portal GRF</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Não encontramos <strong>{prettyPlate(plate)}</strong> no cadastro mestre. Neste caso, o cadastro começa normalmente do zero.
                    </p>
                    <Button asChild className="mt-4">
                      <Link to="/cadastro">Cadastrar veículo</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {plateResult?.exists && (
              <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 text-destructive" />
                  <div>
                    <p className="font-bold">Este veículo já possui um cadastro enviado</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A placa <strong>{prettyPlate(plate)}</strong> já passou pela etapa de envio no Portal GRF.
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

function VehicleInfo({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm font-bold">{value && value !== "-" ? value : "Não informado"}</p>
    </div>
  );
}
