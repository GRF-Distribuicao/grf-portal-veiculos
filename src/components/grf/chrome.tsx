import { Link } from "@tanstack/react-router";
import { LockKeyhole, Search, Truck } from "lucide-react";

export function GrfLogo({
  compact = false,
  inverted = false,
}: {
  compact?: boolean;
  inverted?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center">
      <span className={inverted ? "flex min-w-0 items-center justify-center bg-transparent" : "flex min-w-0 items-center justify-center"}>
        <img
          src="/grf-logo-exata.png.png"
          alt="GRF Distribuição Garrafaria"
          className={compact ? "h-10 w-auto object-contain" : "h-16 w-auto max-w-[260px] object-contain sm:h-[108px] sm:max-w-[310px] max-[640px]:h-[54px] max-[640px]:max-w-[170px]"}
          loading="eager"
          width={310}
          height={160}
        />
      </span>
      {!compact && (
        <span className="ml-7 hidden whitespace-nowrap font-display text-xl font-extrabold tracking-[0.08em] text-white uppercase sm:block lg:text-[28px]">
          Portal de veículos
        </span>
      )}
    </span>
  );
}

export function PublicHeader() {
  return (
    <header className="grf-topbar relative z-30 border-b-2 border-[#19a83a] bg-[#070d0c]">
      <div className="mx-auto flex min-h-[124px] max-w-[1536px] items-center justify-between gap-6 px-6 sm:px-10 lg:px-14 max-[640px]:min-h-0 max-[640px]:gap-2 max-[640px]:px-4 max-[640px]:py-3">
        <Link
          to="/"
          className="flex min-w-0 items-center max-[640px]:w-[88px] max-[640px]:shrink-0 max-[420px]:w-[72px]"
          aria-label="Portal GRF - início"
        >
          <GrfLogo inverted />
        </Link>

        <nav className="flex shrink-0 items-center gap-4 text-sm font-semibold sm:gap-6 sm:text-base lg:text-lg max-[640px]:ml-auto max-[640px]:grid max-[640px]:min-w-0 max-[640px]:flex-1 max-[640px]:grid-cols-3 max-[640px]:gap-1.5">
          <Link
            to="/consulta"
            className="flex items-center gap-3 border-r border-white/20 px-2 py-3 pr-6 text-white transition-colors hover:text-[#39d65a] max-[640px]:min-h-[44px] max-[640px]:min-w-0 max-[640px]:justify-center max-[640px]:gap-1 max-[640px]:rounded-lg max-[640px]:border max-[640px]:border-white/20 max-[640px]:px-1 max-[640px]:py-2 max-[640px]:text-center"
          >
            <Search className="size-6 shrink-0 sm:size-7 max-[640px]:size-[15px]" aria-hidden="true" />
            <span className="whitespace-nowrap max-[640px]:text-[9px] max-[420px]:text-[8px]">Consultar protocolo</span>
          </Link>

          <Link
            to="/transportador"
            className="flex items-center gap-3 rounded-lg bg-[#2563eb] px-5 py-3.5 text-white shadow-lg transition-colors hover:bg-[#1d4ed8] sm:px-6 sm:py-4 max-[640px]:min-h-[44px] max-[640px]:min-w-0 max-[640px]:justify-center max-[640px]:gap-1 max-[640px]:px-1 max-[640px]:py-2 max-[640px]:text-center"
          >
            <Truck className="size-6 shrink-0 max-[640px]:size-[15px]" aria-hidden="true" />
            <span className="whitespace-nowrap max-[640px]:text-[9px] max-[420px]:text-[8px]">Área Transportador</span>
          </Link>

          <Link
            to="/admin"
            className="flex items-center gap-3 rounded-lg bg-[#16a832] px-5 py-3.5 text-white shadow-lg transition-colors hover:bg-[#20bd3f] sm:px-6 sm:py-4 max-[640px]:min-h-[44px] max-[640px]:min-w-0 max-[640px]:justify-center max-[640px]:gap-1 max-[640px]:px-1 max-[640px]:py-2 max-[640px]:text-center"
          >
            <LockKeyhole className="size-6 shrink-0 max-[640px]:size-[15px]" aria-hidden="true" />
            <span className="whitespace-nowrap max-[640px]:text-[9px] max-[420px]:text-[8px]">Área GRF</span>
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
