const express = require("express");
const supabase = require("../supabase");
const { verifierToken, verifierAdmin } = require("../middlewares/auth");
const ReservationRepository = require("../repositories/ReservationRepository");
const ReservationService = require("../services/ReservationService");
const ReservationController = require("../controllers/ReservationController");

const router = express.Router();

const controller = new ReservationController(
  new ReservationService(new ReservationRepository(supabase))
);

router.get("/", verifierToken, verifierAdmin, controller.lister);
router.get("/recherche/:numero", verifierToken, verifierAdmin, controller.rechercher);
router.get("/seance/:seanceId", verifierToken, verifierAdmin, controller.parSeance);
router.post("/selection-seance", controller.selectionSeance);
router.post("/informations-client", controller.informationsClient);
router.post("/confirmer", verifierToken, controller.confirmer);
router.put("/:id/annuler", verifierToken, controller.annuler);

module.exports = router;