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
            ? "flex items-center justify-center bg-transparent"
            : "flex items-center justify-center"
        }
      >
        <img
          src="/grf-logo-exata.png.png"
          alt="GRF Distribuição Garrafaria"
          className={compact ? "h-10 w-auto object-contain" : "h-16 w-auto max-w-[260px] object-contain sm:h-[108px] sm:max-w-[310px]"}
          loading="eager"
          width={310}
          height={160}
        />
      </span>
      {!compact && (
        <span className="ml-7 hidden font-display text-xl font-extrabold tracking-[0.08em] text-white uppercase sm:block lg:text-[28px]">
          Portal de veículos
        </span>
      )}
    </span>
  );
}

export function PublicHeader() {
  return (
    <header className="grf-topbar relative z-30 border-b-2 border-[#19a83a] bg-[#070d0c]">
      <div className="mx-auto flex min-h-[124px] max-w-[1536px] items-center justify-between gap-6 px-6 sm:px-10 lg:px-14">
        <Link to="/" className="flex min-w-0 items-center" aria-label="Portal GRF - início">
          <GrfLogo inverted />
        </Link>
        <nav className="flex shrink-0 items-center gap-4 text-sm font-semibold sm:gap-6 sm:text-base lg:text-lg">
          <Link
            to="/consulta"
            className="flex items-center gap-3 border-r border-white/20 px-2 py-3 pr-6 text-white transition-colors hover:text-[#39d65a]"
          >
            <Search className="size-6 sm:size-7" aria-hidden="true" />
            <span>Consultar protocolo</span>
          </Link>
          <Link
            to="/admin"
            className="flex items-center gap-3 rounded-lg bg-[#16a832] px-5 py-3.5 text-white shadow-lg transition-colors hover:bg-[#20bd3f] sm:px-6 sm:py-4"
          >
            <LockKeyhole className="size-6" aria-hidden="true" />
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
