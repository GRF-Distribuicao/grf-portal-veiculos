import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Clock3,
  MailCheck,
  MailWarning,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
import { TransporterAccessRequests } from "@/components/grf/transporter-access-requests";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/grf-domain";
import {
  approveGrfAccessRequest,
  listGrfAccessRequests,
  rejectGrfAccessRequest,
  revokeGrfAccess,
} from "@/lib/grf-access.functions";

export const Route = createFileRoute("/admin/acessos")({
  head: () => ({
    meta: [{ title: "Aprovação de acessos – Área GRF" }, { name: "robots", content: "noindex" }],
  }),
  component: AccessRequestsPage,
});

type AccessRow = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  requested_at: string;
  decided_at: string | null;
  decision_note: string | null;
  notification_sent_at: string | null;
  notification_error: string | null;
};

type ActiveAccess = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  role: "admin" | "analista" | string;
  approved_at: string | null;
};

const STATUS = {
  PENDING: {
    label: "Aguardando aprovação",
    className: "border-warning/30 bg-warning/10 text-warning-foreground",
  },
  APPROVED: { label: "Aprovado", className: "border-success/30 bg-success/10 text-success" },
  REJECTED: {
    label: "Reprovado",
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  REVOKED: { label: "Acesso excluído", className: "border-muted bg-muted text-muted-foreground" },
} as const;

function AccessRequestsPage() {
  const list = useServerFn(listGrfAccessRequests);
  const approve = useServerFn(approveGrfAccessRequest);
  const reject = useServerFn(rejectGrfAccessRequest);
  const revoke = useServerFn(revokeGrfAccess);
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["grf-access-requests"],
    queryFn: () => list(),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["grf-access-requests"] });
  }

  async function handleApprove(row: AccessRow) {
    if (!window.confirm(`Liberar acesso à Área GRF para ${row.name} (${row.email})?`)) return;
    const result = await approve({ data: { requestId: row.id, note: "" } });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`Acesso de ${row.name} aprovado.`);
    await refresh();
  }

  async function handleReject(row: AccessRow) {
    if (!window.confirm(`Reprovar a solicitação de ${row.name} (${row.email})?`)) return;
    const result = await reject({ data: { requestId: row.id, note: "" } });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Solicitação reprovada.");
    await refresh();
  }

  async function handleRevoke(access: ActiveAccess) {
    if (
      !window.confirm(
        `Excluir o acesso à Área GRF de ${access.name} (${access.email})? O histórico será preservado.`,
      )
    )
      return;
    setBusyId(access.user_id);
    const result = await revoke({ data: { userId: access.user_id } });
    setBusyId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if ("warning" in result && result.warning) toast.warning(result.warning);
    else toast.success(`Acesso de ${access.name} excluído.`);
    await refresh();
  }

  const rows = (data?.rows ?? []) as AccessRow[];
  const activeAccesses = (data?.activeAccesses ?? []) as ActiveAccess[];
  const pending = rows.filter((r) => r.status === "PENDING");
  const history = rows.filter((r) => r.status !== "PENDING");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="size-5" />
            <span className="text-xs font-bold tracking-wide uppercase">Controle de acesso</span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            Solicitações de acesso à Área GRF
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Uma aprovação feita por qualquer responsável autorizado libera o usuário para entrar na
            área interna.
          </p>
        </div>
        {data?.approverEmail && (
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
            Responsável autenticado:{" "}
            <strong className="text-foreground">{data.approverEmail}</strong>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="mt-8 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando solicitações...
        </div>
      )}

      {error && (
        <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
          Não foi possível carregar as solicitações. Confirme se este usuário está na lista de
          responsáveis autorizados.
        </div>
      )}

      {!isLoading && !error && (
        <>
          <section className="mt-8">
            <div className="flex items-center gap-2">
              <Users className="size-5 text-primary" />
              <h2 className="text-lg font-bold">Acessos ativos da GRF</h2>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
                {activeAccesses.length}
              </span>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {activeAccesses.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nenhum acesso GRF ativo.</p>
              ) : (
                <div className="divide-y divide-border">
                  {activeAccesses.map((access) => (
                    <div
                      key={access.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-4"
                    >
                      <div>
                        <p className="text-sm font-bold">{access.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {access.email} · {access.role === "admin" ? "Administrador" : "Analista"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          busyId === access.user_id || access.user_id === data?.currentUserId
                        }
                        title={
                          access.user_id === data?.currentUserId
                            ? "Você não pode excluir o próprio acesso"
                            : undefined
                        }
                        onClick={() => void handleRevoke(access)}
                      >
                        <Trash2 className="size-4" /> Excluir acesso
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center gap-2">
              <Clock3 className="size-5 text-warning" />
              <h2 className="text-lg font-bold">Aguardando aprovação</h2>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
                {pending.length}
              </span>
            </div>

            {pending.length === 0 ? (
              <div className="mt-4 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground shadow-sm">
                Nenhuma solicitação pendente.
              </div>
            ) : (
              <div className="mt-4 grid gap-4">
                {pending.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-xl border border-border bg-card p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-bold">{row.name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{row.email}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Solicitado em {formatDateTime(row.requested_at)}
                        </p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS.PENDING.className}`}
                      >
                        {STATUS.PENDING.label}
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
                          <MailWarning className="size-4" /> Notificação por e-mail ainda não
                          enviada
                        </span>
                      )}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4">
                      <Button onClick={() => void handleApprove(row)}>
                        <UserCheck className="size-4" /> Aprovar e liberar acesso
                      </Button>
                      <Button variant="outline" onClick={() => void handleReject(row)}>
                        <UserX className="size-4" /> Reprovar
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="mt-10">
            <div className="flex items-center gap-2">
              <Check className="size-5 text-primary" />
              <h2 className="text-lg font-bold">Histórico recente</h2>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {history.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Ainda não há decisões registradas.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {history.slice(0, 30).map((row) => {
                    const status = STATUS[row.status as keyof typeof STATUS] ?? STATUS.REJECTED;
                    return (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-4"
                      >
                        <div>
                          <p className="text-sm font-bold">{row.name}</p>
                          <p className="text-xs text-muted-foreground">{row.email}</p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${status.className}`}
                          >
                            {status.label}
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
          </section>

          <TransporterAccessRequests />
        </>
      )}
    </main>
  );
}
