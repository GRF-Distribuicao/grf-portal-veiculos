import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowRight, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { transporterSupabase as supabase } from "@/integrations/supabase/transporter-client";
import { listReturnedCorrections } from "@/lib/grf-transporter-corrections.functions";
import { prettyPlate } from "@/lib/grf-domain";

type CorrectionRow = {
  id: string;
  protocol: string;
  plate: string;
  brandModel: string | null;
  updatedAt: string;
  note: string | null;
};

export function TransporterCorrectionsPanel() {
  const list = useServerFn(listReturnedCorrections);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<CorrectionRow[]>([]);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setRows([]);
        return;
      }
      const result = await list({ data: { accessToken } });
      setRows(result.ok ? (result.rows as CorrectionRow[]) : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Verificando correções pendentes...
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <section className="mb-7 rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-700">
          <AlertTriangle className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-extrabold">Correções pendentes</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A GRF devolveu {rows.length === 1 ? "um cadastro" : `${rows.length} cadastros`} para ajuste. Corrija e reenvie pelo mesmo protocolo.
              </p>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-800">
              {rows.length} pendente{rows.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {rows.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/25 bg-background/80 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display font-extrabold tracking-wide">{prettyPlate(row.plate)}</p>
                    <span className="text-xs text-muted-foreground">{row.protocol}</span>
                  </div>
                  {row.brandModel && <p className="mt-1 text-sm text-muted-foreground">{row.brandModel}</p>}
                  {row.note && <p className="mt-2 text-sm"><strong>Motivo:</strong> {row.note}</p>}
                </div>
                <Button asChild className="bg-amber-600 text-white hover:bg-amber-700">
                  <a href={`/transportador/corrigir-cadastro?id=${encodeURIComponent(row.id)}`}>
                    <RotateCcw className="size-4" /> Corrigir cadastro <ArrowRight className="size-4" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
