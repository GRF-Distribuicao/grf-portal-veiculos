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
    <div className="flex min-h-screen flex-col bg-[#050b0a] text-white">
      <PublicHeader />

      <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_76%_58%,rgba(0,175,62,0.24),transparent_34%),radial-gradient(circle_at_48%_48%,rgba(255,255,255,0.025),transparent_38%),linear-gradient(110deg,#050b0a_0%,#07120e_48%,#102519_100%)]">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(0,0,0,0.12),transparent_52%,rgba(0,0,0,0.08))]" />

        <div className="mx-auto grid min-h-[670px] max-w-[1536px] items-center gap-2 px-6 py-14 sm:px-10 lg:grid-cols-[0.83fr_1.17fr] lg:px-14 lg:py-10 max-[767px]:min-h-0 max-[767px]:gap-0 max-[767px]:px-5 max-[767px]:py-10">
          <div className="relative z-20 max-w-[610px] lg:pb-3">
            <span className="inline-flex rounded-full border border-[#16a832] px-5 py-2 text-sm font-bold tracking-wide text-white uppercase max-[420px]:px-4 max-[420px]:text-[12px]">
              Portal do transportador
            </span>

            <h1 className="mt-8 max-w-[590px] text-5xl leading-[0.98] font-extrabold tracking-tight sm:text-6xl lg:text-[76px] max-[767px]:mt-7 max-[767px]:text-[44px] max-[420px]:text-[42px]">
              Cadastro de
              <br />
              veículos GRF
            </h1>

            <p className="mt-7 max-w-[590px] text-lg leading-8 text-white/90 sm:text-xl max-[767px]:mt-6 max-[767px]:text-[17px] max-[767px]:leading-7">
              Agregados, terceiros e frota própria: envie os dados do veículo, do motorista e os
              documentos em um único fluxo. A equipe GRF analisa e responde pelo protocolo.
            </p>

            <div className="mt-9 flex flex-wrap gap-4 max-[767px]:mt-7 max-[767px]:flex-col max-[767px]:gap-3">
              <Button
                asChild
                size="lg"
                className="h-[66px] min-w-[288px] bg-[#16a832] px-6 text-lg font-bold text-white shadow-xl shadow-black/25 hover:bg-[#20bd3f] max-[767px]:h-[60px] max-[767px]:w-full max-[767px]:min-w-0 max-[767px]:text-[17px]"
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
                className="h-[66px] min-w-[245px] border-white/45 bg-transparent px-6 text-lg font-bold text-white hover:bg-white/10 hover:text-white max-[767px]:h-[60px] max-[767px]:w-full max-[767px]:min-w-0 max-[767px]:text-[17px]"
              >
                <Link to="/consulta" search={{ mode: "plate" } as never}>
                  <Search className="size-6" aria-hidden="true" />
                  Consultar placa
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative flex min-h-[430px] items-center justify-center lg:min-h-[590px] max-[767px]:min-h-0 max-[767px]:mt-5 max-[767px]:h-[230px]">
            <div className="absolute right-[10%] top-[28%] h-[420px] w-[520px] rounded-full bg-[#00c853]/15 blur-[85px] max-[767px]:h-[230px] max-[767px]:w-[300px]" />
            <img
              src="/grf-caminhao-exato.png.png"
              alt="Caminhão GRF Distribuição"
              className="relative z-10 w-full max-w-[900px] object-contain drop-shadow-[0_30px_35px_rgba(0,0,0,0.58)] lg:translate-x-5 lg:scale-[1.08] max-[767px]:max-w-[390px]"
              loading="eager"
              width={1200}
              height={800}
            />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#050b0a]">
        <div className="mx-auto grid max-w-[1536px] grid-cols-1 divide-y divide-white/15 px-6 py-7 sm:px-10 md:grid-cols-2 md:divide-x md:divide-y-0 lg:grid-cols-4 lg:px-14">
          {benefits.map((item) => (
            <div key={item.title} className="flex min-h-[130px] items-center gap-5 px-5 py-5 lg:px-7">
              <item.icon className="size-14 shrink-0 stroke-[1.7] text-[#20b83b]" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-bold">{item.title}</h2>
                <p className="mt-2 max-w-[245px] text-sm leading-6 text-white/70">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
