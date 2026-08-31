import { useState } from "react";
import { OperationBaseField } from "@/components/grf/operation-base-field";
import { isTransgarra } from "@/lib/grf-operation-base";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { Field } from "@/components/grf/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { lookupTransporterCnpj } from "@/lib/grf-cnpj.functions";
import {
  BODY_TYPES,
  CNH_CATEGORIES,
  FUELS,
  LINK_TYPES,
  SPECIES,
  TRACKER_STATUS,
  UFS,
  VEHICLE_TYPES,
  WHEEL_TYPES,
  formatDoc,
  formatPhone,
  onlyDigits,
  prettyPlate,
} from "@/lib/grf-domain";

export const completionEmpty = {
  operationBase: "",
  plate: "", transporterName: "", docNumber: "", phone: "", email: "", city: "", uf: "", linkType: "",
  brandModel: "", vehicleType: "", species: "", wheelType: "", bodyType: "", manufactureYear: "", modelYear: "",
  pbtKg: "", tareKg: "", lotacaoKg: "", pallets: "", axles: "", renavam: "", chassis: "", engineNumber: "",
  plateCity: "", plateUf: "", color: "", fuel: "", rntrc: "",
  bodyWidthM: "", bodyHeightM: "", bodyLengthM: "", tollTagNumber: "", tollTagCompany: "", tollTagOwned: "nao",
  driverName: "", driverCpf: "", driverCnh: "", driverCategory: "", driverPhone: "",
  hasTracker: "nao", trackerProvider: "", trackerId: "", trackerStatus: "", grfSticker: "nao", hasMonitoringCamera: "nao",
};

export type CompletionFormState = typeof completionEmpty;
export type SetCompletionField = (key: keyof CompletionFormState, value: string) => void;

type CnpjLookupState = "idle" | "loading" | "found" | "partial" | "not_found";

export function CompletionSections({
  form,
  set,
  errors,
  showApprovalFields = false,
  requireOperationBase = true,
}: {
  form: CompletionFormState;
  set: SetCompletionField;
  errors: Record<string, string>;
  showApprovalFields?: boolean;
  requireOperationBase?: boolean;
}) {
  const companyVehicle = form.linkType === "Frota própria";
  const lookupCnpj = useServerFn(lookupTransporterCnpj);
  const [cnpjLookupState, setCnpjLookupState] = useState<CnpjLookupState>("idle");
  const [cnpjLookupMessage, setCnpjLookupMessage] = useState("");

  async function handleCnpjLookup() {
    const cnpj = onlyDigits(form.docNumber);
    if (cnpj.length !== 14) {
      setCnpjLookupState("idle");
      setCnpjLookupMessage("");
      return;
    }

    setCnpjLookupState("loading");
    setCnpjLookupMessage("Consultando cadastro da transportadora...");

    try {
      const result = await lookupCnpj({ data: { cnpj } });
      if (!result.ok) {
        setCnpjLookupState("not_found");
        setCnpjLookupMessage("CNPJ não localizado no cadastro da transportadora. Preencha os dados abaixo normalmente.");
        return;
      }

      if (result.savedTransporter) {
        const saved = result.savedTransporter;
        set("transporterName", saved.name || result.companyName || form.transporterName);
        set("phone", saved.phone || form.phone);
        set("email", saved.email || form.email);
        set("city", saved.city || result.city || form.city);
        set("uf", saved.uf || result.uf || form.uf);
        set("linkType", saved.linkType || form.linkType);
        setCnpjLookupState("found");
        setCnpjLookupMessage("Transportadora encontrada. Os dados já cadastrados foram preenchidos automaticamente.");
        return;
      }

      if (result.companyName) set("transporterName", result.companyName);
      if (result.city) set("city", result.city);
      if (result.uf) set("uf", result.uf);
      setCnpjLookupState("partial");
      setCnpjLookupMessage("CNPJ localizado, mas ainda não há um cadastro completo da transportadora no Portal. Complete somente os campos que ficaram em branco.");
    } catch {
      setCnpjLookupState("not_found");
      setCnpjLookupMessage("Não foi possível consultar o CNPJ agora. Você pode preencher os dados manualmente e continuar.");
    }
  }

  return (
    <>
      <Section title="Responsável / transportador">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CNPJ" required error={errors.docNumber} className="sm:col-span-2">
            <div className="flex gap-2">
              <Input
                value={form.docNumber}
                onChange={(e) => {
                  set("docNumber", formatDoc(e.target.value));
                  setCnpjLookupState("idle");
                  setCnpjLookupMessage("");
                }}
                onBlur={() => {
                  if (onlyDigits(form.docNumber).length === 14 && cnpjLookupState === "idle") void handleCnpjLookup();
                }}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleCnpjLookup()}
                disabled={cnpjLookupState === "loading" || onlyDigits(form.docNumber).length !== 14}
                className="shrink-0"
              >
                {cnpjLookupState === "loading" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Consultar
              </Button>
            </div>
            {cnpjLookupMessage && (
              <p className={cnpjLookupState === "found" ? "mt-2 text-xs font-medium text-success" : "mt-2 text-xs text-muted-foreground"}>
                {cnpjLookupMessage}
              </p>
            )}
          </Field>
          <Field label="Nome / Razão social" required error={errors.transporterName} className="sm:col-span-2"><Input value={form.transporterName} onChange={(e) => set("transporterName", e.target.value)} /></Field>
          {isTransgarra(form.docNumber) && <div className="sm:col-span-2"><OperationBaseField value={form.operationBase} onChange={(v) => set("operationBase", v)} error={errors['operationBase']} required={requireOperationBase} /></div>}
          <Field label="Telefone" required error={errors.phone}><Input value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} /></Field>
          <Field label="E-mail" hint="Opcional."><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Cidade" required error={errors.city}><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="UF" required error={errors.uf}><SelectBox value={form.uf} onChange={(v) => set("uf", v)} options={UFS} placeholder="UF" /></Field>
          <Field label="Tipo de vínculo" required error={errors.linkType}><SelectBox value={form.linkType} onChange={(v) => set("linkType", v)} options={LINK_TYPES} placeholder="Selecione" /></Field>
          {showApprovalFields && (
            <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Veículo da empresa</p>
              <p className="mt-1 text-sm font-bold">{companyVehicle ? "Sim" : "Não"}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Definido automaticamente pelo tipo de vínculo.</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Dados do veículo">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Placa"><Input value={prettyPlate(form.plate)} readOnly className="font-display font-bold tracking-widest" /></Field>
          <Field label="Marca / modelo" required error={errors.brandModel} className="lg:col-span-2"><Input value={form.brandModel} onChange={(e) => set("brandModel", e.target.value)} /></Field>

          {showApprovalFields && <>
            <Field label="Tipo de veículo"><SelectBox value={form.vehicleType} onChange={(v) => set("vehicleType", v)} options={VEHICLE_TYPES} placeholder="Selecione" /></Field>
            <Field label="Espécie / tipo"><SelectBox value={form.species} onChange={(v) => set("species", v)} options={SPECIES} placeholder="Selecione" /></Field>
            <Field label="Tipo de rodado"><SelectBox value={form.wheelType} onChange={(v) => set("wheelType", v)} options={WHEEL_TYPES} placeholder="Selecione" /></Field>
            <Field label="Ano de fabricação"><Input inputMode="numeric" value={form.manufactureYear} onChange={(e) => set("manufactureYear", e.target.value.replace(/\D/g, "").slice(0, 4))} /></Field>
            <Field label="Ano modelo"><Input inputMode="numeric" value={form.modelYear} onChange={(e) => set("modelYear", e.target.value.replace(/\D/g, "").slice(0, 4))} /></Field>
            <Field label="Número de eixos"><Input inputMode="numeric" value={form.axles} onChange={(e) => set("axles", e.target.value.replace(/\D/g, ""))} /></Field>
          </>}

          <Field label="PBT (kg)" required error={errors.pbtKg}><Input inputMode="decimal" value={form.pbtKg} onChange={(e) => set("pbtKg", e.target.value.replace(/[^0-9,.]/g, ""))} /></Field>
          <Field label="TARA (kg)" required error={errors.tareKg}><Input inputMode="decimal" value={form.tareKg} onChange={(e) => set("tareKg", e.target.value.replace(/[^0-9,.]/g, ""))} /></Field>
          <Field label="LOTAÇÃO (kg)" required error={errors.lotacaoKg}><Input inputMode="decimal" value={form.lotacaoKg} onChange={(e) => set("lotacaoKg", e.target.value.replace(/[^0-9,.]/g, ""))} /></Field>
          <Field label="Quantidade de pallets" required error={errors.pallets}><Input inputMode="numeric" value={form.pallets} onChange={(e) => set("pallets", e.target.value.replace(/\D/g, ""))} /></Field>
          <Field label="Tipo de carroceria"><SelectBox value={form.bodyType} onChange={(v) => set("bodyType", v)} options={BODY_TYPES} placeholder="Selecione" /></Field>
          <Field label="ANTT / RNTRC" required error={errors.rntrc}><Input value={form.rntrc} onChange={(e) => set("rntrc", e.target.value.toUpperCase())} /></Field>
          <Field label="RENAVAM" required error={errors.renavam}><Input value={form.renavam} onChange={(e) => set("renavam", e.target.value.replace(/\D/g, "").slice(0, 11))} /></Field>
          <Field label="Chassi" required error={errors.chassis} className="sm:col-span-2"><Input value={form.chassis} onChange={(e) => set("chassis", e.target.value.toUpperCase().slice(0, 17))} /></Field>

          {showApprovalFields && <>
            <Field label="Número do motor"><Input value={form.engineNumber} onChange={(e) => set("engineNumber", e.target.value.toUpperCase())} /></Field>
            <Field label="Cidade de emplacamento"><Input value={form.plateCity} onChange={(e) => set("plateCity", e.target.value)} /></Field>
            <Field label="UF de emplacamento"><SelectBox value={form.plateUf} onChange={(v) => set("plateUf", v)} options={UFS} placeholder="UF" /></Field>
            <Field label="Cor"><Input value={form.color} onChange={(e) => set("color", e.target.value)} /></Field>
            <Field label="Combustível"><SelectBox value={form.fuel} onChange={(v) => set("fuel", v)} options={FUELS} placeholder="Selecione" /></Field>
          </>}
        </div>
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-sm font-bold">Dimensões da carroceria</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Field label="Largura (m)" required error={errors.bodyWidthM}><Input inputMode="decimal" value={form.bodyWidthM} onChange={(e) => set("bodyWidthM", e.target.value.replace(/[^0-9,.]/g, ""))} placeholder="2,40" /></Field>
            <Field label="Altura (m)" required error={errors.bodyHeightM}><Input inputMode="decimal" value={form.bodyHeightM} onChange={(e) => set("bodyHeightM", e.target.value.replace(/[^0-9,.]/g, ""))} placeholder="2,60" /></Field>
            <Field label="Comprimento (m)" required error={errors.bodyLengthM}><Input inputMode="decimal" value={form.bodyLengthM} onChange={(e) => set("bodyLengthM", e.target.value.replace(/[^0-9,.]/g, ""))} placeholder="8,50" /></Field>
          </div>
        </div>
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="text-sm font-bold">TAG de pedágio</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Número da TAG" hint="Se houver."><Input value={form.tollTagNumber} onChange={(e) => set("tollTagNumber", e.target.value)} /></Field>
            <Field label="Empresa da TAG" hint="Ex.: Sem Parar, ConectCar."><Input value={form.tollTagCompany} onChange={(e) => set("tollTagCompany", e.target.value)} /></Field>
            <Field label="TAG própria?" className="sm:col-span-2"><YesNo value={form.tollTagOwned} onChange={(v) => set("tollTagOwned", v)} name="tagOwned" /></Field>
          </div>
        </div>
      </Section>

      <Section title="Motorista">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" required error={errors.driverName} className="sm:col-span-2"><Input value={form.driverName} onChange={(e) => set("driverName", e.target.value)} /></Field>
          <Field label="CPF" required error={errors.driverCpf}><Input value={form.driverCpf} onChange={(e) => set("driverCpf", formatDoc(e.target.value))} /></Field>
          <Field label="Número da CNH" required error={errors.driverCnh}><Input value={form.driverCnh} onChange={(e) => set("driverCnh", e.target.value.replace(/\D/g, "").slice(0, 11))} /></Field>
          <Field label="Categoria" required error={errors.driverCategory}><SelectBox value={form.driverCategory} onChange={(v) => set("driverCategory", v)} options={CNH_CATEGORIES} placeholder="Selecione" /></Field>
          <Field label="Telefone" required error={errors.driverPhone}><Input value={form.driverPhone} onChange={(e) => set("driverPhone", formatPhone(e.target.value))} /></Field>
        </div>
      </Section>

      <Section title="Rastreamento">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="O veículo possui rastreador?" className="sm:col-span-2"><YesNo value={form.hasTracker} onChange={(v) => set("hasTracker", v)} name="tracker" /></Field>
          {form.hasTracker === "sim" && <>
            <Field label="Empresa" required error={errors.trackerProvider}><Input value={form.trackerProvider} onChange={(e) => set("trackerProvider", e.target.value)} /></Field>
            <Field label="Identificador / IMEI" required error={errors.trackerId}><Input value={form.trackerId} onChange={(e) => set("trackerId", e.target.value)} /></Field>
            <Field label="Status" required error={errors.trackerStatus}><SelectBox value={form.trackerStatus} onChange={(v) => set("trackerStatus", v)} options={TRACKER_STATUS} placeholder="Selecione" /></Field>
          </>}
        </div>
      </Section>

      <Section title="Identificação e monitoramento">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Adesivo GRF no carro"><YesNo value={form.grfSticker} onChange={(v) => set("grfSticker", v)} name="grfSticker" /></Field>
          <Field label="Veículo possui câmera de monitoramento?"><YesNo value={form.hasMonitoringCamera} onChange={(v) => set("hasMonitoringCamera", v)} name="monitoringCamera" /></Field>
        </div>
      </Section>
    </>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6"><h2 className="mb-4 text-base font-bold">{title}</h2>{children}</section>;
}

function SelectBox({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>;
}

function YesNo({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
  return <RadioGroup value={value} onValueChange={onChange} className="flex gap-6"><div className="flex items-center gap-2"><RadioGroupItem value="sim" id={`${name}-sim`} /><Label htmlFor={`${name}-sim`}>Sim</Label></div><div className="flex items-center gap-2"><RadioGroupItem value="nao" id={`${name}-nao`} /><Label htmlFor={`${name}-nao`}>Não</Label></div></RadioGroup>;
}
