import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Copy,
  FileText,
  FileUp,
  ImageIcon,
  Loader2,
  Trash2,
} from "lucide-react";
import { PublicHeader, PublicFooter } from "@/components/grf/chrome";
import { Field, ReviewRow } from "@/components/grf/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { checkPlate, createUploadTicket, submitRegistration } from "@/lib/grf.functions";
import { prepareFile, uploadWithTicket } from "@/lib/grf-upload";
import {
  ATTACHMENT_TYPES,
  BODY_TYPES,
  CNH_CATEGORIES,
  DOC_TYPES,
  FUELS,
  LINK_TYPES,
  MAX_FILE_MB,
  PHOTO_TYPES,
  SPECIES,
  TRACKER_STATUS,
  UFS,
  VEHICLE_TYPES,
  WHEEL_TYPES,
  acceptAttrFor,
  formatBytes,
  formatDoc,
  formatPhone,
  formatPlate,
  isValidDoc,
  isValidEmail,
  isValidPhone,
  isValidPlate,
  onlyDigits,
  prettyPlate,
} from "@/lib/grf-domain";
import type { AttachmentType } from "@/lib/grf-domain";

export const Route = createFileRoute("/cadastro")({
  head: () => ({
    meta: [
      { title: "Cadastrar veículo – Portal GRF" },
      {
        name: "description",
        content:
          "Formulário em 6 etapas para cadastrar um veículo na GRF: transportador, veículo, motorista, rastreamento, documentos e revisão.",
      },
      { property: "og:title", content: "Cadastrar veículo – Portal GRF" },
      { property: "og:description", content: "Envie os dados e documentos do seu veículo para a GRF." },
    ],
  }),
  component: Cadastro,
});

const STEP_TITLES = [
  "Responsável / Transportador",
  "Dados do veículo",
  "Motorista",
  "Rastreamento",
  "Documentos",
  "Revisão e envio",
];

type UploadedDoc = {
  attachmentKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  /** ObjectURL local, só para pré-visualizar fotos antes do envio. */
  previewUrl: string | null;
  status: "enviando" | "enviado" | "erro";
  error?: string;
};

const empty = {
  name: "", docNumber: "", phone: "", email: "", city: "", uf: "", linkType: "",
  plate: "", vehicleType: "", species: "", wheelType: "", bodyType: "", brandModel: "",
  manufactureYear: "", modelYear: "", maxWeightKg: "", tareKg: "", maxCapacityKg: "",
  pallets: "", axles: "", renavam: "", chassis: "", engineNumber: "", plateCity: "",
  plateUf: "", color: "", fuel: "", companyVehicle: "nao",
  driverName: "", driverCpf: "", driverCnh: "", driverCategory: "", driverPhone: "",
  hasTracker: "nao", trackerProvider: "", trackerId: "", trackerStatus: "",
};
type FormState = typeof empty;

function num(v: string) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && v !== "" ? n : null;
}

function Cadastro() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Record<string, UploadedDoc>>({});
  const [declaration, setDeclaration] = useState(false);
  const [sending, setSending] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  const submit = useServerFn(submitRegistration);
  const plateCheck = useServerFn(checkPlate);
  const requestTicket = useServerFn(createUploadTicket);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function validateStep(current: number) {
    const e: Record<string, string> = {};
    if (current === 0) {
      if (form.name.trim().length < 3) e['name'] = "Informe o nome ou razão social.";
      if (!isValidDoc(form.docNumber)) e['docNumber'] = "CPF/CNPJ inválido.";
      if (!isValidPhone(form.phone)) e['phone'] = "Telefone inválido.";
      if (form.email.trim() && !isValidEmail(form.email)) e['email'] = "E-mail inválido.";
      if (form.city.trim().length < 2) e['city'] = "Informe a cidade.";
      if (!form.uf) e['uf'] = "Selecione a UF.";
      if (!form.linkType) e['linkType'] = "Selecione o tipo de vínculo.";
    }
    if (current === 1) {
      if (!isValidPlate(form.plate)) e['plate'] = "Placa inválida (padrão ABC1234 ou ABC1D23).";
      if (!form.maxCapacityKg) e['maxCapacityKg'] = "Informe a capacidade de carga em kg.";
      if (!form.pallets) e['pallets'] = "Informe a quantidade de pallets.";
      if (!form.brandModel.trim()) e['brandModel'] = "Informe marca/modelo.";
      if (!form.renavam.trim()) e['renavam'] = "Informe o RENAVAM.";
      if (!form.chassis.trim()) e['chassis'] = "Informe o chassi.";
      if (!e['plate']) {
        const r = await plateCheck({ data: { plate: form.plate } });
        if (r.exists) e['plate'] = "Veículo já possui cadastro no Portal GRF.";
      }
    }
    if (current === 2) {
      if (form.driverName.trim().length < 3) e['driverName'] = "Informe o nome do motorista.";
      if (!isValidDoc(form.driverCpf) || onlyDigits(form.driverCpf).length !== 11)
        e['driverCpf'] = "CPF inválido.";
      if (!form.driverCnh.trim()) e['driverCnh'] = "Informe o número da CNH.";
      if (!form.driverCategory) e['driverCategory'] = "Selecione a categoria.";
      if (!isValidPhone(form.driverPhone)) e['driverPhone'] = "Telefone inválido.";
    }
    if (current === 3 && form.hasTracker === "sim") {
      if (!form.trackerProvider.trim()) e['trackerProvider'] = "Informe a empresa de rastreamento.";
      if (!form.trackerId.trim()) e['trackerId'] = "Informe o identificador/IMEI.";
      if (!form.trackerStatus) e['trackerStatus'] = "Selecione o status.";
    }
    if (current === 4) {
      for (const a of ATTACHMENT_TYPES) {
        if (!a.required) continue;
        const up = docs[a.key];
        if (!up) e[a.key] = `Anexe: ${a.label}.`;
        else if (up.status === "enviando") e[a.key] = "Aguarde o envio deste arquivo terminar.";
        else if (up.status !== "enviado") e[a.key] = up.error ?? "Falha no envio. Tente novamente.";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function next() {
    if (await validateStep(step)) setStep((s) => Math.min(s + 1, 5));
    else toast.error("Revise os campos destacados.");
  }

  function dropDoc(key: string) {
    setDocs((s) => {
      const next = { ...s };
      const previous = next[key];
      if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
      delete next[key];
      return next;
    });
  }

  /**
   * Envio em duas etapas: o servidor emite uma URL assinada e o navegador manda
   * o arquivo direto para o Storage. Fotos são convertidas para JPEG e
   * redimensionadas antes (resolve HEIC do iPhone e arquivos acima de 10 MB).
   */
  async function handleFile(att: AttachmentType, file: File | undefined) {
    if (!file) return;

    setErrors((prev) => {
      const next = { ...prev };
      delete next[att.key];
      return next;
    });

    const prep = await prepareFile(att.kind, file);
    if (!prep.ok) {
      toast.error(prep.error);
      return;
    }
    const { prepared } = prep;

    setDocs((d) => {
      const previous = d[att.key];
      if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
      return {
        ...d,
        [att.key]: {
          attachmentKey: att.key,
          fileName: prepared.fileName,
          fileSize: prepared.fileSize,
          mimeType: prepared.mimeType,
          storagePath: "",
          previewUrl: prepared.previewUrl,
          status: "enviando",
        },
      };
    });

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

      const sentFile = await uploadWithTicket({ path: ticket.path, token: ticket.token }, prepared.file);
      if (!sentFile.ok) throw new Error(sentFile.error);

      setDocs((d) => ({
        ...d,
        [att.key]: { ...d[att.key]!, storagePath: ticket.path, status: "enviado" },
      }));
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Falha no envio do arquivo. Verifique a conexão e tente novamente.";
      setDocs((d) => ({ ...d, [att.key]: { ...d[att.key]!, status: "erro", error: message } }));
      toast.error(message);
    }
  }

  async function handleSubmit() {
    if (!declaration) {
      toast.error("É necessário declarar a veracidade das informações.");
      return;
    }
    setSending(true);
    try {
      const res = await submit({
        data: {
          transporter: {
            name: form.name.trim(),
            docType: onlyDigits(form.docNumber).length === 11 ? "CPF" : "CNPJ",
            docNumber: form.docNumber,
            phone: form.phone,
            email: form.email.trim(),
            city: form.city.trim(),
            uf: form.uf,
            linkType: form.linkType,
          },
          vehicle: {
            plate: formatPlate(form.plate),
            vehicleType: form.vehicleType || null,
            species: form.species || null,
            wheelType: form.wheelType || null,
            bodyType: form.bodyType || null,
            brandModel: form.brandModel || null,
            manufactureYear: num(form.manufactureYear),
            modelYear: num(form.modelYear),
            maxWeightKg: num(form.maxWeightKg),
            tareKg: num(form.tareKg),
            maxCapacityKg: num(form.maxCapacityKg),
            pallets: num(form.pallets),
            axles: num(form.axles),
            renavam: form.renavam || null,
            chassis: form.chassis || null,
            engineNumber: form.engineNumber || null,
            plateCity: form.plateCity || null,
            plateUf: form.plateUf || null,
            color: form.color || null,
            fuel: form.fuel || null,
            companyVehicle: form.companyVehicle === "sim",
          },
          driver: {
            name: form.driverName.trim(),
            cpf: form.driverCpf,
            cnh: form.driverCnh || null,
            cnhCategory: form.driverCategory || null,
            phone: form.driverPhone || null,
          },
          tracking: {
            hasTracker: form.hasTracker === "sim",
            provider: form.trackerProvider || null,
            identifier: form.trackerId || null,
            status: form.trackerStatus || null,
          },
          documents: Object.values(docs)
            .filter((d) => d.status === "enviado" && d.storagePath)
            .map(({ attachmentKey, fileName, fileSize, mimeType, storagePath }) => ({
              docType: attachmentKey,
              fileName,
              fileSize,
              mimeType,
              storagePath,
            })),
          declarationAccepted: declaration,
        },
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setProtocol(res.protocol);
    } catch {
      toast.error("Não foi possível enviar o cadastro. Tente novamente.");
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
          <h1 className="mt-5 text-2xl font-bold">Cadastro enviado!</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Guarde o número do protocolo. A equipe GRF fará a análise dos dados e documentos.
          </p>
          <div className="mt-6 rounded-lg border border-border bg-card p-6">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Protocolo
            </p>
            <p className="font-display mt-1 text-3xl font-extrabold">{protocol}</p>
            <p className="mt-3 text-sm">
              Status atual: <strong>Aguardando análise</strong>
            </p>
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
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild>
              <Link to="/consulta">Consultar andamento</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Início
        </Link>

        <div className="mt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Etapa {step + 1} de 6
              </p>
              <h1 className="text-2xl font-bold">{STEP_TITLES[step]}</h1>
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {Math.round(((step + 1) / 6) * 100)}%
            </span>
          </div>
          <Progress value={((step + 1) / 6) * 100} className="mt-3 h-2" />
        </div>

        <div className="mt-6 rounded-lg border border-border bg-card p-5 sm:p-6">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome / Razão social" required error={errors['name']} className="sm:col-span-2">
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="CPF / CNPJ" required error={errors['docNumber']}>
                <Input value={form.docNumber} onChange={(e) => set("docNumber", formatDoc(e.target.value))} placeholder="000.000.000-00" />
              </Field>
              <Field label="Telefone" required error={errors['phone']}>
                <Input value={form.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
              </Field>
              <Field label="E-mail" error={errors['email']} hint="Opcional.">
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
              </Field>
              <Field label="Cidade" required error={errors['city']}>
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="UF" required error={errors['uf']}>
                <SelectBox value={form.uf} onChange={(v) => set("uf", v)} options={UFS} placeholder="UF" />
              </Field>
              <Field label="Tipo de vínculo" required error={errors['linkType']}>
                <SelectBox value={form.linkType} onChange={(v) => set("linkType", v)} options={LINK_TYPES} placeholder="Selecione" />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Placa" required error={errors['plate']} hint="Padrão Mercosul ou antigo.">
                <Input
                  value={prettyPlate(form.plate)}
                  onChange={(e) => set("plate", formatPlate(e.target.value))}
                  placeholder="ABC-1D23"
                  className="font-display text-lg font-bold tracking-widest uppercase"
                />
              </Field>
              <Field label="Tipo de veículo" hint="Opcional.">
                <SelectBox value={form.vehicleType} onChange={(v) => set("vehicleType", v)} options={VEHICLE_TYPES} placeholder="Selecione" />
              </Field>
              <Field label="Espécie / tipo">
                <SelectBox value={form.species} onChange={(v) => set("species", v)} options={SPECIES} placeholder="Selecione" />
              </Field>
              <Field label="Tipo de rodado">
                <SelectBox value={form.wheelType} onChange={(v) => set("wheelType", v)} options={WHEEL_TYPES} placeholder="Selecione" />
              </Field>
              <Field label="Tipo de carroceria">
                <SelectBox value={form.bodyType} onChange={(v) => set("bodyType", v)} options={BODY_TYPES} placeholder="Selecione" />
              </Field>
              <Field label="Marca / modelo" required error={errors['brandModel']}>
                <Input value={form.brandModel} onChange={(e) => set("brandModel", e.target.value)} />
              </Field>
              <Field label="Ano de fabricação">
                <Input inputMode="numeric" value={form.manufactureYear} onChange={(e) => set("manufactureYear", e.target.value.replace(/\D/g, "").slice(0, 4))} />
              </Field>
              <Field label="Ano modelo">
                <Input inputMode="numeric" value={form.modelYear} onChange={(e) => set("modelYear", e.target.value.replace(/\D/g, "").slice(0, 4))} />
              </Field>
              <Field label="Peso máximo (kg)">
                <Input inputMode="numeric" value={form.maxWeightKg} onChange={(e) => set("maxWeightKg", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Tara (kg)">
                <Input inputMode="numeric" value={form.tareKg} onChange={(e) => set("tareKg", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Capacidade de carga (kg)" required error={errors['maxCapacityKg']}>
                <Input inputMode="numeric" value={form.maxCapacityKg} onChange={(e) => set("maxCapacityKg", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Quantidade de pallets" required error={errors['pallets']}>
                <Input inputMode="numeric" value={form.pallets} onChange={(e) => set("pallets", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Número de eixos">
                <Input inputMode="numeric" value={form.axles} onChange={(e) => set("axles", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="RENAVAM" required error={errors['renavam']}>
                <Input value={form.renavam} onChange={(e) => set("renavam", e.target.value.replace(/\D/g, "").slice(0, 11))} />
              </Field>
              <Field label="Chassi" required error={errors['chassis']}>
                <Input value={form.chassis} onChange={(e) => set("chassis", e.target.value.toUpperCase().slice(0, 17))} />
              </Field>
              <Field label="Número do motor">
                <Input value={form.engineNumber} onChange={(e) => set("engineNumber", e.target.value.toUpperCase())} />
              </Field>
              <Field label="Cidade de emplacamento">
                <Input value={form.plateCity} onChange={(e) => set("plateCity", e.target.value)} />
              </Field>
              <Field label="UF de emplacamento">
                <SelectBox value={form.plateUf} onChange={(v) => set("plateUf", v)} options={UFS} placeholder="UF" />
              </Field>
              <Field label="Cor">
                <Input value={form.color} onChange={(e) => set("color", e.target.value)} />
              </Field>
              <Field label="Combustível">
                <SelectBox value={form.fuel} onChange={(v) => set("fuel", v)} options={FUELS} placeholder="Selecione" />
              </Field>
              <Field label="Veículo da empresa?" className="sm:col-span-2">
                <YesNo value={form.companyVehicle} onChange={(v) => set("companyVehicle", v)} name="companyVehicle" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome do motorista" required error={errors['driverName']} className="sm:col-span-2">
                <Input value={form.driverName} onChange={(e) => set("driverName", e.target.value)} />
              </Field>
              <Field label="CPF" required error={errors['driverCpf']}>
                <Input value={form.driverCpf} onChange={(e) => set("driverCpf", formatDoc(e.target.value))} placeholder="000.000.000-00" />
              </Field>
              <Field label="Número da CNH" required error={errors['driverCnh']}>
                <Input value={form.driverCnh} onChange={(e) => set("driverCnh", e.target.value.replace(/\D/g, "").slice(0, 11))} />
              </Field>
              <Field label="Categoria" required error={errors['driverCategory']}>
                <SelectBox value={form.driverCategory} onChange={(v) => set("driverCategory", v)} options={CNH_CATEGORIES} placeholder="Selecione" />
              </Field>
              <Field label="Telefone" required error={errors['driverPhone']}>
                <Input value={form.driverPhone} onChange={(e) => set("driverPhone", formatPhone(e.target.value))} placeholder="(00) 00000-0000" />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="O veículo possui rastreador?" className="sm:col-span-2">
                <YesNo value={form.hasTracker} onChange={(v) => set("hasTracker", v)} name="hasTracker" />
              </Field>
              {form.hasTracker === "sim" && (
                <>
                  <Field label="Empresa de rastreamento" required error={errors['trackerProvider']}>
                    <Input value={form.trackerProvider} onChange={(e) => set("trackerProvider", e.target.value)} />
                  </Field>
                  <Field label="Identificador / IMEI" required error={errors['trackerId']}>
                    <Input value={form.trackerId} onChange={(e) => set("trackerId", e.target.value)} />
                  </Field>
                  <Field label="Status do rastreador" required error={errors['trackerStatus']}>
                    <SelectBox value={form.trackerStatus} onChange={(v) => set("trackerStatus", v)} options={TRACKER_STATUS} placeholder="Selecione" />
                  </Field>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <section className="space-y-3">
                <div>
                  <h2 className="text-sm font-bold">Documentos</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF, JPG ou PNG — até {MAX_FILE_MB} MB por arquivo. Ficam armazenados de forma
                    privada e são analisados pela equipe GRF.
                  </p>
                </div>
                {DOC_TYPES.map((att) => (
                  <AttachmentCard
                    key={att.key}
                    att={att}
                    up={docs[att.key]}
                    error={errors[att.key]}
                    onPick={(file) => handleFile(att, file)}
                    onRemove={() => dropDoc(att.key)}
                  />
                ))}
              </section>

              <section className="space-y-3">
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                  <h2 className="flex items-center gap-2 text-sm font-bold">
                    <Camera className="size-4" /> Fotos do veículo
                    <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-destructive uppercase">
                      Obrigatório
                    </span>
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    As fotos comprovam os dados declarados no formulário. Tire com o veículo
                    descarregado, em local iluminado, e confirme que a placa aparece legível. Fotos
                    que não permitirem conferir placa e carroceria fazem o cadastro ser devolvido.
                  </p>
                </div>
                {PHOTO_TYPES.map((att) => (
                  <AttachmentCard
                    key={att.key}
                    att={att}
                    up={docs[att.key]}
                    error={errors[att.key]}
                    onPick={(file) => handleFile(att, file)}
                    onRemove={() => dropDoc(att.key)}
                  />
                ))}
              </section>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <section>
                <h2 className="text-sm font-bold">Transportador</h2>
                <div className="mt-2">
                  <ReviewRow label="Nome / Razão social" value={form.name} />
                  <ReviewRow label="CPF / CNPJ" value={form.docNumber} />
                  <ReviewRow label="Contato" value={`${form.phone} · ${form.email}`} />
                  <ReviewRow label="Cidade / UF" value={`${form.city} / ${form.uf}`} />
                  <ReviewRow label="Vínculo" value={form.linkType} />
                </div>
              </section>
              <section>
                <h2 className="text-sm font-bold">Veículo</h2>
                <div className="mt-2">
                  <ReviewRow label="Placa" value={prettyPlate(form.plate)} />
                  <ReviewRow label="Tipo / espécie" value={`${form.vehicleType} ${form.species ? `· ${form.species}` : ""}`} />
                  <ReviewRow label="Rodado / carroceria" value={`${form.wheelType || "—"} · ${form.bodyType || "—"}`} />
                  <ReviewRow label="Marca / modelo" value={form.brandModel} />
                  <ReviewRow label="Ano fab. / modelo" value={`${form.manufactureYear || "—"} / ${form.modelYear || "—"}`} />
                  <ReviewRow label="Peso máx. / tara" value={`${form.maxWeightKg || "—"} kg / ${form.tareKg || "—"} kg`} />
                  <ReviewRow label="Capacidade / pallets / eixos" value={`${form.maxCapacityKg || "—"} kg · ${form.pallets || "—"} · ${form.axles || "—"}`} />
                  <ReviewRow label="RENAVAM" value={form.renavam} />
                  <ReviewRow label="Chassi" value={form.chassis} />
                  <ReviewRow label="Motor" value={form.engineNumber} />
                  <ReviewRow label="Emplacamento" value={`${form.plateCity || "—"} / ${form.plateUf || "—"}`} />
                  <ReviewRow label="Cor / combustível" value={`${form.color || "—"} · ${form.fuel || "—"}`} />
                  <ReviewRow label="Veículo da empresa" value={form.companyVehicle === "sim" ? "Sim" : "Não"} />
                </div>
              </section>
              <section>
                <h2 className="text-sm font-bold">Motorista</h2>
                <div className="mt-2">
                  <ReviewRow label="Nome" value={form.driverName} />
                  <ReviewRow label="CPF" value={form.driverCpf} />
                  <ReviewRow label="CNH / categoria" value={`${form.driverCnh} · ${form.driverCategory}`} />
                  <ReviewRow label="Telefone" value={form.driverPhone} />
                </div>
              </section>
              <section>
                <h2 className="text-sm font-bold">Rastreamento</h2>
                <div className="mt-2">
                  <ReviewRow label="Possui rastreador" value={form.hasTracker === "sim" ? "Sim" : "Não"} />
                  {form.hasTracker === "sim" && (
                    <>
                      <ReviewRow label="Empresa" value={form.trackerProvider} />
                      <ReviewRow label="Identificador / IMEI" value={form.trackerId} />
                      <ReviewRow label="Status" value={form.trackerStatus} />
                    </>
                  )}
                </div>
              </section>
              <section>
                <h2 className="text-sm font-bold">Documentos anexados</h2>
                <div className="mt-2">
                  {DOC_TYPES.map((d) => (
                    <ReviewRow
                      key={d.key}
                      label={d.label}
                      value={
                        docs[d.key]?.status === "enviado"
                          ? `${docs[d.key]!.fileName} (${formatBytes(docs[d.key]!.fileSize)})`
                          : "—"
                      }
                    />
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-sm font-bold">Fotos do veículo</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {PHOTO_TYPES.map((p) => {
                    const up = docs[p.key];
                    return (
                      <figure key={p.key} className="rounded-md border border-border p-2">
                        <div className="grid aspect-4/3 place-items-center overflow-hidden rounded bg-surface">
                          {up?.previewUrl ? (
                            <img src={up.previewUrl} alt={p.label} className="size-full object-cover" />
                          ) : (
                            <ImageIcon className="size-6 text-muted-foreground" />
                          )}
                        </div>
                        <figcaption className="mt-2 text-[11px] leading-tight text-muted-foreground">
                          {p.label}
                          {up?.status === "enviado" ? "" : " — não enviada"}
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              </section>

              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-4">
                <Checkbox checked={declaration} onCheckedChange={(v) => setDeclaration(v === true)} className="mt-0.5" />
                <span className="text-sm">
                  Declaro que as informações e documentos enviados são verdadeiros e estou ciente de
                  que serão analisados pela equipe GRF.
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || sending}>
            <ArrowLeft className="size-4" /> Voltar
          </Button>
          {step < 5 ? (
            <Button onClick={next}>
              Continuar <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={sending || !declaration}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Enviar cadastro
            </Button>
          )}
        </div>
      </main>
      <PublicFooter />
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
  const accept = acceptAttrFor(att.kind);
  const sending = up?.status === "enviando";

  return (
    <div
      className={
        error
          ? "rounded-lg border border-destructive/60 bg-destructive/5 p-4"
          : "rounded-lg border border-border p-4"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* Miniatura da foto (ou ícone do documento). */}
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
            <p className="text-sm font-semibold">
              {att.label}
              {!att.required && (
                <span className="ml-2 text-[11px] font-medium text-muted-foreground">(opcional)</span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{att.hint}</p>
            {up ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {formatBytes(up.fileSize)} ·{" "}
                <span
                  className={
                    up.status === "enviado"
                      ? "font-semibold text-success"
                      : up.status === "erro"
                        ? "font-semibold text-destructive"
                        : "font-semibold"
                  }
                >
                  {up.status === "enviando"
                    ? "Enviando..."
                    : up.status === "enviado"
                      ? "Enviado"
                      : "Erro no envio"}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sending && <Loader2 className="size-4 animate-spin" />}
          {up && !sending && (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label="Remover">
              <Trash2 className="size-4" />
            </Button>
          )}

          {/* No celular este botão abre a câmera direto. */}
          {isPhoto && (
            <Button asChild variant="outline" size="sm" disabled={sending}>
              <label className="cursor-pointer">
                <Camera className="size-4" /> {up ? "Refazer" : "Tirar foto"}
                <input
                  type="file"
                  className="hidden"
                  accept={accept}
                  capture="environment"
                  disabled={sending}
                  onChange={(e) => {
                    onPick(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
          )}

          <Button asChild variant={isPhoto ? "ghost" : "outline"} size="sm" disabled={sending}>
            <label className="cursor-pointer">
              <FileUp className="size-4" />
              {isPhoto ? "Galeria" : up ? "Trocar" : "Anexar"}
              <input
                type="file"
                className="hidden"
                accept={accept}
                disabled={sending}
                onChange={(e) => {
                  onPick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive">
          <AlertCircle className="size-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

function SelectBox({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function YesNo({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
  return (
    <RadioGroup value={value} onValueChange={onChange} className="flex gap-6">
      <div className="flex items-center gap-2">
        <RadioGroupItem value="sim" id={`${name}-sim`} />
        <Label htmlFor={`${name}-sim`}>Sim</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="nao" id={`${name}-nao`} />
        <Label htmlFor={`${name}-nao`}>Não</Label>
      </div>
    </RadioGroup>
  );
}

