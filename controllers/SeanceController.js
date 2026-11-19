const repondreErreur = require("../utils/repondreErreur");

const idDe = (req) => parseInt(req.params.id, 10);

class SeanceController {
  constructor(seanceService) {
    this.service = seanceService;
  }

  detail = async (req, res) => {
    try {
      return res.status(200).json(await this.service.detail(idDe(req)));
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la récupération de la séance");
    }
  };

  places = async (req, res) => {
    try {
      return res.status(200).json(await this.service.places(idDe(req)));
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la récupération des places");
    }
  };

  placesReservees = async (req, res) => {
    try {
      return res.status(200).json(await this.service.placesReservees(idDe(req)));
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la récupération des places");
    }
  };

  etat = async (req, res) => {
    try {
      const etat = await this.service.etat(idDe(req));
      return res.status(200).json({
        message: "État des places récupéré avec succès",
        ...etat
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la récupération des places");
    }
  };

  creer = async (req, res) => {
    try {
      const seance = await this.service.creer(idDe(req), req.body);
      return res.status(201).json({ message: "Séance créée avec succès", seance });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la création de la séance");
    }
  };

  modifier = async (req, res) => {
    try {
      return res.status(200).json(await this.service.modifier(idDe(req), req.body));
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la modification de la séance");
    }
  };

  changerSalle = async (req, res) => {
    try {
      const resultat = await this.service.changerSalle(idDe(req), req.body.salle);
      return res.status(200).json({
        message: "Salle associée à la séance avec succès",
        ...resultat
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors du changement de salle");
    }
  };

  annuler = async (req, res) => {
    try {
      const seance = await this.service.annuler(idDe(req));
      return res.status(200).json({ message: "Séance annulée avec succès", seance });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de l'annulation de la séance");
    }
  };
}

module.exports = SeanceController;