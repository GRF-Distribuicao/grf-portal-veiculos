import { isValidElement, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { SankhyaPlateLookup } from "@/components/grf/sankhya-plate-lookup";
import { cn } from "@/lib/utils";

export function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const plateInput = label === "Placa" && isValidElement(children) ? children : null;
  const plateProps = plateInput?.props as { value?: unknown; onChange?: (event: unknown) => void } | undefined;
  const plateValue = typeof plateProps?.value === "string" ? plateProps.value : null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {plateValue !== null && plateProps?.onChange ? (
        <SankhyaPlateLookup
          value={plateValue}
          onChange={(plate) => plateProps.onChange?.({ target: { value: plate } })}
        />
      ) : (
        children
      )}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function ReviewRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}
