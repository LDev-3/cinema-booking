const express = require("express");


const app = express();
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const filmsRoutes = require("./routes/films.routes");
const utilisateursRoutes = require("./routes/utilisateurs.routes");
const sallesRoutes = require("./routes/salles.routes");
const { seancesRouter, seancesParFilmRouter } = require("./routes/seances.routes");
const reservationsRoutes = require("./routes/reservations.routes");
const { billetsRouter, billetsParReservationRouter } = require("./routes/billets.routes");
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
