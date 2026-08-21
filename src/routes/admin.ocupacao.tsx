import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Loader2 } from "lucide-react";
import { createOccupationPanelTicket } from "@/lib/grf-occupation-panel.functions";

export const Route = createFileRoute("/admin/ocupacao")({
  head: () => ({
    meta: [
      { title: "Painel de Ocupação – Portal GRF" },
      { name: "description", content: "Painel interno de ocupação de distribuição e transbordo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OccupationPanelPage,
});

function OccupationPanelPage() {
  const requestTicket = useServerFn(createOccupationPanelTicket);
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { ticket } = await requestTicket();
        // O HTML não vem por aqui: o iframe carrega a rota protegida direto.
        if (active) setSrc(`/admin/ocupacao/painel?t=${encodeURIComponent(ticket)}`);
      } catch {
        if (active) setError("Não foi possível carregar o Painel de Ocupação.");
      }
    })();
    return () => {
      active = false;
    };
  }, [requestTicket]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-5">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <h1 className="font-display text-lg font-bold">Painel de Ocupação</h1>
            <p className="mt-1 text-sm text-muted-foreground">{error} Atualize a página e tente novamente.</p>
          </div>
        </div>
      </main>
    );
  }

  if (!src) {
    return (
      <main className="flex min-h-[65vh] flex-1 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando Painel de Ocupação...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-0 flex-1 bg-slate-100">
      <iframe
        title="Painel de Ocupação"
        src={src}
        className="block h-[calc(100vh-68px)] min-h-[720px] w-full border-0 bg-white"
      />
    </main>
  );
}
