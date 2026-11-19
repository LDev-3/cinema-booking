const repondreErreur = require("../utils/repondreErreur");

class SalleController {
  constructor(salleService) {
    this.service = salleService;
  }

  lister = async (req, res) => {
    try {
      const salles = await this.service.lister();
      return res.status(200).json({
        message: "Liste des salles récupérée avec succès",
        salles
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur serveur");
    }
  };

  modifierCapacite = async (req, res) => {
    try {
      const nomSalle = decodeURIComponent(req.params.nom);
      const { capacite } = req.body;

      await this.service.modifierCapacite(nomSalle, capacite);

      return res.status(200).json({
        message: "Capacité de la salle modifiée avec succès",
        salle: nomSalle,
        capacite
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors de la modification de la capacité");
    }
  };
}

module.exports = SalleController;