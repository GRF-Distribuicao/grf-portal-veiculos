import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, CalendarDays, CheckCircle2, Clock3, KeyRound, Loader2, Lock, LogIn, LogOut, Save, Truck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PublicFooter, PublicHeader } from "@/components/grf/chrome";
import { TransporterCorrectionsPanel } from "@/components/grf/transporter-corrections-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { transporterSupabase as supabase } from "@/integrations/supabase/transporter-client";
import { prettyPlate } from "@/lib/grf-domain";
import {
  canInformAvailability,
  isApprovalRequiredError,
  isVisibleInTransporterArea,
  normalizePortalStatus,
  type PortalStatus,
} from "@/lib/grf-fleet-eligibility";
import {
  AVAILABILITY_CUTOFF,
  NOTE_MAX_LENGTH,
  emptyDetail,
  findRepeatedTrailer,
  isCutoffError,
  isFriendlyAvailabilityError,
  isTransbordoVehicle,
  normalizePlate,
  palletOptions,
  validateAvailabilityDetail,
  type AvailabilityDetail,
} from "@/lib/grf-availability-rules";

export const Route = createFileRoute("/transportador")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Área do Transportador – Portal GRF" },
      {
        name: "description",
        content: "Área restrita das transportadoras para consulta da frota vinculada e informação de disponibilidade diária.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TransporterArea,
});

type VehicleRow = {
  id: string;
  plate: string;
  brand_model: string | null;
  vehicle_type: string | null;
  lotacao_kg: number | null;
  pallets: number | null;
  completion_status: string | null;
  sankhya_registered: boolean | null;
  portal_status: PortalStatus;
};

type HistoryRow = {
  id: string;
  availability_date: string;
  revision: number;
  submitted_at: string;
  is_current: boolean;
  count: number;
};

function localDateISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(value: string) {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

function TransporterArea() {
  const [loading, setLoading] = useState(true);
  const [loginBusy, setLoginBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [membershipRole, setMembershipRole] = useState("");
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [fleetStatusError, setFleetStatusError] = useState(false);
  const [details, setDetails] = useState<Record<string, AvailabilityDetail>>({});
  // Data e horário de corte vêm do banco (migração 17), não do relógio do
  // computador. Sem a função, a tela usa a data local e o banco segue travando.
  const [today, setToday] = useState(() => localDateISO());
  const [cutoff, setCutoff] = useState<{ cutoffAt: number; offsetMs: number } | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const closed = cutoff != null && nowMs + cutoff.offsetMs >= cutoff.cutoffAt;

  // O envio de hoje pode trazer um veículo que depois foi devolvido: ele não
  // entra na contagem nem é reenviado. O banco recusaria de qualquer forma.
  const approvedIds = useMemo(
    () => new Set(vehicles.filter((vehicle) => canInformAvailability(vehicle.portal_status)).map((vehicle) => vehicle.id)),
    [vehicles],
  );
  const selectedApproved = useMemo(
    () => Array.from(selected).filter((id) => approvedIds.has(id)),
    [selected, approvedIds],
  );
  const pendingCount = vehicles.length - approvedIds.size;

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    setLoading(true);
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id ?? null;
    setUserId(uid);
    if (uid) await loadArea(uid);
    setLoading(false);
  }

  async function loadArea(uid: string) {
    setAccessError(null);
    const db = supabase as any;

    // A Área GRF e a Área do Transportador usam sessões separadas. Além disso,
    // um usuário com papel interno GRF nunca é aceito como transportador.
    const { data: grfRole } = await db
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .maybeSingle();

    if (grfRole) {
      await supabase.auth.signOut();
      setUserId(null);
      setCompanyId(null);
      setCompanyName("");
      setVehicles([]);
      setSelected(new Set());
      setHistory([]);
      setAccessError("Este usuário pertence à Área GRF. Entre aqui somente com um acesso de transportadora.");
      return;
    }

    const { data: membership, error: membershipError } = await db
      .from("transporter_memberships")
      .select("transporter_company_id, role")
      .eq("user_id", uid)
      .eq("active", true)
      .maybeSingle();

    if (membershipError || !membership) {
      const { data: request } = await db
        .from("transporter_access_requests")
        .select("status, company_name, requested_at")
        .eq("user_id", uid)
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setCompanyId(null);
      setCompanyName("");
      setVehicles([]);
      setSelected(new Set());
      setHistory([]);

      if (request?.status === "PENDING") {
        setAccessError(`Sua solicitação para ${request.company_name} está aguardando aprovação da GRF.`);
      } else if (request?.status === "REJECTED") {
        setAccessError("Sua solicitação de acesso não foi aprovada. Faça uma nova solicitação com os dados corretos da empresa.");
      } else {
        setAccessError("Seu usuário está autenticado, mas ainda não foi vinculado a uma transportadora pela GRF.");
      }
      return;
    }

    const cid = String(membership.transporter_company_id);
    setCompanyId(cid);
    setMembershipRole(String(membership.role ?? ""));

    const [
      { data: company },
      { data: links, error: linksError },
      { data: fleetStatus, error: fleetStatusFailure },
      { data: windowRows, error: windowError },
    ] = await Promise.all([
      db.from("transporter_companies").select("name").eq("id", cid).single(),
      db
        .from("transporter_vehicle_links")
        .select(
          "vehicle_id, vehicles(id, plate, brand_model, vehicle_type, lotacao_kg, pallets, completion_status, sankhya_registered)",
        )
        .eq("transporter_company_id", cid)
        .eq("active", true),
      // Situação do cadastro de cada veículo (migração 16). Sem ela a tela não
      // sabe o que é aprovado, então não oferece nenhum veículo.
      db.rpc("transporter_fleet_status"),
      db.rpc("fleet_availability_window"),
    ]);

    setCompanyName(String(company?.name ?? "Transportadora"));

    const windowRow = !windowError ? (Array.isArray(windowRows) ? windowRows[0] : windowRows) : null;
    const day = windowRow?.today ? String(windowRow.today) : localDateISO();
    setToday(day);
    setNowMs(Date.now());
    setCutoff(
      windowRow?.cutoff_at && windowRow?.server_now
        ? {
            cutoffAt: new Date(windowRow.cutoff_at).getTime(),
            offsetMs: new Date(windowRow.server_now).getTime() - Date.now(),
          }
        : null,
    );

    if (linksError) {
      setVehicles([]);
      setAccessError("Não foi possível carregar os veículos vinculados à sua transportadora.");
      return;
    }

    if (fleetStatusFailure) {
      setVehicles([]);
      setFleetStatusError(true);
      await loadAvailability(cid, day);
      return;
    }
    setFleetStatusError(false);

    const statusByVehicle = new Map<string, PortalStatus>();
    for (const row of (fleetStatus ?? []) as Array<{ vehicle_id: string; portal_status: string }>) {
      statusByVehicle.set(String(row.vehicle_id), normalizePortalStatus(row.portal_status));
    }

    // Só entram aprovados (podem ser informados) e devolvidos (pendência de
    // correção). Em análise, reprovado e Sankhya sem complemento não aparecem.
    const rows: VehicleRow[] = (links ?? [])
      .map((link: any) => (Array.isArray(link.vehicles) ? link.vehicles[0] : link.vehicles))
      .filter(Boolean)
      .map((vehicle: any) => ({
        id: String(vehicle.id),
        plate: String(vehicle.plate),
        brand_model: vehicle.brand_model ?? null,
        vehicle_type: vehicle.vehicle_type ?? null,
        lotacao_kg: vehicle.lotacao_kg == null ? null : Number(vehicle.lotacao_kg),
        pallets: vehicle.pallets == null ? null : Number(vehicle.pallets),
        completion_status: vehicle.completion_status ?? null,
        sankhya_registered: vehicle.sankhya_registered ?? null,
        portal_status: statusByVehicle.get(String(vehicle.id)) ?? "PENDENTE",
      }))
      .filter((vehicle: VehicleRow) => isVisibleInTransporterArea(vehicle.portal_status))
      .sort((a: VehicleRow, b: VehicleRow) => {
        const rank = (row: VehicleRow) => (canInformAvailability(row.portal_status) ? 0 : 1);
        return rank(a) - rank(b) || a.plate.localeCompare(b.plate);
      });

    setVehicles(rows);
    await loadAvailability(cid, day);
  }

  async function loadAvailability(cid: string, day: string) {
    const db = supabase as any;
    const { data: current } = await db
      .from("fleet_availability_submissions")
      .select("id")
      .eq("transporter_company_id", cid)
      .eq("availability_date", day)
      .eq("is_current", true)
      .maybeSingle();

    if (current?.id) {
      const itemsQuery = (columns: string) =>
        db.from("fleet_availability_items").select(columns).eq("submission_id", current.id).eq("available", true);
      // Se as colunas novas (migração 18) ainda não existirem, carrega só a seleção.
      const full = await itemsQuery("vehicle_id, note, trailer_plate, trailer_pallets");
      const { data: items } = full.error ? await itemsQuery("vehicle_id") : full;
      setSelected(new Set((items ?? []).map((item: any) => String(item.vehicle_id))));
      const loaded: Record<string, AvailabilityDetail> = {};
      for (const item of items ?? []) {
        loaded[String(item.vehicle_id)] = {
          note: item.note ?? "",
          trailer_plate: item.trailer_plate ?? "",
          trailer_pallets: item.trailer_pallets == null ? null : Number(item.trailer_pallets),
        };
      }
      setDetails(loaded);
    } else {
      setSelected(new Set());
      setDetails({});
    }

    const { data: submissions } = await db
      .from("fleet_availability_submissions")
      .select("id, availability_date, revision, submitted_at, is_current")
      .eq("transporter_company_id", cid)
      .order("availability_date", { ascending: false })
      .order("revision", { ascending: false })
      .limit(20);

    const ids = (submissions ?? []).map((row: any) => String(row.id));
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: items } = await db
        .from("fleet_availability_items")
        .select("submission_id, available")
        .in("submission_id", ids);
      for (const item of items ?? []) {
        if (!item.available) continue;
        const key = String(item.submission_id);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    setHistory(
      (submissions ?? []).map((row: any) => ({
        id: String(row.id),
        availability_date: String(row.availability_date),
        revision: Number(row.revision),
        submitted_at: String(row.submitted_at),
        is_current: Boolean(row.is_current),
        count: counts.get(String(row.id)) ?? 0,
      })),
    );
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginBusy(true);
    setAccessError(null);
    setResetMessage(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) {
      setLoginBusy(false);
      setAccessError("Usuário ou senha inválidos.");
      return;
    }
    setUserId(data.user.id);
    await loadArea(data.user.id);
    setLoginBusy(false);
  }

  async function handleForgotPassword() {
    setAccessError(null);
    setResetMessage(null);
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setAccessError("Informe seu e-mail acima para receber o link de recuperação.");
      return;
    }

    setResetBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/transportador/redefinir-senha`,
    });
    setResetBusy(false);

    if (error) {
      setAccessError("Não foi possível enviar o link de recuperação agora. Tente novamente em alguns minutos.");
      return;
    }

    setResetMessage(
      "Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha sem precisar falar com a GRF.",
    );
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUserId(null);
    setCompanyId(null);
    setCompanyName("");
    setVehicles([]);
    setFleetStatusError(false);
    setSelected(new Set());
    setDetails({});
    setHistory([]);
    setPassword("");
    setAccessError(null);
    setResetMessage(null);
  }

  function toggleVehicle(id: string) {
    if (!approvedIds.has(id) || closed) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateDetail(id: string, patch: Partial<AvailabilityDetail>) {
    if (closed) return;
    setDetails((current) => ({ ...current, [id]: { ...(current[id] ?? emptyDetail()), ...patch } }));
  }

  async function saveAvailability() {
    if (!companyId || !userId) return;
    if (closed) {
      toast.error(`Disponibilidade de ${formatDate(today)} encerrada às ${AVAILABILITY_CUTOFF}. Não é possível alterar.`);
      return;
    }

    const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
    const items = selectedApproved.map((id) => {
      const vehicle = vehicleById.get(id);
      const detail = details[id] ?? emptyDetail();
      const transbordo = vehicle ? isTransbordoVehicle(vehicle) : false;
      return {
        vehicle,
        detail,
        payload: {
          vehicle_id: id,
          note: detail.note.trim() || null,
          trailer_plate: transbordo ? normalizePlate(detail.trailer_plate) || null : null,
          trailer_pallets: transbordo ? detail.trailer_pallets : null,
        },
      };
    });

    for (const item of items) {
      const problem = item.vehicle ? validateAvailabilityDetail(item.vehicle, item.detail) : null;
      if (problem) {
        toast.error(problem);
        return;
      }
    }
    const repeated = findRepeatedTrailer(items.map((item) => item.payload.trailer_plate ?? ""));
    if (repeated) {
      toast.error(`A carreta ${repeated} foi informada em mais de um cavalo.`);
      return;
    }

    setSaving(true);
    const { data, error } = await (supabase as any).rpc("submit_fleet_availability_items", {
      p_availability_date: today,
      p_items: items.map((item) => item.payload),
    });
    setSaving(false);

    if (error) {
      toast.error(
        isFriendlyAvailabilityError(error.message)
          ? error.message
          : "Não foi possível gravar a disponibilidade.",
      );
      if ((isApprovalRequiredError(error.message) || isCutoffError(error.message)) && userId) await loadArea(userId);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    toast.success(
      `Disponibilidade confirmada: ${result?.available_count ?? selectedApproved.length} veículo(s).`,
    );
    await loadAvailability(companyId, today);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="grid flex-1 place-items-center p-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> Carregando Área do Transportador...</span>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <PublicHeader />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-blue-500/10 text-blue-600">
                <Building2 className="size-5" />
              </span>
              <div>
                <h1 className="font-display text-xl font-extrabold">Área do Transportador</h1>
                <p className="text-xs text-muted-foreground">Acesso restrito à frota vinculada à sua empresa.</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleForgotPassword()}
                  disabled={resetBusy}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50"
                >
                  {resetBusy ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
                  Esqueci minha senha
                </button>
              </div>
              {accessError && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{accessError}</p>}
              {resetMessage && <p className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-800">{resetMessage}</p>}
              <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700" disabled={loginBusy}>
                {loginBusy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
                Entrar
              </Button>
            </form>

            <div className="mt-5 border-t border-border pt-5">
              <Button asChild variant="outline" className="w-full border-blue-500/30 text-blue-700 hover:bg-blue-500/5 hover:text-blue-800">
                <Link to="/transportador/solicitar-acesso">
                  <UserPlus className="size-4" /> Solicitar acesso
                </Link>
              </Button>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                O acesso é aprovado pela GRF e vinculado a uma única transportadora. Esse vínculo determina quais veículos podem ser visualizados.
              </p>
            </div>
          </div>
          <Link to="/" className="mt-6 text-center text-sm text-muted-foreground hover:text-foreground">Voltar ao portal</Link>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex min-h-screen flex-col bg-surface">
        <PublicHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-14">
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-6">
            <h1 className="text-xl font-bold">Acesso ainda não liberado</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{accessError}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void signOut()}><LogOut className="size-4" /> Sair</Button>
              <Button asChild className="bg-blue-600 text-white hover:bg-blue-700">
                <Link to="/transportador/solicitar-acesso"><UserPlus className="size-4" /> Nova solicitação</Link>
              </Button>
            </div>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="border-b border-blue-500/30 bg-[#07101a] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-blue-300 uppercase">Área do Transportador</p>
            <h1 className="font-display text-xl font-extrabold">{companyName}</h1>
            {membershipRole && <p className="mt-0.5 text-xs text-white/55">Perfil: {membershipRole}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link to="/">Portal público</Link></Button>
            <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={() => void signOut()}><LogOut className="size-4" /> Sair</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
        <TransporterCorrectionsPanel />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><CalendarDays className="size-4" /> Disponibilidade de {formatDate(today)}</div>
            <h2 className="mt-1 font-display text-2xl font-extrabold">Minha frota</h2>
            <p className="mt-1 text-sm text-muted-foreground">Marque os veículos que a GRF poderá considerar na roteirização de hoje.</p>
            {!closed && (
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                <Clock3 className="mr-1 inline size-3.5" />
                Você pode informar e alterar até {AVAILABILITY_CUTOFF} de hoje (horário de Brasília).
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-right">
            <p className="text-xs font-semibold text-muted-foreground">Disponíveis selecionados</p>
            <p className="font-display text-2xl font-extrabold text-blue-600">{selectedApproved.length}</p>
            {pendingCount > 0 && (
              <p className="mt-1 text-xs font-semibold text-warning-foreground">{pendingCount} pendente(s) de correção</p>
            )}
          </div>
        </div>

        {closed && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <p>
              <strong>Disponibilidade de {formatDate(today)} encerrada às {AVAILABILITY_CUTOFF}.</strong> Depois do horário de corte
              não é possível alterar. O que está marcado abaixo é o que a roteirização recebeu.
            </p>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-border bg-surface/60 p-4 text-sm leading-6 text-muted-foreground">
          <p>
            <strong className="text-foreground">Só aparecem aqui os veículos com cadastro aprovado pela GRF</strong>, e só eles podem ser
            informados para a roteirização. Veículo devolvido fica como pendência até a correção ser aprovada. Cadastro enviado
            e ainda em análise aparece depois da aprovação.
          </p>
          <p className="mt-2">
            Está faltando algum veículo da sua frota? Finalize o cadastro dele em{" "}
            <a href="/iniciar-cadastro" className="font-semibold text-primary underline-offset-2 hover:underline">Iniciar cadastro</a>.
          </p>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {fleetStatusError ? (
            <p className="p-6 text-sm text-destructive">
              Não foi possível verificar a situação dos cadastros da sua frota. Atualize a página; se continuar, fale com a GRF.
            </p>
          ) : vehicles.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Nenhum veículo com cadastro aprovado. Finalize o cadastro dos veículos da sua frota em{" "}
              <a href="/iniciar-cadastro" className="font-semibold text-primary underline-offset-2 hover:underline">Iniciar cadastro</a>{" "}
              para poder informá-los à roteirização.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {vehicles.map((vehicle) => {
                if (!canInformAvailability(vehicle.portal_status)) {
                  return (
                    <li key={vehicle.id} className="flex flex-wrap items-center justify-between gap-4 bg-warning/10 p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-10 place-items-center rounded-lg border border-warning/40 bg-card text-warning-foreground">
                          <AlertTriangle className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-display font-bold tracking-wide">{prettyPlate(vehicle.plate)}</p>
                          <p className="truncate text-sm text-muted-foreground">{vehicle.brand_model || vehicle.vehicle_type || "Modelo não informado"}</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-warning/40 bg-card px-3 py-1 text-xs font-bold text-warning-foreground">
                        Devolvido · corrija em Correções pendentes
                      </span>
                    </li>
                  );
                }
                const active = selected.has(vehicle.id);
                const transbordo = isTransbordoVehicle(vehicle);
                const detail = details[vehicle.id] ?? emptyDetail();
                const pallets = palletOptions(vehicle.pallets);
                return (
                  <li key={vehicle.id}>
                    <button type="button" onClick={() => toggleVehicle(vehicle.id)} disabled={closed} className="flex w-full flex-wrap items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:hover:bg-transparent">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={active ? "grid size-10 place-items-center rounded-lg bg-blue-600 text-white" : "grid size-10 place-items-center rounded-lg bg-surface text-muted-foreground"}>
                          {active ? <CheckCircle2 className="size-5" /> : <Truck className="size-5" />}
                        </span>
                        <div className="min-w-0">
                          <p className="font-display font-bold tracking-wide">{prettyPlate(vehicle.plate)}</p>
                          <p className="truncate text-sm text-muted-foreground">{vehicle.brand_model || vehicle.vehicle_type || "Modelo não informado"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>Lotação: <strong className="text-foreground">{vehicle.lotacao_kg == null ? "—" : `${vehicle.lotacao_kg.toLocaleString("pt-BR")} kg`}</strong></span>
                        <span>Pallets: <strong className="text-foreground">{vehicle.pallets ?? "—"}</strong></span>
                        {transbordo && <span className="rounded-full border border-blue-500/30 px-3 py-1 font-bold text-blue-700">Transbordo</span>}
                        <span className={active ? "rounded-full bg-blue-600 px-3 py-1 font-bold text-white" : "rounded-full bg-surface px-3 py-1 font-semibold"}>{active ? "Disponível" : "Não selecionado"}</span>
                      </div>
                    </button>
                    {active && (
                      <div className="grid gap-3 border-t border-dashed border-border bg-surface/40 px-4 py-3 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]">
                        {transbordo && (
                          <>
                            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                              <span>Placa da carreta *</span>
                              <Input
                                value={detail.trailer_plate}
                                onChange={(event) => updateDetail(vehicle.id, { trailer_plate: event.target.value.toUpperCase() })}
                                placeholder="ABC1D23"
                                maxLength={8}
                                disabled={closed}
                                className="bg-card font-display tracking-wide uppercase"
                              />
                            </label>
                            <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                              <span>Pallets na carreta *</span>
                              <select
                                value={detail.trailer_pallets ?? ""}
                                onChange={(event) =>
                                  updateDetail(vehicle.id, { trailer_pallets: event.target.value ? Number(event.target.value) : null })
                                }
                                disabled={closed || pallets.length === 0}
                                className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <option value="">{pallets.length ? "Selecione" : "Sem pallets no cadastro"}</option>
                                {pallets.map((value) => (
                                  <option key={value} value={value}>{value} pallets</option>
                                ))}
                              </select>
                            </label>
                          </>
                        )}
                        <label className="space-y-1 text-xs font-semibold text-muted-foreground">
                          <span>Obs (opcional)</span>
                          <Input
                            value={detail.note}
                            onChange={(event) => updateDetail(vehicle.id, { note: event.target.value })}
                            placeholder="Ex.: disponível a partir das 19h"
                            maxLength={NOTE_MAX_LENGTH}
                            disabled={closed}
                            className="bg-card"
                          />
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={() => void saveAvailability()} disabled={saving || fleetStatusError || closed} className="bg-blue-600 text-white hover:bg-blue-700">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Confirmar disponibilidade do dia
          </Button>
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-bold">Histórico informado</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cada confirmação fica registrada. Se houver uma nova confirmação para o mesmo dia, a revisão anterior continua preservada.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
            {history.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Ainda não há disponibilidade registrada.</p>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-semibold">{formatDate(row.availability_date)}</p>
                      <p className="text-xs text-muted-foreground">Revisão {row.revision} · {new Date(row.submitted_at).toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {row.is_current && <span className="rounded-full bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-700 uppercase">Atual</span>}
                      <span className="font-display text-lg font-extrabold">{row.count} veículo(s)</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
