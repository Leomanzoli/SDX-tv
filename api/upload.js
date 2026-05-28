const { requireAuth } = require("./_lib/auth");
const { putFile, deleteFile, getFile } = require("./_lib/github");

function sanitizeName(name) {
  return String(name)
    .replace(/[\\/]/g, "-")
    .replace(/\.{2,}/g, "")
    .trim();
}

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method === "POST") {
    const { folder, filename, contentBase64 } = req.body || {};
    if (!folder || !filename || !contentBase64) {
      return res.status(400).json({ error: "folder, filename e contentBase64 obrigatórios" });
    }
    if (contentBase64.length > 6_000_000) {
      return res.status(413).json({ error: "Arquivo muito grande (limite ~4 MB no Vercel Hobby). Use arquivos menores." });
    }

    const path = `assets/${sanitizeName(folder)}/${sanitizeName(filename)}`;
    try {
      const result = await putFile({
        path,
        contentBase64,
        message: `admin(${user.u}): adiciona ${path}`,
      });
      return res.status(200).json({ path, sha: result.content.sha, commit: result.commit.sha });
    } catch (error) {
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  if (req.method === "DELETE") {
    const { path } = req.body || {};
    if (!path || !path.startsWith("assets/")) {
      return res.status(400).json({ error: "path inválido (precisa começar com assets/)" });
    }
    try {
      const file = await getFile(path);
      if (!file) return res.status(404).json({ error: "Arquivo não encontrado" });
      await deleteFile({
        path,
        sha: file.sha,
        message: `admin(${user.u}): remove ${path}`,
      });
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).json({ error: "Método não permitido" });
};
