const { requireAuth } = require("./_lib/auth");
const { listDir, getRepoConfig } = require("./_lib/github");

const TAG = "media-bucket";
const SEP = "--";

async function listReleaseAssetsForFolder(folder) {
  const { owner, repo, octokit } = getRepoConfig();
  try {
    const { data: release } = await octokit.repos.getReleaseByTag({ owner, repo, tag: TAG });
    const { data: assets } = await octokit.repos.listReleaseAssets({
      owner,
      repo,
      release_id: release.id,
      per_page: 100,
    });
    const prefix = folder + SEP;
    return assets
      .filter((a) => a.name.startsWith(prefix))
      .map((a) => ({
        kind: "release",
        id: a.id,
        name: a.name.slice(prefix.length).replace(/^\d+_/, ""),
        url: a.browser_download_url,
        size: a.size,
        contentType: a.content_type,
      }));
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }
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
    const [repoFiles, releaseFiles] = await Promise.all([
      listDir(`assets/${folder}`),
      listReleaseAssetsForFolder(folder),
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
      ...releaseFiles,
    ];

    return res.status(200).json({ files: items });
  } catch (error) {
    return res.status(500).json({ error: String(error.message || error) });
  }
};
