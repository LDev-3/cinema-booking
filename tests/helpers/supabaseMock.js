// Simulateur de Supabase pour les tests : aucune vraie base n'est appelée.
// Chaque appel à supabase.from(...) ou supabase.rpc(...) consomme le résultat
// suivant de la file d'attente, dans l'ordre où la route interroge la base.

const resultats = [];
const appels = [];

const ok = (data = null) => ({ data, error: null });
const ko = (message = "Erreur simulée", extra = {}) => ({
  data: null,
  error: { message, ...extra }
});
const lance = (erreur) => ({ throws: erreur });

function enqueue(...liste) {
  resultats.push(...liste);
}

function reinitialiser() {
  resultats.length = 0;
  appels.length = 0;
}

function prochainResultat() {
  const suivant = resultats.shift();
  if (suivant && suivant.throws) {
    throw suivant.throws;
  }
  return suivant || ok(null);
}

function creerRequete(resultat, appel) {
  const requete = {};

  [
    "select", "insert", "update", "delete",
    "eq", "neq", "ilike", "order", "limit",
    "single", "maybeSingle"
  ].forEach((nom) => {
    requete[nom] = (...args) => {
      appel.methodes.push([nom, args]);
      return requete;
    };
  });

  // Permet d'écrire : const { data, error } = await requete
  requete.then = (resolve, reject) =>
    Promise.resolve(resultat).then(resolve, reject);

  return requete;
}

const supabase = {
  from(table) {
    const appel = { type: "from", nom: table, methodes: [] };
    appels.push(appel);
    return creerRequete(prochainResultat(), appel);
  },
  rpc(nom, args) {
    const appel = { type: "rpc", nom, args, methodes: [] };
    appels.push(appel);
    return creerRequete(prochainResultat(), appel);
  }
};

module.exports = { supabase, enqueue, reinitialiser, appels, ok, ko, lance };
