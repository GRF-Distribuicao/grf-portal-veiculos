import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatPlate, isValidPlate, prettyPlate } from "@/lib/grf-domain";
import { lookupSankhyaVehicle } from "@/lib/grf-vehicle-catalog.functions";

export type SankhyaVehicleReference = {
  plate: string;
  model: string | null;
  capacityKg: number | null;
  pallets: number | null;
  fleetVehicleType: string | null;
};

export function SankhyaPlateLookup({ value, onChange, onFound }: {
  value: string;
  onChange: (plate: string) => void;
  onFound?: (vehicle: SankhyaVehicleReference) => void;
}) {
  const lookup = useServerFn(lookupSankhyaVehicle);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SankhyaVehicleReference | null>(null);
  const [checkedPlate, setCheckedPlate] = useState<string | null>(null);
  const requestRef = useRef(0);
  const lookupRef = useRef(lookup);
  const onFoundRef = useRef(onFound);
  lookupRef.current = lookup;
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
          const response = await lookupRef.current({ data: { plate } });
          if (requestRef.current !== requestId) return;
          setCheckedPlate(plate);
          if (response.found) {
            const vehicle = {
              plate: response.vehicle.plate,
              model: response.vehicle.model,
              capacityKg: response.vehicle.capacityKg,
              pallets: response.vehicle.pallets,
              fleetVehicleType: response.vehicle.fleetVehicleType,
            };
            setResult(vehicle);
            onFoundRef.current?.(vehicle);
          }
        } finally {
          if (requestRef.current === requestId) setLoading(false);
        }
      })();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div className="space-y-3">
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
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
            <CheckCircle2 className="size-4" /> Veículo localizado na base Sankhya
          </p>
          <div className="mt-2 grid gap-x-5 gap-y-1 text-xs sm:grid-cols-2">
            <Reference label="Modelo" value={result.model} />
            <Reference label="Classificação" value={result.fleetVehicleType} />
            <Reference label="Capacidade" value={result.capacityKg == null ? null : `${result.capacityKg.toLocaleString("pt-BR")} kg`} />
            <Reference label="Pallets" value={result.pallets == null ? null : String(result.pallets)} />
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
