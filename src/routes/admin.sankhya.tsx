import { createFileRoute, Link } from "@tanstack/react-router";
import { Plug, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRegistrations } from "@/lib/grf.functions";
import { StatusBadge } from "@/components/grf/status-badge";
import { prettyPlate } from "@/lib/grf-domain";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/sankhya")({
  head: () => ({
    meta: [
      { title: "Integração Sankhya – Área GRF" },
      {
        name: "description",
        content: "Prévia da futura integração dos cadastros aprovados da GRF com o ERP Sankhya.",
      },
      { property: "og:title", content: "Integração Sankhya – Área GRF" },
      { property: "og:description", content: "Mock visual da integração com o ERP Sankhya." },
    ],
  }),
  component: SankhyaPage,
});

function SankhyaPage() {
  const list = useServerFn(listRegistrations);
  const { data } = useQuery({
    queryKey: ["sankhya-queue"],
    queryFn: () => list({ data: { status: "PRONTO_INTEGRACAO" } }),
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <Plug className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Integração Sankhya</h1>
          <p className="text-sm text-muted-foreground">Pré-visualização — conexão real na próxima etapa.</p>
        </div>
      </div>

      <div className="mt-6 flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          <strong>Mock visual.</strong> Nenhum dado é enviado ao Sankhya nesta fase. Os campos{" "}
          <code className="rounded bg-surface px-1">CODVEICULO_SANKHYA</code>,{" "}
          <code className="rounded bg-surface px-1">STATUS_INTEGRACAO</code> e{" "}
          <code className="rounded bg-surface px-1">MENSAGEM_INTEGRACAO</code> já existem no banco e
          serão preenchidos quando a integração for ativada.
        </p>
      </div>

      <section className="mt-8">
        <h2 className="text-lg font-bold">Fila: prontos para integração</h2>
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
          {(data?.list.length ?? 0) === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhum cadastro na fila. Aprove um cadastro e marque como “Pronto para integração”.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data?.list.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-display font-bold">{prettyPlate(r.plate)}</p>
                    <p className="text-xs text-muted-foreground">{r.protocol}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={r.status} />
                    <Button asChild size="sm" variant="outline">
                      <Link to="/admin/$id" params={{ id: r.id }}>
                        Abrir
                      </Link>
                    </Button>
                    <Button size="sm" disabled>
                      Enviar ao Sankhya
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { t: "Endpoint", v: "Não configurado" },
          { t: "Credenciais", v: "Pendentes" },
          { t: "Última sincronização", v: "Nunca" },
        ].map((c) => (
          <div key={c.t} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground">{c.t}</p>
            <p className="mt-1 font-semibold">{c.v}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
