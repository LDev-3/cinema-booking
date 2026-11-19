const ErreurHttp = require("../utils/ErreurHttp");

class StatistiqueService {
  constructor(statistiqueRepository) {
    this.repository = statistiqueRepository;
  }

  async seancesProchesSaturation() {
    const { data, error } = await this.repository.seancesAvecPlaces();

    if (error) {
      console.error("Erreur Supabase :", error.message);
      throw new ErreurHttp(500, "Erreur lors du calcul des statistiques");
    }

    return data
      .map((seance) => {
        const capacite = seance.places.length;
        const placesReservees = seance.places.filter(
          (place) => place.statut === "reservee"
        ).length;
        const tauxRemplissage = capacite > 0 ? (placesReservees / capacite) * 100 : 0;

        return {
          film: seance.films?.titre,
          seanceId: seance.id,
          salle: seance.salles?.nom,
          capacite,
          placesReservees,
          tauxRemplissage: Number(tauxRemplissage.toFixed(2))
        };
      })
      .filter((seance) => seance.tauxRemplissage >= 80);
  }

  // Compte les réservations non annulées, regroupées par une clé de la séance
  async reservationsParCritere(colonne, transformer = (valeur) => valeur) {
    const { data: reservations, error: erreurReservations } =
      await this.repository.reservations();

    if (erreurReservations) {
      throw new ErreurHttp(500, "Erreur lors de la récupération des réservations");
    }

    const { data: seances, error: erreurSeances } = await this.repository.seances(colonne);

    if (erreurSeances) {
      throw new ErreurHttp(500, "Erreur lors de la récupération des séances");
    }

    const compteurs = {};

    reservations
      .filter((reservation) => reservation.statut !== "annulee")
      .forEach((reservation) => {
        const seance = seances.find((s) => s.id === reservation.seance_id);

        if (seance) {
          const cle = transformer(seance[colonne]);
          compteurs[cle] = (compteurs[cle] || 0) + 1;
        }
      });

    return Object.entries(compteurs).map(([cle, nombreReservations]) => ({
      cle,
      nombreReservations
    }));
  }

  trier(liste) {
    return liste.sort((a, b) => b.nombreReservations - a.nombreReservations);
  }

  async horairesPlusDemandes() {
    const liste = await this.reservationsParCritere("heure");
    return this.trier(liste.map(({ cle, nombreReservations }) => ({
      horaire: cle,
      nombreReservations
    })));
  }

  async journeesPlusFrequentees() {
    const liste = await this.reservationsParCritere("date_seance");
    return this.trier(liste.map(({ cle, nombreReservations }) => ({
      date: cle,
      nombreReservations
    })));
  }

  async periodesForteAffluence() {
    const liste = await this.reservationsParCritere("date_seance", (date) =>
      date.substring(0, 7)
    );
    return this.trier(liste.map(({ cle, nombreReservations }) => ({
      periode: cle,
      nombreReservations
    })));
  }
}

module.exports = StatistiqueService;