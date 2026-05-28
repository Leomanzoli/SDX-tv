const jwt = require("jsonwebtoken");

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET ausente nas variáveis de ambiente");
  return secret;
}

function sign(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: "12h" });
}

function verifyRequest(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return jwt.verify(match[1], getSecret());
  } catch (_) {
    return null;
  }
}

function requireAuth(req, res) {
  const user = verifyRequest(req);
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return null;
  }
  return user;
}

module.exports = { sign, verifyRequest, requireAuth };
