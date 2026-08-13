import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Database, Loader2, Search } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/grf/chrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkPlate } from "@/lib/grf.functions";
import { lookupSankhyaVehicle } from "@/lib/grf-vehicle-catalog.functions";
import { prepareVehicleMaster } from "@/lib/grf-start-registration.functions";
import { formatPlate, isValidPlate, prettyPlate, STATUS_LABEL } from "@/lib/grf-domain";

export const Route = createFileRoute("/iniciar-cadastro")({
  head: () => ({
    meta: [
      { title: "Iniciar cadastro – Portal GRF" },
      {
        name: "description",
        content: "Informe primeiro a placa para aproveitar os dados que a GRF ja possui do veiculo.",
      },
    ],
  }),
  component: IniciarCadastro,
});

type PlateResult = Awaited<ReturnType<typeof checkPlate>>;
type MasterResult = Awaited<ReturnType<typeof lookupSankhyaVehicle>>;

function IniciarCadastro() {
  const verifyPlate = useServerFn(checkPlate);
  const lookupVehicle = useServerFn(lookupSankhyaVehicle);
  const prepareVehicle = useServerFn(prepareVehicleMaster);

  const [plate, setPlate] = useState("");
  const [loading, setLoading] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plateResult, setPlateResult] = useState<PlateResult | null>(null);
  const [masterResult, setMasterResult] = useState<MasterResult | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("plate") ?? "";
    const normalized = formatPlate(raw);
    if (normalized.length === 7) setPlate(normalized);
  }, []);

  async function searchPlate(event: React.FormEvent) {
    event.preventDefault();
    const normalized = formatPlate(plate);
    setError(null);
    setPlateResult(null);
    setMasterResult(null);

    if (!isValidPlate(normalized)) {
      setError("Informe uma placa valida no padrao ABC1234 ou ABC1D23.");
      return;
    }

    setLoading(true);
    try {
      const [portal, master] = await Promise.all([
        verifyPlate({ data: { plate: normalized } }),
        lookupVehicle({ data: { plate: normalized } }),
      ]);
      setPlate(normalized);
      setPlateResult(portal);
      setMasterResult(master);
    } catch {
      setError("Nao foi possivel consultar a placa. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  async function continueRegistration() {
    const normalized = formatPlate(plate);
    setContinuing(true);
    setError(null);
    try {
      const result = await prepareVehicle({ data: { plate: normalized } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.location.assign(`/completar-cadastro?plate=${encodeURIComponent(normalized)}`);
    } catch {
      setError("Nao foi possivel preparar o cadastro. Tente novamente.");
    } finally {
      setContinuing(false);
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

        <div className="mt-5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Primeiro passo</p>
          <h1 className="mt-1 text-2xl font-bold">Informe a placa do veiculo</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Antes de pedir os dados do transportador, o Portal verifica se a GRF ja possui um cadastro basico desta placa.
          </p>
        </div>

        <form onSubmit={searchPlate} className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm">
          <label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Placa do veiculo *</label>
          <div className="mt-2 flex gap-3 max-sm:flex-col">
            <Input
              value={prettyPlate(plate)}
              onChange={(e) => setPlate(formatPlate(e.target.value))}
              placeholder="ABC-1D23"
              autoComplete="off"
              className="font-display h-12 flex-1 text-lg font-bold tracking-widest uppercase"
            />
            <Button type="submit" className="h-12" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {loading ? "Consultando..." : "Continuar"}
            </Button>
          </div>
          {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}
        </form>

        {plateResult?.exists && (
          <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div>
                <p className="font-bold">Este veiculo ja possui cadastro enviado</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A placa <strong>{prettyPlate(plate)}</strong> ja passou pela etapa de envio no Portal GRF.
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

        {!plateResult?.exists && masterVehicle && (
          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="font-bold">Veiculo encontrado — continue o cadastro</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ja temos informacoes basicas desta placa. O formulario seguinte sera preenchido automaticamente com o que estiver salvo.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Info label="Modelo" value={masterVehicle.model} />
                  <Info label="Tipo / classificacao" value={masterVehicle.fleetVehicleType} />
                  <Info
                    label="Lotacao conhecida"
                    value={masterVehicle.capacityKg == null ? null : `${masterVehicle.capacityKg.toLocaleString("pt-BR")} kg`}
                  />
                  <Info label="Pallets" value={masterVehicle.pallets == null ? null : String(masterVehicle.pallets)} />
                </div>
                <Button onClick={continueRegistration} disabled={continuing} className="mt-4">
                  {continuing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  {continuing ? "Preparando..." : "Continuar para o transportador"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {!plateResult?.exists && masterResult && !masterResult.found && (
          <div className="mt-5 rounded-xl border border-[#00c853]/30 bg-[#00c853]/10 p-5">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#00a844]" />
              <div>
                <p className="font-bold">Placa nova no cadastro mestre</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nao encontramos dados anteriores para <strong>{prettyPlate(plate)}</strong>. A placa sera criada no banco e o transportador completa as informacoes normalmente.
                </p>
                <Button onClick={continueRegistration} disabled={continuing} className="mt-4">
                  {continuing ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                  {continuing ? "Preparando..." : "Continuar para o transportador"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm font-bold">{value && value !== "-" ? value : "Nao informado"}</p>
    </div>
  );
}
