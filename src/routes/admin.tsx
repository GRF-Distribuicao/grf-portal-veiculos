import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Plug, ArrowUpRight, LogOut, UsersRound, Database, CalendarCheck2, BarChart3 } from "lucide-react";
import { GrfLogo } from "@/components/grf/chrome";
import { supabase } from "@/integrations/supabase/client";

const ACCESS_APPROVERS = new Set([
  "roberta.souza@grfdistribuicao.com.br",
  "roteirizador.transporte@grfdistribuicao.com.br",
  "deivede.lima@grfdistribuicao.com.br",
]);

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });

    const { data: role } = await (supabase as any)
      .from("user_roles")
      .select("role, must_change_password")
      .eq("user_id", data.user.id)
      .in("role", ["admin", "analista"])
      .maybeSingle();

    if (!role) {
      await supabase.auth.signOut();
      throw redirect({ to: "/login" });
    }
    if (role.must_change_password) throw redirect({ to: "/alterar-senha" });

    return {
      grfUser: data.user,
      grfRole: role.role as "admin" | "analista",
      isAccessApprover: ACCESS_APPROVERS.has((data.user.email ?? "").toLowerCase()),
    };
  },
  head: () => ({
    meta: [
      { title: "Área GRF – Análise de cadastros" },
      {
        name: "description",
        content:
          "Painel interno da GRF para analisar, aprovar, devolver ou reprovar cadastros de veículos.",
      },
      { property: "og:title", content: "Área GRF – Análise de cadastros" },
      { property: "og:description", content: "Painel interno de análise de cadastros de veículos." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { grfUser, isAccessApprover } = Route.useRouteContext();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    void navigate({ to: "/login", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="grf-topbar">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-white px-2 py-1.5">
              <GrfLogo compact />
            </span>
            <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary-foreground uppercase">
              Área interna
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-1 text-sm font-medium">
            <Link
              to="/admin"
              activeOptions={{ exact: true }}
              activeProps={{ className: "bg-white/15" }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 hover:bg-white/10"
            >
              <LayoutDashboard className="size-4" /> Cadastros de veículos
            </Link>
            <Link
              to="/admin/veiculos"
              activeProps={{ className: "bg-white/15" }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 hover:bg-white/10"
            >
              <Database className="size-4" /> Base de veículos
            </Link>
            <Link
              to="/admin/disponibilidade"
              activeProps={{ className: "bg-white/15" }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 hover:bg-white/10"
            >
              <CalendarCheck2 className="size-4" /> Disponibilidade
            </Link>
            <Link
              to="/admin/ocupacao"
              activeProps={{ className: "bg-white/15" }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 hover:bg-white/10"
            >
              <BarChart3 className="size-4" /> Ocupação
            </Link>
            {isAccessApprover && (
              <Link
                to="/admin/acessos"
                activeProps={{ className: "bg-white/15" }}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 hover:bg-white/10"
              >
                <UsersRound className="size-4" /> Acessos
              </Link>
            )}
            <Link
              to="/admin/sankhya"
              activeProps={{ className: "bg-white/15" }}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 hover:bg-white/10"
            >
              <Plug className="size-4" /> Integração Sankhya
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-md border border-white/25 px-3 py-2 hover:bg-white/10"
            >
              Portal público <ArrowUpRight className="size-3.5" />
            </Link>
            <button
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 hover:bg-white/10"
              title={grfUser?.email ?? undefined}
            >
              <LogOut className="size-4" /> Sair
            </button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
