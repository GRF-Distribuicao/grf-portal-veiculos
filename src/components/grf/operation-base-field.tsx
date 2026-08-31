import { Field } from "@/components/grf/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OPERATION_BASES, operationBaseLabel } from "@/lib/grf-operation-base";

export function OperationBaseField({ value, onChange, error, required = true, disabled = false }: {
  value: string; onChange: (value: string) => void; error?: string | undefined; required?: boolean; disabled?: boolean;
}) {
  return <Field label="Base de operação" required={required} error={error}
    hint="Selecione onde este veículo vai operar. O CNPJ é o mesmo para as duas bases.">
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full" aria-label="Base de operação"><SelectValue placeholder="Selecione a base" /></SelectTrigger>
      <SelectContent>{OPERATION_BASES.map((base) => <SelectItem key={base} value={base}>{operationBaseLabel(base)}</SelectItem>)}</SelectContent>
    </Select>
  </Field>;
}
