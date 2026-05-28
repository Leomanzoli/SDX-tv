const bcrypt = require("bcryptjs");
const { sign } = require("./_lib/auth");

function getUsers() {
  const raw = process.env.ADMIN_USERS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Usuário e senha obrigatórios" });
  }

  const users = getUsers();
  const user = users.find((u) => u.u === username);
  if (!user) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const ok = await bcrypt.compare(password, user.hash || "");
  if (!ok) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const token = sign({ u: user.u });
  return res.status(200).json({ token, user: { username: user.u } });
};
