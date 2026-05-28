const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { requireAuth } = require("./_lib/auth");
const { listDir } = require("./_lib/github");

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function listR2ForFolder(folder) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!client || !bucket || !publicUrl) return [];

  const prefix = `${folder}/`;
  const { Contents = [] } = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
  );
  const base = publicUrl.replace(/\/$/, "");
  return Contents.map((obj) => {
    const name = obj.Key.slice(prefix.length).replace(/^\d+_/, "");
    return {
      kind: "r2",
      key: obj.Key,
      name,
      url: `${base}/${obj.Key}`,
      size: obj.Size,
    };
  });
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
    const [repoFiles, r2Files] = await Promise.all([
      listDir(`assets/${folder}`),
      listR2ForFolder(folder),
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
      ...r2Files,
    ];

    return res.status(200).json({ files: items });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
};
