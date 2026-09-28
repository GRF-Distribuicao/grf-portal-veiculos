import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  Package,
  RotateCcw,
  Search,
  Truck,
  Weight,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listRoutingAvailability, setRoutingVehicleUsage } from "@/lib/grf-routing-availability.functions";
import { prettyPlate } from "@/lib/grf-domain";
import {
  AVAILABILITY_CUTOFF,
  compareDistribution,
  compareTransbordo,
  isTransbordoVehicle,
} from "@/lib/grf-availability-rules";

export const Route = createFileRoute("/admin/disponibilidade")({
  head: () => ({
    meta: [
      { title: "Disponibilidade para roteirização – Área GRF" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RoutingAvailabilityPage,
});

type CompanyRow = {
  id: string;
  name: string;
  fleetCount: number;
  approvedCount: number | null;
  informed: boolean;
  revision: number | null;
  submittedAt: string | null;
  availableCount: number;
  capacityKg: number;
  pallets: number;
};

type VehicleRow = {
  id: string;
  plate: string;
  brand_model: string | null;
  vehicle_type: string | null;
  lotacao_kg: number | null;
  pallets: number | null;
  completion_status: string | null;
  sankhya_registered: boolean | null;
  available_from: string | null;
  availability_note: string | null;
  trailer_plate: string | null;
  trailer_pallets: number | null;
  transporterCompanyId: string;
  transporterName: string;
  submittedAt: string | null;
  revision: number | null;
  usedAt: string | null;
};

type WithdrawnRow = {
  id: string;
  plate: string;
  brand_model: string | null;
  usedAt: string;
};

function localDateISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatTons(valueKg: number) {
  return `${(valueKg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`;
}

function RoutingAvailabilityPage() {
  const list = useServerFn(listRoutingAvailability);
  const setUsage = useServerFn(setRoutingVehicleUsage);
  const [date, setDate] = useState(localDateISO());
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("TODAS");
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["routing-availability", date],
    queryFn: () => list({ data: { date } }),
  });

  const usageMutation = useMutation({
    mutationFn: (input: { vehicleId: string; used: boolean }) => setUsage({ data: { date, ...input } }),
    onSuccess: (_result, input) => {
      toast.success(input.used ? "Veículo marcado como usado." : "Veículo voltou para os disponíveis.");
      void refetch();
    },
    onError: (failure) => {
      toast.error(failure instanceof Error && failure.message ? failure.message : "Não foi possível gravar a marcação.");
      void refetch();
    },
  });

  const companies = (data?.companies ?? []) as CompanyRow[];
  const vehicles = (data?.vehicles ?? []) as VehicleRow[];
  const withdrawnUsed = (data?.withdrawnUsed ?? []) as WithdrawnRow[];
  const usageEnabled = Boolean(data?.usageEnabled);
  const totals = data?.totals ?? {
    companies: 0,
    informedCompanies: 0,
    availableVehicles: 0,
    capacityKg: 0,
    pallets: 0,
  };

  const filteredVehicles = useMemo(() => {
    const term = search.trim().toLowerCase();
    const plateTerm = term.replace(/[^a-z0-9]/g, "");
    return vehicles.filter((vehicle) => {
      if (companyFilter !== "TODAS" && vehicle.transporterCompanyId !== companyFilter) return false;
      if (!term) return true;
      return (
        vehicle.plate.toLowerCase().includes(plateTerm) ||
        String(vehicle.transporterName ?? "").toLowerCase().includes(term) ||
        String(vehicle.brand_model ?? "").toLowerCase().includes(term) ||
        String(vehicle.vehicle_type ?? "").toLowerCase().includes(term)
      );
    });
  }, [vehicles, companyFilter, search]);

  const distributionVehicles = useMemo(
    () => filteredVehicles.filter((vehicle) => !vehicle.usedAt && !isTransbordoVehicle(vehicle)).sort(compareDistribution),
    [filteredVehicles],
  );
  const transbordoVehicles = useMemo(
    () => filteredVehicles.filter((vehicle) => !vehicle.usedAt && isTransbordoVehicle(vehicle)).sort(compareTransbordo),
    [filteredVehicles],
  );
  const usedVehicles = useMemo(
    () => filteredVehicles.filter((vehicle) => vehicle.usedAt).sort((a, b) => String(b.usedAt).localeCompare(String(a.usedAt))),
    [filteredVehicles],
  );
  const usedCount = vehicles.filter((vehicle) => vehicle.usedAt).length;
  const pendingUsageId = usageMutation.isPending ? usageMutation.variables?.vehicleId ?? null : null;

  async function exportExcel() {
    if (!vehicles.length) {
      toast.error("Não há veículos disponíveis nesta data para exportar.");
      return;
    }
    setExporting(true);
    try {
      const [{ buildAvailabilityWorkbook }, { writeFile }] = await Promise.all([
        import("@/lib/grf-availability-export"),
        import("xlsx"),
      ]);
      writeFile(buildAvailabilityWorkbook(vehicles), `disponibilidade-${date}.xlsx`);
    } catch {
      toast.error("Não foi possível gerar o Excel.");
    } finally {
      setExporting(false);
    }
  }

  function markUsage(vehicleId: string, used: boolean) {
    usageMutation.mutate({ vehicleId, used });
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Truck className="size-5" />
            <span className="text-xs font-bold tracking-wide uppercase">Roteirização</span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Disponibilidade de veículos
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Visão consolidada do que cada transportadora informou para o dia. Esta base será usada posteriormente pela roteirização.
          </p>
          <p className="mt-1 max-w-3xl text-xs font-semibold text-muted-foreground">
            <Clock3 className="mr-1 inline size-3.5" />
            As transportadoras podem alterar a disponibilidade do dia até {AVAILABILITY_CUTOFF} (horário de Brasília). Depois disso fica travada.
          </p>
        </div>

        <div className="flex items-end gap-2">
          <label className="space-y-1 text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Data</span>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[165px] bg-card" />
          </label>
          <Button variant="outline" onClick={() => void refetch()}>Atualizar</Button>
          <Button variant="outline" onClick={() => void exportExcel()} disabled={exporting || isLoading}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Exportar Excel
          </Button>
        </div>
      </div>

      <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Truck}
          label="Veículos disponíveis"
          value={String(totals.availableVehicles)}
          detail={usedCount > 0 ? `em ${formatDate(date)} · ${usedCount} usado(s)` : `em ${formatDate(date)}`}
        />
        <MetricCard icon={Building2} label="Transportadoras responderam" value={`${totals.informedCompanies}/${totals.companies}`} detail="com frota vinculada" />
        <MetricCard icon={Weight} label="Capacidade disponível" value={formatTons(totals.capacityKg)} detail="soma das lotações conhecidas" />
        <MetricCard icon={Package} label="Pallets disponíveis" value={totals.pallets.toLocaleString("pt-BR")} detail="capacidade cadastrada" />
      </section>

      {isLoading && (
        <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando disponibilidade...
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          Não foi possível carregar a disponibilidade informada pelas transportadoras.
        </div>
      )}

      {!isLoading && !error && (
        <>
          <section className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Resumo por transportadora</h2>
                <p className="mt-1 text-sm text-muted-foreground">Clique em uma transportadora para filtrar os veículos disponíveis.</p>
              </div>
              {companyFilter !== "TODAS" && (
                <Button variant="ghost" size="sm" onClick={() => setCompanyFilter("TODAS")}>Limpar filtro</Button>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {companies.map((company) => {
                const selected = companyFilter === company.id;
                return (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => setCompanyFilter(selected ? "TODAS" : company.id)}
                    className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 ${selected ? "border-primary ring-1 ring-primary/20" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{company.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {company.approvedCount == null
                            ? `Frota vinculada: ${company.fleetCount}`
                            : `Frota aprovada: ${company.approvedCount} de ${company.fleetCount} vinculados`}
                        </p>
                      </div>
                      {company.informed ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold text-success uppercase">
                          <CheckCircle2 className="size-3" /> Informado
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">Não informado</span>
                      )}
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="font-display text-2xl font-extrabold text-primary">{company.availableCount}</p>
                        <p className="text-xs text-muted-foreground">veículo(s) disponível(is)</p>
                        <p className="mt-2 text-xs font-semibold text-foreground">
                          Capacidade: {formatTons(company.capacityKg)}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {company.informed ? (
                          <>
                            <p><Clock3 className="mr-1 inline size-3" />{formatTime(company.submittedAt)}</p>
                            <p className="mt-1">Revisão {company.revision}</p>
                          </>
                        ) : (
                          <p>Aguardando retorno</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-9">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Veículos disponíveis</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {companyFilter === "TODAS"
                    ? "Todos os veículos confirmados para a data selecionada."
                    : `Filtro: ${companies.find((company) => company.id === companyFilter)?.name ?? "Transportadora"}`}
                  {usageEnabled && " Marque o veículo usado na roteirização para tirá-lo da lista."}
                </p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar placa, modelo ou transportadora" className="bg-card pl-9" />
              </div>
            </div>

            <AvailabilityGroup
              title="Distribuição"
              summary={`${distributionVehicles.length} veículo(s) · ${formatTons(distributionVehicles.reduce((sum, vehicle) => sum + (vehicle.lotacao_kg ?? 0), 0))} · maior lotação primeiro`}
              vehicles={distributionVehicles}
              mode="distribuicao"
              usageEnabled={usageEnabled}
              pendingUsageId={pendingUsageId}
              onUsage={markUsage}
            />

            <AvailabilityGroup
              title="Transbordo"
              summary={`${transbordoVehicles.length} cavalo(s) · ${transbordoVehicles.reduce((sum, vehicle) => sum + (vehicle.trailer_pallets ?? 0), 0).toLocaleString("pt-BR")} pallets informados · mais pallets primeiro`}
              vehicles={transbordoVehicles}
              mode="transbordo"
              usageEnabled={usageEnabled}
              pendingUsageId={pendingUsageId}
              onUsage={markUsage}
            />

            {usageEnabled && (usedVehicles.length > 0 || withdrawnUsed.length > 0) && (
              <AvailabilityGroup
                title="Usados na roteirização"
                summary={`${usedVehicles.length + withdrawnUsed.length} veículo(s) · use "Voltar" se a marcação foi errada`}
                vehicles={usedVehicles}
                mode="usados"
                usageEnabled={usageEnabled}
                pendingUsageId={pendingUsageId}
                onUsage={markUsage}
                withdrawn={withdrawnUsed}
              />
            )}
          </section>
        </>
      )}
    </main>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Truck; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="size-4 text-primary" /> {label}
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

type GroupMode = "distribuicao" | "transbordo" | "usados";

function AvailabilityGroup({
  title,
  summary,
  vehicles,
  mode,
  usageEnabled,
  pendingUsageId,
  onUsage,
  withdrawn = [],
}: {
  title: string;
  summary: string;
  vehicles: VehicleRow[];
  mode: GroupMode;
  usageEnabled: boolean;
  pendingUsageId: string | null;
  onUsage: (vehicleId: string, used: boolean) => void;
  withdrawn?: WithdrawnRow[];
}) {
  const showTrailer = mode !== "distribuicao";
  const isEmpty = vehicles.length === 0 && withdrawn.length === 0;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">{title}</h3>
        <p className="text-xs text-muted-foreground">{summary}</p>
      </div>
      <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isEmpty ? (
          <div className="p-6 text-center">
            <Truck className="mx-auto size-7 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-semibold">Nenhum veículo neste filtro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">{mode === "transbordo" ? "Cavalo" : "Placa"}</th>
                  {showTrailer && <th className="px-4 py-3 font-semibold">Carreta</th>}
                  <th className="px-4 py-3 font-semibold">Transportadora</th>
                  <th className="px-4 py-3 font-semibold">Veículo</th>
                  <th className="px-4 py-3 text-right font-semibold">Lotação</th>
                  <th className="px-4 py-3 text-right font-semibold">{showTrailer ? "Pallets informados" : "Pallets"}</th>
                  <th className="px-4 py-3 font-semibold">Obs</th>
                  <th className="px-4 py-3 font-semibold">Sankhya</th>
                  <th className="px-4 py-3 font-semibold">{mode === "usados" ? "Usado às" : "Atualizado"}</th>
                  {usageEnabled && <th className="px-4 py-3 text-right font-semibold">Roteirização</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vehicles.map((vehicle) => {
                  const transbordo = isTransbordoVehicle(vehicle);
                  const busy = pendingUsageId === vehicle.id;
                  return (
                    <tr key={`${vehicle.transporterCompanyId}-${vehicle.id}`} className="hover:bg-surface/60">
                      <td className="px-4 py-3 font-display font-extrabold tracking-wide">{prettyPlate(vehicle.plate)}</td>
                      {showTrailer && (
                        <td className="px-4 py-3 font-display font-bold tracking-wide">
                          {transbordo && vehicle.trailer_plate ? prettyPlate(vehicle.trailer_plate) : "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 font-semibold">{vehicle.transporterName}</td>
                      <td className="px-4 py-3 text-muted-foreground">{vehicle.brand_model || vehicle.vehicle_type || "—"}</td>
                      <td className="px-4 py-3 text-right">{vehicle.lotacao_kg == null ? "—" : `${vehicle.lotacao_kg.toLocaleString("pt-BR")} kg`}</td>
                      <td className="px-4 py-3 text-right">
                        {showTrailer && transbordo ? vehicle.trailer_pallets ?? "—" : vehicle.pallets ?? "—"}
                      </td>
                      <td className="max-w-[220px] px-4 py-3 text-xs text-muted-foreground">
                        {vehicle.availability_note ? <span className="line-clamp-2" title={vehicle.availability_note}>{vehicle.availability_note}</span> : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={vehicle.sankhya_registered ? "rounded-full bg-success/10 px-2 py-1 text-[10px] font-bold text-success uppercase" : "rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase"}>
                          {vehicle.sankhya_registered ? "Sim" : "Não"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatTime(mode === "usados" ? vehicle.usedAt : vehicle.submittedAt)}</td>
                      {usageEnabled && (
                        <td className="px-4 py-3 text-right">
                          {mode === "usados" ? (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => onUsage(vehicle.id, false)}>
                              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Voltar
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => onUsage(vehicle.id, true)}>
                              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Usado
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
                {withdrawn.map((row) => {
                  const busy = pendingUsageId === row.id;
                  return (
                    <tr key={`retirado-${row.id}`} className="bg-warning/10">
                      <td className="px-4 py-3 font-display font-extrabold tracking-wide">{prettyPlate(row.plate)}</td>
                      {showTrailer && <td className="px-4 py-3">—</td>}
                      <td className="px-4 py-3 text-xs font-semibold text-warning-foreground" colSpan={6}>
                        Retirado da disponibilidade pelo transportador depois de marcado como usado.
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatTime(row.usedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => onUsage(row.id, false)}>
                          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Desmarcar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
