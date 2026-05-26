const config = {
  slideWindowMs: {
    image: 12000,
    // Imagens têm tempo fixo. Para vídeos usamos o evento `ended` do <video>,
    // mas mantemos um teto de segurança caso o stream trave em redes ruins.
    video: 90000,
    message: 12000,
  },
  // Tempo máximo aguardando buffer antes de pular para o próximo slide.
  videoBufferTimeoutMs: 8000,
  newsCardMs: 10000,
  alertPriorityMs: 45000,
  newsCacheMinutes: 20,
};

// Gera a sequência 1.jpg..16.jpg para manter a ordem das inspeções no loop.
const inspectionSlides = Array.from({ length: 16 }, (_, index) => {
  const number = index + 1;
  return {
    type: "image",
    title: `Inspeções · Slide ${number}`,
    subtitle: "Checklist e evidências de campo",
    src: `assets/Inspeções/${number}.jpg`,
    transition: "fade",
    kenBurns: true,
  };
});

const slides = [
  {
    type: "image",
    title: "Panorama CRM",
    subtitle: "Comunicação de rotina operacional",
    src: "assets/CRM/CRM_1.png",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "image",
    title: "Indicadores N3",
    subtitle: "Visibilidade em tempo real para equipes",
    src: "assets/N3/N3_1.png",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "image",
    title: "Indicadores N3 · Continuação",
    subtitle: "Acompanhamento diário com foco em prevenção",
    src: "assets/N3/N3_2.png",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "image",
    title: "Painel N3",
    subtitle: "Visão consolidada de desempenho",
    src: "assets/N3/Painel.png",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "image",
    title: "Painel N3 · Detalhamento",
    subtitle: "Análise operacional por frente",
    src: "assets/N3/Painel 2.png",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "video",
    title: "Kaizens em Movimento",
    subtitle: "Boas práticas em ação",
    src: "assets/Kaizens/1.Video 1.mp4",
    transition: "slide",
  },
  {
    type: "video",
    title: "Kaizens · Edição 2",
    subtitle: "Evolução contínua com segurança",
    src: "assets/Kaizens/2.Video 2.mp4",
    transition: "slide",
  },
  {
    type: "image",
    title: "Resumo Kaizens",
    subtitle: "Resultados e próximos ciclos",
    src: "assets/Kaizens/0.Slide.png",
    transition: "fade",
    kenBurns: true,
  },
  // Conteúdos complementares já disponíveis no repositório.
  {
    type: "video",
    title: "Pílulas de Segurança",
    subtitle: "Princípios de incêndios em correias",
    src: "assets/Pilulas/Princípios de incêndios em correias_horizontal.mp4",
    transition: "slide",
  },
  {
    type: "image",
    title: "Saúde em Foco",
    subtitle: "Conteúdo de bem-estar ocupacional",
    src: "assets/Saúde/01.png",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "image",
    title: "Inspeções · Painel 1",
    subtitle: "Resumo visual de inspeções",
    src: "assets/Inspeções/0.Painel 1.png",
    transition: "fade",
    kenBurns: true,
  },
  {
    type: "image",
    title: "Inspeções · Painel 2",
    subtitle: "Acompanhamento das evidências",
    src: "assets/Inspeções/0.Painel 2.png",
    transition: "fade",
    kenBurns: true,
  },
  ...inspectionSlides,
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
      const response = await fetch(endpoint, { headers: { Accept: "application/xml,text/xml" } });
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
      const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
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
  const response = await fetch("data/news-fallback.json");
  if (!response.ok) {
    throw new Error("Fallback indisponível");
  }

  return response.json();
}

async function loadNews() {
  setStatus("Atualizando fontes externas...", "pending");
  logNewsUpdate("Iniciando atualização");

  const fromCache = readNewsCache(config.newsCacheMinutes);
  if (fromCache.length > 0) {
    logNewsUpdate("Cache válido encontrado", { count: fromCache.length });
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
    logNewsUpdate("Atualização via RSS concluída", { count: unique.length });
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

function renderSlide(item, onVideoEnded) {
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
    node = document.createElement("img");
    node.src = item.src;
    node.alt = item.title;
    node.className = "active-slide";
    // Dica ao navegador para decodificar de forma assíncrona, evitando travas.
    node.decoding = "async";
    node.loading = "eager";
    attachMediaErrorFallback(node);
    if (item.kenBurns) {
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
    slideProgressBarEl.style.width = "0%";
    void slideProgressBarEl.offsetWidth;
    slideProgressBarEl.style.transition = `width ${duration}ms linear`;
    slideProgressBarEl.style.width = "100%";
  }

  if (old) {
    window.setTimeout(() => {
      if (old.parentNode === slideStageEl) old.remove();
    }, 820);
  }

  return node;
}

// Prefetch leve: dispara o download do próximo vídeo em segundo plano
// enquanto o slide atual ainda está sendo exibido. Como o navegador
// armazena em cache HTTP, ao trocar de slide o vídeo já estará disponível.
let prefetchEl = null;
function prefetchNextVideo() {
  const next = slides[(slideIndex) % slides.length];
  if (!next || next.type !== "video") return;

  if (prefetchEl) {
    prefetchEl.remove();
    prefetchEl = null;
  }

  const v = document.createElement("video");
  v.src = next.src;
  v.preload = "auto";
  v.muted = true;
  v.playsInline = true;
  v.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;";
  document.body.appendChild(v);
  v.load();
  prefetchEl = v;
}

function startSlides() {
  const showNext = () => {
    const current = slides[slideIndex];

    // Guarda de idempotência: garante que `advance` execute apenas uma vez
    // por slide, independente da origem (timer, evento `ended`, erro).
    let advanced = false;
    let safetyTimer = null;
    const advance = () => {
      if (advanced) return;
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
      prefetchNextVideo();
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

      renderSlide(current, advance);

      // Teto inicial enquanto os metadados ainda não chegaram.
      safetyTimer = window.setTimeout(advance, config.slideWindowMs.video);
      prefetchNextVideo();
    } else {
      renderSlide(current);
      const duration = config.slideWindowMs[current.type] || 12000;
      slideTimer = window.setTimeout(advance, duration);
      prefetchNextVideo();
    }
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

function preloadVideos() {
  // Substituído pelo prefetch sob demanda em `prefetchNextVideo()`.
  // Baixar todos os vídeos no boot saturava a banda e fazia os clipes
  // travarem ou começarem pela metade em redes de menor qualidade.
}

async function bootstrap() {
  startClock();
  preloadVideos();
  startSlides();

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
