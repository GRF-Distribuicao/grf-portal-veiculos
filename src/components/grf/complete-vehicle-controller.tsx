import { Link } from "@tanstack/react-router";
import { isTransgarra, isOperationBase, knownOperationBase } from "@/lib/grf-operation-base";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, Database, Loader2 } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/grf/chrome";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CompletionAttachments, type UploadedDoc } from "@/components/grf/complete-vehicle-attachments";
import { CompletionSections, completionEmpty, type CompletionFormState } from "@/components/grf/complete-vehicle-fields";
import { createUploadTicket, checkPlate } from "@/lib/grf.functions";
import { completeExistingVehicle } from "@/lib/grf-complete-vehicle.functions";
import { lookupSankhyaVehicle } from "@/lib/grf-vehicle-catalog.functions";
import { prepareFile, uploadWithTicket } from "@/lib/grf-upload";
import { ATTACHMENT_TYPES, formatPlate, isValidDoc, isValidPhone, onlyDigits, prettyPlate } from "@/lib/grf-domain";
import type { AttachmentType } from "@/lib/grf-domain";

type MasterVehicle = Awaited<ReturnType<typeof lookupSankhyaVehicle>> extends infer T
  ? T extends { found: true; vehicle: infer V }
    ? V
    : never
  : never;

function num(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && value.trim() !== "" ? parsed : null;
}

export function CompleteVehicleController() {
  const lookup = useServerFn(lookupSankhyaVehicle);
  const verifyPortal = useServerFn(checkPlate);
  const requestTicket = useServerFn(createUploadTicket);
  const complete = useServerFn(completeExistingVehicle);
  const [form, setForm] = useState<CompletionFormState>(completionEmpty);
  const [vehicle, setVehicle] = useState<MasterVehicle | null>(null);
  const [loadingVehicle, setLoadingVehicle] = useState(true);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [docs, setDocs] = useState<Record<string, UploadedDoc>>({});
  const [declaration, setDeclaration] = useState(false);
  const [sending, setSending] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());
  const set = (key: keyof CompletionFormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const plate = formatPlate(new URLSearchParams(window.location.search).get("plate") ?? "");
    if (plate.length !== 7) {
      setBlocked("Informe uma placa válida pela tela Consultar placa antes de completar o cadastro.");
      setLoadingVehicle(false);
      return;
    }
    void (async () => {
      try {
        const [master, portal] = await Promise.all([lookup({ data: { plate } }), verifyPortal({ data: { plate } })]);
        if (portal.exists) {
          setBlocked(portal.protocol ? `Este veículo já possui um cadastro enviado no Portal GRF (${portal.protocol}).` : "Este veículo já possui um cadastro enviado no Portal GRF.");
          return;
        }
        if (!master.found) {
          setBlocked("A placa não foi encontrada no cadastro mestre. Volte e inicie o cadastro pela placa.");
          return;
        }
        const v = master.vehicle;
        setVehicle(v);
        setForm((current) => ({
          ...current,
          plate: v.plate,
          operationBase: knownOperationBase(v.supportPoint),
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
          grfSticker: v.grfSticker === true ? "sim" : "nao",
          hasMonitoringCamera: v.hasMonitoringCamera === true ? "sim" : "nao",
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
    if (!prep.ok) return void toast.error(prep.error);
    const { prepared } = prep;
    setDocs((current) => ({ ...current, [att.key]: { attachmentKey: att.key, fileName: prepared.fileName, fileSize: prepared.fileSize, mimeType: prepared.mimeType, storagePath: "", previewUrl: prepared.previewUrl, status: "enviando" } }));
    try {
      const ticket = await requestTicket({ data: { sessionId, attachmentKey: att.key, fileName: prepared.fileName, mimeType: prepared.mimeType, fileSize: prepared.fileSize } });
      if (!ticket.ok) throw new Error(ticket.error);
      const uploaded = await uploadWithTicket({ path: ticket.path, token: ticket.token }, prepared.file);
      if (!uploaded.ok) throw new Error(uploaded.error);
      setDocs((current) => ({ ...current, [att.key]: { ...current[att.key]!, storagePath: ticket.path, status: "enviado" } }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no envio do arquivo.";
      setDocs((current) => ({ ...current, [att.key]: { ...current[att.key]!, status: "erro", error: message } }));
      toast.error(message);
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (isTransgarra(form.docNumber) && !isOperationBase(form.operationBase)) e['operationBase'] = "Selecione a base de operação da Transgarra.";
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
    if (!validate()) return void toast.error("Revise os campos destacados antes de enviar.");
    setSending(true);
    try {
      const result = await complete({ data: {
        operationBase: isTransgarra(form.docNumber) && isOperationBase(form.operationBase) ? form.operationBase : null,
        transporter: { name: form.transporterName.trim(), docType: onlyDigits(form.docNumber).length === 11 ? "CPF" : "CNPJ", docNumber: form.docNumber, phone: form.phone, email: form.email.trim() || null, city: form.city.trim(), uf: form.uf, linkType: form.linkType },
        vehicle: { plate: form.plate, brandModel: form.brandModel.trim(), bodyType: form.bodyType || null, pbtKg: num(form.pbtKg)!, tareKg: num(form.tareKg)!, lotacaoKg: num(form.lotacaoKg)!, pallets: Math.trunc(num(form.pallets)!), renavam: form.renavam.trim(), chassis: form.chassis.trim().toUpperCase(), rntrc: form.rntrc.trim(), bodyWidthM: num(form.bodyWidthM)!, bodyHeightM: num(form.bodyHeightM)!, bodyLengthM: num(form.bodyLengthM)!, tollTagNumber: form.tollTagNumber.trim() || null, tollTagCompany: form.tollTagCompany.trim() || null, tollTagOwned: form.tollTagOwned === "sim", grfSticker: form.grfSticker === "sim", hasMonitoringCamera: form.hasMonitoringCamera === "sim" },
        driver: { name: form.driverName.trim(), cpf: form.driverCpf, cnh: form.driverCnh.trim(), cnhCategory: form.driverCategory, phone: form.driverPhone },
        tracking: { hasTracker: form.hasTracker === "sim", provider: form.trackerProvider.trim() || null, identifier: form.trackerId.trim() || null, status: form.trackerStatus || null },
        documents: Object.values(docs).filter((d) => d.status === "enviado" && d.storagePath).map((d) => ({ docType: d.attachmentKey, fileName: d.fileName, fileSize: d.fileSize, mimeType: d.mimeType, storagePath: d.storagePath })),
        declarationAccepted: declaration,
      } });
      if (!result.ok) return void toast.error(result.error);
      setProtocol(result.protocol);
    } catch {
      toast.error("Não foi possível concluir o cadastro. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (protocol) {
    return <div className="flex min-h-screen flex-col"><PublicHeader /><main className="mx-auto w-full max-w-xl flex-1 px-4 py-14 text-center"><CheckCircle2 className="mx-auto size-14 text-success" /><h1 className="mt-5 text-2xl font-bold">Complementação enviada!</h1><p className="mt-2 text-sm text-muted-foreground">Os dados do veículo foram atualizados e enviados para análise da equipe GRF.</p><div className="mt-6 rounded-lg border border-border bg-card p-6"><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Protocolo</p><p className="font-display mt-1 text-3xl font-extrabold">{protocol}</p><Button variant="outline" size="sm" className="mt-4" onClick={() => { navigator.clipboard.writeText(protocol); toast.success("Protocolo copiado."); }}><Copy className="size-4" /> Copiar protocolo</Button></div><Button asChild className="mt-6"><Link to="/consulta">Consultar andamento</Link></Button></main><PublicFooter /></div>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <Link to="/consulta" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Voltar à consulta</Link>
        <h1 className="mt-4 text-2xl font-bold">Completar cadastro do veículo</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Aproveitamos tudo que a GRF já possui. Confira os dados encontrados e preencha somente o que estiver faltando.</p>
        {loadingVehicle && <div className="mt-8 flex items-center gap-2 rounded-lg border border-border bg-card p-5 text-sm"><Loader2 className="size-4 animate-spin" /> Carregando cadastro do veículo...</div>}
        {!loadingVehicle && blocked && <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 p-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 text-destructive" /><div><p className="font-bold">Não é possível continuar por esta tela</p><p className="mt-1 text-sm text-muted-foreground">{blocked}</p><Button asChild className="mt-4" variant="outline"><Link to="/consulta">Consultar outra placa</Link></Button></div></div></div>}
        {!loadingVehicle && vehicle && !blocked && <div className="mt-6 space-y-6">
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-5"><div className="flex items-start gap-3"><Database className="mt-0.5 size-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="font-bold">Veículo encontrado — termine o cadastro</p><p className="mt-1 text-sm text-muted-foreground">Placa <strong>{prettyPlate(vehicle.plate)}</strong> já existe no cadastro mestre da GRF{vehicle.sankhyaRegistered ? " e foi localizada no Sankhya" : ""}.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Known label="Modelo" value={vehicle.model} /><Known label="Tipo / classificação" value={vehicle.fleetVehicleType} /><Known label="Lotação conhecida" value={vehicle.capacityKg == null ? null : `${vehicle.capacityKg.toLocaleString("pt-BR")} kg`} /><Known label="Pallets" value={vehicle.pallets == null ? null : String(vehicle.pallets)} /></div>{vehicle.missingFields.length > 0 && <p className="mt-4 text-xs leading-5 text-muted-foreground"><strong>Ainda faltam no cadastro:</strong> {vehicle.missingFields.join(", ")} e os documentos/fotos de validação.</p>}</div></div></section>
          <CompletionSections form={form} set={set} errors={errors} />
          <CompletionAttachments docs={docs} errors={errors} onPick={handleFile} onRemove={dropDoc} />
          <label className={errors.declaration ? "flex cursor-pointer items-start gap-3 rounded-xl border border-destructive bg-destructive/5 p-4" : "flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4"}><Checkbox checked={declaration} onCheckedChange={(v) => setDeclaration(v === true)} className="mt-0.5" /><span className="text-sm">Declaro que as informações e documentos enviados são verdadeiros e autorizo a GRF a atualizar o cadastro deste veículo com os dados informados.{errors.declaration && <span className="mt-1 block text-xs font-medium text-destructive">{errors.declaration}</span>}</span></label>
          <div className="flex justify-end"><Button size="lg" onClick={handleSubmit} disabled={sending}>{sending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}{sending ? "Enviando..." : "Finalizar cadastro"}</Button></div>
        </div>}
      </main>
      <PublicFooter />
    </div>
  );
}

function Known({ label, value }: { label: string; value: string | null }) {
  return <div className="rounded-lg border border-border/70 bg-background/70 p-3"><p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p><p className="mt-1 text-sm font-bold">{value && value !== "-" ? value : "Não informado"}</p></div>;
}
