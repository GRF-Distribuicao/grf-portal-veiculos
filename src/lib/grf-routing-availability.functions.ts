import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const availabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

    const submissionByCompany = new Map<string, Record<string, any>>();
    for (const submission of submissions) {
      submissionByCompany.set(String(submission.transporter_company_id), submission);
    }

    const submissionIds = submissions.map((row) => String(row.id));
    const itemsBySubmission = new Map<string, Array<Record<string, any>>>();

    if (submissionIds.length) {
      const { data: items, error: itemsError } = await db
        .from("fleet_availability_items")
        .select("submission_id, vehicle_id, available, available_from, note")
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
            };
          })
          .filter(Boolean) as Array<Vehicle & { available_from: string | null; availability_note: string | null }>;

        const informed = availableVehicles.length > 0;
        const capacityKg = availableVehicles.reduce((sum, vehicle) => sum + (vehicle.lotacao_kg ?? 0), 0);
        const pallets = availableVehicles.reduce((sum, vehicle) => sum + (vehicle.pallets ?? 0), 0);

        return {
          id: companyId,
          name: String(company.name),
          cnpj: company.cnpj ?? null,
          fleetCount: fleet.length,
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

    const allAvailableVehicles = companyRows.flatMap((company) =>
      company.vehicles.map((vehicle) => ({
        ...vehicle,
        transporterCompanyId: company.id,
        transporterName: company.name,
        submittedAt: company.submittedAt,
        revision: company.revision,
      })),
    );

    return {
      date: data.date,
      companies: companyRows,
      vehicles: allAvailableVehicles,
      totals: {
        companies: companyRows.length,
        informedCompanies: companyRows.filter((company) => company.informed).length,
        availableVehicles: allAvailableVehicles.length,
        capacityKg: allAvailableVehicles.reduce((sum, vehicle) => sum + (vehicle.lotacao_kg ?? 0), 0),
        pallets: allAvailableVehicles.reduce((sum, vehicle) => sum + (vehicle.pallets ?? 0), 0),
      },
    };
  });
