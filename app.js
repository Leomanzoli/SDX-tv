const config = {
  slideWindowMs: {
    image: 12000,
    video: 14000,
    message: 12000,
  },
  newsCardMs: 10000,
  alertPriorityMs: 45000,
  newsCacheMinutes: 20,
};

// Gera a sequência 1.jpg..17.jpg para manter a ordem das inspeções no loop.
const inspectionSlides = Array.from({ length: 17 }, (_, index) => {
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
    type: "video",
    title: "Kaizens em Movimento",
    subtitle: "Boas práticas em ação",
    src: "assets/Kaizens/Video 1.mp4",
    transition: "slide",
  },
  {
    type: "video",
    title: "Kaizens · Edição 2",
    subtitle: "Evolução contínua com segurança",
    src: "assets/Kaizens/Video 2.mp4",
    transition: "slide",
  },
  {
    type: "image",
    title: "Resumo Kaizens",
    subtitle: "Resultados e próximos ciclos",
    src: "assets/Kaizens/Slide.png",
    transition: "fade",
    kenBurns: true,
  },
  ...inspectionSlides,
];


const rssSources = [
  {
    name: "WHO",
    url: "https://www.who.int/rss-feeds/news-english.xml",
  },
  {
    name: "ILO",
    url: "https://www.ilo.org/global/about-the-ilo/newsroom/news/WCMS_008009/lang--en/index.htm?output=rss",
  },
  {
    name: "UNEP",
    url: "https://www.unep.org/news-and-stories/rss.xml",
  },
];

const cacheKey = "sdx-tv-news-cache-v1";
const statusEl = document.getElementById("news-status");
const slideStageEl = document.getElementById("slide-stage");
const slideTitleEl = document.getElementById("slide-title");
const slideSubtitleEl = document.getElementById("slide-subtitle");
const newsStageEl = document.getElementById("news-stage");

let slideIndex = 0;
let newsIndex = 0;
let newsRotationTimer = null;
let activeNewsCard = null;
let slideTimer = null;

function setStatus(text, type = "pending") {
  statusEl.textContent = text;
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
      weekday: "short",
      day: "2-digit",
      month: "long",
      year: "numeric",
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

function classifyCategory(title) {
  const raw = `${title}`.toLowerCase();
  if (/warning|alert|fatal|incident|acidente|risco/.test(raw)) {
    return "safety";
  }

  if (/health|occup|sa[úu]de|disease|worker/.test(raw)) {
    return "health";
  }

  if (/climate|environment|ambient|esg|res[íi]duo|emission/.test(raw)) {
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
    .map((item) => ({
      title: item.title.trim(),
      link: item.link.trim(),
      source: sourceName,
      summary: item.description?.replace(/<[^>]*>/g, " ").trim() || "Sem resumo disponível.",
      publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
      category: classifyCategory(item.title),
    }));
}

function allowedHost(url) {
  try {
    const host = new URL(url).hostname;
    const whitelist = ["who.int", "ilo.org", "unep.org", "gov.br"];
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
  const normal = [];

  for (const item of items) {
    if (isCritical(item)) {
      critical.push(item);
    } else {
      normal.push(item);
    }
  }

  return [...critical, ...normal];
}

function renderSlide(item) {
  const old = slideStageEl.firstElementChild;
  slideStageEl.classList.remove("fade", "slide");
  slideStageEl.classList.add(item.transition || "fade");

  let node;
  if (item.type === "image") {
    node = document.createElement("img");
    node.src = item.src;
    node.alt = item.title;
    node.className = "active-slide";
    if (item.kenBurns) {
      node.classList.add("ken-burns");
    }
  } else if (item.type === "video") {
    node = document.createElement("video");
    node.src = item.src;
    node.autoplay = true;
    node.muted = true;
    node.loop = true;
    node.playsInline = true;
    node.className = "active-slide";
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

  if (old) {
    window.setTimeout(() => {
      if (old.parentNode === slideStageEl) old.remove();
    }, 820);
  }
}

function startSlides() {
  const showNext = () => {
    const current = slides[slideIndex];
    renderSlide(current);

    const duration = config.slideWindowMs[current.type] || 12000;
    slideIndex = (slideIndex + 1) % slides.length;

    window.clearTimeout(slideTimer);
    slideTimer = window.setTimeout(showNext, duration);
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
  card.className = `news-card ${item.category || "environment"}${isHot ? " critical" : ""}`;

  card.innerHTML = `
    <h3>${escapeHtml(item.title)}</h3>
    <p>${escapeHtml(item.summary || "Sem resumo.")}</p>
    <div class="meta">
      <span>${escapeHtml(item.source || "Fonte externa")}</span>
      <span>${formatPublishedAt(item.publishedAt)}</span>
    </div>
    <a class="news-link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Abrir fonte</a>
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

async function bootstrap() {
  startClock();
  startSlides();

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
