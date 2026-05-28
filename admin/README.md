# Painel SDX-tv — Guia rápido

Endereço do painel: **https://SEU-PROJETO.vercel.app/admin**
(o link definitivo aparece quando a Vercel terminar o primeiro deploy)

## Como usar (para quem não programa)

1. **Entrar**
   - Abra o link, digite seu usuário e senha, clique **Entrar**.

2. **Trocar uma foto ou vídeo**
   - Vá em **Pastas & Mídia**.
   - Escolha a pasta no menu (ex: `CRM`, `Inspeções`).
   - Clique em **Upload de arquivos** e selecione um ou mais arquivos do computador.
     - Imagens e arquivos pequenos: publicados na hora.
     - Vídeos grandes (acima de ~4 MB): o painel detecta sozinho e usa o "bucket de vídeos" — sem você precisar fazer nada diferente. Aparecem com a etiqueta **📦 vídeo grande**.
   - O status verde **Publicado ✓** confirma que foi.

3. **Fazer o vídeo/imagem aparecer na TV**
   - Ainda em **Pastas & Mídia**, clique em **+ Usar nos slides** no arquivo que você acabou de subir.
   - Vá na aba **Slides**, confira o slide que apareceu no fim da lista (pode arrastar pela alça `⋮⋮` para a posição que quiser).
   - Clique em **Salvar e publicar**.
   - A TV atualiza em ~1–2 minutos.

4. **Criar uma pasta nova** (ex: para uma nova campanha)
   - Em **Pastas & Mídia**, clique em **+ Nova pasta**, digite o nome (ex: `SIPAT 2026`).

5. **Apagar arquivo ou slide**
   - Botão vermelho **Apagar** ao lado do item. Pede confirmação.

6. **Editar texto de um slide**
   - Na aba **Slides**, botão **Editar** ao lado do slide.
   - Mude título/subtítulo, clique em **Aplicar**, depois **Salvar e publicar**.

## Limites

- Tamanho máximo de vídeo: **2 GB** (mas vídeos curtos rodam melhor na TV).
- A sessão expira em 12 h — depois disso é só logar de novo.
- Mudanças aparecem na TV após o GitHub Pages reconstruir (~1–2 min).

---

# Setup técnico (uma vez só, feito pelo administrador)

## 1. Importar o repo na Vercel

1. Acesse https://vercel.com/new e faça login com sua conta GitHub.
2. Selecione o repositório `Leomanzoli/SDX-tv` → **Import**.
3. Na tela de configuração, **mantenha tudo no padrão** (framework: Other; build command: vazio).
4. Antes de clicar em Deploy, abra **Environment Variables** e adicione as 4 chaves abaixo.

## 2. Gerar as variáveis de ambiente

### `JWT_SECRET`
Uma string aleatória longa. Gere com:
```bash
openssl rand -hex 32
```
ou em qualquer site tipo https://generate-secret.vercel.app/32 — cole o resultado.

### `GITHUB_TOKEN`
1. Acesse https://github.com/settings/tokens?type=beta
2. **Generate new token** (fine-grained)
3. Nome: `SDX-tv admin`. Expiration: 1 ano.
4. Resource owner: sua conta. **Only select repositories** → `SDX-tv`.
5. Permissions → **Repository permissions**:
   - **Contents**: Read and write
   - **Metadata**: Read-only (já vem marcado)
6. Generate token → copie. Esse token só vê esse repo.

### `GITHUB_REPO`
Valor literal: `Leomanzoli/SDX-tv`

### `ADMIN_USERS`
Lista de usuários como JSON. Para cada pessoa, gere o hash da senha:

```bash
# (precisa ter Node.js instalado)
npx bcryptjs-cli hash 'senha-da-pessoa'
```

ou em qualquer editor com Node:
```bash
node -e "console.log(require('bcryptjs').hashSync('senha-da-pessoa', 10))"
```

Depois monte o valor da variável (em **uma linha só**, sem quebras):
```json
[{"u":"maria","hash":"$2a$10$abc..."},{"u":"joao","hash":"$2a$10$def..."}]
```

## 3. Configurar Cloudflare R2 (storage de vídeos)

Por que R2: free tier 10 GB de storage + **bandwidth de saída ilimitada e grátis** (vital pra TV que fica tocando vídeo o dia todo). Outras opções (Vercel Blob, GitHub Releases) não funcionam por restrição de CORS no upload direto do browser.

### 3.1. Criar conta + bucket

1. Crie conta em https://dash.cloudflare.com (grátis, e-mail só).
2. No painel esquerdo, **R2 Object Storage** → **Create bucket**.
3. Nome: `sdx-tv-media`. Location: **Automatic**. Storage class: **Standard**. **Create bucket**.

### 3.2. Liberar acesso público

1. Abra o bucket → aba **Settings**.
2. Em **Public access**, seção **R2.dev subdomain** → **Allow Access**. Confirme.
3. Copie a URL que aparece (algo como `https://pub-xxxxxxxxxxxxxxxx.r2.dev`). É o `R2_PUBLIC_URL`.

### 3.3. Configurar CORS

Ainda em **Settings** → seção **CORS policy** → **Add CORS policy**. Cole:

```json
[
  {
    "AllowedOrigins": ["https://sdx-tv.vercel.app"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Se sua URL na Vercel for outra, troque na linha `AllowedOrigins`. **Save**.

### 3.4. Gerar API token

1. Volte pra **R2 Object Storage** (lista de buckets) → topo direito **Manage R2 API Tokens** → **Create API token**.
2. Nome: `sdx-tv-admin`. Permissions: **Object Read & Write**. Specify bucket: `sdx-tv-media`. TTL: deixa em branco (não expira). **Create API Token**.
3. Vai aparecer:
   - **Access Key ID** → copia, é o `R2_ACCESS_KEY_ID`
   - **Secret Access Key** → copia, é o `R2_SECRET_ACCESS_KEY`
   - Essas chaves só aparecem uma vez. Guarde num gerenciador de senhas se quiser.

### 3.5. Pegar o Account ID

No painel R2, lado direito, em **Account details**, copie o **Account ID**. É o `R2_ACCOUNT_ID`.

### 3.6. Adicionar as 5 env vars na Vercel

Em **Project Settings → Environment Variables**, adicione (todas em Production):

| Nome | Valor |
|---|---|
| `R2_ACCOUNT_ID` | (passo 3.5) |
| `R2_ACCESS_KEY_ID` | (passo 3.4) |
| `R2_SECRET_ACCESS_KEY` | (passo 3.4) |
| `R2_BUCKET` | `sdx-tv-media` |
| `R2_PUBLIC_URL` | (passo 3.2) |

Depois **Deployments** → último → ⋯ → **Redeploy**.

## 4. Deploy

Clique em **Deploy**. Em ~1 minuto a Vercel mostra a URL `https://SEU-PROJETO.vercel.app`. O painel está em `/admin`.

## 5. Compartilhar com a equipe

Envie para as 2-3 pessoas:
- O link `https://SEU-PROJETO.vercel.app/admin`
- O usuário e senha de cada uma
- Este README (seção "Como usar")

## Onde os arquivos vão parar

- **Imagens e arquivos pequenos** (`≤3,5 MB`): commit em `assets/<pasta>/` no repositório. GitHub Pages serve direto.
- **Vídeos e arquivos grandes** (`>3,5 MB`): vão para o bucket **Cloudflare R2**. A URL pública (no domínio `pub-xxx.r2.dev`) é gravada em `data/slides.json`. O repo principal continua leve.
- **Edições de slides** (ordem, títulos, ticker): commit em `data/slides.json`.

Tudo gera commits com a mensagem `admin(usuário): ...`, então o histórico fica auditável.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| "Sessão expirada" | Passou 12h | Logar de novo |
| Login não aceita | Hash bcrypt errado | Regerar com `bcryptjs.hashSync('senha', 10)` |
| Upload trava em vídeo grande | Conexão lenta | Tentar de novo — upload é direto pro Cloudflare R2 |
| TV não atualizou | Pages ainda reconstruindo | Esperar mais 1 min, depois F5 |
| "GITHUB_TOKEN ausente" | Variável não configurada na Vercel | Adicionar e fazer Redeploy |
| Upload de vídeo falha com "R2 403" | CORS policy não inclui o domínio do painel | Editar CORS policy no bucket, ajustar `AllowedOrigins` |
| Upload de vídeo falha com "R2_BUCKET ausente" | env vars do R2 não configuradas ou Redeploy não feito | Conferir Project Settings → Environment Variables, depois Redeploy |
