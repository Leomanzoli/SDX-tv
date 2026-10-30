// Agregador RSS/Atom sem dependências, compartilhado pelo endpoint Vercel (api/news.js)
// e pelo script do GitHub Actions (scripts/fetch-news.js).

const SOURCES = [
  { name: "Agência Brasil – Saúde", url: "https://agenciabrasil.ebc.com.br/rss/saude/feed.xml" },
  { name: "Agência Brasil – Meio Ambiente", url: "https://agenciabrasil.ebc.com.br/rss/meio-ambiente/feed.xml" },
  {
    name: "Notícias – Segurança do Trabalho",
    url: "https://news.google.com/rss/search?q=%28%22sa%C3%BAde+ocupacional%22+OR+%22acidente+de+trabalho%22+OR+%22sa%C3%BAde+e+seguran%C3%A7a+do+trabalho%22%29&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
  {
    name: "Notícias – Meio Ambiente Brasil",
    url: "https://news.google.com/rss/search?q=meio+ambiente+brasil&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  },
];

const FETCH_TIMEOUT_MS = 8000;
const MAX_PER_SOURCE = 12;

function decodeEntities(text) {
  return String(text)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function atomLink(block) {
  const alternate = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  const any = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return decodeEntities((alternate || any || [])[1] || "");
}

function stripHtml(html) {
  return decodeEntities(String(html).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim().slice(0, 600);
}

function parseFeed(xml) {
  const items = [];
  const rssItems = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
  for (const block of rssItems) {
    items.push({
      title: tag(block, "title"),
      link: tag(block, "link") || (block.match(/<guid[^>]*>(https?:[^<]+)<\/guid>/i) || [])[1] || "",
      description: stripHtml(tag(block, "description") || tag(block, "content:encoded")),
      pubDate: tag(block, "pubDate") || tag(block, "dc:date"),
    });
  }
  if (items.length === 0) {
    const entries = xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
    for (const block of entries) {
      items.push({
        title: tag(block, "title"),
        link: atomLink(block),
        description: stripHtml(tag(block, "summary") || tag(block, "content")),
        pubDate: tag(block, "published") || tag(block, "updated"),
      });
    }
  }
  return items.filter((item) => item.title && item.link).slice(0, MAX_PER_SOURCE);
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SDX-TV/1.0)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    return parseFeed(xml).map((item) => ({ ...item, source: source.name }));
  } finally {
    clearTimeout(timer);
  }
}

async function aggregateNews() {
  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const items = [];
  const errors = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") items.push(...result.value);
    else errors.push({ source: SOURCES[index].name, error: String(result.reason?.message || result.reason) });
  });
  return { fetchedAt: new Date().toISOString(), items, errors };
}

module.exports = { SOURCES, parseFeed, fetchSource, aggregateNews };
