import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const availabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const usageSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vehicleId: z.string().uuid(),
  used: z.boolean(),
});

type Vehicle = {
  id: string;
  plate: string;
  brand_model: string | null;
  vehicle_type: string | null;
  lotacao_kg: number | null;
  pallets: number | null;
  completion_status: string | null;
  sankhya_registered: boolean | null;
};

export const listRoutingAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => availabilitySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { assertGrfUser } = await import("@/lib/grf-auth.server");
    await assertGrfUser(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [companiesResult, linksResult, submissionsResult] = await Promise.all([
      db
        .from("transporter_companies")
        .select("id, name, cnpj")
        .eq("active", true)
        .order("name", { ascending: true }),
      db
        .from("transporter_vehicle_links")
        .select(
          "transporter_company_id, vehicle_id, vehicles(id, plate, brand_model, vehicle_type, lotacao_kg, pallets, completion_status, sankhya_registered)",
        )
        .eq("active", true),
      db
        .from("fleet_availability_submissions")
        .select("id, transporter_company_id, revision, submitted_at, note")
        .eq("availability_date", data.date)
        .eq("is_current", true),
    ]);

    if (companiesResult.error) throw companiesResult.error;
    if (linksResult.error) throw linksResult.error;
    if (submissionsResult.error) throw submissionsResult.error;

    const companies = (companiesResult.data ?? []) as Array<Record<string, any>>;
    const links = (linksResult.data ?? []) as Array<Record<string, any>>;
    const submissions = (submissionsResult.data ?? []) as Array<Record<string, any>>;

    const vehicleById = new Map<string, Vehicle>();
    const fleetByCompany = new Map<string, Vehicle[]>();

    for (const link of links) {
      const raw = Array.isArray(link.vehicles) ? link.vehicles[0] : link.vehicles;
      if (!raw) continue;
      const vehicle: Vehicle = {
        id: String(raw.id),
        plate: String(raw.plate),
        brand_model: raw.brand_model ?? null,
        vehicle_type: raw.vehicle_type ?? null,
        lotacao_kg: raw.lotacao_kg == null ? null : Number(raw.lotacao_kg),
        pallets: raw.pallets == null ? null : Number(raw.pallets),
        completion_status: raw.completion_status ?? null,
        sankhya_registered: raw.sankhya_registered ?? null,
      };
      vehicleById.set(vehicle.id, vehicle);
      const cid = String(link.transporter_company_id);
      const current = fleetByCompany.get(cid) ?? [];
      current.push(vehicle);
      fleetByCompany.set(cid, current);
    }

    // Quantos veículos de cada frota têm cadastro aprovado (os únicos que o
    // transportador consegue informar). Consulta separada e tolerante a falha:
    // se não vier, o card volta a mostrar só a frota vinculada.
    const approvedVehicleIds = await loadApprovedVehicleIds(db);

    const submissionByCompany = new Map<string, Record<string, any>>();
    for (const submission of submissions) {
      submissionByCompany.set(String(submission.transporter_company_id), submission);
    }

    const submissionIds = submissions.map((row) => String(row.id));
    const itemsBySubmission = new Map<string, Array<Record<string, any>>>();

    if (submissionIds.length) {
      const { data: items, error: itemsError } = await db
        .from("fleet_availability_items")
        .select("submission_id, vehicle_id, available, available_from, note, trailer_plate, trailer_pallets")
        .in("submission_id", submissionIds)
        .eq("available", true);
      if (itemsError) throw itemsError;

      for (const item of items ?? []) {
        const sid = String(item.submission_id);
        const current = itemsBySubmission.get(sid) ?? [];
        current.push(item);
        itemsBySubmission.set(sid, current);
      }
    }

    const companyRows = companies
      .map((company) => {
        const companyId = String(company.id);
        const fleet = (fleetByCompany.get(companyId) ?? []).sort((a, b) => a.plate.localeCompare(b.plate));
        const submission = submissionByCompany.get(companyId) ?? null;
        const items = submission ? itemsBySubmission.get(String(submission.id)) ?? [] : [];

        const availableVehicles = items
          .map((item) => {
            const vehicle = vehicleById.get(String(item.vehicle_id));
            if (!vehicle) return null;
            return {
              ...vehicle,
              available_from: item.available_from ?? null,
              availability_note: item.note ?? null,
              trailer_plate: item["trailer_plate"] ?? null,
              trailer_pallets: item["trailer_pallets"] == null ? null : Number(item["trailer_pallets"]),
            };
          })
          .filter(Boolean) as Array<
            Vehicle & {
              available_from: string | null;
              availability_note: string | null;
              trailer_plate: string | null;
              trailer_pallets: number | null;
            }
          >;

        const informed = availableVehicles.length > 0;
        const capacityKg = availableVehicles.reduce((sum, vehicle) => sum + (vehicle.lotacao_kg ?? 0), 0);
        const pallets = availableVehicles.reduce((sum, vehicle) => sum + (vehicle.pallets ?? 0), 0);

        return {
          id: companyId,
          name: String(company.name),
          cnpj: company.cnpj ?? null,
          fleetCount: fleet.length,
          approvedCount: approvedVehicleIds ? fleet.filter((vehicle) => approvedVehicleIds.has(vehicle.id)).length : null,
          informed,
          revision: informed && submission ? Number(submission.revision) : null,
          submittedAt: informed ? submission?.submitted_at ?? null : null,
          availableCount: availableVehicles.length,
          capacityKg,
          pallets,
          vehicles: availableVehicles,
        };
      })
      .filter((company) => company.fleetCount > 0 || company.informed);

    // Veículos já usados pela roteirização neste dia (migração 19). Tolerante
    // a falha: sem a tabela, a aba continua funcionando sem a marcação.
    const usage = await loadRoutingUsage(db, data.date);

    const allAvailableVehicles = companyRows.flatMap((company) =>
      company.vehicles.map((vehicle) => ({
        ...vehicle,
        transporterCompanyId: company.id,
        transporterName: company.name,
        submittedAt: company.submittedAt,
        revision: company.revision,
        usedAt: usage?.get(vehicle.id)?.marked_at ?? null,
      })),
    );

    // Marcado como usado, mas o transportador tirou da disponibilidade depois
    // (antes do corte). Aparece em "Usados" com aviso.
    const availableIds = new Set(allAvailableVehicles.map((vehicle) => vehicle.id));
    const withdrawnUsed = usage
      ? Array.from(usage.values())
          .filter((row) => !availableIds.has(row.vehicle_id))
          .map((row) => ({
            id: row.vehicle_id,
            plate: row.plate,
            brand_model: row.brand_model,
            usedAt: row.marked_at,
          }))
      : [];

    return {
      date: data.date,
      companies: companyRows,
      vehicles: allAvailableVehicles,
      usageEnabled: usage != null,
      withdrawnUsed,
      totals: {
        companies: companyRows.length,
        informedCompanies: companyRows.filter((company) => company.informed).length,
        availableVehicles: allAvailableVehicles.length,
        capacityKg: allAvailableVehicles.reduce((sum, vehicle) => sum + (vehicle.lotacao_kg ?? 0), 0),
        pallets: allAvailableVehicles.reduce((sum, vehicle) => sum + (vehicle.pallets ?? 0), 0),
      },
    };
  });

/**
 * Marca (ou desmarca) um veículo como usado pela roteirização no dia. Não
 * segue o horário de corte: a roteirização trabalha depois das 16:30.
 * Desmarcar devolve o veículo para a lista de disponíveis.
 */
export const setRoutingVehicleUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => usageSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { assertGrfUser } = await import("@/lib/grf-auth.server");
    await assertGrfUser(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    if (!data.used) {
      const { error } = await db
        .from("routing_vehicle_usage")
        .delete()
        .eq("availability_date", data.date)
        .eq("vehicle_id", data.vehicleId);
      if (error) throw error;
      return { ok: true };
    }

    // Só marca veículo que está na disponibilidade atual do dia.
    const { data: submissions, error: submissionsError } = await db
      .from("fleet_availability_submissions")
      .select("id")
      .eq("availability_date", data.date)
      .eq("is_current", true);
    if (submissionsError) throw submissionsError;

    const submissionIds = (submissions ?? []).map((row: { id: string }) => String(row.id));
    const { data: items, error: itemsError } = submissionIds.length
      ? await db
          .from("fleet_availability_items")
          .select("vehicle_id")
          .in("submission_id", submissionIds)
          .eq("vehicle_id", data.vehicleId)
          .eq("available", true)
          .limit(1)
      : { data: [], error: null };
    if (itemsError) throw itemsError;
    if (!items?.length) {
      throw new Error("Este veículo não está mais na disponibilidade do dia.");
    }

    const { error } = await db
      .from("routing_vehicle_usage")
      .upsert(
        { availability_date: data.date, vehicle_id: data.vehicleId, marked_by: context.userId },
        { onConflict: "availability_date,vehicle_id", ignoreDuplicates: true },
      );
    if (error) throw error;
    return { ok: true };
  });

type UsageRow = {
  vehicle_id: string;
  marked_at: string;
  plate: string;
  brand_model: string | null;
};

async function loadRoutingUsage(db: any, date: string): Promise<Map<string, UsageRow> | null> {
  const { data, error } = await db
    .from("routing_vehicle_usage")
    .select("vehicle_id, marked_at, vehicles(plate, brand_model)")
    .eq("availability_date", date);
  if (error) {
    console.error("[disponibilidade] falha ao ler veículos usados:", error.message);
    return null;
  }
  const rows = new Map<string, UsageRow>();
  for (const row of (data ?? []) as any[]) {
    const vehicle = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
    rows.set(String(row.vehicle_id), {
      vehicle_id: String(row.vehicle_id),
      marked_at: String(row.marked_at),
      plate: String(vehicle?.plate ?? ""),
      brand_model: vehicle?.brand_model ?? null,
    });
  }
  return rows;
}

const APPROVED_STATUSES = ["APROVADO", "PRONTO_INTEGRACAO"];
const PAGE_SIZE = 1000;

async function loadApprovedVehicleIds(db: any): Promise<Set<string> | null> {
  const ids = new Set<string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await db
      .from("vehicle_registrations")
      .select("vehicle_id")
      .in("status", APPROVED_STATUSES)
      .not("vehicle_id", "is", null)
      .order("vehicle_id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error("[disponibilidade] falha ao ler cadastros aprovados:", error.message);
      return null;
    }
    const page = (data ?? []) as Array<{ vehicle_id: string }>;
    for (const row of page) ids.add(String(row.vehicle_id));
    if (page.length < PAGE_SIZE) break;
  }
  return ids;
}
