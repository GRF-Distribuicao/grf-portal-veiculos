import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Database, Search, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listVehicleMaster } from "@/lib/grf-admin-vehicles.functions";
import { prettyPlate, STATUS_LABEL } from "@/lib/grf-domain";

export const Route = createFileRoute("/admin/veiculos")({
  head: () => ({
    meta: [
      { title: "Base de veículos – Área GRF" },
      {
        name: "description",
        content: "Cadastro mestre de veículos da GRF, com identificação dos veículos já existentes no Sankhya.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VehicleMasterPage,
});

const COMPLETION_LABEL: Record<string, string> = {
  PENDENTE_COMPLEMENTO: "Pendente de complemento",
  EM_ANALISE: "Em análise",
  COMPLETO: "Cadastro completo",
  DEVOLVIDO: "Devolvido",
};

function VehicleMasterPage() {
  const list = useServerFn(listVehicleMaster);
  const [search, setSearch] = useState("");
  const [sankhya, setSankhya] = useState<"TODOS" | "SIM" | "NAO">("TODOS");
  const [completionStatus, setCompletionStatus] = useState("TODOS");

  const { data, isLoading } = useQuery({
    queryKey: ["vehicle-master", search, sankhya, completionStatus],
    queryFn: () => list({ data: { search, sankhya, completionStatus } }),
  });

  const cards = [
    { label: "Total no banco GRF", value: data?.counts.total ?? 0 },
    { label: "Já cadastrados no Sankhya", value: data?.counts.sankhya ?? 0 },
    { label: "Ainda fora do Sankhya", value: data?.counts.foraSankhya ?? 0 },
    { label: "Pendentes de complemento", value: data?.counts.pendentes ?? 0 },
    { label: "Em análise", value: data?.counts.emAnalise ?? 0 },
    { label: "Cadastros completos", value: data?.counts.completos ?? 0 },
  ];

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <div className="flex items-start gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <Database className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-extrabold">Base de veículos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastro mestre da GRF. Aqui você enxerga quais placas já existem no Sankhya antes de qualquer integração.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold leading-5 text-muted-foreground">{card.label}</p>
            <p className="font-display mt-1 text-2xl font-extrabold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-7 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_210px_220px_auto]">
        <div>
          <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Buscar veículo</Label>
          <div className="relative mt-1.5">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Placa, modelo, transportadora, motorista ou RNTRC"
              className="pl-9"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Sankhya</Label>
          <Select value={sankhya} onValueChange={(value) => setSankhya(value as typeof sankhya)}>
            <SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              <SelectItem value="SIM">Já está no Sankhya</SelectItem>
              <SelectItem value="NAO">Fora do Sankhya</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Situação do cadastro</Label>
          <Select value={completionStatus} onValueChange={setCompletionStatus}>
            <SelectTrigger className="mt-1.5 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos</SelectItem>
              <SelectItem value="PENDENTE_COMPLEMENTO">Pendente de complemento</SelectItem>
              <SelectItem value="EM_ANALISE">Em análise</SelectItem>
              <SelectItem value="COMPLETO">Cadastro completo</SelectItem>
              <SelectItem value="DEVOLVIDO">Devolvido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              setSearch("");
              setSankhya("TODOS");
              setCompletionStatus("TODOS");
            }}
          >
            Limpar
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        {isLoading && <p className="p-6 text-sm text-muted-foreground">Carregando base de veículos...</p>}
        {!isLoading && (data?.list.length ?? 0) === 0 && (
          <p className="p-6 text-sm text-muted-foreground">Nenhum veículo encontrado com estes filtros.</p>
        )}
        <ul className="divide-y divide-border">
          {data?.list.map((vehicle) => {
            const registrations = Array.isArray(vehicle.vehicle_registrations)
              ? vehicle.vehicle_registrations
              : vehicle.vehicle_registrations
                ? [vehicle.vehicle_registrations]
                : [];
            const registration = registrations[0] as
              | { id?: string; protocol?: string; status?: string }
              | undefined;

            return (
              <li key={vehicle.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Truck className="size-4 text-muted-foreground" />
                      <span className="font-display text-base font-bold tracking-wide">{prettyPlate(String(vehicle.plate))}</span>
                      <span
                        className={
                          vehicle.sankhya_registered
                            ? "rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-success uppercase"
                            : "rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-warning-foreground uppercase"
                        }
                      >
                        {vehicle.sankhya_registered ? "No Sankhya" : "Fora do Sankhya"}
                      </span>
                      <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                        {COMPLETION_LABEL[String(vehicle.completion_status)] ?? String(vehicle.completion_status)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {vehicle.brand_model || "Modelo não informado"}
                      {vehicle.vehicle_type ? ` · ${vehicle.vehicle_type}` : ""}
                      {vehicle.transporter_name ? ` · ${vehicle.transporter_name}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Lotação: {vehicle.lotacao_kg ?? "—"} kg · Pallets: {vehicle.pallets ?? "—"} · RNTRC: {vehicle.rntrc || "—"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {vehicle.grf_sticker === true && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                        <CheckCircle2 className="size-3.5" /> Adesivo GRF
                      </span>
                    )}
                    {vehicle.has_monitoring_camera === true && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                        <CheckCircle2 className="size-3.5" /> Câmera
                      </span>
                    )}
                    {registration?.id && (
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/$id" params={{ id: String(registration.id) }}>
                          {registration.protocol || STATUS_LABEL[String(registration.status)] || "Abrir cadastro"}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
