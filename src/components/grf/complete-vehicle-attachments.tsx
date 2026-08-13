import { AlertCircle, Camera, FileText, FileUp, ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DOC_TYPES, MAX_FILE_MB, PHOTO_TYPES, acceptAttrFor, formatBytes } from "@/lib/grf-domain";
import type { AttachmentType } from "@/lib/grf-domain";
import { Section } from "@/components/grf/complete-vehicle-fields";

export type UploadedDoc = {
  attachmentKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  previewUrl: string | null;
  status: "enviando" | "enviado" | "erro";
  error?: string;
};

export function CompletionAttachments({
  docs,
  errors,
  onPick,
  onRemove,
}: {
  docs: Record<string, UploadedDoc>;
  errors: Record<string, string>;
  onPick: (att: AttachmentType, file: File | undefined) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <Section title="Documentos e fotos">
      <p className="mb-4 text-xs leading-5 text-muted-foreground">
        PDF, JPG ou PNG — até {MAX_FILE_MB} MB por arquivo. Os documentos ficam privados e serão analisados pela GRF.
      </p>
      <div className="space-y-3">
        {DOC_TYPES.map((att) => (
          <AttachmentCard key={att.key} att={att} up={docs[att.key]} error={errors[att.key]} onPick={(file) => onPick(att, file)} onRemove={() => onRemove(att.key)} />
        ))}
      </div>
      <div className="mt-6 rounded-md border border-primary/30 bg-primary/5 p-3">
        <p className="flex items-center gap-2 text-sm font-bold"><Camera className="size-4" /> Fotos do veículo</p>
        <p className="mt-1 text-xs text-muted-foreground">As fotos são usadas para validar placa, veículo e carroceria.</p>
      </div>
      <div className="mt-3 space-y-3">
        {PHOTO_TYPES.map((att) => (
          <AttachmentCard key={att.key} att={att} up={docs[att.key]} error={errors[att.key]} onPick={(file) => onPick(att, file)} onRemove={() => onRemove(att.key)} />
        ))}
      </div>
    </Section>
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
            {up?.previewUrl ? <img src={up.previewUrl} alt={att.label} className="size-full object-cover" /> : isPhoto ? <ImageIcon className="size-5 text-muted-foreground" /> : <FileText className="size-5 text-muted-foreground" />}
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
          {isPhoto && <Button asChild variant="outline" size="sm" disabled={sending}><label className="cursor-pointer"><Camera className="size-4" /> {up ? "Refazer" : "Tirar foto"}<input type="file" className="hidden" accept={accept} capture="environment" disabled={sending} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} /></label></Button>}
          <Button asChild variant={isPhoto ? "ghost" : "outline"} size="sm" disabled={sending}><label className="cursor-pointer"><FileUp className="size-4" /> {isPhoto ? "Galeria" : up ? "Trocar" : "Anexar"}<input type="file" className="hidden" accept={accept} disabled={sending} onChange={(e) => { onPick(e.target.files?.[0]); e.target.value = ""; }} /></label></Button>
        </div>
      </div>
      {error && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive"><AlertCircle className="size-3.5" /> {error}</p>}
    </div>
  );
}
