const express = require("express");
const supabase = require("../supabase");
const { verifierToken } = require("../middlewares/auth");
const UtilisateurRepository = require("../repositories/UtilisateurRepository");
const UtilisateurService = require("../services/UtilisateurService");
const UtilisateurController = require("../controllers/UtilisateurController");

const router = express.Router();

const controller = new UtilisateurController(
  new UtilisateurService(new UtilisateurRepository(supabase))
);

router.post("/inscription", controller.inscription);
router.post("/connexion", controller.connexion);
router.get("/mes-reservations", verifierToken, controller.mesReservations);
router.get("/mes-billets", verifierToken, controller.mesBillets);
router.get("/mes-informations", verifierToken, controller.profil);
router.put("/mes-informations", verifierToken, controller.modifierProfil);
router.put("/changer-mot-de-passe", verifierToken, controller.changerMotDePasse);
router.get("/mes-notifications", verifierToken, controller.notifications);
router.put("/notifications/:id/lue", verifierToken, controller.marquerNotificationLue);

module.exports = router;