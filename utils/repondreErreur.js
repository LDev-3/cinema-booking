const ErreurHttp = require("./ErreurHttp");

// Erreur métier (400, 401, 404, 409...) : on renvoie son code et son message.
// Toute autre erreur (base de données, bug) : 500 avec un message générique.
function repondreErreur(res, error, messageParDefaut) {
  if (error instanceof ErreurHttp) {
    return res.status(error.statut).json({ message: error.message });
  }

  console.error(`${messageParDefaut} :`, error);
  return res.status(500).json({ message: messageParDefaut });
}

module.exports = repondreErreur;