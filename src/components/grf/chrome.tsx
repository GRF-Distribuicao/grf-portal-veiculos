import { Link } from "@tanstack/react-router";
import { LockKeyhole, Search } from "lucide-react";

export function GrfLogo({
  compact = false,
  inverted = false,
}: {
  compact?: boolean;
  inverted?: boolean;
}) {
  return (
    <span className="flex items-center">
      <span
        className={
          inverted
            ? "grid place-items-center rounded-xl bg-white/95 px-3 py-2 shadow-sm"
            : "grid place-items-center"
        }
      >
        <img
          src="/grf-logo.png"
          alt="GRF Distribuição"
          className={compact ? "h-9 w-auto" : "h-12 w-auto sm:h-[74px]"}
          loading="eager"
          width={220}
          height={96}
        />
      </span>
      {!compact && (
        <span className="ml-5 hidden font-display text-xl font-extrabold tracking-[0.08em] text-white uppercase sm:block lg:text-[28px]">
          Portal de veículos
        </span>
      )}
    </span>
  );
}

export function PublicHeader() {
  return (
    <header className="grf-topbar relative z-30 border-b-2 border-[#19a83a] bg-[#070d0c]">
      <div className="mx-auto flex min-h-[92px] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-14">
        <Link to="/" className="flex items-center" aria-label="Portal GRF - início">
          <GrfLogo inverted />
        </Link>
        <nav className="flex items-center gap-3 text-sm font-semibold sm:gap-5 sm:text-base">
          <Link
            to="/consulta"
            className="flex items-center gap-2 border-r border-white/20 px-2 py-2.5 pr-5 text-white transition-colors hover:text-[#39d65a]"
          >
            <Search className="size-5 sm:size-6" aria-hidden="true" />
            <span>Consultar protocolo</span>
          </Link>
          <Link
            to="/admin"
            className="flex items-center gap-2 rounded-lg bg-[#16a832] px-4 py-2.5 text-white shadow-lg transition-colors hover:bg-[#20bd3f] sm:px-5 sm:py-3"
          >
            <LockKeyhole className="size-5" aria-hidden="true" />
            <span>Área GRF</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#070d0c] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-white/55 sm:px-6">
        Portal GRF – cadastro de veículos de transportadores e agregados. Integração com o Sankhya
        prevista para a próxima etapa.
      </div>
    </footer>
  );
}
