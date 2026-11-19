const ErreurHttp = require("../utils/ErreurHttp");
const genererPlaces = require("../utils/genererPlaces");

class SalleService {
  constructor(salleRepository, seanceRepository) {
    this.salleRepository = salleRepository;
    this.seanceRepository = seanceRepository;
  }

  async lister() {
    const { data, error } = await this.salleRepository.lister();

    if (error) {
      console.error("Erreur Supabase :", error.message);
      throw new ErreurHttp(500, "Erreur lors de la récupération des salles");
    }

    return data;
  }

  async modifierCapacite(nomSalle, capacite) {
    if (!Number.isInteger(capacite) || capacite <= 0) {
      throw new ErreurHttp(400, "La capacité doit être un entier positif");
    }

    const { data: salle, error: erreurSalle } =
      await this.salleRepository.trouverParNom(nomSalle);

    if (erreurSalle) {
      throw erreurSalle;
    }

    if (!salle) {
      throw new ErreurHttp(404, "Salle introuvable");
    }

    const { data: seances, error: erreurSeances } =
      await this.seanceRepository.seancesDeSalle(salle.id);

    if (erreurSeances) {
      throw erreurSeances;
    }

    if (!seances || seances.length === 0) {
      throw new ErreurHttp(404, "Aucune séance trouvée pour cette salle");
    }

    // 1. Vérifier que la nouvelle capacité couvre les places déjà réservées
    for (const seance of seances) {
      const { data: reservees, error } =
        await this.seanceRepository.placesReservees(seance.id);

      if (error) {
        throw error;
      }

      if (capacite < reservees.length) {
        throw new ErreurHttp(
          400,
          "La capacité ne peut pas être inférieure au nombre de places réservées"
        );
      }
    }

    // 2. Mettre à jour chaque séance en gardant les places réservées
    for (const seance of seances) {
      const { error } = await this.seanceRepository.mettreAJourCapacite(seance.id, capacite);

      if (error) {
        throw error;
      }

      const { error: erreurSuppression } =
        await this.seanceRepository.supprimerPlacesDisponibles(seance.id);

      if (erreurSuppression) {
        throw erreurSuppression;
      }

      const { data: reservees, error: erreurReservees } =
        await this.seanceRepository.placesReserveesDetail(seance.id);

      if (erreurReservees) {
        throw erreurReservees;
      }

      const dejaReservees = new Set(reservees.map((p) => `${p.rangee}-${p.numero}`));
      const nouvellesPlaces = genererPlaces(seance.id, capacite, dejaReservees);

      if (nouvellesPlaces.length > 0) {
        const { error: erreurInsertion } =
          await this.seanceRepository.insererPlaces(nouvellesPlaces);

        if (erreurInsertion) {
          throw erreurInsertion;
        }
      }
    }
  }
}

module.exports = SalleService;