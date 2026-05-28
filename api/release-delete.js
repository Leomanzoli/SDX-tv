const { requireAuth } = require("./_lib/auth");
const { getRepoConfig } = require("./_lib/github");

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method !== "DELETE") {
    res.setHeader("Allow", "DELETE");
    return res.status(405).json({ error: "Metodo nao permitido" });
  }

  const { assetId } = req.body || {};
  if (!assetId) return res.status(400).json({ error: "assetId obrigatorio" });

  try {
    const { owner, repo, octokit } = getRepoConfig();
    await octokit.repos.deleteReleaseAsset({ owner, repo, asset_id: Number(assetId) });
    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
};
