import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck, FileCheck2, ShieldCheck, Search, ArrowRight, Truck } from "lucide-react";
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
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />

      <section className="relative overflow-hidden bg-gradient-to-br from-[#3f4040] via-[#505151] to-[#38453b] text-white">
        <div className="absolute inset-y-0 right-0 w-[52%] bg-gradient-to-l from-[#00c853]/10 to-transparent" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <span className="inline-flex rounded-full border border-white/30 px-3 py-1 text-xs font-bold tracking-wide uppercase">
              Portal do transportador
            </span>
            <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
              Cadastro de veículos GRF
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
              Agregados, terceiros e frota própria: envie os dados do veículo, do motorista e os
              documentos em um único fluxo. A equipe GRF analisa e responde pelo protocolo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary" className="font-bold shadow-lg">
                <Link to="/cadastro">
                  Cadastrar veículo <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/35 bg-transparent font-bold text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/consulta" search={{ mode: "plate" } as never}>
                  <Search className="size-4" /> Consultar placa
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative hidden min-h-[330px] items-center justify-center lg:flex">
            <div className="absolute h-[310px] w-[310px] rounded-full bg-[#00c853]/10 blur-2xl" />
            <div className="relative flex h-[300px] w-full max-w-[520px] items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl backdrop-blur-sm">
              <Truck className="size-56 stroke-[1.15] text-white/80 drop-shadow-2xl" aria-hidden="true" />
              <div className="absolute bottom-7 left-1/2 -translate-x-1/2 rounded-full border border-[#00c853]/50 bg-[#00c853]/10 px-5 py-2 text-xs font-bold tracking-[0.22em] text-[#b9ffd2] uppercase">
                GRF Distribuição
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-12 sm:px-6 sm:py-14">
        <h2 className="text-2xl font-bold tracking-tight">Como funciona</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                  <s.icon className="size-5" />
                </span>
                <span className="font-display text-sm font-bold text-muted-foreground">
                  Etapa {i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-border bg-surface p-5 text-sm text-muted-foreground shadow-sm">
          Não é necessário criar senha para o transportador. Guarde o número de protocolo gerado no
          envio: com ele e o CPF/CNPJ você acompanha o andamento da análise.
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
