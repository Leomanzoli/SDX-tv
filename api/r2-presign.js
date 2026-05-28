const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { requireAuth } = require("./_lib/auth");

function getClient() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID ou R2_SECRET_ACCESS_KEY ausente");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function sanitize(name) {
  return String(name).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 200) || "file";
}

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const bucket = process.env.R2_BUCKET;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicUrl) {
    return res.status(500).json({ error: "R2_BUCKET ou R2_PUBLIC_URL ausente" });
  }

  try {
    const client = getClient();

    if (req.method === "POST") {
      const { folder, filename, contentType } = req.body || {};
      if (!folder || !filename) {
        return res.status(400).json({ error: "folder e filename obrigatorios" });
      }
      const safeFolder = String(folder).replace(/^\/+|\/+$/g, "").replace(/\//g, "_");
      const key = `${safeFolder}/${Date.now()}_${sanitize(filename)}`;
      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType || "application/octet-stream",
      });
      const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 600 });
      return res.status(200).json({
        uploadUrl,
        publicUrl: `${publicUrl.replace(/\/$/, "")}/${key}`,
        key,
      });
    }

    if (req.method === "DELETE") {
      const { key } = req.body || {};
      if (!key) return res.status(400).json({ error: "key obrigatorio" });
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ error: "Metodo nao permitido" });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
};
