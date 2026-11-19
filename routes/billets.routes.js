const express = require("express");
const supabase = require("../supabase");
const { verifierToken, verifierAdmin } = require("../middlewares/auth");
const BilletRepository = require("../repositories/BilletRepository");
const ReservationRepository = require("../repositories/ReservationRepository");
const BilletService = require("../services/BilletService");
const BilletController = require("../controllers/BilletController");

const controller = new BilletController(
  new BilletService(new BilletRepository(supabase), new ReservationRepository(supabase))
);

// Routes montées sur /billets
const billetsRouter = express.Router();

billetsRouter.get("/:numero/qr-code", controller.qrCode);
billetsRouter.post("/:numero/valider", verifierToken, verifierAdmin, controller.valider);

// Route montée sur /reservations : génération du billet d'une réservation
const billetsParReservationRouter = express.Router();

billetsParReservationRouter.post("/:id/billet", verifierToken, verifierAdmin, controller.generer);

module.exports = { billetsRouter, billetsParReservationRouter };