const { handleUpload } = require("@vercel/blob/client");
const { del } = require("@vercel/blob");
const { verifyRequest, requireAuth } = require("./_lib/auth");

function sanitize(name) {
  return String(name)
    .replace(/[^A-Za-z0-9._/-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 200) || "file";
}

module.exports = async (req, res) => {
  if (req.method === "DELETE") {
    const user = requireAuth(req, res);
    if (!user) return;
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: "url obrigatoria" });
    try {
      await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  try {
    const body = req.body;
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let payload = {};
        try {
          payload = clientPayload ? JSON.parse(clientPayload) : {};
        } catch (_) {}
        const fakeReq = { headers: { authorization: `Bearer ${payload.token || ""}` } };
        const user = verifyRequest(fakeReq);
        if (!user) throw new Error("Nao autenticado");
        const folder = sanitize(payload.folder || "misc");
        return {
          allowedContentTypes: ["video/*", "image/*", "application/octet-stream"],
          maximumSizeInBytes: 2 * 1024 * 1024 * 1024,
          tokenPayload: JSON.stringify({ user: user.u, folder }),
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return res.status(200).json(jsonResponse);
  } catch (error) {
    return res.status(400).json({ error: String(error.message || error) });
  }
};
