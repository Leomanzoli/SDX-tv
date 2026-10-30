const { aggregateNews } = require("./_lib/rss");

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = { at: 0, payload: null };

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const fresh = cache.payload && Date.now() - cache.at < CACHE_TTL_MS;
  let payload = fresh ? cache.payload : null;
  if (!payload) {
    payload = await aggregateNews();
    // Se todas as fontes falharem agora, mantém o último resultado bom.
    if (payload.items.length === 0 && cache.payload?.items?.length) {
      payload = { ...cache.payload, stale: true, errors: payload.errors };
    } else {
      cache = { at: Date.now(), payload };
    }
  }

  res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1800, max-age=60");
  return res.status(200).json(payload);
};
