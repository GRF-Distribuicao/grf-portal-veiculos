import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, ChevronRight, FileSpreadsheet, Filter, X, Truck } from "lucide-react";
import { StatusBadge } from "@/components/grf/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listApprovedForExport, listRegistrations } from "@/lib/grf.functions";
import { LINK_TYPES, STATUS_LABEL, STATUSES, formatDateTime, prettyPlate } from "@/lib/grf-domain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Cadastros de veículos – Área GRF" },
      {
        name: "description",
        content: "Lista interna de cadastros de veículos enviados para análise da GRF.",
      },
      { property: "og:title", content: "Cadastros de veículos – Área GRF" },
      { property: "og:description", content: "Painel de análise de cadastros de veículos da GRF." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminList,
});

const CARDS = [
  { key: "TOTAL", label: "Total de veículos" },
  { key: "AGUARDANDO_ANALISE", label: "Aguardando análise" },
  { key: "EM_ANALISE", label: "Em análise" },
  { key: "APROVADO", label: "Aprovados" },
  { key: "DEVOLVIDO", label: "Devolvidos" },
  { key: "REPROVADO", label: "Reprovados" },
  { key: "INTEGRADO_SANKHYA", label: "Integrados ao Sankhya" },
];

const emptyFilters = {
  plate: "",
  transporter: "",
  protocol: "",
  status: "TODOS",
  linkType: "TODOS",
  hasTracker: "TODOS",
  dateFrom: "",
  dateTo: "",
};

type Scope = "PENDENTES" | "APROVADOS";

function AdminList() {
  const list = useServerFn(listRegistrations);
  const exportApproved = useServerFn(listApprovedForExport);

  const [scope, setScope] = useState<Scope>("PENDENTES");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-registrations", scope, search, filters],
    queryFn: () => list({ data: { ...filters, search, scope } }),
  });

  const setF = (k: keyof typeof emptyFilters, v: string) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const filtersActive =
    search.trim() !== "" || JSON.stringify(filters) !== JSON.stringify(emptyFilters);

  async function handleExport() {
    setExporting(true);
    try {
      const rows = await exportApproved();
      if (!rows.length) {
        toast.error("Nenhum veículo aprovado para exportar.");
        return;
      }
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.json_to_sheet(
        rows.map((r) => ({
          Protocolo: r.protocol,
          Placa: prettyPlate(r.plate),
          Transportador: r.transporter,
          "CPF/CNPJ": r.doc,
          "Tipo de vínculo": r.linkType,
          "Marca/Modelo": r.brandModel,
          Ano: r.year,
          "Tipo de veículo": r.vehicleType,
          Carroceria: r.bodyType,
          "Capacidade de carga (kg)": r.capacity,
          "Tara (kg)": r.tare,
          "Qtd. pallets": r.pallets,
          "Qtd. eixos": r.axles,
          RENAVAM: r.renavam,
          Chassi: r.chassis,
          Motorista: r.driver,
          "CPF do motorista": r.driverCpf,
          Rastreador: r.tracker,
          "Empresa de rastreamento": r.trackerProvider,
          Status: STATUS_LABEL[r.status] ?? r.status,
          "Data de aprovação": formatDateTime(String(r.approvedAt)),
          "Código Sankhya": r.sankhyaCode,
          "Status integração Sankhya": r.sankhyaStatus,
          Observação: r.isDemo ? "TESTE / DEMONSTRAÇÃO" : "",
        })),
      );
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Veiculos aprovados");
      XLSX.writeFile(book, `veiculos-aprovados-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel gerado com sucesso.");
    } catch {
      toast.error("Não foi possível gerar o Excel. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <h1 className="font-display text-2xl font-extrabold">Dashboard GRF</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cadastros enviados pelos transportadores, com dados atualizados do banco.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {CARDS.map((c) => {
          const value = c.key === "TOTAL" ? (data?.total ?? 0) : (data?.counts[c.key] ?? 0);
          const active = filters.status === c.key;
          return (
            <button
              key={c.key}
              onClick={() => {
                if (c.key === "TOTAL") {
                  setF("status", "TODOS");
                  return;
                }
                setScope(c.key === "APROVADO" ? "APROVADOS" : "PENDENTES");
                setF("status", active ? "TODOS" : c.key);
              }}
              className={cn(
                "rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50",
                active ? "border-primary ring-1 ring-primary/30" : "border-border",
              )}
            >
              <p className="text-xs font-semibold text-muted-foreground">{c.label}</p>
              <p className="font-display mt-1 text-2xl font-extrabold">{value}</p>
            </button>
          );
        })}
      </div>

      {/* Abas: pendentes x aprovados */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex gap-1">
          {(
            [
              { key: "PENDENTES", label: "Pendentes / em análise" },
              { key: "APROVADOS", label: "Veículos aprovados" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setScope(t.key);
                setF("status", "TODOS");
              }}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
                scope === t.key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {scope === "APROVADOS" && (
          <Button size="sm" onClick={() => void handleExport()} disabled={exporting} className="mb-2">
            <FileSpreadsheet className="size-4" /> Baixar Excel
          </Button>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca rápida por placa, protocolo, transportador ou CPF/CNPJ"
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
          <Filter className="size-4" /> Filtros
        </Button>
        {filtersActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setFilters(emptyFilters);
            }}
          >
            <X className="size-4" /> Limpar
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="mt-3 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label="Placa">
            <Input value={filters.plate} onChange={(e) => setF("plate", e.target.value)} placeholder="ABC1D23" />
          </FilterField>
          <FilterField label="Transportador">
            <Input
              value={filters.transporter}
              onChange={(e) => setF("transporter", e.target.value)}
              placeholder="Nome / razão social"
            />
          </FilterField>
          <FilterField label="Protocolo">
            <Input value={filters.protocol} onChange={(e) => setF("protocol", e.target.value)} placeholder="GRF-2026-..." />
          </FilterField>
          <FilterField label="Status">
            <Select value={filters.status} onValueChange={(v) => setF("status", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                {STATUSES.filter((s) => s !== "RASCUNHO").map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Tipo de vínculo">
            <Select value={filters.linkType} onValueChange={(v) => setF("linkType", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                {LINK_TYPES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Possui rastreador">
            <Select value={filters.hasTracker} onValueChange={(v) => setF("hasTracker", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="SIM">Sim</SelectItem>
                <SelectItem value="NAO">Não</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Cadastro de">
            <Input type="date" value={filters.dateFrom} onChange={(e) => setF("dateFrom", e.target.value)} />
          </FilterField>
          <FilterField label="Cadastro até">
            <Input type="date" value={filters.dateTo} onChange={(e) => setF("dateTo", e.target.value)} />
          </FilterField>
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        {isLoading && <p className="p-6 text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && (data?.list.length ?? 0) === 0 && (
          <p className="p-6 text-sm text-muted-foreground">Nenhum cadastro encontrado.</p>
        )}
        <ul className="divide-y divide-border">
          {data?.list.map((r) => {
            const t = r.transporters as unknown as {
              name: string;
              doc_number: string;
              link_type: string;
            } | null;
            return (
              <li key={r.id}>
                <Link
                  to="/admin/$id"
                  params={{ id: r.id }}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-surface"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Truck className="size-4 text-muted-foreground" />
                      <span className="font-display text-base font-bold tracking-wide">
                        {prettyPlate(r.plate)}
                      </span>
                      <span className="text-xs text-muted-foreground">{r.protocol}</span>
                      {r.is_demo && (
                        <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-warning-foreground uppercase">
                          Teste / demonstração
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {t?.name} · {t?.doc_number} · {t?.link_type} · {r.brand_model ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <StatusBadge status={r.status} />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(r.submitted_at)}
                      </p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </Label>
      {children}
    </div>
  );
}
