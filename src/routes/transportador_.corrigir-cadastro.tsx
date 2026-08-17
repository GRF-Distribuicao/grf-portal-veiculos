import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ArrowLeft, CheckCircle2, Copy, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PublicFooter } from "@/components/grf/chrome";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CompletionAttachments, type UploadedDoc } from "@/components/grf/complete-vehicle-attachments";
import { CompletionSections, completionEmpty, type CompletionFormState } from "@/components/grf/complete-vehicle-fields";
import { createUploadTicket } from "@/lib/grf.functions";
import { getReturnedCorrection, resubmitReturnedCorrection } from "@/lib/grf-transporter-corrections.functions";
import { transporterSupabase as supabase } from "@/integrations/supabase/transporter-client";
import { prepareFile, uploadWithTicket } from "@/lib/grf-upload";
import { ATTACHMENT_TYPES, formatPlate, isValidDoc, isValidPhone, onlyDigits, prettyPlate } from "@/lib/grf-domain";
import type { AttachmentType } from "@/lib/grf-domain";

export const Route = createFileRoute("/transportador/corrigir-cadastro")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Corrigir cadastro – Área do Transportador" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TransporterCorrectionPage,
});

function num(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && value.trim() !== "" ? parsed : null;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function TransporterCorrectionPage() {
  const getCorrection = useServerFn(getReturnedCorrection);
  const resubmit = useServerFn(resubmitReturnedCorrection);
  const requestTicket = useServerFn(createUploadTicket);

  const [registrationId, setRegistrationId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [returnNote, setReturnNote] = useState<string | null>(null);
  const [form, setForm] = useState<CompletionFormState>(completionEmpty);
  const [docs, setDocs] = useState<Record<string, UploadedDoc>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [declaration, setDeclaration] = useState(false);
  const [sending, setSending] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [sessionId] = useState(() => crypto.randomUUID());

  const set = (key: keyof CompletionFormState, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const id = new URLSearchParams(window.location.search).get("id") ?? "";
      if (!id) {
        setLoadError("Cadastro devolvido não informado.");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      if (!token) {
        setLoadError("Entre novamente na Área do Transportador para corrigir este cadastro.");
        return;
      }

      const result = await getCorrection({ data: { accessToken: token, registrationId: id } });
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }

      setRegistrationId(id);
      setAccessToken(token);
      setReturnNote(result.returnNote);

      const reg = result.registration as any;
      const transporter = (result.transporter ?? {}) as any;
      const driver = (result.driver ?? {}) as any;
      const tracking = (result.tracking ?? {}) as any;
      const master = (result.master ?? {}) as any;

      setForm({
        ...completionEmpty,
        plate: formatPlate(text(reg.plate)),
        transporterName: text(transporter.name),
        docNumber: text(transporter.doc_number),
        phone: text(transporter.phone),
        email: text(transporter.email),
        city: text(transporter.city),
        uf: text(transporter.uf),
        linkType: text(transporter.link_type),
        brandModel: text(reg.brand_model || master.brand_model),
        vehicleType: text(reg.vehicle_type || master.vehicle_type),
        species: text(reg.species || master.species),
        wheelType: text(reg.wheel_type || master.wheel_type),
        bodyType: text(reg.body_type || master.body_type),
        manufactureYear: text(reg.manufacture_year ?? master.manufacture_year),
        modelYear: text(reg.model_year ?? master.model_year),
        pbtKg: text(reg.max_weight_kg ?? master.pbt_kg),
        tareKg: text(reg.tare_kg ?? master.tare_kg),
        lotacaoKg: text(reg.max_capacity_kg ?? master.lotacao_kg),
        pallets: text(reg.pallets ?? master.pallets),
        axles: text(reg.axles ?? master.axles),
        renavam: text(reg.renavam || master.renavam),
        chassis: text(reg.chassis || master.chassis),
        engineNumber: text(reg.engine_number || master.engine_number),
        plateCity: text(reg.plate_city || master.plate_city),
        plateUf: text(reg.plate_uf || master.plate_uf),
        color: text(reg.color || master.color),
        fuel: text(reg.fuel || master.fuel),
        rntrc: text(master.rntrc),
        bodyWidthM: text(master.body_width_m),
        bodyHeightM: text(master.body_height_m),
        bodyLengthM: text(master.body_length_m),
        tollTagNumber: text(master.toll_tag_number),
        tollTagCompany: text(master.toll_tag_company),
        tollTagOwned: master.toll_tag_owned === true ? "sim" : "nao",
        driverName: text(driver.name || master.driver_name),
        driverCpf: text(driver.cpf),
        driverCnh: text(driver.cnh),
        driverCategory: text(driver.cnh_category),
        driverPhone: text(driver.phone),
        hasTracker: tracking.has_tracker === true || master.has_tracker === true ? "sim" : "nao",
        trackerProvider: text(tracking.provider || master.tracker_provider),
        trackerId: text(tracking.identifier || master.tracker_identifier),
        trackerStatus: text(tracking.status || master.tracker_status),
        grfSticker: reg.grf_sticker === true || master.grf_sticker === true ? "sim" : "nao",
        hasMonitoringCamera: reg.has_monitoring_camera === true || master.has_monitoring_camera === true ? "sim" : "nao",
      });

      const existingDocs: Record<string, UploadedDoc> = {};
      for (const doc of (result.documents ?? []) as any[]) {
        const mimeType = text(doc.mime_type) || "application/octet-stream";
        existingDocs[text(doc.doc_type)] = {
          attachmentKey: text(doc.doc_type),
          fileName: text(doc.file_name),
          fileSize: Number(doc.file_size ?? 0),
          mimeType,
          storagePath: text(doc.storage_path),
          previewUrl: mimeType.startsWith("image/") ? text(doc.url) || null : null,
          status: "enviado",
        };
      }
      setDocs(existingDocs);
    } catch {
      setLoadError("Não foi possível carregar o cadastro para correção.");
    } finally {
      setLoading(false);
    }
  }

  function dropDoc(key: string) {
    setDocs((current) => {
      const next = { ...current };
      const preview = next[key]?.previewUrl;
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
      delete next[key];
      return next;
    });
  }

  async function handleFile(att: AttachmentType, file: File | undefined) {
    if (!file) return;
    const prep = await prepareFile(att.kind, file);
    if (!prep.ok) return void toast.error(prep.error);
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
      const uploaded = await uploadWithTicket({ path: ticket.path, token: ticket.token }, prepared.file);
      if (!uploaded.ok) throw new Error(uploaded.error);
      setDocs((current) => ({
        ...current,
        [att.key]: { ...current[att.key]!, storagePath: ticket.path, status: "enviado" },
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
    if (!declaration) e.declaration = "Confirme a declaração antes de reenviar.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return void toast.error("Revise os campos destacados antes de reenviar.");
    if (!registrationId || !accessToken) return;
    setSending(true);
    try {
      const result = await resubmit({
        data: {
          accessToken,
          registrationId,
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
            vehicleType: form.vehicleType || null,
            species: form.species || null,
            wheelType: form.wheelType || null,
            bodyType: form.bodyType || null,
            manufactureYear: num(form.manufactureYear),
            modelYear: num(form.modelYear),
            pbtKg: num(form.pbtKg)!,
            tareKg: num(form.tareKg)!,
            lotacaoKg: num(form.lotacaoKg)!,
            pallets: Math.trunc(num(form.pallets)!),
            axles: num(form.axles) == null ? null : Math.trunc(num(form.axles)!),
            renavam: form.renavam.trim(),
            chassis: form.chassis.trim().toUpperCase(),
            engineNumber: form.engineNumber.trim() || null,
            plateCity: form.plateCity.trim() || null,
            plateUf: form.plateUf || null,
            color: form.color.trim() || null,
            fuel: form.fuel || null,
            rntrc: form.rntrc.trim(),
            bodyWidthM: num(form.bodyWidthM)!,
            bodyHeightM: num(form.bodyHeightM)!,
            bodyLengthM: num(form.bodyLengthM)!,
            tollTagNumber: form.tollTagNumber.trim() || null,
            tollTagCompany: form.tollTagCompany.trim() || null,
            tollTagOwned: form.tollTagOwned === "sim",
            grfSticker: form.grfSticker === "sim",
            hasMonitoringCamera: form.hasMonitoringCamera === "sim",
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
            .filter((doc) => doc.status === "enviado" && doc.storagePath)
            .map((doc) => ({
              docType: doc.attachmentKey,
              fileName: doc.fileName,
              fileSize: doc.fileSize,
              mimeType: doc.mimeType,
              storagePath: doc.storagePath,
            })),
          declarationAccepted: declaration,
        },
      });
      if (!result.ok) return void toast.error(result.error);
      setProtocol(result.protocol);
    } catch {
      toast.error("Não foi possível reenviar as correções. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  if (protocol) {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <main className="mx-auto grid w-full max-w-xl flex-1 place-items-center px-4 py-12 text-center">
          <div>
            <CheckCircle2 className="mx-auto size-14 text-success" />
            <h1 className="mt-5 text-2xl font-bold">Correções reenviadas!</h1>
            <p className="mt-2 text-sm text-muted-foreground">O mesmo protocolo voltou para a fila de análise da GRF.</p>
            <div className="mt-6 rounded-xl border border-border bg-card p-6">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Protocolo</p>
              <p className="font-display mt-1 text-3xl font-extrabold">{protocol}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => { void navigator.clipboard.writeText(protocol); toast.success("Protocolo copiado."); }}>
                <Copy className="size-4" /> Copiar protocolo
              </Button>
            </div>
            <Button asChild className="mt-6 bg-blue-600 text-white hover:bg-blue-700"><Link to="/transportador">Voltar à minha frota</Link></Button>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-blue-500/30 bg-[#07101a] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-300 uppercase">Área do Transportador</p>
            <h1 className="font-display text-xl font-extrabold">Corrigir cadastro devolvido</h1>
          </div>
          <Button asChild variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link to="/transportador"><ArrowLeft className="size-4" /> Minha frota</Link></Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {loading && <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Carregando cadastro devolvido...</div>}

        {!loading && loadError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5">
            <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-5 text-destructive" /><div><p className="font-bold">Não foi possível abrir a correção</p><p className="mt-1 text-sm text-muted-foreground">{loadError}</p><Button asChild variant="outline" className="mt-4"><Link to="/transportador">Voltar à Área do Transportador</Link></Button></div></div>
          </div>
        )}

        {!loading && !loadError && (
          <div className="space-y-6">
            <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
              <div className="flex items-start gap-3">
                <RotateCcw className="mt-0.5 size-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-bold">Cadastro devolvido para correção — {prettyPlate(form.plate)}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Altere o que foi solicitado pela GRF e reenvie. O protocolo será mantido.</p>
                  {returnNote && <div className="mt-3 rounded-lg border border-amber-500/30 bg-background/70 p-3 text-sm"><strong>Motivo informado pela GRF:</strong> {returnNote}</div>}
                </div>
              </div>
            </section>

            <CompletionSections form={form} set={set} errors={errors} showApprovalFields />
            <CompletionAttachments docs={docs} errors={errors} onPick={(att, file) => void handleFile(att, file)} onRemove={dropDoc} />

            <section className={errors.declaration ? "rounded-xl border border-destructive/60 bg-destructive/5 p-5" : "rounded-xl border border-border bg-card p-5"}>
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox checked={declaration} onCheckedChange={(checked) => setDeclaration(checked === true)} className="mt-0.5" />
                <span className="text-sm leading-6">Declaro que conferi as correções e que as informações e documentos reenviados são verdadeiros.</span>
              </label>
              {errors.declaration && <p className="mt-2 text-xs font-medium text-destructive">{errors.declaration}</p>}
            </section>

            <div className="flex flex-wrap justify-between gap-3">
              <Button asChild variant="outline"><Link to="/transportador"><ArrowLeft className="size-4" /> Cancelar</Link></Button>
              <Button onClick={() => void handleSubmit()} disabled={sending} className="bg-blue-600 text-white hover:bg-blue-700">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                Reenviar correções para análise
              </Button>
            </div>
          </div>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
