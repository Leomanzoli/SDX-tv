# Painel admin do SDX-tv

Permite que usuários cadastrados editem o conteúdo da TV (slides, pastas, mídias, ticker) pelo navegador. Cada alteração gera um **commit automático no `main`** via GitHub API; o GitHub Pages republica em seguida.

## Setup na Vercel (uma vez só)

1. Importe o repositório `Leomanzoli/SDX-tv` no painel da Vercel.
2. Em **Project Settings → Environment Variables**, configure:

| Variável | Valor |
|---|---|
| `JWT_SECRET` | string aleatória longa (gere com `openssl rand -hex 32`) |
| `ADMIN_USERS` | JSON com a lista de usuários, ex: `[{"u":"maria","hash":"$2a$10$..."}]` |
| `GITHUB_TOKEN` | Personal Access Token (clássico) com escopo `repo` |
| `GITHUB_REPO` | `Leomanzoli/SDX-tv` |
| `GITHUB_BRANCH` | `main` (opcional) |

### Gerar hash bcrypt de uma senha

```bash
node -e "console.log(require('bcryptjs').hashSync('SENHA_AQUI', 10))"
```

Cole o resultado no campo `hash` do `ADMIN_USERS`.

## Uso

- Acesse `https://<projeto>.vercel.app/admin`
- Faça login com usuário + senha
- Abas:
  - **Slides**: arraste para reordenar, edite título/subtítulo/arquivo, adicione/apague. Clique **Salvar e publicar** para gerar o commit.
  - **Pastas & Mídia**: crie/apague pastas em `assets/`, faça upload de imagens e vídeos (até ~4 MB por arquivo no plano Hobby).
  - **Textos**: edita mensagens auxiliares (ticker).

## Limites

- Plano Hobby da Vercel: payload de upload limitado a ~4.5 MB. Para vídeos maiores, comprima antes ou faça upload manual via git.
- Token JWT expira em 12 h; após isso o painel pede novo login.
