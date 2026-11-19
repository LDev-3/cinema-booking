const express = require("express");
const QRCode = require("qrcode");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const supabase = require("./supabase");

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
    servers: [{ url: "/" }]
  },
  apis: ["./server.js"]
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
const PORT = process.env.PORT || 3000;
function verifierToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentification requise"
    });
  }

  const token = authorization.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.utilisateur = decoded;
    next();
  } catch  {
    return res.status(401).json({
      message: "Token invalide ou expiré"
    });
  }
}

function verifierAdmin(req, res, next) {
  if (!req.utilisateur || req.utilisateur.role !== "admin") {
    return res.status(403).json({
      message: "Accès réservé aux administrateurs"
    });
  }

  next();
}


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

app.post("/films", verifierToken, verifierAdmin, async (req, res) => {
  const { titre, description, duree, genre } = req.body;

  // Vérifier les champs obligatoires
  if (
    !titre || typeof titre !== "string" || !titre.trim() ||
    !description || typeof description !== "string" || !description.trim() ||
    !duree || !genre || typeof genre !== "string" || !genre.trim()
  ) {
    return res.status(400).json({
      message: "Tous les champs sont obligatoires"
    });
  }

  // Vérifier la durée
  if (typeof duree !== "number" || !Number.isInteger(duree) || duree <= 0) {
    return res.status(400).json({
      message: "La durée doit être un nombre entier positif"
    });
  }

  // Enregistrer le film dans Supabase
  const { data: nouveauFilm, error } = await supabase
    .from("films")
    .insert({
      titre: titre.trim(),
      description: description.trim(),
      duree,
      genre: genre.trim(),
      actif: true
    })
    .select()
    .single();

  if (error) {
    console.error("Erreur Supabase :", error.message);
    return res.status(500).json({
      message: "Erreur lors de l'ajout du film"
    });
  }

  return res.status(201).json({
    message: "Film ajouté avec succès",
    film: {
      ...nouveauFilm,
      seances: []
    }
  });
});

app.get("/films/recherche", async (req, res) => {
  const recherche = req.query.titre;

  if (!recherche) {
    return res.status(400).json({
      message: "Veuillez saisir un titre de film"
    });
  }

  const { data, error } = await supabase
    .from("films")
    .select("*")
    .ilike("titre", `%${recherche}%`);

  if (error) {
    console.error("Erreur Supabase :", error.message);
    return res.status(500).json({
      message: "Erreur lors de la recherche des films"
    });
  }

  return res.status(200).json(data);
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

app.get("/films/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({
      message: "Identifiant du film invalide"
    });
  }

  const { data: film, error } = await supabase
    .from("films")
    .select(`
      id,
      titre,
      description,
      duree,
      genre,
      actif,
      seances (
        id,
        date_seance,
        heure,
        capacite,
        salles (nom),
        places (
          id,
          rangee,
          numero,
          statut
        )
      )
    `)
    .eq("id", id)
    .single();
  if (error || !film) {
    if (error && error.code !== "PGRST116") {
      console.error("Erreur Supabase :", error.message);
      return res.status(500).json({
        message: "Erreur lors de la récupération du film"
      });
    }

    return res.status(404).json({
      message: "Film introuvable"
    });
  }

  const filmAvecSeances = {
    ...film,
    seances: (film.seances || []).map((seance) => ({
      id: seance.id,
      date: seance.date_seance,
      heure: seance.heure,
      salle: seance.salles?.nom,
      capacite: seance.capacite,
      places: seance.places || []
    }))
  };

  return res.json(filmAvecSeances);
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


// Supprimer un film
app.delete("/films/:id", verifierToken, verifierAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);

  if (isNaN(id)) {
    return res.status(400).json({
      message: "Identifiant du film invalide"
    });
  }

  // Supprimer le film dans Supabase
  const { data: filmSupprime, error } = await supabase
    .from("films")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Erreur Supabase :", error.message);
    return res.status(500).json({
      message: "Erreur lors de la suppression du film"
    });
  }

  if (!filmSupprime) {
    return res.status(404).json({
      message: "Film introuvable"
    });
  }

  return res.status(200).json({
    message: "Film supprimé avec succès",
    film: filmSupprime
  });
});


app.patch("/films/:id/desactiver", verifierToken, verifierAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const { data: film, error } = await supabase
      .from("films")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !film) {
      return res.status(404).json({
        message: "Film introuvable"
      });
    }

    if (!film.actif) {
      return res.status(400).json({
        message: "Ce film est déjà désactivé"
      });
    }

    const { data: filmDesactive, error: erreurUpdate } = await supabase
      .from("films")
      .update({ actif: false })
      .eq("id", id)
      .select()
      .single();

    if (erreurUpdate) {throw erreurUpdate;}

    return res.status(200).json({
      message: "Film désactivé avec succès",
      film: filmDesactive
    });

  } catch (error) {
    console.error("Erreur désactivation film :", error);
    return res.status(500).json({
      message: "Erreur lors de la désactivation du film"
    });
  }
});


app.get("/films/:id/seances", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    const { data: film, error: erreurFilm } = await supabase
      .from("films")
      .select("id")
      .eq("id", id)
      .single();

    if (erreurFilm || !film) {
      return res.status(404).json({
        message: "Film introuvable"
      });
    }

    const { data: seances, error } = await supabase
      .from("seances")
      .select("*")
      .eq("film_id", id)
      .order("date_seance", { ascending: true });

    if (error) {throw error;}

    return res.status(200).json(seances);

  } catch (error) {
    console.error("Erreur récupération séances :", error);
    return res.status(500).json({
      message: "Erreur lors de la récupération des séances"
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


app.post("/utilisateurs/inscription", async (req, res) => {
  const { nom, prenom, email, motDePasse } = req.body;

  if (
    typeof nom !== "string" ||
    typeof prenom !== "string" ||
    typeof email !== "string" ||
    typeof motDePasse !== "string" ||
    !nom.trim() ||
    !prenom.trim() ||
    !email.trim() ||
    !motDePasse
  ) {
    return res.status(400).json({
      message: "Tous les champs sont obligatoires"
    });
  }

  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailValide.test(email.trim())) {
    return res.status(400).json({
      message: "Adresse email invalide"
    });
  }

  if (motDePasse.length < 8) {
    return res.status(400).json({
      message: "Le mot de passe doit contenir au moins 8 caractères"
    });
  }

  try {
    const emailNormalise = email.trim().toLowerCase();

    // Vérifier si l'utilisateur existe déjà dans Supabase
    const { data: utilisateurExistant, error: erreurRecherche } =
      await supabase
        .from("utilisateurs")
        .select("id")
        .eq("email", emailNormalise)
        .maybeSingle();

    if (erreurRecherche) {throw erreurRecherche;}

    if (utilisateurExistant) {
      return res.status(409).json({
        message: "Cette adresse email est déjà utilisée"
      });
    }

    // Hacher le mot de passe
    const motDePasseHache = await bcrypt.hash(motDePasse, 10);

    // Enregistrer l'utilisateur dans Supabase
    const { data: utilisateur, error: erreurInsertion } =
      await supabase
        .from("utilisateurs")
        .insert({
          nom: nom.trim(),
          prenom: prenom.trim(),
          email: emailNormalise,
          mot_de_passe: motDePasseHache,
          role: "utilisateur"
        })
        .select("id, nom, prenom, email, role, date_creation")
        .single();

    if (erreurInsertion) {
      if (erreurInsertion.code === "23505") {
        return res.status(409).json({
          message: "Cette adresse email est déjà utilisée"
        });
      }

      throw erreurInsertion;
    }

    return res.status(201).json({
      message: "Compte utilisateur créé avec succès",
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.role,
        dateCreation: utilisateur.date_creation
      }
    });

  } catch (error) {
    console.error("Erreur inscription :", error);

    return res.status(500).json({
      message: "Erreur lors de la création du compte"
    });
  }
});


app.post("/utilisateurs/connexion", async (req, res) => {
  try {
    const { email, motDePasse } = req.body;

    // Vérifier les champs obligatoires
    if (
      typeof email !== "string" ||
      typeof motDePasse !== "string" ||
      !email.trim() ||
      !motDePasse
    ) {
      return res.status(400).json({
        message: "L'email et le mot de passe sont obligatoires"
      });
    }

    // Normaliser l'adresse email
    const emailNormalise = email.trim().toLowerCase();

    // Rechercher l'utilisateur dans Supabase
    const { data: utilisateur, error } = await supabase
      .from("utilisateurs")
      .select("*")
      .eq("email", emailNormalise)
      .maybeSingle();

    if (error) {throw error;}

    if (!utilisateur) {
      return res.status(401).json({
        message: "Email ou mot de passe incorrect"
      });
    }

    // Vérifier le mot de passe haché
    const motDePasseCorrect = await bcrypt.compare(
      motDePasse,
      utilisateur.mot_de_passe
    );

    if (!motDePasseCorrect) {
      return res.status(401).json({
        message: "Email ou mot de passe incorrect"
      });
    }

    // Générer le token JWT
    const token = jwt.sign(
      {
        id: utilisateur.id,
        email: utilisateur.email,
        role: utilisateur.role
      },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    return res.status(200).json({
      message: "Connexion réussie",
      token,
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.role
      }
    });

  } catch (error) {
    console.error("Erreur connexion :", error);

    return res.status(500).json({
      message: "Erreur lors de la connexion"
    });
  }
});

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


app.get("/utilisateurs/mes-reservations", verifierToken, async (req, res) => {
  try {
    const email = req.utilisateur.email.toLowerCase();

    // Rechercher les réservations de l'utilisateur dans Supabase
    const { data: reservations, error } = await supabase
      .from("reservations")
      .select(`
        id,
        numero_reservation,
        seance_id,
        nom,
        prenom,
        email,
        telephone,
        date_reservation,
        statut,
        reservation_places (
          places (
            id,
            rangee,
            numero
          )
        )
      `)
      .eq("email", email)
      .order("date_reservation", { ascending: false });

    if (error) {throw error;}

    // Adapter les données au format de réponse de l'API
    const mesReservations = reservations.map((reservation) => ({
      id: reservation.id,
      numeroReservation: reservation.numero_reservation,
      seanceId: reservation.seance_id,
      client: {
        nom: reservation.nom,
        prenom: reservation.prenom,
        email: reservation.email,
        telephone: reservation.telephone
      },
      places: reservation.reservation_places.map(
        (association) => association.places
      ),
      dateReservation: reservation.date_reservation,
      statut: reservation.statut
    }));

    return res.status(200).json({
      message: "Liste de vos réservations",
      reservations: mesReservations
    });

  } catch (error) {
    console.error("Erreur récupération réservations :", error);

    return res.status(500).json({
      message: "Erreur lors de la récupération de vos réservations"
    });
  }
});


app.get("/utilisateurs/mes-billets", verifierToken, async (req, res) => {
  try {
    const email = req.utilisateur.email.toLowerCase();

    // Récupérer les billets liés aux réservations de l'utilisateur
    const { data: billets, error } = await supabase
      .from("billets")
      .select(`
        id,
        numero_billet,
        reservation_id,
        date_generation,
        statut,
        date_utilisation,
        reservations!inner (
          id,
          numero_reservation,
          seance_id,
          nom,
          prenom,
          email,
          telephone,
          reservation_places (
            places (
              id,
              rangee,
              numero
            )
          )
        )
      `)
      .eq("reservations.email", email)
      .order("date_generation", { ascending: false });

    if (error) {throw error;}

    // Formater les billets
    const mesBillets = billets.map((billet) => {
      const reservation = billet.reservations;

      return {
        id: billet.id,
        numeroBillet: billet.numero_billet,
        reservationId: reservation.id,
        numeroReservation: reservation.numero_reservation,
        client: {
          nom: reservation.nom,
          prenom: reservation.prenom,
          email: reservation.email,
          telephone: reservation.telephone
        },
        seanceId: reservation.seance_id,
        places: reservation.reservation_places.map(
          (association) => association.places
        ),
        dateGeneration: billet.date_generation,
        statut: billet.statut,
        dateUtilisation: billet.date_utilisation
      };
    });

    return res.status(200).json({
      message: "Liste de vos billets",
      billets: mesBillets
    });

  } catch (error) {
    console.error("Erreur récupération billets :", error);

    return res.status(500).json({
      message: "Erreur lors de la récupération de vos billets"
    });
  }
});


app.put("/utilisateurs/mes-informations", verifierToken, async (req, res) => {
  try {
    const { nom, prenom, email } = req.body;

    if (
      typeof nom !== "string" ||
      typeof prenom !== "string" ||
      typeof email !== "string" ||
      !nom.trim() ||
      !prenom.trim() ||
      !email.trim()
    ) {
      return res.status(400).json({
        message: "Tous les champs sont obligatoires"
      });
    }

    const emailNormalise = email.trim().toLowerCase();
    const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailValide.test(emailNormalise)) {
      return res.status(400).json({
        message: "Adresse email invalide"
      });
    }

    // Vérifier si l'adresse email est déjà utilisée par un autre compte
    const { data: emailExistant, error: erreurRecherche } =
      await supabase
        .from("utilisateurs")
        .select("id")
        .eq("email", emailNormalise)
        .neq("id", req.utilisateur.id)
        .maybeSingle();

    if (erreurRecherche) {throw erreurRecherche;}

    if (emailExistant) {
      return res.status(409).json({
        message: "Cette adresse email est déjà utilisée"
      });
    }

    // Modifier les informations dans Supabase
    const { data: utilisateur, error } = await supabase
      .from("utilisateurs")
      .update({
        nom: nom.trim(),
        prenom: prenom.trim(),
        email: emailNormalise
      })
      .eq("id", req.utilisateur.id)
      .select("id, nom, prenom, email, role")
      .maybeSingle();

    if (error) {throw error;}

    if (!utilisateur) {
      return res.status(404).json({
        message: "Utilisateur introuvable"
      });
    }

    return res.status(200).json({
      message: "Informations personnelles modifiées avec succès",
      utilisateur
    });

  } catch (error) {
    console.error("Erreur modification profil :", error);

    return res.status(500).json({
      message: "Erreur lors de la modification des informations personnelles"
    });
  }
});

app.put("/utilisateurs/changer-mot-de-passe", verifierToken, async (req, res) => {
  try {
    const { ancienMotDePasse, nouveauMotDePasse } = req.body;

    if (!ancienMotDePasse || !nouveauMotDePasse) {
      return res.status(400).json({
        message: "Les deux mots de passe sont obligatoires"
      });
    }

    if (nouveauMotDePasse.length < 8) {
      return res.status(400).json({
        message: "Le nouveau mot de passe doit contenir au moins 8 caractères"
      });
    }

    const { data: utilisateur, error } = await supabase
      .from("utilisateurs")
      .select("id, mot_de_passe")
      .eq("id", req.utilisateur.id)
      .maybeSingle();

    if (error) {throw error;}

    if (!utilisateur) {
      return res.status(404).json({
        message: "Utilisateur introuvable"
      });
    }

    const motDePasseCorrect = await bcrypt.compare(
      ancienMotDePasse,
      utilisateur.mot_de_passe
    );

    if (!motDePasseCorrect) {
      return res.status(401).json({
        message: "Ancien mot de passe incorrect"
      });
    }

    const nouveauMotDePasseHache = await bcrypt.hash(nouveauMotDePasse, 10);

    const { error: erreurMaj } = await supabase
      .from("utilisateurs")
      .update({ mot_de_passe: nouveauMotDePasseHache })
      .eq("id", req.utilisateur.id);

    if (erreurMaj) {throw erreurMaj;}

    return res.status(200).json({
      message: "Mot de passe modifié avec succès"
    });

  } catch (error) {
    console.error("Erreur changement mot de passe :", error);

    return res.status(500).json({
      message: "Erreur lors du changement de mot de passe"
    });
  }
});

app.get("/utilisateurs/mes-informations", verifierToken, async (req, res) => {
  try {
    const { data: utilisateur, error } = await supabase
      .from("utilisateurs")
      .select("id, nom, prenom, email, role")
      .eq("id", req.utilisateur.id)
      .maybeSingle();

    if (error) {throw error;}

    if (!utilisateur) {
      return res.status(404).json({
        message: "Utilisateur introuvable"
      });
    }

    return res.status(200).json({
      message: "Informations personnelles récupérées avec succès",
      utilisateur
    });
  } catch (error) {
    console.error("Erreur récupération profil :", error);
    return res.status(500).json({
      message: "Erreur lors de la récupération des informations personnelles"
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

app.get("/utilisateurs/mes-notifications", verifierToken, async (req, res) => {
  try {
    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("utilisateur_id", req.utilisateur.id)
      .order("date", { ascending: false });

    if (error) {
      throw error;
    }

    const mesNotifications = notifications.map((notification) => ({
      id: notification.id,
      utilisateurId: notification.utilisateur_id,
      message: notification.message,
      date: notification.date,
      lu: notification.lu
    }));

    return res.status(200).json({
      message: "Liste de vos notifications",
      notifications: mesNotifications
    });

  } catch (error) {
    console.error("Erreur récupération notifications :", error);

    return res.status(500).json({
      message: "Erreur lors de la récupération des notifications"
    });
  }
});

app.put("/utilisateurs/notifications/:id/lue", verifierToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Identifiant de notification invalide"
      });
    }

    const { data: notification, error } = await supabase
      .from("notifications")
      .update({ lu: true })
      .eq("id", id)
      .eq("utilisateur_id", req.utilisateur.id)
      .select("*")
      .maybeSingle();

    if (error) {throw error;}

    if (!notification) {
      return res.status(404).json({
        message: "Notification introuvable"
      });
    }

    return res.status(200).json({
      message: "Notification marquée comme lue",
      notification
    });

  } catch (error) {
    console.error("Erreur notification :", error);
    return res.status(500).json({
      message: "Erreur lors de la mise à jour de la notification"
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

// Route pour récupérer tous les films
app.get("/films", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("films")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error("Erreur Supabase :", error.message);
      return res.status(500).json({
        message: "Erreur lors de la récupération des films"
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur",
      error: error.message
    });
  }
});

// Démarrage du serveur
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Serveur lancé sur le port ${PORT}`);
  });
}

module.exports = app;
