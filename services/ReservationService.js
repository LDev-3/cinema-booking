const ErreurHttp = require("../utils/ErreurHttp");

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class ReservationService {
  constructor(reservationRepository) {
    this.repository = reservationRepository;
  }

  async selectionnerSeance(seanceId) {
    const id = parseInt(seanceId, 10);

    if (!seanceId || isNaN(id)) {
      throw new ErreurHttp(400, "Veuillez sélectionner une séance valide");
    }

    const { data: seance, error } = await this.repository.seancePourSelection(id);

    if (error) {
      console.error("Erreur Supabase :", error.message);
      throw new ErreurHttp(500, "Erreur lors de la récupération de la séance");
    }

    if (!seance) {
      throw new ErreurHttp(404, "Séance introuvable");
    }

    return {
      film: seance.films?.titre,
      seance: {
        id: seance.id,
        date: seance.date_seance,
        heure: seance.heure,
        salle: seance.salles?.nom,
        capacite: seance.capacite,
        statut: seance.statut,
        places: seance.places
      }
    };
  }

  validerInformationsClient({ nom, prenom, email, telephone } = {}) {
    if (!nom || !prenom || !email || !telephone) {
      throw new ErreurHttp(400, "Veuillez renseigner toutes les informations");
    }

    if (!REGEX_EMAIL.test(email)) {
      throw new ErreurHttp(400, "Adresse e-mail invalide");
    }

    return { nom, prenom, email, telephone };
  }

  async confirmer(utilisateurId, { seanceId, placesIds, telephone } = {}) {
    if (
      !Number.isInteger(Number(utilisateurId)) ||
      !seanceId ||
      !Array.isArray(placesIds) ||
      placesIds.length === 0 ||
      !placesIds.every((id) => Number.isInteger(id)) ||
      typeof telephone !== "string" ||
      !telephone.trim()
    ) {
      throw new ErreurHttp(400, "Informations de réservation invalides ou incomplètes");
    }

    const { data: utilisateur, error: erreurUtilisateur } =
      await this.repository.trouverUtilisateur(utilisateurId);

    if (erreurUtilisateur || !utilisateur) {
      throw new ErreurHttp(404, "Utilisateur introuvable");
    }

    const { data, error } = await this.repository.confirmer({
      p_seance_id: Number(seanceId),
      p_places_ids: placesIds,
      p_nom: utilisateur.nom,
      p_prenom: utilisateur.prenom,
      p_email: utilisateur.email,
      p_telephone: telephone.trim(),
      p_utilisateur_id: Number(utilisateur.id)
    });

    if (error) {
      console.error("Erreur Supabase :", error);

      if (error.message.includes("Séance introuvable")) {
        throw new ErreurHttp(404, "Séance introuvable");
      }

      if (error.message.includes("place")) {
        throw new ErreurHttp(400, error.message);
      }

      throw new ErreurHttp(500, "Erreur lors de la confirmation de la réservation");
    }

    return data;
  }

  async lister() {
    const { data, error } = await this.repository.lister();

    if (error) {
      throw new ErreurHttp(500, "Erreur lors de la récupération des réservations");
    }

    return data;
  }

  async rechercher(numero) {
    const { data: reservation, error } =
      await this.repository.rechercherParNumero(numero.toUpperCase());

    if (error) {
      throw error;
    }

    if (!reservation) {
      throw new ErreurHttp(404, "Réservation introuvable");
    }

    return reservation;
  }

  async parSeance(seanceId) {
    if (!Number.isInteger(seanceId) || seanceId <= 0) {
      throw new ErreurHttp(400, "Identifiant de séance invalide");
    }

    const { data, error } = await this.repository.parSeance(seanceId);

    if (error) {
      throw error;
    }

    return data;
  }

  async annuler(idReservation, utilisateur) {
    if (!Number.isInteger(idReservation) || idReservation <= 0) {
      throw new ErreurHttp(400, "Identifiant de réservation invalide");
    }

    const { data, error } = await this.repository.annuler({
      p_reservation_id: idReservation,
      p_utilisateur_id: utilisateur.id,
      p_est_admin: utilisateur.role === "admin"
    });

    if (error) {
      if (error.message.includes("introuvable")) {
        throw new ErreurHttp(404, error.message);
      }

      if (error.message.includes("ne pouvez pas") || error.message.includes("propriétaire")) {
        throw new ErreurHttp(403, error.message);
      }

      if (error.message.includes("déjà annulée")) {
        throw new ErreurHttp(400, error.message);
      }

      throw error;
    }

    return data;
  }
}

module.exports = ReservationService;