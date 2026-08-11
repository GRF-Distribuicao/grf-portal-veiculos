import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, FileCheck2, ShieldCheck, Search, ArrowRight } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/grf/chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portal GRF – Cadastro de Veículos para Transportadores" },
      {
        name: "description",
        content:
          "Cadastre seu veículo na GRF em poucos minutos: dados do transportador, veículo, motorista, rastreamento e documentos para análise.",
      },
      { property: "og:title", content: "Portal GRF – Cadastro de Veículos" },
      {
        property: "og:description",
        content: "Cadastro de veículos e envio de documentos para a equipe GRF analisar.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Home,
});

const steps = [
  { icon: ClipboardCheck, title: "Preencha o formulário", text: "6 etapas rápidas: transportador, veículo, motorista, rastreamento e documentos." },
  { icon: FileCheck2, title: "Envie os documentos", text: "CRLV, documento do proprietário e CNH em PDF, JPG ou PNG." },
  { icon: ShieldCheck, title: "Análise da GRF", text: "Nossa equipe valida os dados e aprova ou devolve para correção." },
];

function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />

      <section className="grf-hero">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <span className="inline-flex rounded-full border border-white/25 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            Portal do transportador
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl leading-tight font-extrabold sm:text-5xl">
            Cadastro de veículos GRF
          </h1>
          <p className="mt-4 max-w-xl text-base opacity-85 sm:text-lg">
            Agregados, terceiros e frota própria: envie os dados do veículo, do motorista e os
            documentos em um único fluxo. A equipe GRF analisa e responde pelo protocolo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary" className="font-semibold">
              <Link to="/cadastro">
                Cadastrar veículo <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-transparent font-semibold text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
            >
              <Link to="/consulta">
                <Search className="size-4" /> Consultar protocolo
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
        <h2 className="text-xl font-bold">Como funciona</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-md bg-secondary text-secondary-foreground">
                  <s.icon className="size-5" />
                </span>
                <span className="font-display text-sm font-bold text-muted-foreground">
                  Etapa {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">
          Não é necessário criar senha. Guarde o número de protocolo gerado no envio: com ele e o
          CPF/CNPJ você acompanha o andamento da análise.
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
