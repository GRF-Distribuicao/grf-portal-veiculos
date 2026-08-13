import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatPlate, isValidPlate, prettyPlate } from "@/lib/grf-domain";
import { lookupSankhyaVehicle } from "@/lib/grf-vehicle-catalog.functions";

export type SankhyaVehicleReference = {
  plate: string;
  fleetStatus: string | null;
  operation: string | null;
  supportPoint: string | null;
  transporterName: string | null;
  driverName: string | null;
  model: string | null;
  capacityKg: number | null;
  pallets: number | null;
  fleetVehicleType: string | null;
};

export function SankhyaPlateLookup({ value, onChange, onFound }: {
  value: string;
  onChange: (plate: string) => void;
  onFound: (vehicle: SankhyaVehicleReference) => void;
}) {
  const lookup = useServerFn(lookupSankhyaVehicle);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SankhyaVehicleReference | null>(null);
  const [checkedPlate, setCheckedPlate] = useState<string | null>(null);
  const requestRef = useRef(0);
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;

  useEffect(() => {
    const plate = formatPlate(value);
    const requestId = ++requestRef.current;
    setResult(null);
    setCheckedPlate(null);

    if (!isValidPlate(plate)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await lookup({ data: { plate } });
          if (requestRef.current !== requestId) return;
          setCheckedPlate(plate);
          if (response.found) {
            setResult(response.vehicle);
            onFoundRef.current(response.vehicle);
          }
        } finally {
          if (requestRef.current === requestId) setLoading(false);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [lookup, value]);

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="relative max-w-sm">
        <Input
          value={prettyPlate(value)}
          onChange={(e) => onChange(formatPlate(e.target.value))}
          placeholder="ABC-1D23"
          className="font-display pr-10 text-lg font-bold tracking-widest uppercase"
        />
        {loading && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {result && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Veículo localizado na base Sankhya</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Informações conhecidas foram carregadas como referência. Confira e complete o que faltar.
              </p>
              <div className="mt-3 grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                <Reference label="Modelo" value={result.model} />
                <Reference label="Classificação" value={result.fleetVehicleType} />
                <Reference label="Capacidade" value={result.capacityKg == null ? null : `${result.capacityKg.toLocaleString("pt-BR")} kg`} />
                <Reference label="Pallets" value={result.pallets == null ? null : String(result.pallets)} />
                <Reference label="Transportadora" value={result.transporterName} />
                <Reference label="Motorista de referência" value={result.driverName} />
                <Reference label="Ponto de apoio" value={result.supportPoint} />
                <Reference label="Operação" value={result.operation} />
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && checkedPlate && !result && (
        <p className="text-xs text-muted-foreground">
          Placa não localizada na base importada do Sankhya. Continue o preenchimento normalmente.
        </p>
      )}
    </div>
  );
}

function Reference({ label, value }: { label: string; value: string | null }) {
  if (!value || value === "-") return null;
  return <p><span className="text-muted-foreground">{label}:</span>{" "}<strong className="font-semibold text-foreground">{value}</strong></p>;
}
