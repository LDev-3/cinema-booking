const express = require("express");
const supabase = require("../supabase");
const { verifierToken, verifierAdmin } = require("../middlewares/auth");
const FilmRepository = require("../repositories/FilmRepository");
const SalleRepository = require("../repositories/SalleRepository");
const SeanceRepository = require("../repositories/SeanceRepository");
const SeanceService = require("../services/SeanceService");
const SeanceController = require("../controllers/SeanceController");

const controller = new SeanceController(
  new SeanceService(
    new SeanceRepository(supabase),
    new SalleRepository(supabase),
    new FilmRepository(supabase)
  )
);

// Routes montées sur /seances
const seancesRouter = express.Router();

seancesRouter.get("/:id/places/reservees", controller.placesReservees);
seancesRouter.get("/:id/places/etat", controller.etat);
seancesRouter.get("/:id/places", controller.places);
seancesRouter.get("/:id", controller.detail);
seancesRouter.put("/:id/salle", verifierToken, verifierAdmin, controller.changerSalle);
seancesRouter.put("/:id", verifierToken, verifierAdmin, controller.modifier);
seancesRouter.patch("/:id/annuler", verifierToken, verifierAdmin, controller.annuler);

// Route montée sur /films : création d'une séance pour un film
const seancesParFilmRouter = express.Router();

seancesParFilmRouter.post("/:id/seances", verifierToken, verifierAdmin, controller.creer);

module.exports = { seancesRouter, seancesParFilmRouter };