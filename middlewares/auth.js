const jwt = require("jsonwebtoken");

function verifierToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentification requise" });
  }

  const token = authorization.split(" ")[1];

  try {
    req.utilisateur = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Token invalide ou expiré" });
  }
}

function verifierAdmin(req, res, next) {
  if (!req.utilisateur || req.utilisateur.role !== "admin") {
    return res.status(403).json({ message: "Accès réservé aux administrateurs" });
  }

  next();
}

module.exports = { verifierToken, verifierAdmin };