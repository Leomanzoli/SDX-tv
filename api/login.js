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
  if (users.length === 0) {
    return res.status(401).json({ error: "DIAG: ADMIN_USERS vazio ou JSON invalido" });
  }
  const user = users.find((u) => u.u === username);
  if (!user) {
    return res.status(401).json({ error: `DIAG: usuario '${username}' nao encontrado. Cadastrados: ${users.map((u) => u.u).join(", ")}` });
  }

  const ok = await bcrypt.compare(password, user.hash || "");
  if (!ok) {
    return res.status(401).json({ error: "DIAG: senha incorreta para esse usuario" });
  }

  const token = sign({ u: user.u });
  return res.status(200).json({ token, user: { username: user.u } });
};
