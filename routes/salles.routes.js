const express = require("express");
const supabase = require("../supabase");
const { verifierToken, verifierAdmin } = require("../middlewares/auth");
const SalleRepository = require("../repositories/SalleRepository");
const SeanceRepository = require("../repositories/SeanceRepository");
const SalleService = require("../services/SalleService");
const SalleController = require("../controllers/SalleController");

const router = express.Router();

const controller = new SalleController(
  new SalleService(new SalleRepository(supabase), new SeanceRepository(supabase))
);

router.get("/", controller.lister);
router.put("/:nom/capacite", verifierToken, verifierAdmin, controller.modifierCapacite);

module.exports = router;