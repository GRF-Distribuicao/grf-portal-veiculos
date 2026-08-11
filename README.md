# Portal GRF — Cadastro de Veículos

Portal público para transportadores agregados cadastrarem veículos, documentos e
fotos, com área interna para a equipe GRF analisar, aprovar e exportar.

Stack: TanStack Start (React 19 + SSR) · Vite 8 · Tailwind 4 · shadcn/ui · Supabase.

---

## 1. Configurar as variáveis de ambiente

```bash
cp .env.example .env
```

Abra o `.env` e preencha **apenas** o `SUPABASE_SERVICE_ROLE_KEY`.
Pegue em: Supabase → Project Settings → API Keys → `service_role` / secret.

| Variável | Onde é usada |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | navegador (login e upload) |
| `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` | SSR e validação de token |
| `SUPABASE_SERVICE_ROLE_KEY` | **segredo** — server functions, ignora RLS |

O `.env` está no `.gitignore`. Nunca coloque o prefixo `VITE_` no service role:
tudo com esse prefixo vai para o bundle público do navegador.

## 2. Preparar a base

A base `yxvzbcqtcfgmsptrqsfa` já tem as 6 tabelas e o bucket privado
`grf-documentos`. Falta só um passo, **obrigatório para o login funcionar**:

Abra o SQL Editor do Supabase e rode `supabase/migrations/01_user_roles.sql`.
Ele apenas cria a tabela `user_roles`, o enum `app_role` e a função `has_role()`
— não altera nem apaga nada do que já existe.

## 3. Rodar local

```bash
npm install
npm run dev      # http://localhost:8080
```

Primeiro acesso da equipe: vá em `/login`. Enquanto não existir nenhum usuário,
a tela oferece criar o primeiro administrador. Depois disso essa rotina se
desativa sozinha e novos usuários precisam ser criados no painel do Supabase
com a linha correspondente em `user_roles`.

## 4. Publicar no GitHub

```bash
git init
git add .
git commit -m "Portal GRF - cadastro de veiculos"
git branch -M main
git remote add origin git@github.com:SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

## 5. Publicar na Vercel

1. Vercel → Add New → Project → importe o repositório.
2. Framework Preset: **Other**. O `vercel.json` já define o resto.
3. Em Settings → Environment Variables, cadastre as **5 variáveis** do `.env`
   (as três públicas e as duas de servidor) em Production e Preview.
4. Deploy.

O build usa o preset `vercel` do Nitro e gera `.vercel/output` (Build Output
API), que a Vercel reconhece sozinha. A região está fixada em `gru1` (São Paulo)
para reduzir latência até a base em `sa-east-1`.

Para rodar em Node puro (VPS, Docker) em vez da Vercel:

```bash
NITRO_PRESET=node-server npm run build
npm start          # http://localhost:3000
```

---

## Como funciona o envio de arquivos

O formulário é público e o bucket é privado, então o upload acontece em duas
etapas:

1. `createUploadTicket` (server function) valida tipo e tamanho, monta o caminho
   e emite uma **URL assinada** com o service role.
2. O navegador envia o arquivo **direto para o Storage** com esse token.

Isso evita depender de política RLS no bucket e não passa o arquivo pela função
serverless — a Vercel limita o corpo da requisição a ~4,5 MB, bem abaixo dos
10 MB por arquivo aceitos aqui.

Fotos são convertidas para JPEG e reduzidas para no máximo 1920px antes do
envio. Isso resolve o HEIC do iPhone, que o bucket rejeitaria, e as fotos de
12 MP que estourariam o limite de tamanho.

### Anexos exigidos

| Chave | Item | Obrigatório |
|---|---|---|
| `CRLV` | CRLV do veículo | sim |
| `DOC_PROPRIETARIO` | Documento do proprietário | sim |
| `CNH` | CNH do motorista | sim |
| `FOTO_FRENTE` | Foto frontal, placa legível | sim |
| `FOTO_LATERAL` | Foto lateral, carroceria visível | sim |
| `FOTO_CARROCERIA` | Interior da carroceria | não |

Para mudar essa lista, edite `DOC_TYPES` e `PHOTO_TYPES` em
`src/lib/grf-domain.ts` — o formulário, a validação de servidor e a tela de
análise se ajustam sozinhos. A obrigatoriedade é checada **também no servidor**,
em `submitRegistration`, porque o formulário do navegador pode ser burlado.

## Estrutura

```
src/
  routes/            páginas (index, cadastro, consulta, login, admin/*)
  lib/
    grf-domain.ts        constantes, validações e tipos de anexo
    grf.functions.ts     server functions (cadastro, consulta, análise)
    grf-upload.ts        upload e normalização de imagem (navegador)
    grf-server-helpers.ts  schemas Zod
  integrations/supabase/
    env.ts               leitura de env e constantes
    client.ts            cliente do navegador (chave publicável)
    client.server.ts     cliente service role — só no servidor
    auth-middleware.ts   valida o bearer token da área GRF
supabase/migrations/   scripts SQL (ver 00_LEIA-ME.md)
```

## Notas de manutenção

- **Logo**: `public/grf-logo.png` é um placeholder derivado do favicon (64px).
  Substitua pela arte oficial em alta resolução.
- **Segurança do bucket**: existe uma policy antiga que permite INSERT anônimo
  em `grf-documentos`. Com o fluxo de URL assinada ela virou porta aberta sem
  uso. Depois de confirmar os uploads em produção, rode
  `supabase/migrations/02_opcional_endurecer_storage.sql` para removê-la.
- **Versões**: `@tanstack/react-start` e `@tanstack/react-router` precisam ficar
  alinhados. Versões descasadas causam erro de `MISSING_EXPORT` no build ou um
  ciclo de import que derruba o SSR em todas as rotas.
- **Integração Sankhya**: os campos `codveiculo_sankhya`, `status_integracao` e
  `mensagem_integracao` já existem e são exibidos na tela de análise, mas o
  envio real ainda não foi implementado.
