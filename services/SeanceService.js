const ErreurHttp = require("../utils/ErreurHttp");
const genererPlaces = require("../utils/genererPlaces");

const SEANCE_INTROUVABLE = "Séance introuvable";
const SALLE_INTROUVABLE = "Salle introuvable";
const SALLE_OCCUPEE = "Cette salle est déjà utilisée à cet horaire";
const INFORMATIONS_INVALIDES = "Les informations de la séance sont invalides";

function verifierIdentifiant(id) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new ErreurHttp(400, "Identifiant de séance invalide");
  }
}

class SeanceService {
  constructor(seanceRepository, salleRepository, filmRepository) {
    this.seanceRepository = seanceRepository;
    this.salleRepository = salleRepository;
    this.filmRepository = filmRepository;
  }

  // Lit une séance avec la requête voulue et gère les erreurs communes
  async charger(requete, id, messageErreur) {
    verifierIdentifiant(id);

    const { data: seance, error } = await requete(id);

    if (error) {
      console.error("Erreur Supabase :", error.message);
      throw new ErreurHttp(500, messageErreur);
    }

    if (!seance) {
      throw new ErreurHttp(404, SEANCE_INTROUVABLE);
    }

    return seance;
  }

  async detail(id) {
    const seance = await this.charger(
      (i) => this.seanceRepository.trouverDetail(i),
      id,
      "Erreur lors de la récupération de la séance"
    );

    return {
      id: seance.id,
      film: seance.films?.titre,
      salle: seance.salles?.nom,
      date: seance.date_seance,
      heure: seance.heure,
      capacite: seance.capacite,
      places: seance.places
    };
  }

  async places(id) {
    const seance = await this.charger(
      (i) => this.seanceRepository.trouverAvecPlaces(i),
      id,
      "Erreur lors de la récupération des places"
    );

    return { seanceId: seance.id, salle: seance.salles?.nom, places: seance.places };
  }

  async placesReservees(id) {
    const seance = await this.charger(
      (i) => this.seanceRepository.trouverAvecPlaces(i),
      id,
      "Erreur lors de la récupération des places"
    );

    return {
      seanceId: seance.id,
      salle: seance.salles?.nom,
      placesReservees: (seance.places || []).filter((place) => place.statut === "reservee")
    };
  }

  async etat(id) {
    const seance = await this.charger(
      (i) => this.seanceRepository.trouverEtat(i),
      id,
      "Erreur lors de la récupération des places"
    );

    const placesDisponibles = seance.places.filter((place) => place.statut === "disponible");
    const placesOccupees = seance.places.filter((place) => place.statut === "reservee");

    return {
      seanceId: seance.id,
      salle: seance.salles?.nom,
      capacite: seance.capacite,
      nombrePlacesDisponibles: placesDisponibles.length,
      nombrePlacesOccupees: placesOccupees.length,
      placesDisponibles,
      placesOccupees
    };
  }

  async creer(filmId, { date, heure, salle, capacite } = {}) {
    if (!Number.isInteger(filmId) || filmId <= 0) {
      throw new ErreurHttp(400, "Identifiant du film invalide");
    }

    if (!date || !heure || !salle || capacite === undefined) {
      throw new ErreurHttp(400, "Tous les champs sont obligatoires");
    }

    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof heure !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(heure) ||
      typeof salle !== "string" ||
      !salle.trim() ||
      !Number.isInteger(capacite) ||
      capacite <= 0
    ) {
      throw new ErreurHttp(400, INFORMATIONS_INVALIDES);
    }

    const { data: film, error: erreurFilm } = await this.filmRepository.existe(filmId);

    if (erreurFilm || !film) {
      throw new ErreurHttp(404, "Film introuvable");
    }

    const { data: salleTrouvee, error: erreurSalle } =
      await this.salleRepository.trouverParNom(salle.trim());

    if (erreurSalle || !salleTrouvee) {
      throw new ErreurHttp(404, SALLE_INTROUVABLE);
    }

    if (capacite > salleTrouvee.capacite) {
      throw new ErreurHttp(400, "La capacité dépasse celle de la salle");
    }

    const { data: conflit, error: erreurConflit } =
      await this.seanceRepository.conflitHoraire(salleTrouvee.id, date, heure);

    if (erreurConflit) {
      throw erreurConflit;
    }

    if (conflit.length > 0) {
      throw new ErreurHttp(409, SALLE_OCCUPEE);
    }

    const { data: nouvelleSeance, error: erreurCreation } =
      await this.seanceRepository.creer({
        film_id: filmId,
        salle_id: salleTrouvee.id,
        date_seance: date,
        heure,
        capacite
      });

    if (erreurCreation) {
      throw erreurCreation;
    }

    const { error: erreurPlaces } = await this.seanceRepository.insererPlaces(
      genererPlaces(nouvelleSeance.id, capacite)
    );

    if (erreurPlaces) {
      // Supprimer la séance si la création des places échoue
      const { error: erreurSuppression } =
        await this.seanceRepository.supprimer(nouvelleSeance.id);

      if (erreurSuppression) {
        console.error("Erreur lors du nettoyage :", erreurSuppression);
      }

      throw erreurPlaces;
    }

    return { ...nouvelleSeance, salle: salleTrouvee.nom };
  }

  async modifier(id, { date, heure, salle, capacite } = {}) {
    verifierIdentifiant(id);

    if (!date || !heure || !salle || !Number.isInteger(capacite) || capacite <= 0) {
      throw new ErreurHttp(400, INFORMATIONS_INVALIDES);
    }

    const { data: salleTrouvee, error: erreurSalle } =
      await this.salleRepository.trouverParNom(salle.trim());

    if (erreurSalle || !salleTrouvee) {
      throw new ErreurHttp(404, SALLE_INTROUVABLE);
    }

    const { data, error } = await this.seanceRepository.modifier({
      p_seance_id: id,
      p_date_seance: date,
      p_heure: heure,
      p_salle_id: salleTrouvee.id,
      p_capacite: capacite
    });

    if (error) {
      console.error("Erreur modification séance :", error);

      if (error.message.includes("introuvable")) {
        throw new ErreurHttp(404, error.message);
      }

      if (error.message.includes("capacité") || error.message.includes("utilisée")) {
        throw new ErreurHttp(400, error.message);
      }

      throw error;
    }

    return data;
  }

  async changerSalle(id, salle) {
    verifierIdentifiant(id);

    if (typeof salle !== "string" || !salle.trim()) {
      throw new ErreurHttp(400, "Le nom de la salle est obligatoire");
    }

    const { data: seance, error: erreurSeance } = await this.seanceRepository.trouverParId(id);

    if (erreurSeance || !seance) {
      throw new ErreurHttp(404, SEANCE_INTROUVABLE);
    }

    const { data: salleTrouvee, error: erreurSalle } =
      await this.salleRepository.trouverParNom(salle.trim());

    if (erreurSalle || !salleTrouvee) {
      throw new ErreurHttp(404, SALLE_INTROUVABLE);
    }

    const { data: autreSeance, error: erreurConflit } =
      await this.seanceRepository.conflitHoraireHorsSeance(
        salleTrouvee.id,
        seance.date_seance,
        seance.heure,
        id
      );

    if (erreurConflit) {
      throw erreurConflit;
    }

    if (autreSeance.length > 0) {
      throw new ErreurHttp(409, SALLE_OCCUPEE);
    }

    const { error } = await this.seanceRepository.changerSalle(id, salleTrouvee.id);

    if (error) {
      throw error;
    }

    return { seanceId: id, salle: salleTrouvee.nom };
  }

  async annuler(id) {
    verifierIdentifiant(id);

    const { data: seance, error: erreurSeance } = await this.seanceRepository.trouverParId(id);

    if (erreurSeance || !seance) {
      throw new ErreurHttp(404, SEANCE_INTROUVABLE);
    }

    if (seance.statut === "annulee") {
      throw new ErreurHttp(400, "Cette séance est déjà annulée");
    }

    const { data: seanceAnnulee, error } = await this.seanceRepository.annuler(id);

    if (error) {
      throw error;
    }

    return seanceAnnulee;
  }
}

module.exports = SeanceService;