const express = require("express");


const app = express();
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const supabase = require("./supabase");
const filmsRoutes = require("./routes/films.routes");
const utilisateursRoutes = require("./routes/utilisateurs.routes");
const sallesRoutes = require("./routes/salles.routes");
const { seancesRouter, seancesParFilmRouter } = require("./routes/seances.routes");
const reservationsRoutes = require("./routes/reservations.routes");
const { billetsRouter, billetsParReservationRouter } = require("./routes/billets.routes");
const { verifierToken, verifierAdmin } = require("./middlewares/auth");
const statistiquesRoutes = require("./routes/statistiques.routes");
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("La variable JWT_SECRET est obligatoire.");
}
app.use(express.json());
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Cinema Booking API",
      version: "1.0.0",
      description: "Documentation de l'API de réservation de cinéma"
    },
       servers: [{ url: "/" }],
       components: {
        securitySchemes: {
         bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      }
    }
  },
  apis: ["./server.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    persistAuthorization: true
  })
);
app.use("/films", filmsRoutes);
app.use("/utilisateurs", utilisateursRoutes);
app.use("/salles", sallesRoutes);
app.use("/seances", seancesRouter);
app.use("/films", seancesParFilmRouter);
app.use("/reservations", reservationsRoutes);
app.use("/reservations", billetsParReservationRouter);
app.use("/billets", billetsRouter);
app.use("/statistiques", statistiquesRoutes);
const PORT = process.env.PORT || 3000;


/**
 * @swagger
 * /billets/{numero}/qr-code:
 *   get:
 *     summary: Générer le QR code d'un billet
 *     tags: [Billets]
 *     parameters:
 *       - in: path
 *         name: numero
 *         required: true
 *         schema:
 *           type: string
 *         description: Numéro du billet
 *     responses:
 *       200:
 *         description: QR code généré avec succès
 *       404:
 *         description: Billet introuvable
 */

/**
 * @swagger
 * /utilisateurs/connexion:
 *   post:
 *     summary: Se connecter et obtenir un token JWT
 *     tags: [Utilisateurs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - motDePasse
 *             properties:
 *               email:
 *                 type: string
 *                 example: email@exemple.com
 *               motDePasse:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connexion réussie, le token JWT est retourné
 *       401:
 *         description: Email ou mot de passe incorrect
 */

/**
 * @swagger
 * /reservations:
 *   get:
 *     summary: Lister toutes les réservations (administrateur)
 *     tags: [Réservations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Liste des réservations
 *       401:
 *         description: Token absent ou invalide
 *       403:
 *         description: Accès réservé aux administrateurs
 */


app.get("/statistiques/seances-proches-saturation", verifierToken, async (req, res) => {
  if (req.utilisateur.role !== "admin") {
    return res.status(403).json({
      message: "Accès réservé aux administrateurs"
    });
  }

  const { data, error } = await supabase
    .from("seances")
    .select(`
      id,
      capacite,
      date_seance,
      heure,
      films (titre),
      salles (nom),
      places (statut)
    `);

  if (error) {
    console.error("Erreur Supabase :", error.message);
    return res.status(500).json({
      message: "Erreur lors du calcul des statistiques"
    });
  }

  const seancesProchesSaturation = data.map((seance) => {
    const capacite = seance.places.length;
    const placesReservees = seance.places.filter(
      (place) => place.statut === "reservee"
    ).length;

    const tauxRemplissage = capacite > 0
      ? (placesReservees / capacite) * 100
      : 0;

    return {
      film: seance.films?.titre,
      seanceId: seance.id,
      salle: seance.salles?.nom,
      capacite,
      placesReservees,
      tauxRemplissage: Number(tauxRemplissage.toFixed(2))
    };
  }).filter((seance) => seance.tauxRemplissage >= 80);

  return res.status(200).json({
    message: "Séances proches de la saturation récupérées avec succès",
    nombreSeances: seancesProchesSaturation.length,
    seances: seancesProchesSaturation
  });
});
app.get("/statistiques/horaires-plus-demandes", verifierToken, verifierAdmin, async (req, res) => {
  try {
    const { data: reservations, error: erreurReservations } = await supabase
      .from("reservations")
      .select("seance_id, statut");

    if (erreurReservations) {
      return res.status(500).json({
        message: "Erreur lors de la récupération des réservations",
        error: erreurReservations.message
      });
    }

    const { data: seances, error: erreurSeances } = await supabase
      .from("seances")
      .select("id, heure");

    if (erreurSeances) {
      return res.status(500).json({
        message: "Erreur lors de la récupération des séances",
        error: erreurSeances.message
      });
    }

    const statistiques = {};

    reservations
      .filter(reservation => reservation.statut !== "annulee")
      .forEach(reservation => {
        const seance = seances.find(
          s => s.id === reservation.seance_id
        );

        if (seance) {
          const horaire = seance.heure;
          statistiques[horaire] = (statistiques[horaire] || 0) + 1;
        }
      });

    const horairesDemandes = Object.entries(statistiques)
      .map(([horaire, nombreReservations]) => ({
        horaire,
        nombreReservations
      }))
      .sort((a, b) => b.nombreReservations - a.nombreReservations);

    return res.status(200).json({
      message: "Horaires les plus demandés récupérés avec succès",
      horaires: horairesDemandes
    });

  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
});app.get("/statistiques/journees-plus-frequentees", verifierToken, verifierAdmin, async (req, res) => {
  try {
    // Récupérer les réservations depuis Supabase
    const { data: reservations, error: erreurReservations } = await supabase
      .from("reservations")
      .select("seance_id, statut");

    if (erreurReservations) {
      return res.status(500).json({
        message: "Erreur lors de la récupération des réservations",
        error: erreurReservations.message
      });
    }

    // Récupérer les séances depuis Supabase
    const { data: seances, error: erreurSeances } = await supabase
      .from("seances")
      .select("id, date_seance");

    if (erreurSeances) {
      return res.status(500).json({
        message: "Erreur lors de la récupération des séances",
        error: erreurSeances.message
      });
    }

    // Calculer les statistiques par journée
    const statistiques = {};

    reservations
      .filter(reservation => reservation.statut !== "annulee")
      .forEach(reservation => {
        const seance = seances.find(
          s => s.id === reservation.seance_id
        );

        if (seance) {
          const date = seance.date_seance;

          statistiques[date] = (statistiques[date] || 0) + 1;
        }
      });

    // Trier les journées par nombre de réservations
    const journeesFrequentees = Object.entries(statistiques)
      .map(([date, nombreReservations]) => ({
        date,
        nombreReservations
      }))
      .sort((a, b) => b.nombreReservations - a.nombreReservations);

    return res.status(200).json({
      message: "Journées les plus fréquentées récupérées avec succès",
      journees: journeesFrequentees
    });

  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
});

app.get("/statistiques/periodes-forte-affluence", verifierToken, verifierAdmin, async (req, res) => {
  try {
    // Récupérer les réservations
    const { data: reservations, error: erreurReservations } = await supabase
      .from("reservations")
      .select("seance_id, statut");

    if (erreurReservations) {
      return res.status(500).json({
        message: "Erreur lors de la récupération des réservations",
        error: erreurReservations.message
      });
    }

    // Récupérer les séances
    const { data: seances, error: erreurSeances } = await supabase
      .from("seances")
      .select("id, date_seance");

    if (erreurSeances) {
      return res.status(500).json({
        message: "Erreur lors de la récupération des séances",
        error: erreurSeances.message
      });
    }

    // Calculer les statistiques par mois
    const statistiques = {};

    reservations
      .filter(reservation => reservation.statut !== "annulee")
      .forEach(reservation => {
        const seance = seances.find(
          s => s.id === reservation.seance_id
        );

        if (seance) {
          const mois = seance.date_seance.substring(0, 7);

          statistiques[mois] = (statistiques[mois] || 0) + 1;
        }
      });

    // Trier les périodes par nombre de réservations
    const periodesForteAffluence = Object.entries(statistiques)
      .map(([periode, nombreReservations]) => ({
        periode,
        nombreReservations
      }))
      .sort((a, b) => b.nombreReservations - a.nombreReservations);

    return res.status(200).json({
      message: "Périodes de forte affluence récupérées avec succès",
      periodes: periodesForteAffluence
    });

  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
});



console.log("Route QR code chargée");

/**
 * @swagger
 * /films:
 *   get:
 *     summary: Lister les films
 *     tags: [Films]
 *     responses:
 *       200:
 *         description: Liste des films
 */
// Démarrage du serveur
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
  });
}

module.exports = app;
