const express = require("express");
const QRCode = require("qrcode");

const app = express();
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const supabase = require("./supabase");
const filmsRoutes = require("./routes/films.routes");
const utilisateursRoutes = require("./routes/utilisateurs.routes");
const sallesRoutes = require("./routes/salles.routes");
const { seancesRouter, seancesParFilmRouter } = require("./routes/seances.routes");
const { verifierToken, verifierAdmin } = require("./middlewares/auth");
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
const PORT = process.env.PORT || 3000;

app.put("/salles/:nom/capacite", verifierToken, verifierAdmin, async (req, res) => {
  try {
    const nomSalle = decodeURIComponent(req.params.nom);
    const { capacite } = req.body;

    if (!Number.isInteger(capacite) || capacite <= 0) {
      return res.status(400).json({
        message: "La capacité doit être un entier positif"
      });
    }

    // Rechercher la salle dans Supabase
    const { data: salle, error: erreurSalle } = await supabase
      .from("salles")
      .select("id, nom")
      .eq("nom", nomSalle)
      .single();

    console.log("Nom de salle recherché :", nomSalle);
        console.log("Résultat Supabase :", salle);
        console.log("Erreur Supabase :", erreurSalle);

        if (erreurSalle) {
          throw erreurSalle;
        }

        if (!salle) {
          return res.status(404).json({
            message: "Salle introuvable"
          });
        }

    // Récupérer les séances de cette salle
    const { data: seances, error: erreurSeances } = await supabase
      .from("seances")
      .select("id")
      .eq("salle_id", salle.id);

    if (erreurSeances) {throw erreurSeances;}

    if (!seances || seances.length === 0) {
      return res.status(404).json({
        message: "Aucune séance trouvée pour cette salle"
      });
    }

    // Vérifier les places réservées pour chaque séance
    for (const seance of seances) {
      const { data: placesReservees, error } = await supabase
        .from("places")
        .select("id")
        .eq("seance_id", seance.id)
        .eq("statut", "reservee");

      if (error) {throw error;}

      if (capacite < placesReservees.length) {
        return res.status(400).json({
          message: "La capacité ne peut pas être inférieure au nombre de places réservées"
        });
      }
    }

    // Mettre à jour la capacité de chaque séance
    for (const seance of seances) {
      const { error } = await supabase
        .from("seances")
        .update({ capacite })
        .eq("id", seance.id);

      if (error) {throw error;}

      // Supprimer uniquement les places disponibles
      const { error: erreurSuppression } = await supabase
        .from("places")
        .delete()
        .eq("seance_id", seance.id)
        .eq("statut", "disponible");

      if (erreurSuppression) {throw erreurSuppression;}

      // Recréer les places disponibles sans toucher aux places réservées
      const { data: reservees, error: erreurReservees } = await supabase
        .from("places")
        .select("rangee, numero")
        .eq("seance_id", seance.id)
        .eq("statut", "reservee");

      if (erreurReservees) {throw erreurReservees;}

      const placesExistantes = new Set(
        reservees.map(p => `${p.rangee}-${p.numero}`)
      );

      const nouvellesPlaces = [];

      for (let i = 0; i < capacite; i++) {
        const rangee = String.fromCharCode(65 + Math.floor(i / 10));
        const numero = (i % 10) + 1;

        if (!placesExistantes.has(`${rangee}-${numero}`)) {
          nouvellesPlaces.push({
            seance_id: seance.id,
            rangee,
            numero,
            statut: "disponible"
          });
        }
      }

      if (nouvellesPlaces.length > 0) {
        const { error: erreurInsertion } = await supabase
          .from("places")
          .insert(nouvellesPlaces);

        if (erreurInsertion) {throw erreurInsertion;}
      }
    }

    return res.status(200).json({
      message: "Capacité de la salle modifiée avec succès",
      salle: nomSalle,
      capacite
    });

  } catch (error) {
    console.error("Erreur modification capacité :", error);

    return res.status(500).json({
      message: "Erreur lors de la modification de la capacité"
    });
  }
});
app.get("/salles", async (req, res) => {
  try {
    const { data: salles, error } = await supabase
      .from("salles")
      .select("id, nom, capacite")
      .order("id", { ascending: true });

    if (error) {
      console.error("Erreur Supabase :", error.message);
      return res.status(500).json({
        message: "Erreur lors de la récupération des salles"
      });
    }

    return res.status(200).json({
      message: "Liste des salles récupérée avec succès",
      salles
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Erreur serveur"
    });
  }
});


app.get("/seances/:id/places/reservees", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
      message: "Identifiant de séance invalide"
    });
  }

  const { data: seance, error } = await supabase
    .from("seances")
    .select(`
      id,
      salles (nom),
      places (
        id,
        rangee,
        numero,
        statut
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Erreur Supabase :", error.message);
    return res.status(500).json({
      message: "Erreur lors de la récupération des places"
    });
  }

  if (!seance) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  const placesReservees = (seance.places || []).filter(
    (place) => place.statut === "reservee"
  );

  return res.status(200).json({
    seanceId: seance.id,
    salle: seance.salles?.nom,
    placesReservees
  });
});

app.post("/films/:id/seances", verifierToken, verifierAdmin, async (req, res) => {
  try {
    const filmId = parseInt(req.params.id, 10);
    const { date, heure, salle, capacite } = req.body;

    if (!Number.isInteger(filmId) || filmId <= 0) {
      return res.status(400).json({
        message: "Identifiant du film invalide"
      });
    }

    if (
      !date ||
      !heure ||
      !salle ||
      capacite === undefined
    ) {
      return res.status(400).json({
        message: "Tous les champs sont obligatoires"
      });
    }

    if (
      typeof date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof heure !== "string" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(heure) ||
      typeof salle !== "string" ||
      !salle.trim() ||
      !Number.isInteger(capacite) ||
      capacite <= 0
    ) {
      return res.status(400).json({
        message: "Les informations de la séance sont invalides"
      });
    }

    // Vérifier que le film existe
    const { data: film, error: erreurFilm } = await supabase
      .from("films")
      .select("id")
      .eq("id", filmId)
      .single();

    if (erreurFilm || !film) {
      return res.status(404).json({
        message: "Film introuvable"
      });
    }

    // Vérifier que la salle existe
    const { data: salleTrouvee, error: erreurSalle } = await supabase
      .from("salles")
      .select("id, nom, capacite")
      .eq("nom", salle.trim())
      .single();

    if (erreurSalle || !salleTrouvee) {
      return res.status(404).json({
        message: "Salle introuvable"
      });
    }

    if (capacite > salleTrouvee.capacite) {
      return res.status(400).json({
        message: "La capacité dépasse celle de la salle"
      });
    }

    // Vérifier si la salle est déjà utilisée à cet horaire
    const { data: conflit, error: erreurConflit } = await supabase
      .from("seances")
      .select("id")
      .eq("salle_id", salleTrouvee.id)
      .eq("date_seance", date)
      .eq("heure", heure)
      .limit(1);

    if (erreurConflit) {throw erreurConflit;}

    if (conflit.length > 0) {
      return res.status(409).json({
        message: "Cette salle est déjà utilisée à cet horaire"
      });
    }

    // Créer la séance
    const { data: nouvelleSeance, error: erreurCreation } = await supabase
      .from("seances")
      .insert({
        film_id: filmId,
        salle_id: salleTrouvee.id,
        date_seance: date,
        heure,
        capacite
      })
      .select()
      .single();

    if (erreurCreation) {throw erreurCreation;}

    // Préparer les places
    const places = [];

    for (let i = 0; i < capacite; i++) {
      places.push({
        seance_id: nouvelleSeance.id,
        rangee: String.fromCharCode(65 + Math.floor(i / 10)),
        numero: (i % 10) + 1,
        statut: "disponible"
      });
    }

    // Insérer les places
    const { error: erreurPlaces } = await supabase
      .from("places")
      .insert(places);

    if (erreurPlaces) {
      // Supprimer la séance si la création des places échoue
      const { error: erreurSuppression } = await supabase
        .from("seances")
        .delete()
        .eq("id", nouvelleSeance.id);

      if (erreurSuppression) {
        console.error("Erreur lors du nettoyage :", erreurSuppression);
      }

      throw erreurPlaces;
    }

    return res.status(201).json({
      message: "Séance créée avec succès",
      seance: {
        ...nouvelleSeance,
        salle: salleTrouvee.nom
      }
    });

  } catch (error) {
    console.error("Erreur création séance :", error);

    return res.status(500).json({
      message: "Erreur lors de la création de la séance"
    });
  }
});


app.put("/seances/:id", verifierToken, verifierAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { date, heure, salle, capacite } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Identifiant de séance invalide"
      });
    }

    if (
      !date ||
      !heure ||
      !salle ||
      !Number.isInteger(capacite) ||
      capacite <= 0
    ) {
      return res.status(400).json({
        message: "Les informations de la séance sont invalides"
      });
    }

    // Rechercher la salle dans Supabase
    const { data: salleTrouvee, error: erreurSalle } = await supabase
      .from("salles")
      .select("id")
      .eq("nom", salle.trim())
      .single();

    if (erreurSalle || !salleTrouvee) {
      return res.status(404).json({
        message: "Salle introuvable"
      });
    }

    // Modifier la séance et ses places via la fonction SQL
    const { data, error } = await supabase.rpc("modifier_seance", {
      p_seance_id: id,
      p_date_seance: date,
      p_heure: heure,
      p_salle_id: salleTrouvee.id,
      p_capacite: capacite
    });

    if (error) {
      console.error("Erreur modification séance :", error);

      if (error.message.includes("introuvable")) {
        return res.status(404).json({ message: error.message });
      }

      if (
        error.message.includes("capacité") ||
        error.message.includes("utilisée")
      ) {
        return res.status(400).json({ message: error.message });
      }

      throw error;
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("Erreur modification séance :", error);

    return res.status(500).json({
      message: "Erreur lors de la modification de la séance"
    });
  }
});


app.put("/seances/:id/salle", verifierToken, verifierAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { salle } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Identifiant de séance invalide"
      });
    }

    if (typeof salle !== "string" || !salle.trim()) {
      return res.status(400).json({
        message: "Le nom de la salle est obligatoire"
      });
    }

    // Vérifier que la séance existe
    const { data: seance, error: erreurSeance } = await supabase
      .from("seances")
      .select("id, date_seance, heure, salle_id")
      .eq("id", id)
      .single();

    if (erreurSeance || !seance) {
      return res.status(404).json({
        message: "Séance introuvable"
      });
    }

    // Rechercher la nouvelle salle
    const { data: salleTrouvee, error: erreurSalle } = await supabase
      .from("salles")
      .select("id, nom")
      .eq("nom", salle.trim())
      .single();

    if (erreurSalle || !salleTrouvee) {
      return res.status(404).json({
        message: "Salle introuvable"
      });
    }

    // Vérifier que la salle est libre à cet horaire
    const { data: autreSeance, error: erreurConflit } = await supabase
      .from("seances")
      .select("id")
      .eq("salle_id", salleTrouvee.id)
      .eq("date_seance", seance.date_seance)
      .eq("heure", seance.heure)
      .neq("id", id)
      .limit(1);

    if (erreurConflit) {throw erreurConflit;}

    if (autreSeance.length > 0) {
      return res.status(409).json({
        message: "Cette salle est déjà utilisée à cet horaire"
      });
    }

    // Mettre à jour la salle de la séance
    const { error: erreurMiseAJour } = await supabase
      .from("seances")
      .update({ salle_id: salleTrouvee.id })
      .eq("id", id);

    if (erreurMiseAJour) {throw erreurMiseAJour;}

    return res.status(200).json({
      message: "Salle associée à la séance avec succès",
      seanceId: id,
      salle: salleTrouvee.nom
    });

  } catch (error) {
    console.error("Erreur changement de salle :", error);

    return res.status(500).json({
      message: "Erreur lors du changement de salle"
    });
  }
});


app.patch("/seances/:id/annuler", verifierToken, verifierAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Identifiant de séance invalide"
      });
    }

    // Rechercher la séance dans Supabase
    const { data: seance, error: erreurSeance } = await supabase
      .from("seances")
      .select("*")
      .eq("id", id)
      .single();

    if (erreurSeance || !seance) {
      return res.status(404).json({
        message: "Séance introuvable"
      });
    }

    // Vérifier si la séance est déjà annulée
    if (seance.statut === "annulee") {
      return res.status(400).json({
        message: "Cette séance est déjà annulée"
      });
    }

    // Annuler la séance
    const { data: seanceAnnulee, error: erreurMiseAJour } = await supabase
      .from("seances")
      .update({
        statut: "annulee",
        date_annulation: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (erreurMiseAJour) {throw erreurMiseAJour;}

    return res.status(200).json({
      message: "Séance annulée avec succès",
      seance: seanceAnnulee
    });

  } catch (error) {
    console.error("Erreur annulation séance :", error);

    return res.status(500).json({
      message: "Erreur lors de l'annulation de la séance"
    });
  }
});



app.post("/reservations/selection-seance", async (req, res) => {
  const { seanceId } = req.body;
  const id = parseInt(seanceId, 10);

  if (!seanceId || isNaN(id)) {
    return res.status(400).json({
      message: "Veuillez sélectionner une séance valide"
    });
  }

  const { data: seance, error } = await supabase
    .from("seances")
    .select(`
      id,
      date_seance,
      heure,
      capacite,
      statut,
      films (titre),
      salles (nom),
      places (
        id,
        rangee,
        numero,
        statut
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Erreur Supabase :", error.message);
    return res.status(500).json({
      message: "Erreur lors de la récupération de la séance"
    });
  }

  if (!seance) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  return res.status(200).json({
    message: "Séance sélectionnée avec succès",
    film: seance.films?.titre,
    seance: {
      id: seance.id,
      date: seance.date_seance,
      heure: seance.heure,
      salle: seance.salles?.nom,
      capacite: seance.capacite,
      statut: seance.statut,
      places: seance.places
    }
  });
});
app.post("/reservations/informations-client", (req, res) => {
  const { nom, prenom, email, telephone } = req.body;

  if (!nom || !prenom || !email || !telephone) {
    return res.status(400).json({
      message: "Veuillez renseigner toutes les informations"
    });
  }

  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!emailValide) {
    return res.status(400).json({
      message: "Adresse e-mail invalide"
    });
  }

  res.status(200).json({
    message: "Informations client enregistrées avec succès",
    client: {
      nom,
      prenom,
      email,
      telephone
    }
  });
});
app.get("/seances/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({
      message: "Identifiant de séance invalide"
    });
  }

  const { data: seance, error } = await supabase
    .from("seances")
    .select(`
      id,
      film_id,
      salle_id,
      date_seance,
      heure,
      capacite,
      films (
        titre
      ),
      salles (
        nom
      ),
      places (
        id,
        rangee,
        numero,
        statut
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Erreur Supabase :", error.message);
    return res.status(500).json({
      message: "Erreur lors de la récupération de la séance"
    });
  }

  if (!seance) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  return res.status(200).json({
    id: seance.id,
    film: seance.films?.titre,
    salle: seance.salles?.nom,
    date: seance.date_seance,
    heure: seance.heure,
    capacite: seance.capacite,
    places: seance.places
  });
});
app.get("/seances/:id/places/etat", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({
      message: "Identifiant de séance invalide"
    });
  }

  const { data: seance, error } = await supabase
    .from("seances")
    .select(`
      id,
      capacite,
      salles (nom),
      places (
        id,
        rangee,
        numero,
        statut
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Erreur Supabase :", error.message);
    return res.status(500).json({
      message: "Erreur lors de la récupération des places"
    });
  }

  if (!seance) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  const placesDisponibles = seance.places.filter(
    place => place.statut === "disponible"
  );

  const placesOccupees = seance.places.filter(
    place => place.statut === "reservee"
  );

  return res.status(200).json({
    message: "État des places récupéré avec succès",
    seanceId: seance.id,
    salle: seance.salles?.nom,
    capacite: seance.capacite,
    nombrePlacesDisponibles: placesDisponibles.length,
    nombrePlacesOccupees: placesOccupees.length,
    placesDisponibles,
    placesOccupees
  });
});
app.get("/seances/:id/places", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({
      message: "Identifiant de séance invalide"
    });
  }

  const { data: seance, error } = await supabase
    .from("seances")
    .select(`
      id,
      salles (nom),
      places (
        id,
        rangee,
        numero,
        statut
      )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Erreur Supabase :", error.message);
    return res.status(500).json({
      message: "Erreur lors de la récupération des places"
    });
  }

  if (!seance) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  return res.status(200).json({
    seanceId: seance.id,
    salle: seance.salles?.nom,
    places: seance.places
  });
});
app.post("/reservations/confirmer", verifierToken, async (req, res) => {
  try {
    const { seanceId, placesIds, telephone } = req.body;

    const utilisateurId = req.utilisateur.id;

    if (
      !Number.isInteger(Number(utilisateurId)) ||
      !seanceId ||
      !Array.isArray(placesIds) ||
      placesIds.length === 0 ||
      !placesIds.every(id => Number.isInteger(id)) ||
      typeof telephone !== "string" ||
      !telephone.trim()
    ) {
      return res.status(400).json({
        message: "Informations de réservation invalides ou incomplètes"
      });
    }

    // Récupérer les informations du compte connecté
    const { data: utilisateur, error: erreurUtilisateur } = await supabase
      .from("utilisateurs")
      .select("id, nom, prenom, email")
      .eq("id", utilisateurId)
      .single();

    if (erreurUtilisateur || !utilisateur) {
      return res.status(404).json({
        message: "Utilisateur introuvable"
      });
    }

    const { data, error } = await supabase.rpc(
      "confirmer_reservation",
      {
        p_seance_id: Number(seanceId),
        p_places_ids: placesIds,
        p_nom: utilisateur.nom,
        p_prenom: utilisateur.prenom,
        p_email: utilisateur.email,
        p_telephone: telephone.trim(),
        p_utilisateur_id: Number(utilisateur.id)
      }
    );

    if (error) {
      console.error("Erreur Supabase :", error);

      if (error.message.includes("Séance introuvable")) {
        return res.status(404).json({
          message: "Séance introuvable"
        });
      }

      if (
        error.message.includes("places") ||
        error.message.includes("place")
      ) {
        return res.status(400).json({
          message: error.message
        });
      }

      return res.status(500).json({
        message: "Erreur lors de la confirmation de la réservation"
      });
    }

    return res.status(201).json({
      message: "Réservation confirmée avec succès",
      reservation: data
    });

  } catch (error) {
    console.error("Erreur serveur :", error);

    return res.status(500).json({
      message: "Erreur interne du serveur"
    });
  }
});



app.post("/reservations/:id/billet", verifierToken, verifierAdmin, async (req, res) => {
  try {
    const reservationId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(reservationId) || reservationId <= 0) {
      return res.status(400).json({
        message: "Identifiant de réservation invalide"
      });
    }

    // Vérifier que la réservation existe
    const { data: reservation, error: erreurReservation } =
      await supabase
        .from("reservations")
        .select("*")
        .eq("id", reservationId)
        .maybeSingle();

    if (erreurReservation) {throw erreurReservation;}

    if (!reservation) {
      return res.status(404).json({
        message: "Réservation introuvable"
      });
    }

    // Vérifier qu'un billet n'existe pas déjà
    const { data: billetExistant, error: erreurBillet } =
      await supabase
        .from("billets")
        .select("*")
        .eq("reservation_id", reservationId)
        .maybeSingle();

    if (erreurBillet) {throw erreurBillet;}

    if (billetExistant) {
      return res.status(409).json({
        message: "Un billet existe déjà pour cette réservation"
      });
    }

    // Récupérer les places de la réservation
    const { data: associations, error: erreurPlaces } =
      await supabase
        .from("reservation_places")
        .select("places(id, rangee, numero)")
        .eq("reservation_id", reservationId);

    if (erreurPlaces) {throw erreurPlaces;}

    const places = associations.map(a => a.places);

    // Créer le billet
    const numeroBillet =
      `BIL-${String(reservationId).padStart(6, "0")}`;

    const { data: nouveauBillet, error: erreurCreation } =
      await supabase
        .from("billets")
        .insert({
          numero_billet: numeroBillet,
          reservation_id: reservationId,
          statut: "valide"
        })
        .select()
        .single();

    if (erreurCreation) {
      if (erreurCreation.code === "23505") {
        return res.status(409).json({
          message: "Un billet existe déjà pour cette réservation"
        });
      }
      throw erreurCreation;
    }

    const billet = {
      id: nouveauBillet.id,
      numeroBillet: nouveauBillet.numero_billet,
      reservationId: reservation.id,
      numeroReservation: reservation.numero_reservation,
      client: {
        nom: reservation.nom,
        prenom: reservation.prenom,
        email: reservation.email,
        telephone: reservation.telephone
      },
      seanceId: reservation.seance_id,
      places,
      dateGeneration: nouveauBillet.date_generation,
      statut: nouveauBillet.statut
    };

    return res.status(201).json({
      message: "Billet généré avec succès",
      billet
    });

  } catch (error) {
    console.error("Erreur génération billet :", error);

    return res.status(500).json({
      message: "Erreur lors de la génération du billet"
    });
  }
});

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

app.get("/billets/:numero/qr-code", async (req, res) => {
  try {
    console.log("Route QR code appelée");

    const numero = req.params.numero;

    // Rechercher le billet dans Supabase
    const { data: billet, error } = await supabase
      .from("billets")
      .select(`
        id,
        numero_billet,
        reservation_id,
        reservations (
          numero_reservation
        )
      `)
      .eq("numero_billet", numero)
      .maybeSingle();

    if (error) {throw error;}

    if (!billet) {
      return res.status(404).json({
        message: "Billet introuvable"
      });
    }

    // Préparer les informations du QR code
    const contenuQR = JSON.stringify({
      numeroBillet: billet.numero_billet,
      numeroReservation: billet.reservations.numero_reservation,
      reservationId: billet.reservation_id
    });

    // Générer le QR code
    const qrCode = await QRCode.toDataURL(contenuQR);

    return res.status(200).json({
      message: "QR code généré avec succès",
      numeroBillet: billet.numero_billet,
      qrCode
    });

  } catch (error) {
    console.error("Erreur génération QR code :", error);

    return res.status(500).json({
      message: "Erreur lors de la génération du QR code"
    });
  }
});


app.post("/billets/:numero/valider", verifierToken, verifierAdmin, async (req, res) => {
  try {
    const numero = req.params.numero;

    // Rechercher le billet dans Supabase
    const { data: billet, error: erreurRecherche } = await supabase
      .from("billets")
      .select("*")
      .eq("numero_billet", numero)
      .maybeSingle();

    if (erreurRecherche) {throw erreurRecherche;}

    if (!billet) {
      return res.status(404).json({
        message: "Billet introuvable"
      });
    }

    if (billet.statut === "utilise") {
      return res.status(400).json({
        message: "Ce billet a déjà été utilisé"
      });
    }

    // Mettre à jour le billet dans Supabase
    const dateUtilisation = new Date().toISOString();

    const { data: billetValide, error: erreurMiseAJour } =
      await supabase
        .from("billets")
        .update({
          statut: "utilise",
          date_utilisation: dateUtilisation
        })
        .eq("id", billet.id)
        .neq("statut", "utilise")
        .select()
        .maybeSingle();

    if (erreurMiseAJour) {throw erreurMiseAJour;}

    if (!billetValide) {
      return res.status(400).json({
        message: "Ce billet a déjà été utilisé"
      });
    }

    return res.status(200).json({
      message: "Billet validé avec succès. Accès autorisé.",
      billet: {
        id: billetValide.id,
        numeroBillet: billetValide.numero_billet,
        reservationId: billetValide.reservation_id,
        statut: billetValide.statut,
        dateUtilisation: billetValide.date_utilisation
      }
    });

  } catch (error) {
    console.error("Erreur validation billet :", error);

    return res.status(500).json({
      message: "Erreur lors de la validation du billet"
    });
  }
});


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

app.get("/reservations", verifierToken, verifierAdmin, async (req, res) => {
  try {
    const { data: reservations, error } = await supabase
      .from("reservations")
      .select("*");

    if (error) {
      return res.status(500).json({
        message: "Erreur lors de la récupération des réservations",
        error: error.message
      });
    }

    return res.status(200).json({
      message: "Liste des réservations récupérée avec succès",
      reservations
    });

  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
});
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
app.get("/reservations/recherche/:numero", verifierToken, async (req, res) => {
  try {
    if (req.utilisateur.role !== "admin") {
      return res.status(403).json({
        message: "Accès réservé aux administrateurs"
      });
    }

    const numero = req.params.numero.toUpperCase();

    const { data: reservation, error } = await supabase
      .from("reservations")
      .select(`
        *,
        reservation_places (
          places (
            id,
            seance_id,
            rangee,
            numero,
            statut
          )
        )
      `)
      .eq("numero_reservation", numero)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!reservation) {
      return res.status(404).json({
        message: "Réservation introuvable"
      });
    }

    return res.status(200).json({
      message: "Réservation trouvée avec succès",
      reservation
    });

  } catch (error) {
    console.error("Erreur recherche réservation :", error);
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
});

app.get("/reservations/seance/:seanceId", verifierToken, async (req, res) => {
  try {
    if (req.utilisateur.role !== "admin") {
      return res.status(403).json({
        message: "Accès réservé aux administrateurs"
      });
    }

    const seanceId = parseInt(req.params.seanceId, 10);

    if (!Number.isInteger(seanceId) || seanceId <= 0) {
      return res.status(400).json({
        message: "Identifiant de séance invalide"
      });
    }

    const { data: reservationsSeance, error } = await supabase
      .from("reservations")
      .select(`
        *,
        reservation_places (
          places (
            id,
            rangee,
            numero,
            statut
          )
        )
      `)
      .eq("seance_id", seanceId)
      .order("date_reservation", { ascending: false });

        console.log("Séance recherchée :", seanceId);
    console.log("Réservations récupérées :", reservationsSeance);
    console.log("Erreur Supabase :", error);

    if (error) {
      throw error;
    }

    return res.status(200).json({
      message: "Réservations de la séance récupérées avec succès",
      seanceId,
      nombreReservations: reservationsSeance.length,
      reservations: reservationsSeance
    });
  } catch (error) {
    console.error("Erreur récupération réservations séance :", error);

    return res.status(500).json({
      message: "Erreur lors de la récupération des réservations"
    });
  }
});


app.put("/reservations/:id/annuler", verifierToken, async (req, res) => {
  try {
    const idReservation = parseInt(req.params.id, 10);

    if (!Number.isInteger(idReservation) || idReservation <= 0) {
      return res.status(400).json({
        message: "Identifiant de réservation invalide"
      });
    }

    const { data, error } = await supabase.rpc(
      "annuler_reservation",
      {
        p_reservation_id: idReservation,
        p_utilisateur_id: req.utilisateur.id,
        p_est_admin: req.utilisateur.role === "admin"
      }
    );

    if (error) {
      if (error.message.includes("introuvable")) {
        return res.status(404).json({ message: error.message });
      }

      if (
        error.message.includes("ne pouvez pas") ||
        error.message.includes("propriétaire")
      ) {
        return res.status(403).json({ message: error.message });
      }

      if (error.message.includes("déjà annulée")) {
        return res.status(400).json({ message: error.message });
      }

      throw error;
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error("Erreur annulation réservation :", error);

    return res.status(500).json({
      message: "Erreur lors de l'annulation de la réservation"
    });
  }
});



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
