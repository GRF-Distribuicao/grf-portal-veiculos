/**
 * Leitura de variáveis de ambiente que funciona nos dois lados:
 * - navegador: `import.meta.env.VITE_*` (substituído em build time pelo Vite)
 * - servidor (SSR / Vercel Functions): `process.env.*` em runtime
 *
 * `process` não existe no bundle do navegador, por isso o acesso é protegido.
 */
function fromProcess(key: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

function fromImportMeta(key: string): string | undefined {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const value = env[key];
  return value && value.length > 0 ? value : undefined;
}

/** Aceita tanto `VITE_FOO` (cliente) quanto `FOO` (servidor). */
export function readEnv(name: string): string | undefined {
  return fromImportMeta(`VITE_${name}`) ?? fromProcess(`VITE_${name}`) ?? fromProcess(name);
}

/** Só process.env — para segredos que NUNCA podem ir para o bundle do navegador. */
export function readServerEnv(name: string): string | undefined {
  return fromProcess(name);
}

export function requireServerEnv(names: string[]): string[] {
  return requireFrom(names, readServerEnv);
}

export function requireEnv(names: string[]): string[] {
  return requireFrom(names, readEnv);
}

function requireFrom(names: string[], read: (n: string) => string | undefined): string[] {
  const values = names.map((n) => read(n));
  const missing = names.filter((_, i) => !values[i]);
  if (missing.length) {
    const message =
      `Variáveis de ambiente do Supabase ausentes: ${missing.join(", ")}. ` +
      `Defina-as no arquivo .env (desenvolvimento) ou em Settings → Environment Variables na Vercel.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }
  return values as string[];
}

/** Chaves novas (sb_publishable_/sb_secret_) são opacas, não são JWT bearer. */
export function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/** Garante o header `apikey` e remove o Authorization redundante das chaves novas. */
export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

/** Bucket privado onde ficam documentos e fotos dos veículos. */
export const STORAGE_BUCKET = "grf-documentos";
