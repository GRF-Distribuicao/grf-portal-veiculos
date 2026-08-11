import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

/**
 * Build de producao: o Nitro gera a pasta `.vercel/output` (Build Output API),
 * que a Vercel reconhece automaticamente. Para rodar em Node puro (VPS/Docker),
 * defina NITRO_PRESET=node-server e use `npm start`.
 */
const nitroPreset = process.env["NITRO_PRESET"] ?? "vercel";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    // Sem `server.entry` customizado de propósito: o wrapper src/server.ts que
    // vinha do Lovable fazia o bundle SSR importar o barrel de servidor do Start
    // antes do módulo interno dele, criando um ciclo de import que derrubava
    // TODAS as rotas com "createCsrfMiddleware is not a function".
    tanstackStart(),
    nitro({ preset: nitroPreset }),
    viteReact(),
  ],
});
