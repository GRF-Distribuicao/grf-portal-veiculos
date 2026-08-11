import { Link } from "@tanstack/react-router";

export function GrfLogo({
  compact = false,
  inverted = false,
}: {
  compact?: boolean;
  inverted?: boolean;
}) {
  return (
    <span className="flex items-center gap-3">
      <span
        className={
          inverted
            ? "grid place-items-center rounded-lg bg-white px-3 py-2 shadow-sm"
            : "grid place-items-center"
        }
      >
        <img
          src="/grf-logo.png"
          alt="GRF Distribuição"
          className={compact ? "h-8 w-auto" : "h-12 w-auto sm:h-14"}
          loading="eager"
          width={180}
          height={80}
        />
      </span>
      {!compact && (
        <span className="hidden leading-tight sm:block">
          <span className="font-display block text-base font-extrabold tracking-[0.12em] uppercase text-white">
            Portal de veículos
          </span>
        </span>
      )}
    </span>
  );
}

export function PublicHeader() {
  return (
    <header className="grf-topbar sticky top-0 z-30 border-b border-[#00c853]/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center">
          <GrfLogo inverted />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link
            to="/consulta"
            className="rounded-md px-4 py-2.5 font-semibold opacity-90 transition-colors hover:bg-white/10 hover:opacity-100"
          >
            Consultar protocolo
          </Link>
          <Link
            to="/admin"
            className="rounded-md bg-primary px-4 py-2.5 font-semibold text-primary-foreground transition-colors hover:opacity-90"
          >
            Área GRF
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
        Portal GRF – cadastro de veículos de transportadores e agregados. Integração com o Sankhya
        prevista para a próxima etapa.
      </div>
    </footer>
  );
}
