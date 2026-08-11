import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileText, Search, ShieldCheck, Truck } from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/grf/chrome";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Portal GRF – Cadastro de Veículos" },
      {
        name: "description",
        content:
          "Portal GRF para cadastro de veículos, envio de documentos e acompanhamento do protocolo.",
      },
      { property: "og:title", content: "Portal GRF – Cadastro de Veículos" },
      {
        property: "og:description",
        content: "Cadastro de veículos e envio de documentos para análise da equipe GRF.",
      },
      { name: "robots", content: "index,follow" },
    ],
  }),
  component: Home,
});

const benefits = [
  {
    icon: ShieldCheck,
    title: "Processo Seguro",
    text: "Seus dados e documentos protegidos com segurança.",
  },
  {
    icon: FileText,
    title: "Envio de Documentos",
    text: "PDF, JPG ou PNG – até 10 MB por arquivo.",
  },
  {
    icon: CheckCircle2,
    title: "Análise Rápida",
    text: "A equipe GRF analisa e retorna o protocolo.",
  },
  {
    icon: CheckCircle2,
    title: "Acompanhe Online",
    text: "Consulte o status do seu cadastro a qualquer momento.",
  },
];

function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#070d0c] text-white">
      <PublicHeader />

      <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_75%_55%,rgba(0,170,60,0.20),transparent_38%),linear-gradient(110deg,#070d0c_0%,#09130f_45%,#102419_100%)]">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_48%_45%,rgba(255,255,255,0.035),transparent_42%)]" />

        <div className="mx-auto grid min-h-[660px] max-w-[1440px] items-center gap-5 px-6 py-14 sm:px-10 lg:grid-cols-[0.92fr_1.08fr] lg:px-14 lg:py-12">
          <div className="relative z-10 max-w-[600px]">
            <span className="inline-flex rounded-full border border-[#18a936] px-5 py-2 text-sm font-bold tracking-wide text-white uppercase">
              Portal do transportador
            </span>

            <h1 className="mt-8 max-w-[560px] text-5xl leading-[0.98] font-extrabold tracking-tight sm:text-6xl lg:text-[76px]">
              Cadastro de
              <br />
              veículos GRF
            </h1>

            <p className="mt-7 max-w-[575px] text-lg leading-8 text-white/90 sm:text-xl">
              Agregados, terceiros e frota própria: envie os dados do veículo, do motorista e os
              documentos em um único fluxo. A equipe GRF analisa e responde pelo protocolo.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="h-[66px] min-w-[280px] bg-[#18a936] px-6 text-lg font-bold text-white shadow-xl hover:bg-[#21bd42]"
              >
                <Link to="/cadastro">
                  <Truck className="size-6" aria-hidden="true" />
                  Cadastrar veículo
                  <ArrowRight className="ml-auto size-6" aria-hidden="true" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-[66px] min-w-[245px] border-white/45 bg-transparent px-6 text-lg font-bold text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/consulta" search={{ mode: "plate" } as never}>
                  <Search className="size-6" aria-hidden="true" />
                  Consultar placa
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative flex min-h-[420px] items-center justify-center lg:min-h-[570px]">
            <div className="absolute right-[10%] top-[18%] h-[390px] w-[390px] rounded-full bg-[#00c853]/12 blur-[70px]" />
            <img
              src="/grf-truck.svg"
              alt="Caminhão GRF Distribuição"
              className="relative z-10 w-full max-w-[790px] drop-shadow-[0_28px_35px_rgba(0,0,0,0.55)] lg:translate-x-6"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#070d0c]">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 divide-y divide-white/15 px-6 py-7 sm:px-10 md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-4 lg:px-14">
          {benefits.map((item) => (
            <div key={item.title} className="flex min-h-[125px] items-center gap-5 px-5 py-5 lg:px-7">
              <item.icon className="size-14 shrink-0 stroke-[1.7] text-[#18a936]" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-bold">{item.title}</h2>
                <p className="mt-2 max-w-[240px] text-sm leading-6 text-white/70">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
