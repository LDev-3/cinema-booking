const express = require("express");
const supabase = require("../supabase");
const { verifierToken, verifierAdmin } = require("../middlewares/auth");
const StatistiqueRepository = require("../repositories/StatistiqueRepository");
const StatistiqueService = require("../services/StatistiqueService");
const StatistiqueController = require("../controllers/StatistiqueController");

const router = express.Router();

const controller = new StatistiqueController(
  new StatistiqueService(new StatistiqueRepository(supabase))
);

router.get("/seances-proches-saturation", verifierToken, verifierAdmin, controller.seancesProchesSaturation);
router.get("/horaires-plus-demandes", verifierToken, verifierAdmin, controller.horairesPlusDemandes);
router.get("/journees-plus-frequentees", verifierToken, verifierAdmin, controller.journeesPlusFrequentees);
router.get("/periodes-forte-affluence", verifierToken, verifierAdmin, controller.periodesForteAffluence);

module.exports = router;