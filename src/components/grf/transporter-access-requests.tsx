import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2,
  Check,
  Clock3,
  MailCheck,
  MailWarning,
  Trash2,
  Truck,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/grf-domain";
import {
  approveTransporterAccessRequest,
  listTransporterAccessRequests,
  rejectTransporterAccessRequest,
  revokeTransporterAccess,
} from "@/lib/grf-transporter-access.functions";

type TransporterRequest = {
  id: string;
  user_id: string;
  requester_name: string;
  email: string;
  company_name: string;
  company_cnpj: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  requested_at: string;
  decided_at: string | null;
  decision_note: string | null;
  matched_company_id: string | null;
  notification_sent_at: string | null;
  notification_error: string | null;
  suggested_company_id: string | null;
};

type Company = {
  id: string;
  name: string;
  cnpj: string | null;
  normalizedName: string;
  vehicleCount: number;
};

type ActiveTransporterAccess = {
  id: string;
  membership_id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  approved_at: string | null;
  company_id: string;
  company_name: string;
};

function formatCnpj(value: string) {
  const raw = value.replace(/\D/g, "").slice(0, 14);
  return raw
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function TransporterAccessRequests() {
  const list = useServerFn(listTransporterAccessRequests);
  const approve = useServerFn(approveTransporterAccessRequest);
  const reject = useServerFn(rejectTransporterAccessRequest);
  const revoke = useServerFn(revokeTransporterAccess);
  const queryClient = useQueryClient();
  const [companySelection, setCompanySelection] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["transporter-access-requests"],
    queryFn: () => list(),
  });

  const rows = (data?.rows ?? []) as TransporterRequest[];
  const companies = (data?.companies ?? []) as Company[];
  const activeAccesses = (data?.activeAccesses ?? []) as ActiveTransporterAccess[];
  const pending = rows.filter((row) => row.status === "PENDING");
  const history = rows.filter((row) => row.status !== "PENDING");

  useEffect(() => {
    if (!pending.length) return;
    setCompanySelection((current) => {
      const next = { ...current };
      for (const row of pending) {
        if (!next[row.id] && row.suggested_company_id) next[row.id] = row.suggested_company_id;
      }
      return next;
    });
  }, [data]);

  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["transporter-access-requests"] });
  }

  async function handleApprove(row: TransporterRequest) {
    const selected = companySelection[row.id];
    if (!selected) {
      toast.error("Confirme a transportadora correta antes de aprovar.");
      return;
    }

    const isNew = selected === "NEW";
    const company = isNew ? null : companyById.get(selected);
    const target = isNew ? `criar ${row.company_name}` : company?.name;
    if (!target) {
      toast.error("Transportadora selecionada não encontrada.");
      return;
    }

    if (!window.confirm(`Aprovar ${row.requester_name} e vincular o acesso a ${target}?`)) return;

    setBusyId(row.id);
    const result = await approve({
      data: {
        requestId: row.id,
        companyId: isNew ? null : selected,
        createNewCompany: isNew,
        note: "",
      },
    });
    setBusyId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`Acesso aprovado e vinculado a ${result.companyName}.`);
    await refresh();
  }

  async function handleReject(row: TransporterRequest) {
    if (!window.confirm(`Reprovar a solicitação de ${row.requester_name} (${row.email})?`)) return;
    setBusyId(row.id);
    const result = await reject({
      data: { requestId: row.id, companyId: null, createNewCompany: false, note: "" },
    });
    setBusyId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Solicitação de transportadora reprovada.");
    await refresh();
  }

  async function handleRevoke(access: ActiveTransporterAccess) {
    if (
      !window.confirm(
        `Excluir o acesso de ${access.name} (${access.email}) à ${access.company_name}? O histórico será preservado.`,
      )
    )
      return;
    setBusyId(access.membership_id);
    const result = await revoke({ data: { membershipId: access.membership_id } });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if ("warning" in result && result.warning) toast.warning(result.warning);
    else toast.success(`Acesso de ${access.name} à ${access.company_name} excluído.`);
    await refresh();
  }

  return (
    <section className="mt-12 border-t border-border pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600">
            <Truck className="size-5" />
            <span className="text-xs font-bold tracking-wide uppercase">
              Acessos de transportadoras
            </span>
          </div>
          <h2 className="mt-2 font-display text-2xl font-extrabold">Área do Transportador</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Confirme a empresa correta antes de liberar. O vínculo aprovado define exatamente quais
            veículos esse usuário poderá visualizar.
          </p>
        </div>
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-muted-foreground">
          Pendentes: <strong className="text-foreground">{pending.length}</strong>
        </div>
      </div>

      {isLoading && (
        <div className="mt-6 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando solicitações de transportadoras...
        </div>
      )}

      {error && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          Não foi possível carregar as solicitações de transportadoras.
        </div>
      )}

      {!isLoading && !error && (
        <>
          <div className="mt-7 flex items-center gap-2">
            <Users className="size-5 text-blue-600" />
            <h3 className="text-lg font-bold">Acessos ativos das transportadoras</h3>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
              {activeAccesses.length}
            </span>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {activeAccesses.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Nenhum acesso de transportadora ativo.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {activeAccesses.map((access) => (
                  <div
                    key={access.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <p className="text-sm font-bold">{access.name}</p>
                      <p className="text-xs text-muted-foreground">{access.email}</p>
                      <p className="mt-1 text-xs font-semibold text-blue-700">
                        {access.company_name}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === access.membership_id}
                      onClick={() => void handleRevoke(access)}
                    >
                      <Trash2 className="size-4" /> Excluir acesso
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-7 flex items-center gap-2">
            <Clock3 className="size-5 text-warning" />
            <h3 className="text-lg font-bold">Aguardando aprovação</h3>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
              {pending.length}
            </span>
          </div>

          {pending.length === 0 ? (
            <div className="mt-4 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
              Nenhuma solicitação de transportadora pendente.
            </div>
          ) : (
            <div className="mt-4 grid gap-4">
              {pending.map((row) => {
                const selected = companySelection[row.id] ?? "";
                const suggested = row.suggested_company_id
                  ? companyById.get(row.suggested_company_id)
                  : null;
                return (
                  <article
                    key={row.id}
                    className="rounded-xl border border-blue-500/20 bg-card p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h4 className="text-base font-bold">{row.requester_name}</h4>
                        <p className="mt-1 text-sm text-muted-foreground">{row.email}</p>
                        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                          <span>
                            <strong>Empresa:</strong> {row.company_name}
                          </span>
                          <span>
                            <strong>CNPJ:</strong> {formatCnpj(row.company_cnpj)}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Solicitado em {formatDateTime(row.requested_at)}
                        </p>
                      </div>
                      <span className="rounded-full border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-bold text-warning-foreground">
                        Aguardando aprovação
                      </span>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs">
                      {row.notification_sent_at ? (
                        <span className="inline-flex items-center gap-1.5 text-success">
                          <MailCheck className="size-4" /> Responsáveis notificados por e-mail
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 text-muted-foreground"
                          title={row.notification_error ?? undefined}
                        >
                          <MailWarning className="size-4" /> Solicitação registrada no controle de
                          acesso
                        </span>
                      )}
                    </div>

                    <div className="mt-5 rounded-lg border border-border bg-surface/60 p-4">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-4 text-blue-600" />
                        <p className="text-sm font-bold">Confirmar vínculo com a transportadora</p>
                      </div>
                      {suggested && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          O sistema encontrou uma possível correspondência:{" "}
                          <strong>{suggested.name}</strong> · {suggested.vehicleCount} veículo(s).
                        </p>
                      )}
                      {!suggested && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Nenhuma correspondência exata foi encontrada. Selecione uma empresa
                          existente ou crie uma nova somente após conferir os dados.
                        </p>
                      )}

                      <div className="mt-4 max-w-xl">
                        <Label className="text-xs font-semibold">
                          Transportadora confirmada pela GRF
                        </Label>
                        <Select
                          value={selected}
                          onValueChange={(value) =>
                            setCompanySelection((current) => ({ ...current, [row.id]: value }))
                          }
                        >
                          <SelectTrigger className="mt-1.5 w-full">
                            <SelectValue placeholder="Selecione a empresa correta" />
                          </SelectTrigger>
                          <SelectContent>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name} · {company.vehicleCount} veículo(s)
                                {company.cnpj ? ` · ${formatCnpj(company.cnpj)}` : ""}
                              </SelectItem>
                            ))}
                            <SelectItem value="NEW">
                              + Criar nova transportadora com os dados solicitados
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4">
                      <Button
                        className="bg-blue-600 text-white hover:bg-blue-700"
                        disabled={busyId === row.id}
                        onClick={() => void handleApprove(row)}
                      >
                        <UserCheck className="size-4" /> Aprovar e vincular
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busyId === row.id}
                        onClick={() => void handleReject(row)}
                      >
                        <UserX className="size-4" /> Reprovar
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-10 flex items-center gap-2">
            <Check className="size-5 text-blue-600" />
            <h3 className="text-lg font-bold">Histórico de transportadoras</h3>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {history.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                Ainda não há decisões de transportadoras registradas.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {history.slice(0, 30).map((row) => {
                  const company = row.matched_company_id
                    ? companyById.get(row.matched_company_id)
                    : null;
                  return (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div>
                        <p className="text-sm font-bold">{row.requester_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.email} · {row.company_name} · {formatCnpj(row.company_cnpj)}
                        </p>
                        {company && (
                          <p className="mt-1 text-xs font-semibold text-blue-700">
                            Vinculado a: {company.name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span
                          className={
                            row.status === "APPROVED"
                              ? "inline-flex rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-bold text-success"
                              : row.status === "REVOKED"
                                ? "inline-flex rounded-full border border-muted bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground"
                                : "inline-flex rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-bold text-destructive"
                          }
                        >
                          {row.status === "APPROVED"
                            ? "Aprovado"
                            : row.status === "REVOKED"
                              ? "Acesso excluído"
                              : "Reprovado"}
                        </span>
                        {row.decided_at && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(row.decided_at)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
