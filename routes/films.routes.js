const express = require("express");
const supabase = require("../supabase");
const { verifierToken, verifierAdmin } = require("../middlewares/auth");
const FilmRepository = require("../repositories/FilmRepository");
const FilmService = require("../services/FilmService");
const FilmController = require("../controllers/FilmController");

const router = express.Router();

const controller = new FilmController(
  new FilmService(new FilmRepository(supabase))
);

router.get("/", controller.lister);
router.post("/", verifierToken, verifierAdmin, controller.creer);
router.get("/recherche", controller.rechercher);
router.get("/:id", controller.detail);
router.delete("/:id", verifierToken, verifierAdmin, controller.supprimer);
router.patch("/:id/desactiver", verifierToken, verifierAdmin, controller.desactiver);
router.get("/:id/seances", controller.listerSeances);

module.exports = router;