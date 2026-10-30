#!/usr/bin/env node
// Gera data/news.json a partir das fontes RSS. Usado pelo GitHub Actions antes do deploy do Pages.
// Uso: node scripts/fetch-news.js

const fs = require("fs");
const path = require("path");
const { aggregateNews } = require("../api/_lib/rss");

const OUT = path.resolve(__dirname, "..", "data", "news.json");

async function main() {
  const payload = await aggregateNews();
  if (payload.items.length === 0) {
    console.error("Nenhuma notícia obtida; mantendo data/news.json anterior.", payload.errors);
    process.exit(fs.existsSync(OUT) ? 0 : 1);
  }
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
  console.log(`data/news.json: ${payload.items.length} itens de ${new Set(payload.items.map((i) => i.source)).size} fontes`);
  for (const err of payload.errors) console.warn("Fonte falhou:", err.source, err.error);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
