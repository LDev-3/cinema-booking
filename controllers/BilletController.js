const repondreErreur = require("../utils/repondreErreur");

class BilletController {
  constructor(billetService) {
    this.service = billetService;
  }

  generer = async (req, res) => {
    try {
      const reservationId = Number.parseInt(req.params.id, 10);
      const billet = await this.service.generer(reservationId);
      return res.status(201).json({ message: "Billet généré avec succès", billet });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la génération du billet");
    }
  };

  qrCode = async (req, res) => {
    try {
      const resultat = await this.service.genererQrCode(req.params.numero);
      return res.status(200).json({
        message: "QR code généré avec succès",
        ...resultat
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la génération du QR code");
    }
  };

  valider = async (req, res) => {
    try {
      const billet = await this.service.valider(req.params.numero);
      return res.status(200).json({
        message: "Billet validé avec succès. Accès autorisé.",
        billet
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la validation du billet");
    }
  };
}

module.exports = BilletController;