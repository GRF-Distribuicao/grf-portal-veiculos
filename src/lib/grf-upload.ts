/**
 * Upload de anexos do Portal GRF (executa no navegador).
 *
 * Fluxo: o servidor emite uma URL assinada (service role) e o navegador envia o
 * arquivo direto para o Storage do Supabase. Isso evita depender de política RLS
 * no bucket e não passa o arquivo pela função serverless (que tem limite de
 * corpo de requisição bem menor que 10 MB).
 */
import { supabase } from "@/integrations/supabase/client";
import { STORAGE_BUCKET } from "@/integrations/supabase/env";
import { acceptedMimeFor, MAX_FILE_MB, type AttachmentKind } from "@/lib/grf-domain";

/** Lado maior da foto após o redimensionamento. */
const MAX_IMAGE_EDGE = 1920;
const JPEG_QUALITY = 0.82;

export type UploadTicket = { path: string; token: string };

export type PreparedFile = {
  file: File;
  fileName: string;
  fileSize: number;
  mimeType: string;
  /** ObjectURL para pré-visualização (apenas imagens). */
  previewUrl: string | null;
};

const isImage = (type: string) => type.startsWith("image/");

/**
 * Converte a imagem para JPEG e reduz a resolução.
 *
 * Resolve dois problemas reais de celular:
 *  - iPhone entrega HEIC/HEIF, que o bucket rejeita;
 *  - fotos de 12 MP passam de 10 MB e estouram o limite do bucket.
 *
 * Se o navegador não conseguir decodificar, devolve o arquivo original e a
 * validação de MIME/tamanho cuida do resto.
 */
async function normalizeImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Valida e (para fotos) normaliza o arquivo escolhido pelo usuário. */
export async function prepareFile(
  kind: AttachmentKind,
  original: File,
): Promise<{ ok: true; prepared: PreparedFile } | { ok: false; error: string }> {
  const accepted = acceptedMimeFor(kind);

  let file = original;
  if (isImage(original.type) || original.type === "" || kind === "photo") {
    file = await normalizeImage(original);
  }

  if (!accepted.includes(file.type)) {
    return {
      ok: false,
      error:
        kind === "photo"
          ? "Formato de imagem não suportado. Tire a foto novamente ou envie um JPG/PNG."
          : "Formato não permitido. Envie PDF, JPG ou PNG.",
    };
  }

  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return { ok: false, error: `Arquivo maior que ${MAX_FILE_MB} MB.` };
  }

  if (file.size === 0) {
    return { ok: false, error: "O arquivo selecionado está vazio." };
  }

  return {
    ok: true,
    prepared: {
      file,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      previewUrl: isImage(file.type) ? URL.createObjectURL(file) : null,
    },
  };
}

/** Envia o arquivo usando a URL assinada emitida pelo servidor. */
export async function uploadWithTicket(
  ticket: UploadTicket,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type });

  if (error) {
    console.error("[GRF] falha no upload", error);
    return { ok: false, error: error.message || "Falha ao enviar o arquivo." };
  }
  return { ok: true };
}
