# SDX-tv
Canal de divulgação semanal de assuntos de saúde, segurança e meio ambiente no trabalho.

## Proposta de design sênior (site para TV administrativa)

### 1) Objetivo do produto
Criar um site em modo TV (tela cheia, navegação automática) para exibir:
- **slides internos** de Saúde, Segurança e Meio Ambiente (SSMA);
- **notícias externas confiáveis** de SSMA;
- **avisos rápidos** (campanhas, alertas, datas importantes).

### 2) Estrutura recomendada da tela
- **Área principal (70%)**: carrossel de slides/imagens internas.
- **Barra lateral (30%)**: cards de notícias SSMA com título, fonte e horário.
- **Rodapé ticker**: mensagens curtas (ex.: “Use EPIs”, “DDS às 08h”).
- **Header discreto**: data, hora e status de atualização.

### 3) Modos de transição e animações (recomendado)
Usar animações suaves, com baixa fadiga visual e legibilidade alta:

1. **Fade (padrão)**  
   - Uso: troca entre slides institucionais.  
   - Duração: `600ms` a `900ms`.  
   - Vantagem: elegante e não distrai.

2. **Slide horizontal**  
   - Uso: sequência de notícias em destaque.  
   - Duração: `400ms` a `700ms`.  
   - Vantagem: reforça sensação de linha do tempo.

3. **Zoom leve (Ken Burns sutil)**  
   - Uso: imagens estáticas de campanhas.  
   - Intensidade: `scale(1.00 -> 1.05)` em 8–12s.  
   - Vantagem: dá vida sem poluir.

4. **Ticker contínuo no rodapé**  
   - Uso: alertas rápidos e lembretes de segurança.  
   - Velocidade: leitura confortável, sem “correria”.

> Evitar: efeitos bruscos (flash, bounce, giros), excesso de cores piscantes e transições abaixo de 300ms.

### 4) Ritmo de exibição sugerido
- Slides internos: **10–15s por item**.
- Notícias externas: **8–12s por card**.
- Alertas críticos (quando houver): prioridade no topo por **30–60s**.
- Loop total ideal: **3 a 5 minutos**, depois reinicia.

### 5) APIs e fontes de notícias (SSMA)
Para compor notícias de Saúde, Segurança e Meio Ambiente:

#### Opção A — Feed RSS/Atom (mais simples e estável)
- Consumir feeds públicos confiáveis (órgãos oficiais e portais técnicos).
- Conversão para JSON no backend para padronizar campos.
- Bom custo-benefício para MVP.

#### Opção B — NewsAPI / GNews / similares
- Filtrar por palavras-chave:
  - Saúde ocupacional, segurança do trabalho, meio ambiente, ESG, SST.
- Requer gestão de chave/API key e limites de requisição.

#### Opção C — Agregador próprio (recomendado para evolução)
- Serviço backend que:
  1. consome múltiplas fontes;
  2. remove duplicadas;
  3. classifica por tema (Saúde/Segurança/Meio Ambiente);
  4. entrega endpoint único para a TV.

### 6) Regras de integração (boas práticas)
- **Cache** de notícias (15–30 min) para evitar bloqueio por limite de API.
- **Fallback offline**: se API cair, manter últimas notícias válidas.
- **Whitelist de fontes** para evitar conteúdo não confiável.
- Sanitizar texto/links para segurança da aplicação.
- Registrar logs de atualização (sucesso/falha e horário).

### 7) Diretrizes visuais (ambiente corporativo)
- Contraste alto (acessibilidade): texto claro em fundo escuro ou vice-versa.
- Tipografia grande para leitura à distância (mín. 28px em títulos principais).
- Paleta limpa com cores de status:
  - Verde: Saúde
  - Laranja/Amarelo: Segurança (atenção)
  - Azul/Verde água: Meio Ambiente
- Ícones simples e consistentes.

### 8) Roadmap de implementação (enxuto)
1. **MVP**
   - Layout TV + carrossel local + ticker.
   - 1 fonte externa via RSS/API.
2. **Fase 2**
   - Painel admin simples para cadastrar slides e mensagens.
   - Múltiplas fontes e categorização.
3. **Fase 3**
   - Métricas (itens exibidos, tempo de tela, atualização).
   - Alertas críticos com prioridade.

### 9) Stack sugerida (objetiva)
- Frontend: React/Next.js ou HTML simples com player em modo kiosk.
- Animações: CSS transitions + Framer Motion (se precisar refinamento).
- Backend/API aggregator: Node.js (Express/Nest) com cache (Redis opcional).
- Deploy: modo kiosk na TV (autostart em navegador fullscreen).

## MVP implementado neste repositório

Foi implementado um player web em modo TV com:
- layout 70/30 (carrossel principal + barra de notícias);
- transições `fade` e `slide`, além de zoom sutil (Ken Burns) em imagens;
- ticker contínuo no rodapé;
- header com data/hora e status de atualização de notícias;
- consumo de fontes RSS externas de SSMA (via proxy), com:
  - cache local de 20 minutos;
  - fallback para cache anterior;
  - fallback offline em `data/news-fallback.json`.

### Arquivos principais
- `index.html`
- `styles.css`
- `app.js`
- `data/news-fallback.json`

### Como executar localmente

1. Entre na pasta do projeto:

   ```bash
   cd /workspaces/SDX-tv
   ```

2. Suba um servidor HTTP local (necessário para `fetch` dos dados):

   ```bash
   python3 -m http.server 8080
   ```

3. Abra no navegador:

   ```
   http://localhost:8080
   ```

### Observação sobre Inspeções (PPTX)

As imagens em `assets/Inspeções/` (`1.jpg` até `17.jpg`) foram integradas ao carrossel principal.
O arquivo `assets/Inspeções/Slides.pptx` pode ser mantido como fonte original de edição.
