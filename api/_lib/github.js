const { Octokit } = require("@octokit/rest");

function getRepoConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token) throw new Error("GITHUB_TOKEN ausente nas variáveis de ambiente");
  if (!repo || !repo.includes("/")) throw new Error("GITHUB_REPO ausente ou inválido (esperado dono/repo)");
  const [owner, name] = repo.split("/");
  const branch = process.env.GITHUB_BRANCH || "main";
  return { owner, repo: name, branch, octokit: new Octokit({ auth: token }) };
}

async function getFile(path) {
  const { owner, repo, branch, octokit } = getRepoConfig();
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    if (Array.isArray(data)) return null;
    return {
      sha: data.sha,
      content: Buffer.from(data.content, "base64").toString("utf8"),
    };
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function listDir(path) {
  const { owner, repo, branch, octokit } = getRepoConfig();
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path, ref: branch });
    if (!Array.isArray(data)) return [];
    return data.map((entry) => ({
      name: entry.name,
      path: entry.path,
      type: entry.type,
      size: entry.size,
      sha: entry.sha,
    }));
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }
}

async function putFile({ path, contentBase64, message, sha }) {
  const { owner, repo, branch, octokit } = getRepoConfig();
  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    branch,
    message,
    content: contentBase64,
    sha,
  });
  return data;
}

async function deleteFile({ path, message, sha }) {
  const { owner, repo, branch, octokit } = getRepoConfig();
  const { data } = await octokit.repos.deleteFile({ owner, repo, path, branch, message, sha });
  return data;
}

async function deleteTree({ path, message }) {
  const items = await listDir(path);
  for (const item of items) {
    if (item.type === "dir") {
      await deleteTree({ path: item.path, message });
    } else {
      await deleteFile({ path: item.path, message, sha: item.sha });
    }
  }
}

module.exports = { getFile, listDir, putFile, deleteFile, deleteTree, getRepoConfig };
