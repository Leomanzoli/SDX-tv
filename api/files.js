const { requireAuth } = require("./_lib/auth");
const { listDir } = require("./_lib/github");

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const folder = String(req.query.folder || "").replace(/[\\]/g, "");
  if (!folder) return res.status(400).json({ error: "?folder= obrigatório" });

  try {
    const items = await listDir(`assets/${folder}`);
    return res.status(200).json({
      files: items.filter((i) => i.type === "file" && i.name !== ".gitkeep"),
    });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
};
