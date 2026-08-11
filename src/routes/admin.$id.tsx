import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  FileText,
  ImageIcon,
  Plug,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import { StatusBadge } from "@/components/grf/status-badge";
import { ReviewRow } from "@/components/grf/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { decideRegistration, getRegistration } from "@/lib/grf.functions";
import {
  STATUS_LABEL,
  attachmentLabel,
  formatBytes,
  formatDateTime,
  isPhotoAttachment,
  prettyPlate,
} from "@/lib/grf-domain";

export const Route = createFileRoute("/admin/$id")({
  head: () => ({
    meta: [
      { title: "Análise do cadastro – Área GRF" },
      { name: "description", content: "Detalhes, documentos e decisão sobre um cadastro de veículo na área GRF." },
      { property: "og:title", content: "Análise do cadastro – Área GRF" },
      { property: "og:description", content: "Detalhes e decisão sobre cadastro de veículo." },
    ],
  }),
  component: AdminDetail,
});

type AnyRec = Record<string, unknown>;
const s = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

function AdminDetail() {
  const { id } = useParams({ from: "/admin/$id" });
  const get = useServerFn(getRegistration);
  const decide = useServerFn(decideRegistration);
  const qc = useQueryClient();

  const [userName, setUserName] = useState("Equipe GRF");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["registration", id],
    queryFn: () => get({ data: { id } }),
  });

  async function act(action: "EM_ANALISE" | "APROVAR" | "DEVOLVER" | "REPROVAR" | "PRONTO_INTEGRACAO") {
    if ((action === "DEVOLVER" || action === "REPROVAR") && note.trim().length < 5) {
      toast.error("Informe uma observação explicando a devolução ou reprovação.");
      return;
    }
    setBusy(true);
    try {
      const res = await decide({ data: { id, action, userName, note } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Cadastro atualizado: ${STATUS_LABEL[res.status]}`);
      setNote("");
      await qc.invalidateQueries();
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <main className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">Carregando...</main>;
  if (!data?.ok) return <main className="mx-auto max-w-5xl p-8 text-sm">Cadastro não encontrado.</main>;

  const reg = data.registration as AnyRec;
  const t = reg['transporters'] as AnyRec;
  const driver = ((reg['drivers'] as AnyRec[]) ?? [])[0] ?? {};
  const tracker = ((reg['tracking_devices'] as AnyRec[]) ?? [])[0] ?? {};
  const allAttachments = (reg['documents'] as AnyRec[]) ?? [];
  const docs = allAttachments.filter((d) => !isPhotoAttachment(String(d['doc_type'])));
  const photos = allAttachments.filter((d) => isPhotoAttachment(String(d['doc_type'])));
  const status = String(reg['status']);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Todos os cadastros
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-extrabold tracking-wide">
              {prettyPlate(String(reg['plate']))}
            </h1>
            <StatusBadge status={status} />
            {reg['is_demo'] === true && (
              <span className="rounded bg-warning/20 px-2 py-1 text-[11px] font-bold tracking-wide text-accent-foreground uppercase">
                Dado de teste
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Protocolo {s(reg['protocol'])} · enviado em {formatDateTime(reg['submitted_at'] as string)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <Card title="Transportador">
            <ReviewRow label="Nome / Razão social" value={s(t?.['name'])} />
            <ReviewRow label={`${s(t?.['doc_type'])}`} value={s(t?.['doc_number'])} />
            <ReviewRow label="Telefone" value={s(t?.['phone'])} />
            <ReviewRow label="E-mail" value={s(t?.['email'])} />
            <ReviewRow label="Cidade / UF" value={`${s(t?.['city'])} / ${s(t?.['uf'])}`} />
            <ReviewRow label="Vínculo" value={s(t?.['link_type'])} />
          </Card>

          <Card title="Veículo">
            <ReviewRow label="Tipo / espécie" value={`${s(reg['vehicle_type'])} · ${s(reg['species'])}`} />
            <ReviewRow label="Rodado / carroceria" value={`${s(reg['wheel_type'])} · ${s(reg['body_type'])}`} />
            <ReviewRow label="Marca / modelo" value={s(reg['brand_model'])} />
            <ReviewRow label="Ano fab. / modelo" value={`${s(reg['manufacture_year'])} / ${s(reg['model_year'])}`} />
            <ReviewRow label="Peso máx. / tara" value={`${s(reg['max_weight_kg'])} kg / ${s(reg['tare_kg'])} kg`} />
            <ReviewRow label="Capacidade / pallets / eixos" value={`${s(reg['max_capacity_kg'])} kg · ${s(reg['pallets'])} · ${s(reg['axles'])}`} />
            <ReviewRow label="RENAVAM" value={s(reg['renavam'])} />
            <ReviewRow label="Chassi" value={s(reg['chassis'])} />
            <ReviewRow label="Motor" value={s(reg['engine_number'])} />
            <ReviewRow label="Emplacamento" value={`${s(reg['plate_city'])} / ${s(reg['plate_uf'])}`} />
            <ReviewRow label="Cor / combustível" value={`${s(reg['color'])} · ${s(reg['fuel'])}`} />
            <ReviewRow label="Veículo da empresa" value={reg['company_vehicle'] ? "Sim" : "Não"} />
          </Card>

          <Card title="Motorista">
            <ReviewRow label="Nome" value={s(driver['name'])} />
            <ReviewRow label="CPF" value={s(driver['cpf'])} />
            <ReviewRow label="CNH / categoria" value={`${s(driver['cnh'])} · ${s(driver['cnh_category'])}`} />
            <ReviewRow label="Telefone" value={s(driver['phone'])} />
          </Card>

          <Card title="Rastreamento">
            <ReviewRow label="Possui rastreador" value={tracker['has_tracker'] ? "Sim" : "Não"} />
            <ReviewRow label="Empresa" value={s(tracker['provider'])} />
            <ReviewRow label="Identificador / IMEI" value={s(tracker['identifier'])} />
            <ReviewRow label="Status" value={s(tracker['status'])} />
          </Card>

          <Card title="Documentos">
            <div className="space-y-2 pt-1">
              {docs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>}
              {docs.map((d) => (
                <div key={String(d['id'])} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                  <div className="flex items-center gap-3">
                    <FileText className="size-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">{attachmentLabel(String(d['doc_type']))}</p>
                      <p className="text-xs text-muted-foreground">
                        {String(d['file_name'])} · {formatBytes(Number(d['file_size'] ?? 0))} · {String(d['status'])}
                      </p>
                    </div>
                  </div>
                  {d['url'] ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={String(d['url'])} target="_blank" rel="noreferrer">
                        Abrir <ExternalLink className="size-3.5" />
                      </a>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Arquivo indisponível</span>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Fotos do veículo">
            <div className="pt-1">
              {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma foto anexada. Cadastros enviados antes da exigência de foto podem não ter
                  este item — devolva para correção se precisar conferir o veículo.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {photos.map((ph) => (
                    <figure key={String(ph['id'])} className="rounded-md border border-border p-2">
                      <a
                        href={ph['url'] ? String(ph['url']) : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        <div className="grid aspect-4/3 place-items-center overflow-hidden rounded bg-surface">
                          {ph['url'] ? (
                            <img
                              src={String(ph['url'])}
                              alt={attachmentLabel(String(ph['doc_type']))}
                              className="size-full object-cover transition-opacity hover:opacity-90"
                              loading="lazy"
                            />
                          ) : (
                            <ImageIcon className="size-6 text-muted-foreground" />
                          )}
                        </div>
                      </a>
                      <figcaption className="mt-2 text-[11px] leading-tight">
                        <span className="font-semibold">{attachmentLabel(String(ph['doc_type']))}</span>
                        <span className="block text-muted-foreground">
                          {formatBytes(Number(ph['file_size'] ?? 0))}
                        </span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-bold">Decisão da GRF</h2>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Analista</Label>
                <Input value={userName} onChange={(e) => setUserName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase">Observação</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Obrigatória para devolver ou reprovar."
                />
              </div>
              <div className="grid gap-2">
                <Button variant="outline" disabled={busy} onClick={() => act("EM_ANALISE")}>
                  <Search className="size-4" /> Marcar em análise
                </Button>
                <Button disabled={busy} onClick={() => act("APROVAR")}>
                  <CheckCircle2 className="size-4" /> Aprovar
                </Button>
                <Button variant="secondary" disabled={busy} onClick={() => act("DEVOLVER")}>
                  <RotateCcw className="size-4" /> Devolver para correção
                </Button>
                <Button variant="destructive" disabled={busy} onClick={() => act("REPROVAR")}>
                  <XCircle className="size-4" /> Reprovar
                </Button>
              </div>
            </div>
          </div>

          {(status === "APROVADO" || status === "PRONTO_INTEGRACAO") && (
            <div className="rounded-lg border border-success/40 bg-success/5 p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Plug className="size-4" /> Integração Sankhya
              </h2>
              <div className="mt-2">
                <ReviewRow label="CODVEICULO_SANKHYA" value={s(reg['codveiculo_sankhya'])} />
                <ReviewRow label="STATUS_INTEGRACAO" value={s(reg['status_integracao'])} />
                <ReviewRow label="MENSAGEM_INTEGRACAO" value={s(reg['mensagem_integracao'])} />
              </div>
              {status === "APROVADO" ? (
                <Button className="mt-3 w-full" disabled={busy} onClick={() => act("PRONTO_INTEGRACAO")}>
                  Marcar como pronto para integração
                </Button>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  Na fila de integração. O envio real ao Sankhya será feito na próxima etapa.
                </p>
              )}
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-sm font-bold">Histórico</h2>
            <ol className="mt-3 space-y-3">
              {data.history.map((h: AnyRec) => (
                <li key={String(h['id'])} className="border-l-2 border-border pl-3">
                  <p className="text-sm font-semibold">{STATUS_LABEL[String(h['to_status'])] ?? String(h['to_status'])}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(h['created_at'] as string)} · {String(h['user_name'])}
                  </p>
                  {h['note'] ? <p className="mt-1 text-sm">{String(h['note'])}</p> : null}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
