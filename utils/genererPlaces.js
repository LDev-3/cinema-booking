// Génère les places d'une séance : 10 places par rangée (A1..A10, B1..B10...)
function genererPlaces(seanceId, capacite, exclues = new Set()) {
  const places = [];

  for (let i = 0; i < capacite; i++) {
    const rangee = String.fromCharCode(65 + Math.floor(i / 10));
    const numero = (i % 10) + 1;

    if (!exclues.has(`${rangee}-${numero}`)) {
      places.push({ seance_id: seanceId, rangee, numero, statut: "disponible" });
    }
  }

  return places;
}

module.exports = genererPlaces;