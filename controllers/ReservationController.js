const repondreErreur = require("../utils/repondreErreur");

class ReservationController {
  constructor(reservationService) {
    this.service = reservationService;
  }

  selectionSeance = async (req, res) => {
    try {
      const resultat = await this.service.selectionnerSeance(req.body?.seanceId);
      return res.status(200).json({
        message: "Séance sélectionnée avec succès",
        ...resultat
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la récupération de la séance");
    }
  };

  informationsClient = (req, res) => {
    try {
      const client = this.service.validerInformationsClient(req.body);
      return res.status(200).json({
        message: "Informations client enregistrées avec succès",
        client
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur serveur");
    }
  };

  confirmer = async (req, res) => {
    try {
      const reservation = await this.service.confirmer(req.utilisateur.id, req.body);
      return res.status(201).json({
        message: "Réservation confirmée avec succès",
        reservation
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur interne du serveur");
    }
  };

  lister = async (req, res) => {
    try {
      const reservations = await this.service.lister();
      return res.status(200).json({
        message: "Liste des réservations récupérée avec succès",
        reservations
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur serveur");
    }
  };

  rechercher = async (req, res) => {
    try {
      const reservation = await this.service.rechercher(req.params.numero);
      return res.status(200).json({
        message: "Réservation trouvée avec succès",
        reservation
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur serveur");
    }
  };

  parSeance = async (req, res) => {
    try {
      const seanceId = parseInt(req.params.seanceId, 10);
      const reservations = await this.service.parSeance(seanceId);
      return res.status(200).json({
        message: "Réservations de la séance récupérées avec succès",
        seanceId,
        nombreReservations: reservations.length,
        reservations
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la récupération des réservations");
    }
  };

  annuler = async (req, res) => {
    try {
      const idReservation = parseInt(req.params.id, 10);
      const resultat = await this.service.annuler(idReservation, req.utilisateur);
      return res.status(200).json(resultat);
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de l'annulation de la réservation");
    }
  };
}

module.exports = ReservationController;