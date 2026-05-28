const { requireAuth } = require("./_lib/auth");
const { getFile, putFile } = require("./_lib/github");

const SLIDES_PATH = "data/slides.json";

module.exports = async (req, res) => {
  if (req.method === "GET") {
    try {
      const file = await getFile(SLIDES_PATH);
      if (!file) return res.status(404).json({ error: "slides.json não encontrado" });
      return res.status(200).json({ sha: file.sha, data: JSON.parse(file.content) });
    } catch (error) {
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  if (req.method === "PUT") {
    const user = requireAuth(req, res);
    if (!user) return;

    const { sha, data } = req.body || {};
    if (!sha || !data || !Array.isArray(data.slides)) {
      return res.status(400).json({ error: "sha e data.slides são obrigatórios" });
    }

    try {
      const json = JSON.stringify(data, null, 2) + "\n";
      const result = await putFile({
        path: SLIDES_PATH,
        contentBase64: Buffer.from(json, "utf8").toString("base64"),
        message: `admin(${user.u}): atualiza slides.json`,
        sha,
      });
      return res.status(200).json({ sha: result.content.sha, commit: result.commit.sha });
    } catch (error) {
      if (error.status === 409) {
        return res.status(409).json({ error: "Conflito: alguém atualizou antes. Recarregue o painel." });
      }
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ error: "Método não permitido" });
};
