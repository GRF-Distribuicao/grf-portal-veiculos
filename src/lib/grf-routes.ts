/**
 * Rotas que cada veículo conhece (migração 21), como a aba Disponibilidade
 * mostra. O banco guarda o nome completo; a tela abrevia. Nome sem abreviação
 * cadastrada aparece por extenso.
 */

const SHORT: Record<string, string> = {
  "São João de Meriti": "S.J. Meriti",
  "Belford Roxo": "B. Roxo",
  "Nova Iguaçu": "N. Iguaçu",
  "Santa Cruz": "Sta. Cruz",
  "Ilha do Governador": "Ilha Gov.",
  "São Cristóvão": "S. Cristóvão",
  "Duque de Caxias": "Caxias",
  "Zona Norte": "Z. Norte",
  "Zona Oeste": "Z. Oeste",
  "Zona Sul": "Z. Sul",
  "São Gonçalo": "S. Gonçalo",
  "Jacarepaguá": "Jacarep.",
  "Barra da Tijuca": "Barra",
  "Campo Grande": "C. Grande",
};

/** Rótulo de "carrega em todas as rotas". */
export const ALL_ROUTES_LABEL = "Todas";

export function shortRoute(route: string): string {
  return SHORT[route] ?? route;
}

export type VehicleRoutes = { allRoutes: boolean; routes: string[] };

/**
 * O que cabe na linha: até `max` rótulos ("Todas" primeiro) e quantos ficaram
 * de fora (+N). `full` é a lista completa por extenso, para o título/tooltip.
 */
export function routeChips(value: VehicleRoutes | null | undefined, max = 3) {
  if (!value) return { visible: [] as string[], hidden: 0, full: "" };
  const labels = [
    ...(value.allRoutes ? [ALL_ROUTES_LABEL] : []),
    ...value.routes.map(shortRoute),
  ];
  const fullList = [...(value.allRoutes ? [ALL_ROUTES_LABEL] : []), ...value.routes];
  return {
    visible: labels.slice(0, max),
    hidden: Math.max(0, labels.length - max),
    full: fullList.join(", "),
  };
}

/** Texto completo para o Excel. */
export function routesText(value: VehicleRoutes | null | undefined): string {
  if (!value) return "";
  return [...(value.allRoutes ? [ALL_ROUTES_LABEL] : []), ...value.routes].join(", ");
}

/** Minúsculas e sem acento, para "marica" achar "Maricá". */
export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Texto para a busca da tela: nomes completos e abreviados, sem acento. */
export function routesSearchText(value: VehicleRoutes | null | undefined): string {
  if (!value) return "";
  return foldText(
    [...(value.allRoutes ? [ALL_ROUTES_LABEL] : []), ...value.routes, ...value.routes.map(shortRoute)].join(" "),
  );
}
