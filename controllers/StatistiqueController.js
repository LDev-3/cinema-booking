const repondreErreur = require("../utils/repondreErreur");

class StatistiqueController {
  constructor(statistiqueService) {
    this.service = statistiqueService;
  }

  seancesProchesSaturation = async (req, res) => {
    try {
      const seances = await this.service.seancesProchesSaturation();
      return res.status(200).json({
        message: "Séances proches de la saturation récupérées avec succès",
        nombreSeances: seances.length,
        seances
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur lors du calcul des statistiques");
    }
  };

  horairesPlusDemandes = async (req, res) => {
    try {
      const horaires = await this.service.horairesPlusDemandes();
      return res.status(200).json({
        message: "Horaires les plus demandés récupérés avec succès",
        horaires
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur serveur");
    }
  };

  journeesPlusFrequentees = async (req, res) => {
    try {
      const journees = await this.service.journeesPlusFrequentees();
      return res.status(200).json({
        message: "Journées les plus fréquentées récupérées avec succès",
        journees
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur serveur");
    }
  };

  periodesForteAffluence = async (req, res) => {
    try {
      const periodes = await this.service.periodesForteAffluence();
      return res.status(200).json({
        message: "Périodes de forte affluence récupérées avec succès",
        periodes
      });
    } catch (error) {
      return repondreErreur(res, error, "Erreur serveur");
    }
  };
}

module.exports = StatistiqueController;