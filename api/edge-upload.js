// Edge Function — proxy de upload para GitHub Releases (sem limite de CORS, 25 MB de body)

async function verifyJWT(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const fixB64 = (s) => s.replace(/-/g, "+").replace(/_/g, "/").padEnd(s.length + (4 - (s.length % 4)) % 4, "=");
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(fixB64(sig)), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(`${header}.${payload}`));
    if (!valid) return null;
    const decoded = JSON.parse(atob(fixB64(payload)));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch (_) {
    return null;
  }
}

const TAG = "media-bucket";
const SEP = "--";

async function getOrCreateRelease(ghToken, owner, repo) {
  const headers = {
    Authorization: `Bearer ${ghToken}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "sdx-tv-admin",
  };
  const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${TAG}`, { headers });
  if (getRes.ok) return (await getRes.json()).id;
  if (getRes.status !== 404) throw new Error(`GitHub API ${getRes.status}`);
  const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ tag_name: TAG, name: "Media Bucket", body: "Storage de videos. Nao apague.", draft: false, prerelease: true }),
  });
  if (!createRes.ok) throw new Error(`GitHub create release ${createRes.status}`);
  return (await createRes.json()).id;
}

export default async function handler(request) {
  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

  if (request.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  const auth = request.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return json({ error: "Nao autenticado" }, 401);

  const jwtSecret = process.env.JWT_SECRET;
  const ghToken = process.env.GITHUB_TOKEN;
  const ghRepo = process.env.GITHUB_REPO;
  if (!jwtSecret || !ghToken || !ghRepo) return json({ error: "Variavel de ambiente ausente" }, 500);

  const user = await verifyJWT(match[1], jwtSecret);
  if (!user) return json({ error: "Nao autenticado" }, 401);

  const url = new URL(request.url);
  const folder = (url.searchParams.get("folder") || "misc").replace(/[^A-Za-z0-9._-]+/g, "_");
  const filename = (url.searchParams.get("filename") || "file").replace(/[^A-Za-z0-9._-]+/g, "_");
  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const [owner, repo] = ghRepo.split("/");

  try {
    const body = await request.arrayBuffer();
    const releaseId = await getOrCreateRelease(ghToken, owner, repo);
    const assetName = `${folder}${SEP}${Date.now()}_${filename}`;
    const uploadRes = await fetch(
      `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(assetName)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ghToken}`,
          "Content-Type": contentType,
          Accept: "application/vnd.github+json",
          "User-Agent": "sdx-tv-admin",
        },
        body,
      }
    );
    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      throw new Error(`GitHub upload ${uploadRes.status}: ${text.slice(0, 300)}`);
    }
    const asset = await uploadRes.json();
    return json({ url: asset.browser_download_url, id: asset.id, assetName, kind: "release" });
  } catch (error) {
    return json({ error: String(error.message || error) }, 500);
  }
}

export const config = { runtime: "edge" };
