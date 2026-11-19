const repondreErreur = require("../utils/repondreErreur");

class UtilisateurController {
  constructor(utilisateurService) {
    this.service = utilisateurService;
  }

  inscription = async (req, res) => {
    try {
      const utilisateur = await this.service.inscrire(req.body);
      return res.status(201).json({
        message: "Compte utilisateur créé avec succès",
        utilisateur
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la création du compte");
    }
  };

  connexion = async (req, res) => {
    try {
      const resultat = await this.service.connecter(req.body);
      return res.status(200).json({ message: "Connexion réussie", ...resultat });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la connexion");
    }
  };

  mesReservations = async (req, res) => {
    try {
      const reservations = await this.service.mesReservations(req.utilisateur.email);
      return res.status(200).json({ message: "Liste de vos réservations", reservations });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la récupération de vos réservations");
    }
  };

  mesBillets = async (req, res) => {
    try {
      const billets = await this.service.mesBillets(req.utilisateur.email);
      return res.status(200).json({ message: "Liste de vos billets", billets });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la récupération de vos billets");
    }
  };

  profil = async (req, res) => {
    try {
      const utilisateur = await this.service.profil(req.utilisateur.id);
      return res.status(200).json({
        message: "Informations personnelles récupérées avec succès",
        utilisateur
      });
    } catch (error) {
      return repondreErreur(
        res,
        error,
        "Erreur lors de la récupération des informations personnelles"
      );
    }
  };

  modifierProfil = async (req, res) => {
    try {
      const utilisateur = await this.service.modifierProfil(req.utilisateur.id, req.body);
      return res.status(200).json({
        message: "Informations personnelles modifiées avec succès",
        utilisateur
      });
    } catch (error) {
      return repondreErreur(
        res,
        error,
        "Erreur lors de la modification des informations personnelles"
      );
    }
  };

  changerMotDePasse = async (req, res) => {
    try {
      await this.service.changerMotDePasse(req.utilisateur.id, req.body);
      return res.status(200).json({ message: "Mot de passe modifié avec succès" });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors du changement de mot de passe");
    }
  };

  notifications = async (req, res) => {
    try {
      const notifications = await this.service.notifications(req.utilisateur.id);
      return res.status(200).json({ message: "Liste de vos notifications", notifications });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la récupération des notifications");
    }
  };

  marquerNotificationLue = async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const notification = await this.service.marquerNotificationLue(id, req.utilisateur.id);
      return res.status(200).json({ message: "Notification marquée comme lue", notification });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la mise à jour de la notification");
    }
  };
}

module.exports = UtilisateurController;