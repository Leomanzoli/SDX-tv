const { requireAuth } = require("./_lib/auth");
const { putFile, listDir, deleteTree } = require("./_lib/github");

function sanitizeName(name) {
  return String(name)
    .replace(/[\\/]/g, "-")
    .replace(/\.{2,}/g, "")
    .trim();
}

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method === "GET") {
    try {
      const items = await listDir("assets");
      return res.status(200).json({
        folders: items.filter((i) => i.type === "dir").map((i) => i.name),
      });
    } catch (error) {
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  if (req.method === "POST") {
    const { folder } = req.body || {};
    if (!folder) return res.status(400).json({ error: "folder obrigatório" });
    const path = `assets/${sanitizeName(folder)}/.gitkeep`;
    try {
      await putFile({
        path,
        contentBase64: Buffer.from("", "utf8").toString("base64"),
        message: `admin(${user.u}): cria pasta assets/${sanitizeName(folder)}`,
      });
      return res.status(200).json({ ok: true, folder: sanitizeName(folder) });
    } catch (error) {
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  if (req.method === "DELETE") {
    const { folder } = req.body || {};
    if (!folder) return res.status(400).json({ error: "folder obrigatório" });
    const path = `assets/${sanitizeName(folder)}`;
    try {
      await deleteTree({ path, message: `admin(${user.u}): remove pasta ${path}` });
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ error: "Método não permitido" });
};
