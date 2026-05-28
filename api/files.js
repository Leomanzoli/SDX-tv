const { requireAuth } = require("./_lib/auth");
const { listDir } = require("./_lib/github");
const { list } = require("@vercel/blob");

async function listBlobsForFolder(folder) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const prefix = `${folder}/`;
  const { blobs } = await list({
    prefix,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return blobs.map((b) => ({
    kind: "blob",
    name: b.pathname.slice(prefix.length).replace(/-[A-Za-z0-9]{10,}(\.[^.]+)?$/, "$1"),
    url: b.url,
    size: b.size,
    pathname: b.pathname,
  }));
}

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const folder = String(req.query.folder || "").replace(/[\\]/g, "");
  if (!folder) return res.status(400).json({ error: "?folder= obrigatorio" });

  try {
    const [repoFiles, blobFiles] = await Promise.all([
      listDir(`assets/${folder}`),
      listBlobsForFolder(folder),
    ]);

    const items = [
      ...repoFiles
        .filter((i) => i.type === "file" && i.name !== ".gitkeep")
        .map((i) => ({
          kind: "repo",
          name: i.name,
          path: i.path,
          sha: i.sha,
          size: i.size,
        })),
      ...blobFiles,
    ];

    return res.status(200).json({ files: items });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
};
