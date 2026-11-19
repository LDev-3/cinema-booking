const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ErreurHttp = require("../utils/ErreurHttp");

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MESSAGE_IDENTIFIANTS = "Email ou mot de passe incorrect";
const MESSAGE_EMAIL_UTILISE = "Cette adresse email est déjà utilisée";
const MESSAGE_UTILISATEUR_INTROUVABLE = "Utilisateur introuvable";

class UtilisateurService {
  constructor(utilisateurRepository) {
    this.repository = utilisateurRepository;
  }

  async inscrire({ nom, prenom, email, motDePasse } = {}) {
    if (
      typeof nom !== "string" ||
      typeof prenom !== "string" ||
      typeof email !== "string" ||
      typeof motDePasse !== "string" ||
      !nom.trim() ||
      !prenom.trim() ||
      !email.trim() ||
      !motDePasse
    ) {
      throw new ErreurHttp(400, "Tous les champs sont obligatoires");
    }

    if (!REGEX_EMAIL.test(email.trim())) {
      throw new ErreurHttp(400, "Adresse email invalide");
    }

    if (motDePasse.length < 8) {
      throw new ErreurHttp(400, "Le mot de passe doit contenir au moins 8 caractères");
    }

    const emailNormalise = email.trim().toLowerCase();

    const { data: existant, error: erreurRecherche } =
      await this.repository.trouverIdParEmail(emailNormalise);

    if (erreurRecherche) {
      throw erreurRecherche;
    }

    if (existant) {
      throw new ErreurHttp(409, MESSAGE_EMAIL_UTILISE);
    }

    const motDePasseHache = await bcrypt.hash(motDePasse, 10);

    const { data: utilisateur, error } = await this.repository.creer({
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: emailNormalise,
      mot_de_passe: motDePasseHache,
      role: "utilisateur"
    });

    if (error) {
      if (error.code === "23505") {
        throw new ErreurHttp(409, MESSAGE_EMAIL_UTILISE);
      }
      throw error;
    }

    return {
      id: utilisateur.id,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      email: utilisateur.email,
      role: utilisateur.role,
      dateCreation: utilisateur.date_creation
    };
  }

  async connecter({ email, motDePasse } = {}) {
    if (
      typeof email !== "string" ||
      typeof motDePasse !== "string" ||
      !email.trim() ||
      !motDePasse
    ) {
      throw new ErreurHttp(400, "L'email et le mot de passe sont obligatoires");
    }

    const { data: utilisateur, error } =
      await this.repository.trouverParEmail(email.trim().toLowerCase());

    if (error) {
      throw error;
    }

    if (!utilisateur) {
      throw new ErreurHttp(401, MESSAGE_IDENTIFIANTS);
    }

    const motDePasseCorrect = await bcrypt.compare(motDePasse, utilisateur.mot_de_passe);

    if (!motDePasseCorrect) {
      throw new ErreurHttp(401, MESSAGE_IDENTIFIANTS);
    }

    const token = jwt.sign(
      { id: utilisateur.id, email: utilisateur.email, role: utilisateur.role },
      process.env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    return {
      token,
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.role
      }
    };
  }

  async mesReservations(email) {
    const { data: reservations, error } =
      await this.repository.reservationsParEmail(email.toLowerCase());

    if (error) {
      throw error;
    }

    return reservations.map((reservation) => ({
      id: reservation.id,
      numeroReservation: reservation.numero_reservation,
      seanceId: reservation.seance_id,
      client: {
        nom: reservation.nom,
        prenom: reservation.prenom,
        email: reservation.email,
        telephone: reservation.telephone
      },
      places: reservation.reservation_places.map((association) => association.places),
      dateReservation: reservation.date_reservation,
      statut: reservation.statut
    }));
  }

  async mesBillets(email) {
    const { data: billets, error } =
      await this.repository.billetsParEmail(email.toLowerCase());

    if (error) {
      throw error;
    }

    return billets.map((billet) => {
      const reservation = billet.reservations;

      return {
        id: billet.id,
        numeroBillet: billet.numero_billet,
        reservationId: reservation.id,
        numeroReservation: reservation.numero_reservation,
        client: {
          nom: reservation.nom,
          prenom: reservation.prenom,
          email: reservation.email,
          telephone: reservation.telephone
        },
        seanceId: reservation.seance_id,
        places: reservation.reservation_places.map((association) => association.places),
        dateGeneration: billet.date_generation,
        statut: billet.statut,
        dateUtilisation: billet.date_utilisation
      };
    });
  }

  async profil(id) {
    const { data: utilisateur, error } = await this.repository.trouverProfil(id);

    if (error) {
      throw error;
    }

    if (!utilisateur) {
      throw new ErreurHttp(404, MESSAGE_UTILISATEUR_INTROUVABLE);
    }

    return utilisateur;
  }

  async modifierProfil(id, { nom, prenom, email } = {}) {
    if (
      typeof nom !== "string" ||
      typeof prenom !== "string" ||
      typeof email !== "string" ||
      !nom.trim() ||
      !prenom.trim() ||
      !email.trim()
    ) {
      throw new ErreurHttp(400, "Tous les champs sont obligatoires");
    }

    const emailNormalise = email.trim().toLowerCase();

    if (!REGEX_EMAIL.test(emailNormalise)) {
      throw new ErreurHttp(400, "Adresse email invalide");
    }

    const { data: emailExistant, error: erreurRecherche } =
      await this.repository.emailUtiliseParAutre(emailNormalise, id);

    if (erreurRecherche) {
      throw erreurRecherche;
    }

    if (emailExistant) {
      throw new ErreurHttp(409, MESSAGE_EMAIL_UTILISE);
    }

    const { data: utilisateur, error } = await this.repository.mettreAJourInformations(id, {
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: emailNormalise
    });

    if (error) {
      throw error;
    }

    if (!utilisateur) {
      throw new ErreurHttp(404, MESSAGE_UTILISATEUR_INTROUVABLE);
    }

    return utilisateur;
  }

  async changerMotDePasse(id, { ancienMotDePasse, nouveauMotDePasse } = {}) {
    if (!ancienMotDePasse || !nouveauMotDePasse) {
      throw new ErreurHttp(400, "Les deux mots de passe sont obligatoires");
    }

    if (nouveauMotDePasse.length < 8) {
      throw new ErreurHttp(400, "Le nouveau mot de passe doit contenir au moins 8 caractères");
    }

    const { data: utilisateur, error } = await this.repository.trouverMotDePasse(id);

    if (error) {
      throw error;
    }

    if (!utilisateur) {
      throw new ErreurHttp(404, MESSAGE_UTILISATEUR_INTROUVABLE);
    }

    const motDePasseCorrect = await bcrypt.compare(ancienMotDePasse, utilisateur.mot_de_passe);

    if (!motDePasseCorrect) {
      throw new ErreurHttp(401, "Ancien mot de passe incorrect");
    }

    const nouveauHache = await bcrypt.hash(nouveauMotDePasse, 10);
    const { error: erreurMaj } = await this.repository.mettreAJourMotDePasse(id, nouveauHache);

    if (erreurMaj) {
      throw erreurMaj;
    }
  }

  async notifications(utilisateurId) {
    const { data: notifications, error } =
      await this.repository.notificationsParUtilisateur(utilisateurId);

    if (error) {
      throw error;
    }

    return notifications.map((notification) => ({
      id: notification.id,
      utilisateurId: notification.utilisateur_id,
      message: notification.message,
      date: notification.date,
      lu: notification.lu
    }));
  }

  async marquerNotificationLue(id, utilisateurId) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new ErreurHttp(400, "Identifiant de notification invalide");
    }

    const { data: notification, error } =
      await this.repository.marquerNotificationLue(id, utilisateurId);

    if (error) {
      throw error;
    }

    if (!notification) {
      throw new ErreurHttp(404, "Notification introuvable");
    }

    return notification;
  }
}

module.exports = UtilisateurService;