const { requireAuth } = require("./_lib/auth");
const { getRepoConfig } = require("./_lib/github");

const TAG = "media-bucket";
const SEP = "--";

async function getOrCreateRelease(octokit, owner, repo) {
  try {
    const { data } = await octokit.repos.getReleaseByTag({ owner, repo, tag: TAG });
    return data;
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  const { data } = await octokit.repos.createRelease({
    owner,
    repo,
    tag_name: TAG,
    name: "Media Bucket",
    body: "Storage automatico de videos grandes do painel SDX-tv. Nao apague.",
    draft: false,
    prerelease: true,
  });
  return data;
}

function sanitizeAssetName(name) {
  return String(name)
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 200) || "file";
}

module.exports = async (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;

  if (req.method === "POST") {
    const { folder, filename } = req.body || {};
    if (!folder || !filename) {
      return res.status(400).json({ error: "folder e filename obrigatorios" });
    }

    try {
      const { owner, repo, octokit } = getRepoConfig();
      const release = await getOrCreateRelease(octokit, owner, repo);

      const folderTag = sanitizeAssetName(folder);
      const safe = sanitizeAssetName(filename);
      const assetName = `${folderTag}${SEP}${Date.now()}_${safe}`;

      const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${release.id}/assets?name=${encodeURIComponent(assetName)}`;

      return res.status(200).json({
        uploadUrl,
        githubToken: process.env.GITHUB_TOKEN,
        assetName,
        releaseId: release.id,
      });
    } catch (error) {
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  if (req.method === "DELETE") {
    const { assetId } = req.body || {};
    if (!assetId) return res.status(400).json({ error: "assetId obrigatorio" });
    try {
      const { owner, repo, octokit } = getRepoConfig();
      await octokit.repos.deleteReleaseAsset({ owner, repo, asset_id: Number(assetId) });
      return res.status(200).json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: String(error.message || error) });
    }
  }

  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).json({ error: "Metodo nao permitido" });
};

module.exports.TAG = TAG;
module.exports.SEP = SEP;
