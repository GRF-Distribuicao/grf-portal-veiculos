import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Copy,
  Database,
  FileText,
  FileUp,
  ImageIcon,
  Loader2,
  Trash2,
} from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/grf/chrome";
import { Field } from "@/components/grf/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createUploadTicket, checkPlate } from "@/lib/grf.functions";
import { completeExistingVehicle } from "@/lib/grf-complete-vehicle.functions";
import { lookupSankhyaVehicle } from "@/lib/grf-vehicle-catalog.functions";
import { prepareFile, uploadWithTicket } from "@/lib/grf-upload";
import {
  ATTACHMENT_TYPES,
  BODY_TYPES,
  CNH_CATEGORIES,
  DOC_TYPES,
  LINK_TYPES,
  MAX_FILE_MB,
  PHOTO_TYPES,
  TRACKER_STATUS,
  UFS,
  acceptAttrFor,
  formatBytes,
  formatDoc,
  formatPhone,
  formatPlate,
  isValidDoc,
  isValidPhone,
  onlyDigits,
  prettyPlate,
} from "@/lib/grf-domain";
import type { AttachmentType } from "@/lib/grf-domain";

export const Route = createFileRoute("/completar-cadastro")({
  head: () => ({
    meta: [
      { title: "Completar cadastro – Portal GRF" },
      {
        name: "description",
        content: "Complete os dados e documentos de um veículo que já existe no cadastro mestre da GRF.",
      },
    ],
  }),
  component: CompletarCadastro,
});

type UploadedDoc = {
  attachmentKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  previewUrl: string | null;
  status: "enviando" | "enviado" | "erro";
  error?: string;
};

type MasterVehicle = Awaited<ReturnType<typeof lookupSankhyaVehicle>> extends infer T
  ? T extends { found: true; vehicle: infer V }
    ? V
    : never
  : never;

const empty = {
  plate: "",
  transporterName: "",
  docNumber: "",
  phone: "",
  email: "",
  city: "",
  uf: "",
  linkType: "",
  brandModel: "",
  bodyType: "",
  pbtKg: "",
  tareKg: "",
  lotacaoKg: "",
  pallets: "",
  renavam: "",
  chassis: "",
  rntrc: "",
  bodyWidthM: "",
  bodyHeightM: "",
  bodyLengthM: "",
  tollTagNumber: "",
  tollTagCompany: "",
  tollTagOwned: "nao",
  driverName: "",
  driverCpf: "",
  driverCnh: "",
  driverCategory: "",
  driverPhone: "",
  hasTracker: "nao",
  trackerProvider: "",
  trackerId: "",
  trackerStatus: "",
};

type FormState = typeof empty;

function num(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && value.trim() !== "" ? parsed : null;
}

function CompletarCadastro() {
  const lookup = useServerFn(lookupSankhyaVehicle);
  const verifyPortal = useServerFn(checkPlate);
  const requestTicket = useServerFn(createUploadTicket);
  const complete = useServerFn(completeExistingVehicle);

  const [form, setForm] = useState<FormState>(empty);
  const [vehicle, setVehicle] = useState<MasterVehicle | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Record<string, UploadedDoc>>({});
  const [declaration, setDeclaration] = useState(false);
  const [sending, setSending] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  const set = (key: keyof FormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("plate") ?? "";
    const plate = formatPlate(raw);
    if (plate.length !== 7) {
      setBlocked("Informe uma placa válida pela tela Consultar placa antes de completar o cadastro.");
      setLoadingVehicle(false);
      return;
    }

    void (async () => {
      try {
        const [master, portal] = await Promise.all([
          lookup({ data: { plate } }),
          verifyPortal({ data: { plate } }),
        ]);

        if (portal.exists) {
          setBlocked(
            portal.protocol
              ? `Este veículo já possui um cadastro enviado no Portal GRF (${portal.protocol}).`
              : "Este veículo já possui um cadastro enviado no Portal GRF.",
          );
          return;
        }

        if (!master.found) {
          setBlocked("A placa não foi encontrada no cadastro mestre. Para uma placa nova, utilize o cadastro normal.");
          return;
        }

        const v = master.vehicle;
        setVehicle(v);
        setForm((current) => ({
          ...current,
          plate: v.plate,
          transporterName: v.transporterName ?? "",
          brandModel: v.model ?? "",
          bodyType: v.bodyType ?? "",
          pbtKg: v.pbtKg == null ? "" : String(v.pbtKg),
          tareKg: v.tareKg == null ? "" : String(v.tareKg),
          lotacaoKg: v.capacityKg == null ? "" : String(v.capacityKg),
          pallets: v.pallets == null ? "" : String(v.pallets),
          renavam: v.renavam ?? "",
          chassis: v.chassis ?? "",
          rntrc: v.rntrc ?? "",
          bodyWidthM: v.bodyWidthM == null ? "" : String(v.bodyWidthM),
          bodyHeightM: v.bodyHeightM == null ? "" : String(v.bodyHeightM),
          bodyLengthM: v.bodyLengthM == null ? "" : String(v.bodyLengthM),
          driverName: v.driverName ?? "",
          hasTracker: v.hasTracker === true ? "sim" : "nao",
          trackerProvider: v.trackerProvider ?? "",
          trackerId: v.trackerIdentifier ?? "",
          trackerStatus: v.trackerStatus ?? "",
        }));
      } catch {
        setBlocked("Não foi possível carregar o cadastro do veículo. Tente novamente.");
      } finally {
        setLoadingVehicle(false);
      }
    })();
  }, [lookup, verifyPortal]);

  function dropDoc(key: string) {
    setDocs((current) => {
      const next = { ...current };
      if (next[key]?.previewUrl) URL.revokeObjectURL(next[key]!.previewUrl!);
      delete next[key];
      return next;
    });
  }

  async function handleFile(att: AttachmentType, file: File | undefined) {
    if (!file) return;
    const prep = await prepareFile(att.kind, file);
    if (!prep.ok) {
      toast.error(prep.error);
      return;
    }

    const { prepared } = prep;
    setDocs((current) => ({
      ...current,
      [att.key]: {
        attachmentKey: att.key,
        fileName: prepared.fileName,
        fileSize: prepared.fileSize,
        mimeType: prepared.mimeType,
        storagePath: "",
        previewUrl: prepared.previewUrl,
        status: "enviando",
      },
    }));

    try {
      const ticket = await requestTicket({
        data: {
          sessionId,
          attachmentKey: att.key,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          fileSize: prepared.fileSize,
        },
      });
      if (!ticket.ok) throw new Error(ticket.error);
      const uploaded = await uploadWithTicket(
        { path: ticket.path, token: ticket.token },
        prepared.file,
      );
      if (!uploaded.ok) throw new Error(uploaded.error);

      setDocs((current) => ({
        ...current,
        [att.key]: {
          ...current[att.key]!,
          storagePath: ticket.path,
          status: "enviado",
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no envio do arquivo.";
      setDocs((current) => ({
        ...current,
        [att.key]: { ...current[att.key]!, status: "erro", error: message },
      }));
      toast.error(message);
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (form.transporterName.trim().length < 3) e.transporterName = "Informe o responsável / transportador.";
    if (!isValidDoc(form.docNumber)) e.docNumber = "CPF/CNPJ inválido.";
    if (!isValidPhone(form.phone)) e.phone = "Telefone inválido.";
    if (form.city.trim().length < 2) e.city = "Informe a cidade.";
    if (!form.uf) e.uf = "Selecione a UF.";
    if (!form.linkType) e.linkType = "Selecione o vínculo.";
    if (!form.brandModel.trim()) e.brandModel = "Informe marca/modelo.";
    if (!num(form.pbtKg)) e.pbtKg = "Informe o PBT.";
    if (num(form.tareKg) == null) e.tareKg = "Informe a TARA.";
    if (!num(form.lotacaoKg)) e.lotacaoKg = "Informe a LOTAÇÃO.";
    if (num(form.pallets) == null) e.pallets = "Informe a quantidade de pallets.";
    if (form.renavam.trim().length < 5) e.renavam = "Informe o RENAVAM.";
    if (form.chassis.trim().length < 5) e.chassis = "Informe o chassi.";
    if (form.rntrc.trim().length < 3) e.rntrc = "Informe ANTT / RNTRC.";
    if (!num(form.bodyWidthM)) e.bodyWidthM = "Informe a largura.";
    if (!num(form.bodyHeightM)) e.bodyHeightM = "Informe a altura.";
    if (!num(form.bodyLengthM)) e.bodyLengthM = "Informe o comprimento.";
    if (form.driverName.trim().length < 3) e.driverName = "Informe o motorista.";
    if (!isValidDoc(form.driverCpf) || onlyDigits(form.driverCpf).length !== 11) e.driverCpf = "CPF inválido.";
    if (form.driverCnh.trim().length < 5) e.driverCnh = "Informe a CNH.";
    if (!form.driverCategory) e.driverCategory = "Selecione a categoria.";
    if (!isValidPhone(form.driverPhone)) e.driverPhone = "Telefone inválido.";
    if (form.hasTracker === "sim") {
      if (!form.trackerProvider.trim()) e.trackerProvider = "Informe a empresa de rastreamento.";
      if (!form.trackerId.trim()) e.trackerId = "Informe o identificador / IMEI.";
      if (!form.trackerStatus) e.trackerStatus = "Selecione o status.";
    }
    for (const att of ATTACHMENT_TYPES) {
      if (!att.required) continue;
      const up = docs[att.key];
      if (!up) e[att.key] = `Anexe: ${att.label}.`;
      else if (up.status !== "enviado") e[att.key] = up.error ?? "Aguarde o envio do arquivo.";
    }
    if (!declaration) e.declaration = "Confirme a declaração antes de enviar.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) {
      toast.error("Revise os campos destacados antes de enviar.");
      return;
    }

    setSending(true);
    try {
      const result = await complete({
        data: {
          transporter: {
            name: form.transporterName.trim(),
            docType: onlyDigits(form.docNumber).length === 11 ? "CPF" : "CNPJ",
            docNumber: form.docNumber,
            phone: form.phone,
            email: form.email.trim() || null,
            city: form.city.trim(),
            uf: form.uf,
            linkType: form.linkType,
          },
          vehicle: {
            plate: form.plate,
            brandModel: form.brandModel.trim(),
            bodyType: form.bodyType || null,
            pbtKg: num(form.pbtKg)!,
            tareKg: num(form.tareKg)!,
            lotacaoKg: num(form.lotacaoKg)!,
            pallets: Math.trunc(num(form.pallets)!),
            renavam: form.renavam.trim(),
            chassis: form.chassis.trim().toUpperCase(),
            rntrc: form.rntrc.trim(),
            bodyWidthM: num(form.bodyWidthM)!,
            bodyHeightM: num(form.bodyHeightM)!,
            bodyLengthM: num(form.bodyLengthM)!,
            tollTagNumber: form.tollTagNumber.trim() || null,
            tollTagCompany: form.tollTagCompany.trim() || null,
            tollTagOwned: form.tollTagOwned === "sim",
          },
          driver: {
            name: form.driverName.trim(),
            cpf: form.driverCpf,
            cnh: form.driverCnh.trim(),
            cnhCategory: form.driverCategory,
            phone: form.driverPhone,
          },
          tracking: {
            hasTracker: form.hasTracker === "sim",
            provider: form.trackerProvider.trim() || null,
            identifier: form.trackerId.trim() || null,
            status: form.trackerStatus || null,
          },
          documents: Object.values(docs)
            .filter((d) => d.status === "enviado" && d.storagePath)
            .map((d) => ({
              docType: d.attachmentKey,
              fileName: d.fileName,
              fileSize: d.fileSize,
              mimeType: d.mimeType,
              storagePath: d.storagePath,
            })),
          declarationAccepted: declaration,
        },
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setProtocol(result.protocol);
    } catch {
      toast.error("Não foi possível concluir o cadastro. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (protocol) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-14 text-center">
          <CheckCircle2 className="mx-auto size-14 text-success" />
          <h1 className="mt-5 text-2xl font-bold">Complementação enviada!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Os dados do veículo foram atualizados e enviados para análise da equipe GRF.
          </p>
          <div className="mt-6 rounded-lg border border-border bg-card p-6">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Protocolo</p>
            <p className="font-display mt-1 text-3xl font-extrabold">{protocol}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                navigator.clipboard.writeText(protocol);
                toast.success("Protocolo copiado.");
              }}
            >
              <Copy className="size-4" /> Copiar protocolo
            </Button>
          </div>
          <Button asChild className="mt-6">
            <Link to="/consulta">Consultar andamento</Link>
          </Button>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Link to="/consulta" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar à consulta
        </Link>

        <h1 className="mt-4 text-2xl font-bold">Completar cadastro do veículo</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Aproveitamos tudo que a GRF já possui. Confira os dados encontrados e preencha somente o que estiver faltando.
        </p>

        {loadingVehicle && (
          <div className="mt-8 flex items-center gap-2 rounded-lg border border-border bg-card p-5 text-sm">
            <Loader2 className="size-4 animate-spin" /> Carregando cadastro do veículo...
          </div>
        )}

        {!loadingVehicle && blocked && (
          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 size-5 text-destructive" />
              <div>
                <p className="font-bold">Não é possível continuar por esta tela</p>
                <p className="mt-1 text-sm text-muted-foreground">{blocked}</p>
                <Button asChild className="mt-4" variant="outline">
                  <Link to="/consulta">Consultar outra placa</Link>
                </Button>
              </div>
            </div>
          </div>
        )}

        {!loadingVehicle && vehicle && !blocked && (
          <div className="mt-6 space-y-6">
            <section className="rounded-xl border border-primary/30 bg-primary/5 p-5">
              <div className="flex items-start gap-3">
                <Database className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Veículo encontrado — termine o cadastro</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Placa <strong>{prettyPlate(vehicle.plate)}</strong> já existe no cadastro mestre da GRF
                    {vehicle.sankhyaRegistered ? " e foi localizada no Sankhya" : ""}.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Known label="Modelo" value={vehicle.model} />
                    <Known label="Tipo / classificação" value={vehicle.fleetVehicleType} />
                    <Known label="Lotação conhecida" value={vehicle.capacityKg == null ? null : `${vehicle.capacityKg.toLocaleString("pt-BR")} kg`} />
                    <Known label="Pallets" value={vehicle.pallets == null ? null : String(vehicle.pallets)} />
                  </div>
                  {vehicle.missingFields.length > 0 && (
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">
                      <strong>Ainda faltam no cadastro:</strong> {vehicle.missingFields.join(", ")} e os documentos/fotos de validação.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <Section title="Responsável / transportador">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome / Razão social" required error={errors.transporterName} className="sm:col-span-2">
                  <Input value={form.transporterName} onChange={(e) => set("transporterName", e.target.value)} />
                </Field>
                <Field label="CPF / CNPJ" required error={errors.docNumber}>
                  <Input value={form.docNumber} onChange={(e) => set("docNumber", formatDoc(e.target.value))} />
                </Field>
                <Field label="Telefone" required error={errors.phone}>
                  <Input value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} />
                </Field>
                <Field label="E-mail" hint="Opcional.">
                  <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
                </Field>
                <Field label="Cidade" required error={errors.city}>
                  <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
                </Field>
                <Field label="UF" required error={errors.uf}>
                  <SelectBox value={form.uf} onChange={(v) => set("uf", v)} options={UFS} placeholder="UF" />
                </Field>
                <Field label="Tipo de vínculo" required error={errors.linkType}>
                  <SelectBox value={form.linkType} onChange={(v) => set("linkType", v)} options={LINK_TYPES} placeholder="Selecione" />
                </Field>
              </div>
            </Section>

            <Section title="Dados do veículo">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Placa">
                  <Input value={prettyPlate(form.plate)} readOnly className="font-display font-bold tracking-widest" />
                </Field>
                <Field label="Marca / modelo" required error={errors.brandModel} className="lg:col-span-2">
                  <Input value={form.brandModel} onChange={(e) => set("brandModel", e.target.value)} />
                </Field>
                <Field label="PBT (kg)" required error={errors.pbtKg}>
                  <Input inputMode="decimal" value={form.pbtKg} onChange={(e) => set("pbtKg", e.target.value.replace(/[^0-9,.]/g, ""))} />
                </Field>
                <Field label="TARA (kg)" required error={errors.tareKg}>
                  <Input inputMode="decimal" value={form.tareKg} onChange={(e) => set("tareKg", e.target.value.replace(/[^0-9,.]/g, ""))} />
                </Field>
                <Field label="LOTAÇÃO (kg)" required error={errors.lotacaoKg}>
                  <Input inputMode="decimal" value={form.lotacaoKg} onChange={(e) => set("lotacaoKg", e.target.value.replace(/[^0-9,.]/g, ""))} />
                </Field>
                <Field label="Quantidade de pallets" required error={errors.pallets}>
                  <Input inputMode="numeric" value={form.pallets} onChange={(e) => set("pallets", e.target.value.replace(/\D/g, ""))} />
                </Field>
                <Field label="Tipo de carroceria">
                  <SelectBox value={form.bodyType} onChange={(v) => set("bodyType", v)} options={BODY_TYPES} placeholder="Selecione" />
                </Field>
                <Field label="ANTT / RNTRC" required error={errors.rntrc}>
                  <Input value={form.rntrc} onChange={(e) => set("rntrc", e.target.value.toUpperCase())} />
                </Field>
                <Field label="RENAVAM" required error={errors.renavam}>
                  <Input value={form.renavam} onChange={(e) => set("renavam", e.target.value.replace(/\D/g, "").slice(0, 11))} />
                </Field>
                <Field label="Chassi" required error={errors.chassis} className="sm:col-span-2">
                  <Input value={form.chassis} onChange={(e) => set("chassis", e.target.value.toUpperCase().slice(0, 17))} />
                </Field>
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <h3 className="text-sm font-bold">Dimensões da carroceria</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-3">
                  <Field label="Largura (m)" required error={errors.bodyWidthM}>
                    <Input inputMode="decimal" value={form.bodyWidthM} onChange={(e) => set("bodyWidthM", e.target.value.replace(/[^0-9,.]/g, ""))} placeholder="2,40" />
                  </Field>
                  <Field label="Altura (m)" required error={errors.bodyHeightM}>
                    <Input inputMode="decimal" value={form.bodyHeightM} onChange={(e) => set("bodyHeightM", e.target.value.replace(/[^0-9,.]/g, ""))} placeholder="2,60" />
                  </Field>
                  <Field label="Comprimento (m)" required error={errors.bodyLengthM}>
                    <Input inputMode="decimal" value={form.bodyLengthM} onChange={(e) => set("bodyLengthM", e.target.value.replace(/[^0-9,.]/g, ""))} placeholder="8,50" />
                  </Field>
                </div>
              </div>

              <div className="mt-6 border-t border-border pt-5">
                <h3 className="text-sm font-bold">TAG de pedágio</h3>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field label="Número da TAG" hint="Se houver.">
                    <Input value={form.tollTagNumber} onChange={(e) => set("tollTagNumber", e.target.value)} />
                  </Field>
                  <Field label="Empresa da TAG" hint="Ex.: Sem Parar, ConectCar.">
                    <Input value={form.tollTagCompany} onChange={(e) => set("tollTagCompany", e.target.value)} />
                  </Field>
                  <Field label="TAG própria?" className="sm:col-span-2">
                    <YesNo value={form.tollTagOwned} onChange={(v) => set("tollTagOwned", v)} name="tagOwned" />
                  </Field>
                </div>
              </div>
            </Section>

            <Section title="Motorista">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome" required error={errors.driverName} className="sm:col-span-2">
                  <Input value={form.driverName} onChange={(e) => set("driverName", e.target.value)} />
                </Field>
                <Field label="CPF" required error={errors.driverCpf}>
                  <Input value={form.driverCpf} onChange={(e) => set("driverCpf", formatDoc(e.target.value))} />
                </Field>
                <Field label="Número da CNH" required error={errors.driverCnh}>
                  <Input value={form.driverCnh} onChange={(e) => set("driverCnh", e.target.value.replace(/\D/g, "").slice(0, 11))} />
                </Field>
                <Field label="Categoria" required error={errors.driverCategory}>
                  <SelectBox value={form.driverCategory} onChange={(v) => set("driverCategory", v)} options={CNH_CATEGORIES} placeholder="Selecione" />
                </Field>
                <Field label="Telefone" required error={errors.driverPhone}>
                  <Input value={form.driverPhone} onChange={(e) => set("driverPhone", formatPhone(e.target.value))} />
                </Field>
              </div>
            </Section>

            <Section title="Rastreamento">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="O veículo possui rastreador?" className="sm:col-span-2">
                  <YesNo value={form.hasTracker} onChange={(v) => set("hasTracker", v)} name="tracker" />
                </Field>
                {form.hasTracker === "sim" && (
                  <>
                    <Field label="Empresa" required error={errors.trackerProvider}>
                      <Input value={form.trackerProvider} onChange={(e) => set("trackerProvider", e.target.value)} />
                    </Field>
                    <Field label="Identificador / IMEI" required error={errors.trackerId}>
                      <Input value={form.trackerId} onChange={(e) => set("trackerId", e.target.value)} />
                    </Field>
                    <Field label="Status" required error={errors.trackerStatus}>
                      <SelectBox value={form.trackerStatus} onChange={(v) => set("trackerStatus", v)} options={TRACKER_STATUS} placeholder="Selecione" />
                    </Field>
                  </>
                )}
              </div>
            </Section>

            <Section title="Documentos e fotos">
              <p className="mb-4 text-xs leading-5 text-muted-foreground">
                PDF, JPG ou PNG — até {MAX_FILE_MB} MB por arquivo. Os documentos ficam privados e serão analisados pela GRF.
              </p>
              <div className="space-y-3">
                {DOC_TYPES.map((att) => (
                  <AttachmentCard key={att.key} att={att} up={docs[att.key]} error={errors[att.key]} onPick={(file) => handleFile(att, file)} onRemove={() => dropDoc(att.key)} />
                ))}
              </div>
              <div className="mt-6 rounded-md border border-primary/30 bg-primary/5 p-3">
                <p className="flex items-center gap-2 text-sm font-bold"><Camera className="size-4" /> Fotos do veículo</p>
                <p className="mt-1 text-xs text-muted-foreground">As fotos são usadas para validar placa, veículo e carroceria.</p>
              </div>
              <div className="mt-3 space-y-3">
                {PHOTO_TYPES.map((att) => (
                  <AttachmentCard key={att.key} att={att} up={docs[att.key]} error={errors[att.key]} onPick={(file) => handleFile(att, file)} onRemove={() => dropDoc(att.key)} />
                ))}
              </div>
            </Section>

            <label className={errors.declaration ? "flex cursor-pointer items-start gap-3 rounded-xl border border-destructive bg-destructive/5 p-4" : "flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4"}>
              <Checkbox checked={declaration} onCheckedChange={(v) => setDeclaration(v === true)} className="mt-0.5" />
              <span className="text-sm">
                Declaro que as informações e documentos enviados são verdadeiros e autorizo a GRF a atualizar o cadastro deste veículo com os dados informados.
                {errors.declaration && <span className="mt-1 block text-xs font-medium text-destructive">{errors.declaration}</span>}
              </span>
            </label>

            <div className="flex justify-end">
              <Button size="lg" onClick={handleSubmit} disabled={sending}>
                {sending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                {sending ? "Enviando..." : "Finalizar cadastro"}
              </Button>
            </div>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-base font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Known({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/70 p-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm font-bold">{value && value !== "-" ? value : "Não informado"}</p>
    </div>
  );
}

function AttachmentCard({
  att,
  up,
  error,
  onPick,
  onRemove,
}: {
  att: AttachmentType;
  up: UploadedDoc | undefined;
  error: string | undefined;
  onPick: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  const isPhoto = att.kind === "photo";
  const sending = up?.status === "enviando";
  const accept = acceptAttrFor(att.kind);

  return (
    <div className={error ? "rounded-lg border border-destructive/60 bg-destructive/5 p-4" : "rounded-lg border border-border p-4"}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-surface">
            {up?.previewUrl ? (
              <img src={up.previewUrl} alt={att.label} className="size-full object-cover" />
            ) : isPhoto ? (
              <ImageIcon className="size-5 text-muted-foreground" />
            ) : (
              <FileText className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{att.label}{!att.required && <span className="ml-2 text-[11px] text-muted-foreground">(opcional)</span>}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{att.hint}</p>
            {up && <p className="mt-1 text-xs text-muted-foreground">{formatBytes(up.fileSize)} · <strong>{up.status === "enviando" ? "Enviando..." : up.status === "enviado" ? "Enviado" : "Erro"}</strong></p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sending && <Loader2 className="size-4 animate-spin" />}
          {up && !sending && <Button type="button" variant="ghost" size="sm" onClick={onRemove}><Trash2 className="size-4" /></Button>}
          {isPhoto && (
            <Button asChild variant="outline" size="sm" disabled={sending}>
              <label className="cursor-pointer"><Camera className="size-4" /> {up ? "Refazer" : "Tirar foto"}<input type="file" className="hidden" accept={accept} capture="environment" disabled={sending} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} /></label>
            </Button>
          )}
          <Button asChild variant={isPhoto ? "ghost" : "outline"} size="sm" disabled={sending}>
            <label className="cursor-pointer"><FileUp className="size-4" /> {isPhoto ? "Galeria" : up ? "Trocar" : "Anexar"}<input type="file" className="hidden" accept={accept} disabled={sending} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} /></label>
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive"><AlertCircle className="size-3.5" /> {error}</p>}
    </div>
  );
}

function SelectBox({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function YesNo({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="flex gap-6">
      <div className="flex items-center gap-2"><RadioGroupItem value="sim" id={`${name}-sim`} /><Label htmlFor={`${name}-sim`}>Sim</Label></div>
      <div className="flex items-center gap-2"><RadioGroupItem value="nao" id={`${name}-nao`} /><Label htmlFor={`${name}-nao`}>Não</Label></div>
    </RadioGroup>
  );
}
