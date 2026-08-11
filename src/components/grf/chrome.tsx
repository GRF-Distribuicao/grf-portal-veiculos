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
            ? "grid place-items-center rounded-md bg-white px-2 py-1.5"
            : "grid place-items-center"
        }
      >
        {/* Troque public/grf-logo.png pela arte oficial em alta resolução. */}
        <img
          src="/grf-logo.png"
          alt="GRF Distribuição"
          className={compact ? "h-6 w-auto" : "h-8 w-auto"}
          loading="eager"
          width={64}
          height={64}
        />
      </span>
      {!compact && (
        <span className="hidden leading-tight sm:block">
          <span className="font-display block text-sm font-extrabold tracking-wide">
            GRF Distribuição
          </span>
          <span className="block text-[11px] font-semibold tracking-[0.18em] uppercase opacity-80">
            Portal de veículos
          </span>
        </span>
      )}
    </span>
  );
}

export function PublicHeader() {
  return (
    <header className="grf-topbar sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center">
          <GrfLogo inverted />
        </Link>
        <nav className="flex items-center gap-1 text-sm font-medium">
          <Link
            to="/consulta"
            className="rounded-md px-3 py-2 opacity-90 transition-colors hover:bg-white/10 hover:opacity-100"
          >
            Consultar
          </Link>
          <Link
            to="/admin"
            className="rounded-md bg-primary px-3 py-2 font-semibold text-primary-foreground transition-colors hover:opacity-90"
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
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground">
        Portal GRF – cadastro de veículos de transportadores e agregados. Integração com o Sankhya
        prevista para a próxima etapa.
      </div>
    </footer>
  );
}
