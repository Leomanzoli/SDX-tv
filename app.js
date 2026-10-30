// Valores padrão usados antes do data/slides.json carregar. Sobrescritos no bootstrap().
const defaultConfig = {
  slideWindowMs: { image: 12000, video: 90000, message: 12000 },
  videoBufferTimeoutMs: 8000,
  imageLoadTimeoutMs: 10000,
  fetchTimeoutMs: 10000,
  slidesRefreshMinutes: 5,
  dailyReloadHour: 3,
  maxConsecutiveMediaErrors: 8,
  newsCardMs: 10000,
  alertPriorityMs: 45000,
  newsCacheMinutes: 20,
};
let config = { ...defaultConfig };

// Carregado dinamicamente de data/slides.json (gerenciável pelo painel /admin).
let slides = [];

// Geradores reaproveitados pelo fallback, caso data/slides.json não carregue.
const preaxionSlidesFallback = [
  "whatsapp-image-2026-04-07-at-12-53-33.jpg",
  "whatsapp-image-2026-04-08-at-09-57-26.jpg",
  "whatsapp-image-2026-04-08-at-09-57-27.jpg",
  "whatsapp-image-2026-04-08-at-09-57-28-3.jpg",
  "whatsapp-image-2026-04-08-at-09-57-28-4.jpg",
  "whatsapp-image-2026-04-08-at-09-57-28-7.jpg",
  "whatsapp-image-2026-04-08-at-09-57-28-8.jpg",
  "whatsapp-image-2026-04-09-at-13-12-44-1.jpg",
  "whatsapp-image-2026-04-09-at-13-12-56-1.jpg",
  "whatsapp-image-2026-04-09-at-15-48-39-47.jpg",
  "whatsapp-image-2026-04-09-at-15-48-39-51.jpg",
  "whatsapp-image-2026-04-09-at-15-48-41-2.jpg",
  "whatsapp-image-2026-04-09-at-16-22-42-3.jpg",
  "whatsapp-image-2026-04-09-at-16-28-48-9.jpg",
].map((file, index) => ({
  type: "image",
  title: `Preaxion em Ação · ${index + 1}`,
  subtitle: "Registro do treinamento de campo",
  src: `assets/Preaxion/${file}`,
  transition: "fade",
  kenBurns: true,
}));

const FALLBACK_SLIDES = [
  {
    type: "image",
    title: "Panorama CRM",
    subtitle: "Comunicação de rotina operacional",
    src: "assets/CRM/crm-1.jpg",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "image",
    title: "CRM em Campo",
    subtitle: "Atuação direta na operação",
    src: "assets/CRM/crm-em-campo.jpg",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "image",
    title: "Indicadores N3",
    subtitle: "Visibilidade em tempo real para equipes",
    src: "assets/N3/n3-1.jpg",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "image",
    title: "Indicadores N3 · Continuação",
    subtitle: "Acompanhamento diário com foco em prevenção",
    src: "assets/N3/n3-2.jpg",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "image",
    title: "Painel N3",
    subtitle: "Visão consolidada de desempenho",
    src: "assets/N3/painel.jpg",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "image",
    title: "Painel N3 · Detalhamento",
    subtitle: "Análise operacional por frente",
    src: "assets/N3/painel-2.jpg",
    transition: "fade",
    kenBurns: true,
  },
  // Conteúdos complementares já disponíveis no repositório.
  {
    type: "video",
    title: "Pílulas de Segurança",
    subtitle: "Princípios de incêndios em correias",
    src: "assets/Pilulas/principios-de-incendios-em-correias-horizontal.mp4",
    transition: "slide",
  },
  {
    type: "video",
    title: "Preaxion · Treinamento",
    subtitle: "Resposta rápida e prevenção",
    src: "assets/Preaxion/preaxion.mp4",
    transition: "slide",
  },
  ...preaxionSlidesFallback,
  {
    type: "image",
    title: "Saúde em Foco",
    subtitle: "Conteúdo de bem-estar ocupacional",
    src: "assets/Saúde/01.jpg",
    transition: "fade",
    kenBurns: true,
  },
];


const rssSources = [
  {
    name: "Agência Brasil – Saúde",
    url: "https://agenciabrasil.ebc.com.br/rss/saude/feed.xml",
  },
  {
    name: "Agência Brasil – Meio Ambiente",
    url: "https://agenciabrasil.ebc.com.br/rss/meio-ambiente/feed.xml",
  },
  {
    name: "Notícias – Segurança do Trabalho",
    url: "https://news.google.com/rss/search?q=%28%22sa%C3%BAde+ocupacional%22+OR+%22acidente+de+trabalho%22+OR+%22sa%C3%BAde+e+seguran%C3%A7a+do+trabalho%22%29&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
  {
    name: "Notícias – Meio Ambiente Brasil",
    url: "https://news.google.com/rss/search?q=meio+ambiente+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
];

const cacheKey = "sdx-tv-news-cache-v3";
const statusEl = document.getElementById("news-status");
const statusTextEl = statusEl.querySelector(".status-text");
const slideStageEl = document.getElementById("slide-stage");
const slideTitleEl = document.getElementById("slide-title");
const slideSubtitleEl = document.getElementById("slide-subtitle");
const slideCounterEl = document.getElementById("slide-counter");
const slideProgressBarEl = document.getElementById("slide-progress-bar");
const newsStageEl = document.getElementById("news-stage");

const categoryLabels = {
  health: "Saúde",
  safety: "Segurança",
  environment: "Meio Ambiente",
};

let slideIndex = 0;
let newsIndex = 0;
let newsRotationTimer = null;
let activeNewsCard = null;
let slideTimer = null;
let consecutiveMediaErrors = 0;
let slidesEtag = null;

const MEDIA_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg|mp4|webm|mov|m4v|ogv)(\?.*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)(\?.*)?$/i;

// TVs (Tizen/webOS/etc.) ou ?lite=1 recebem a variante sem efeitos pesados.
const isTvLite = (() => {
  try {
    if (new URLSearchParams(location.search).get("lite") === "1") return true;
  } catch (_) {}
  return /Tizen|Web0S|webOS|SMART-TV|SmartTV|NetCast|BRAVIA|HbbTV|AFTT|AFTM|Silk|Roku|Philips|VIDAA|Hisense/i.test(
    navigator.userAgent
  );
})();
if (isTvLite) document.body.classList.add("tv-lite");

// Encoda só caminhos relativos; URLs absolutas vêm prontas do R2/admin.
function normalizeSrc(src) {
  if (typeof src !== "string") return "";
  const trimmed = src.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z]:\\/i.test(trimmed) || trimmed.startsWith('"')) return "";
  if (/%[0-9a-f]{2}/i.test(trimmed)) return trimmed;
  return encodeURI(trimmed.replace(/^\.?\//, ""));
}

function isPlayableSlide(item) {
  if (!item || typeof item !== "object") return false;
  if (item.type === "message") return true;
  const src = normalizeSrc(item.src);
  if (!src || !MEDIA_EXT.test(src)) return false;
  if (item.type === "video" && !VIDEO_EXT.test(src)) return false;
  if (item.type === "image" && VIDEO_EXT.test(src)) return false;
  return true;
}

function sanitizeSlides(list) {
  const valid = [];
  for (const item of list) {
    if (isPlayableSlide(item)) {
      valid.push({ ...item, src: item.type === "message" ? item.src : normalizeSrc(item.src) });
    } else {
      console.warn("[SDX-TV][SLIDES] Slide ignorado por src inválido", { title: item?.title, src: item?.src });
    }
  }
  return valid;
}

function fetchWithTimeout(url, options = {}, timeoutMs = config.fetchTimeoutMs) {
  if (typeof AbortController === "undefined") return fetch(url, options);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => window.clearTimeout(timer));
}

function setStatus(text, type = "pending") {
  if (statusTextEl) {
    statusTextEl.textContent = text;
  } else {
    statusEl.textContent = text;
  }
  statusEl.classList.remove("ok", "warn", "pending");
  statusEl.classList.add(type);
}

function logNewsUpdate(message, extra = {}) {
  const stamp = new Date().toISOString();
  console.info("[SDX-TV][NEWS]", stamp, message, extra);
}

function startClock() {
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("date");

  const tick = () => {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    dateEl.textContent = now.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  };

  tick();
  window.setInterval(tick, 1000);
}


function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function classifyCategory(item) {
  const text = `${item.title || ""} ${item.summary || ""}`.toLowerCase();
  const source = (item.source || "").toLowerCase();

  if (/acidente|fatal|alerta|surto|interdi[çc][ãa]o|incident|emerg[êe]ncia/.test(text)) {
    return "safety";
  }

  if (source.includes("meio ambiente")) return "environment";
  if (/sa[úu]de/.test(source)) return "health";
  if (/seguran|trabalho|prote[çc]/.test(source)) return "safety";

  if (/seguran[çc]a do trabalho|trabalhador|\bepi\b|\bcipa\b|nr[- ]?\d|ergonom|insalubr/.test(text)) {
    return "safety";
  }
  if (/sa[úu]de|doen[çc]a|pandem|vacin|hospital|m[eé]dic|ocupacional|fisioterap/.test(text)) {
    return "health";
  }
  if (/ambient|clima|sustent|res[íi]du|emiss|reciclag|carbon|polui|biodivers|esg|amaz[ôo]n|desmatam/.test(text)) {
    return "environment";
  }

  return "environment";
}

function isCritical(news) {
  const text = `${news.title} ${news.summary || ""}`.toLowerCase();
  return /critical|urgent|fatal|alerta|surto|interdi[çc][ãa]o/.test(text);
}

function normalizeNews(items, sourceName) {
  return items
    .filter((item) => item.title && item.link)
    .map((item) => {
      const normalized = {
        title: item.title.trim(),
        link: item.link.trim(),
        source: sourceName,
        summary:
          item.description?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ||
          "Sem resumo disponível.",
        publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
      };
      normalized.category = classifyCategory(normalized);
      return normalized;
    });
}

function allowedHost(url) {
  try {
    const host = new URL(url).hostname;
    const whitelist = ["ebc.com.br", "google.com", "protecao.com.br", "gov.br"];
    return whitelist.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

async function fetchRssViaProxy(source) {
  const errors = [];

  const strategies = [
    async () => {
      const endpoint = `https://api.allorigins.win/raw?url=${encodeURIComponent(source.url)}`;
      const response = await fetchWithTimeout(endpoint, { headers: { Accept: "application/xml,text/xml" } });
      if (!response.ok) {
        throw new Error(`AllOrigins ${response.status}`);
      }

      const xml = await response.text();
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        throw new Error("AllOrigins XML inválido");
      }

      const items = [...doc.querySelectorAll("item")].slice(0, 10).map((item) => ({
        title: item.querySelector("title")?.textContent || "",
        link: item.querySelector("link")?.textContent || "",
        description: item.querySelector("description")?.textContent || "",
        pubDate: item.querySelector("pubDate")?.textContent || "",
        isoDate: item.querySelector("updated")?.textContent || "",
      }));

      return normalizeNews(items, source.name);
    },
    async () => {
      const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}`;
      const response = await fetchWithTimeout(endpoint, { headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`RSS2JSON ${response.status}`);
      }

      const payload = await response.json();
      if (payload.status !== "ok" || !Array.isArray(payload.items)) {
        throw new Error("RSS2JSON payload inválido");
      }

      const items = payload.items.slice(0, 10).map((item) => ({
        title: item.title || "",
        link: item.link || "",
        description: item.description || "",
        pubDate: item.pubDate || "",
        isoDate: item.pubDate || "",
      }));

      return normalizeNews(items, source.name);
    },
  ];

  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result.length > 0) {
        return result;
      }
    } catch (error) {
      errors.push(String(error));
    }
  }

  throw new Error(`Falha na fonte ${source.name}: ${errors.join(" | ")}`);
}

function saveNewsCache(news) {
  const payload = {
    timestamp: Date.now(),
    news,
  };

  localStorage.setItem(cacheKey, JSON.stringify(payload));
}

function readNewsCache(maxAgeMinutes) {
  try {
    const raw = localStorage.getItem(cacheKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    const ageMs = Date.now() - parsed.timestamp;
    if (ageMs > maxAgeMinutes * 60000) {
      return [];
    }

    return Array.isArray(parsed.news) ? parsed.news : [];
  } catch {
    return [];
  }
}

async function readFallbackNews() {
  const response = await fetchWithTimeout("data/news-fallback.json");
  if (!response.ok) {
    throw new Error("Fallback indisponível");
  }

  return response.json();
}

// Notícias pré-agregadas pelo servidor: /api/news (Vercel) ou data/news.json (gerado pelo
// GitHub Actions). Elimina a dependência de proxies públicos instáveis.
async function fetchAggregatedNews(url) {
  const response = await fetchWithTimeout(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.items) || payload.items.length === 0) throw new Error("payload vazio");
  const bySource = new Map();
  for (const item of payload.items) {
    const name = item.source || "Fonte externa";
    if (!bySource.has(name)) bySource.set(name, []);
    bySource.get(name).push(item);
  }
  const items = [...bySource.entries()].flatMap(([name, list]) => normalizeNews(list, name));
  return { items, fetchedAt: payload.fetchedAt ? new Date(payload.fetchedAt) : null };
}

function describeAge(date) {
  if (!date || Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 60) return `há ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `há ${hours} h` : `há ${Math.round(hours / 24)} d`;
}

async function loadNews() {
  setStatus("Atualizando fontes externas...", "pending");
  logNewsUpdate("Iniciando atualização");

  const fromCache = readNewsCache(config.newsCacheMinutes);
  if (fromCache.length > 0) {
    logNewsUpdate("Cache válido encontrado", { count: fromCache.length });
  }

  for (const url of ["api/news", `data/news.json?ts=${Date.now()}`]) {
    try {
      const { items, fetchedAt } = await fetchAggregatedNews(url);
      const unique = dedupeNews(items.filter((item) => allowedHost(item.link))).slice(0, 30);
      if (unique.length === 0) continue;
      saveNewsCache(unique);
      const ageMs = fetchedAt ? Date.now() - fetchedAt.getTime() : 0;
      const stale = ageMs > 6 * 3600000;
      setStatus(
        stale ? `Notícias atualizadas ${describeAge(fetchedAt)}` : `Fontes online (${unique.length} itens)`,
        stale ? "warn" : "ok"
      );
      logNewsUpdate("Atualização via servidor concluída", { url, count: unique.length, fetchedAt });
      return prioritizeNews(unique);
    } catch (error) {
      logNewsUpdate("Fonte agregada indisponível", { url, error: String(error) });
    }
  }

  const sourceResults = await Promise.allSettled(rssSources.map(fetchRssViaProxy));
  const aggregated = sourceResults
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .filter((item) => allowedHost(item.link));

  if (aggregated.length > 0) {
    const unique = dedupeNews(aggregated).slice(0, 30);
    saveNewsCache(unique);
    setStatus(`Fontes online (${unique.length} itens)`, "ok");
    logNewsUpdate("Atualização via proxy RSS concluída", { count: unique.length });
    return prioritizeNews(unique);
  }

  if (fromCache.length > 0) {
    setStatus("Sem conexão externa. Exibindo cache local.", "warn");
    logNewsUpdate("Usando cache local por falha externa", { count: fromCache.length });
    return prioritizeNews(fromCache);
  }

  const fallback = await readFallbackNews();
  setStatus("Sem API disponível. Exibindo fallback offline.", "warn");
  logNewsUpdate("Usando fallback offline", { count: fallback.length });
  return prioritizeNews(fallback);
}

function dedupeNews(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.title.toLowerCase();
    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return [...map.values()].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
}

function prioritizeNews(items) {
  const critical = [];
  const buckets = { safety: [], health: [], environment: [] };

  for (const item of items) {
    if (isCritical(item)) {
      critical.push(item);
      continue;
    }
    const cat = item.category || "environment";
    (buckets[cat] || buckets.environment).push(item);
  }

  const interleaved = [];
  const order = ["safety", "environment", "health"];
  let pushed = true;
  while (pushed) {
    pushed = false;
    for (const cat of order) {
      if (buckets[cat].length > 0) {
        interleaved.push(buckets[cat].shift());
        pushed = true;
      }
    }
  }

  return [...critical, ...interleaved];
}

// Remove nós antigos do palco, liberando mídia (src vazio força o browser a soltar buffers).
function releaseMediaNode(node) {
  if (!node) return;
  try {
    if (node.tagName === "VIDEO") {
      node.pause();
      node.removeAttribute("src");
      node.load();
    } else if (node.tagName === "IMG") {
      node.removeAttribute("src");
    }
  } catch (_) {}
  node.remove();
}

function pruneStage(keep) {
  const children = [...slideStageEl.children];
  for (const child of children) {
    if (child !== keep) releaseMediaNode(child);
  }
}

// Baixa e decodifica a imagem fora da tela; resolve com o <img> pronto ou rejeita no timeout/erro.
function preloadImage(src, timeoutMs) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn(value);
    };
    const timer = window.setTimeout(() => {
      img.src = "";
      finish(reject, new Error(`timeout ${timeoutMs}ms`));
    }, timeoutMs);
    img.decoding = "async";
    img.onload = () => {
      if (typeof img.decode === "function") {
        img.decode().then(() => finish(resolve, img)).catch(() => finish(resolve, img));
      } else {
        finish(resolve, img);
      }
    };
    img.onerror = () => finish(reject, new Error("load error"));
    img.src = src;
  });
}

function renderSlide(item, onVideoEnded, preloadedImg) {
  const old = slideStageEl.firstElementChild;
  slideStageEl.classList.remove("fade", "slide");
  slideStageEl.classList.add(item.transition || "fade");

  // Em caso de mídia inválida, exibe fallback para não deixar a área principal vazia.
  const attachMediaErrorFallback = (mediaNode) => {
    mediaNode.addEventListener(
      "error",
      () => {
        if (mediaNode.parentNode !== slideStageEl) return;
        mediaNode.remove();

        const fallback = document.createElement("div");
        fallback.className = "slide-message active-slide";
        fallback.innerHTML = `
          <div>
            <h3>${escapeHtml(item.title || "Mídia indisponível")}</h3>
            <p>Não foi possível carregar este arquivo. O loop seguirá para o próximo item.</p>
          </div>
        `;
        slideStageEl.appendChild(fallback);

        console.warn("[SDX-TV][SLIDE] Falha ao carregar mídia", {
          src: item.src,
          type: item.type,
          title: item.title,
        });
      },
      { once: true }
    );
  };

  let node;
  if (item.type === "image") {
    // Reaproveita o <img> já decodificado pelo preload; cria um novo só como último recurso.
    node = preloadedImg || document.createElement("img");
    node.alt = item.title;
    node.className = "active-slide";
    node.decoding = "async";
    node.loading = "eager";
    attachMediaErrorFallback(node);
    if (!preloadedImg) node.src = item.src;
    if (item.kenBurns && !isTvLite) {
      node.classList.add("ken-burns");
    }
  } else if (item.type === "video") {
    node = document.createElement("video");
    // `preload="auto"` instrui o navegador a baixar o vídeo o quanto antes,
    // aproveitando o cache HTTP gerado pelo prefetch do slide anterior.
    node.preload = "auto";
    node.muted = true;
    node.defaultMuted = true;
    node.playsInline = true;
    node.setAttribute("playsinline", "");
    node.setAttribute("muted", "");
    // Sem `loop`: deixamos o vídeo terminar e o evento `ended` avança o slide,
    // garantindo que a peça inteira seja exibida.
    node.loop = false;
    node.className = "active-slide";
    attachMediaErrorFallback(node);

    // Idempotência: garante que `ended` e `error` não disparem avanço duplicado.
    let advanced = false;
    const advance = (reason) => {
      if (advanced) return;
      advanced = true;
      console.info("[SDX-TV][VIDEO] avanço", { src: item.src, reason });
      if (typeof onVideoEnded === "function") onVideoEnded();
    };

    node.addEventListener("ended", () => advance("ended"), { once: true });
    node.addEventListener(
      "error",
      () => {
        console.warn("[SDX-TV][VIDEO] erro de reprodução", { src: item.src });
        advance("error");
      },
      { once: true }
    );

    // Quando os metadados chegarem, expomos a duração real para o orquestrador
    // calcular um teto de segurança proporcional ao tamanho do clipe, em vez de
    // um valor fixo que poderia cortar o vídeo em redes lentas.
    node.addEventListener(
      "loadedmetadata",
      () => {
        node.dataset.duration = String(node.duration || 0);
        if (typeof item._onMeta === "function") item._onMeta(node.duration);
      },
      { once: true }
    );

    // Tenta tocar assim que o navegador sinalizar buffer suficiente.
    const tryPlay = () => {
      node.play().catch((err) => {
        console.warn("[SDX-TV][VIDEO] play() rejeitado", { src: item.src, err: String(err) });
      });
    };
    node.addEventListener("canplay", tryPlay, { once: true });
    node.addEventListener("canplaythrough", tryPlay, { once: true });

    // Define `src` por último: garante que todos os listeners já estão anexados
    // antes do navegador começar a emitir eventos do recurso (importante quando
    // o arquivo está em cache e o evento dispara quase imediatamente).
    node.src = item.src;
    node.load();
  } else {
    node = document.createElement("div");
    node.className = "slide-message active-slide";
    node.innerHTML = `
      <div>
        <h3>${escapeHtml(item.messageTitle || item.title)}</h3>
        <p>${escapeHtml(item.messageBody || "")}</p>
      </div>
    `;
  }

  slideTitleEl.textContent = item.title;
  slideSubtitleEl.textContent = item.subtitle;
  slideStageEl.appendChild(node);

  if (slideCounterEl) {
    const total = slides.length;
    const position = slideIndex + 1;
    slideCounterEl.textContent = `${String(position).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  }

  if (slideProgressBarEl) {
    const duration = config.slideWindowMs[item.type] || 12000;
    slideProgressBarEl.style.transition = "none";
    slideProgressBarEl.style.transform = "scaleX(0)";
    void slideProgressBarEl.offsetWidth;
    slideProgressBarEl.style.transition = `transform ${duration}ms linear`;
    slideProgressBarEl.style.transform = "scaleX(1)";
  }

  if (old) {
    window.setTimeout(() => pruneStage(node), 820);
  }

  return node;
}

// Prefetch do PRÓXIMO item enquanto o atual está em exibição. Imagens entram no
// cache HTTP via Image(); vídeos usam um <video> oculto com preload=auto.
let prefetchEl = null;
let prefetchImg = null;
function prefetchNext() {
  if (slides.length < 2) return;
  const next = slides[(slideIndex + 1) % slides.length];
  if (!next) return;

  if (prefetchEl) {
    releaseMediaNode(prefetchEl);
    prefetchEl = null;
  }
  if (prefetchImg) {
    prefetchImg.src = "";
    prefetchImg = null;
  }

  if (next.type === "image") {
    const img = new Image();
    img.decoding = "async";
    img.src = next.src;
    prefetchImg = img;
    return;
  }

  if (next.type !== "video") return;
  const v = document.createElement("video");
  v.preload = "auto";
  v.muted = true;
  v.playsInline = true;
  v.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;";
  v.src = next.src;
  document.body.appendChild(v);
  v.load();
  prefetchEl = v;
}

function registerMediaError(item, reason) {
  consecutiveMediaErrors += 1;
  console.warn("[SDX-TV][SLIDE] Falha de mídia", { src: item.src, type: item.type, reason, consecutiveMediaErrors });
  if (consecutiveMediaErrors >= config.maxConsecutiveMediaErrors) {
    console.error("[SDX-TV][WATCHDOG] Muitas falhas consecutivas, recarregando página");
    location.reload();
  }
}

function startSlides() {
  let generation = 0;

  const showNext = async () => {
    const myGeneration = ++generation;
    const current = slides[slideIndex];
    if (!current) return;

    // Guarda de idempotência: garante que `advance` execute apenas uma vez
    // por slide, independente da origem (timer, evento `ended`, erro).
    let advanced = false;
    let safetyTimer = null;
    const advance = () => {
      if (advanced || myGeneration !== generation) return;
      advanced = true;
      window.clearTimeout(safetyTimer);
      window.clearTimeout(slideTimer);

      // Para o vídeo atual antes de remover para evitar que ele continue
      // baixando/decodificando em background e dispare eventos espúrios.
      const active = slideStageEl.querySelector("video.active-slide");
      if (active) {
        try {
          active.pause();
          active.removeAttribute("src");
          active.load();
        } catch (_) {}
      }

      slideIndex = (slideIndex + 1) % slides.length;
      showNext();
    };

    if (current.type === "video") {
      // Quando os metadados chegam, redefine o teto de segurança baseado na
      // duração real: 2x duração + 15s de folga para buffering em redes ruins.
      current._onMeta = (duration) => {
        const ceiling = Math.max(
          config.slideWindowMs.video,
          Math.round((duration || 0) * 2000) + 15000
        );
        window.clearTimeout(safetyTimer);
        safetyTimer = window.setTimeout(advance, ceiling);
      };

      const node = renderSlide(current, advance);
      node.addEventListener("playing", () => { consecutiveMediaErrors = 0; }, { once: true });
      node.addEventListener("error", () => registerMediaError(current, "video error"), { once: true });

      // Teto inicial enquanto os metadados ainda não chegaram.
      safetyTimer = window.setTimeout(advance, config.slideWindowMs.video);
      prefetchNext();
      return;
    }

    if (current.type === "image") {
      // O timer só começa depois que a imagem está decodificada: nada de quadro preto.
      let img = null;
      try {
        img = await preloadImage(current.src, config.imageLoadTimeoutMs);
      } catch (error) {
        if (myGeneration !== generation) return;
        registerMediaError(current, String(error.message || error));
        slideIndex = (slideIndex + 1) % slides.length;
        showNext();
        return;
      }
      if (myGeneration !== generation) return;
      consecutiveMediaErrors = 0;
      renderSlide(current, undefined, img);
      slideTimer = window.setTimeout(advance, config.slideWindowMs.image || 12000);
      prefetchNext();
      return;
    }

    renderSlide(current);
    const duration = config.slideWindowMs[current.type] || 12000;
    slideTimer = window.setTimeout(advance, duration);
    prefetchNext();
  };

  showNext();
}

function formatPublishedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Agora";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderNewsCard(item) {
  const card = document.createElement("article");
  const isHot = isCritical(item);
  const category = item.category || "environment";
  card.className = `news-card ${category}${isHot ? " critical" : ""}`;

  const tagLabel = isHot ? "Alerta" : categoryLabels[category] || "Notícia";

  card.innerHTML = `
    <span class="news-tag">${escapeHtml(tagLabel)}</span>
    <h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.summary || "Sem resumo.")}</p>
    <div class="meta">
      <span>${escapeHtml(item.source || "Fonte externa")}</span>
      <span>${formatPublishedAt(item.publishedAt)}</span>
    </div>
  `;

  return card;
}

function startNewsRotation(newsList) {
  if (!Array.isArray(newsList) || newsList.length === 0) {
    return;
  }

  const rotate = () => {
    const item = newsList[newsIndex % newsList.length];
    const nextCard = renderNewsCard(item);
    newsStageEl.appendChild(nextCard);
    nextCard.getBoundingClientRect();
    nextCard.classList.add("in");

    if (activeNewsCard) {
      const leaving = activeNewsCard;
      leaving.classList.remove("in");
      leaving.classList.add("out");
      window.setTimeout(() => leaving.remove(), 620);
    }

    activeNewsCard = nextCard;
    newsIndex += 1;

    const wait = isCritical(item) ? config.alertPriorityMs : config.newsCardMs;
    window.clearTimeout(newsRotationTimer);
    newsRotationTimer = window.setTimeout(rotate, wait);
  };

  rotate();
}

async function loadSlideConfig() {
  try {
    const response = await fetchWithTimeout(`data/slides.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    slidesEtag = text;
    const payload = JSON.parse(text);
    if (payload.config) {
      config = {
        ...defaultConfig,
        ...payload.config,
        slideWindowMs: {
          ...defaultConfig.slideWindowMs,
          ...(payload.config.slideWindowMs || {}),
        },
      };
    }
    const cleaned = Array.isArray(payload.slides) ? sanitizeSlides(payload.slides) : [];
    slides = cleaned.length > 0 ? cleaned : sanitizeSlides(FALLBACK_SLIDES);
  } catch (error) {
    console.warn("[SDX-TV][SLIDES] Falha ao carregar data/slides.json, usando fallback", error);
    slides = sanitizeSlides(FALLBACK_SLIDES);
  }
}

// Watchdog: recarrega quando o conteúdo muda no painel ou uma vez por dia em horário ocioso,
// evitando sessões de dias acumulando memória no navegador da TV.
function startWatchdog() {
  const refreshMs = Math.max(1, config.slidesRefreshMinutes) * 60000;
  window.setInterval(async () => {
    try {
      const response = await fetchWithTimeout(`data/slides.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) return;
      const text = await response.text();
      if (slidesEtag !== null && text !== slidesEtag) {
        console.info("[SDX-TV][WATCHDOG] slides.json alterado, recarregando");
        location.reload();
      }
    } catch (_) {}
  }, refreshMs);

  const bootDay = new Date().getDate();
  window.setInterval(() => {
    const now = new Date();
    if (now.getHours() === config.dailyReloadHour && now.getDate() !== bootDay) {
      console.info("[SDX-TV][WATCHDOG] reload diário");
      location.reload();
    }
  }, 60000);
}

// Modo ?preview=<src>: usado pelo painel admin para mostrar um único item no palco real,
// sem notícias nem watchdog (que recarregaria o iframe).
function readPreviewSlide() {
  let params;
  try {
    params = new URLSearchParams(location.search);
  } catch (_) {
    return null;
  }
  const src = params.get("preview");
  if (!src) return null;
  const type = params.get("type") === "video" || VIDEO_EXT.test(src) ? "video" : "image";
  const item = {
    type,
    title: params.get("title") || "Pré-visualização",
    subtitle: params.get("subtitle") || "",
    src,
    transition: params.get("transition") === "slide" ? "slide" : "fade",
  };
  if (type === "image" && params.get("kenburns") === "1") item.kenBurns = true;
  return isPlayableSlide(item) ? { ...item, src: normalizeSrc(src) } : null;
}

function startPreview(item) {
  slides = [item];
  startClock();
  startSlides();
  setStatus("Modo pré-visualização", "pending");
  const skeleton = newsStageEl.querySelector(".news-card.skeleton");
  if (skeleton) {
    skeleton.querySelector(".news-tag").textContent = "Preview";
    skeleton.querySelector("h3").textContent = "Pré-visualização do painel";
    skeleton.querySelector("p").textContent = "As notícias reais aparecem aqui na TV.";
  }
}

async function bootstrap() {
  await loadSlideConfig();

  const preview = readPreviewSlide();
  if (preview) {
    startPreview(preview);
    return;
  }

  startClock();
  startSlides();
  startWatchdog();

  const initialSkeleton = newsStageEl.querySelector(".news-card.skeleton");
  if (initialSkeleton) {
    activeNewsCard = initialSkeleton;
  }

  try {
    const news = await loadNews();
    startNewsRotation(news);
  } catch (error) {
    setStatus("Erro ao carregar notícias. Verifique a rede.", "warn");
    logNewsUpdate("Falha geral na carga de notícias", { error: String(error) });
  }

  window.setInterval(async () => {
    try {
      const news = await loadNews();
      newsIndex = 0;
      startNewsRotation(news);
    } catch (error) {
      logNewsUpdate("Falha na atualização periódica", { error: String(error) });
    }
  }, config.newsCacheMinutes * 60000);
}

bootstrap();
