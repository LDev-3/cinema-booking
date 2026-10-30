const express = require("express");
const QRCode = require("qrcode");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const app = express();
let reservations = [];
let prochainIdReservation = 1;
let billets = [];
let prochainIdBillet = 1;
let utilisateurs = [];
let prochainIdUtilisateur = 1;
let notifications = [];
let prochainIdNotification = 1;
const JWT_SECRET = "cinema_booking_secret_2026_a_changer";
app.use(express.json());
const PORT = 3000;
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
  } catch (error) {
    return res.status(401).json({
      message: "Token invalide ou expiré"
    });
  }
}
const films = [
  {
    id: 1,
    titre: "Jungle",
    description: "Un film d'aventure.",
    duree: 120,
    genre: "Aventure",
    actif: true,
   seances: [
 {
  id: 1,
  date: "2026-11-01",
  heure: "14:00",
  salle: "Salle 1",
  capacite: 100,
  places: [
    { id: 1, rangee: "A", numero: 1, statut: "disponible" },
    { id: 2, rangee: "A", numero: 2, statut: "disponible" },
    { id: 3, rangee: "A", numero: 3, statut: "reservee" },
    { id: 4, rangee: "B", numero: 1, statut: "disponible" },
    { id: 5, rangee: "B", numero: 2, statut: "reservee" }
  ]
},
  {
    id: 2,
    date: "2026-11-01",
    heure: "18:00",
    salle: "Salle 2",
    capacite: 80,
    places: [
      { id: 1, rangee: "A", numero: 1, statut: "disponible" },
      { id: 2, rangee: "A", numero: 2, statut: "disponible" },
      { id: 3, rangee: "A", numero: 3, statut: "reservee" },
      { id: 4, rangee: "B", numero: 1, statut: "disponible" },
      { id: 5, rangee: "B", numero: 2, statut: "reservee" }
    ]
  }
]
  },
  {
    id: 2,
    titre: "King",
    description: "Un film dramatique.",
    duree: 105,
    genre: "Drame",
    actif: true,
    seances: [
    {
      id: 3,
      date: "2026-11-02",
      heure: "16:00",
      salle: "Salle 1",
      capacite: 100,
      places: [
      { id: 1, rangee: "A", numero: 1, statut: "disponible" },
      { id: 2, rangee: "A", numero: 2, statut: "disponible" },
      { id: 3, rangee: "A", numero: 3, statut: "reservee" },
      { id: 4, rangee: "B", numero: 1, statut: "disponible" },
      { id: 5, rangee: "B", numero: 2, statut: "reservee" }
    ]
    },
    {
      id: 4,
      date: "2026-11-02",
      heure: "20:00",
      salle: "Salle 2",
      capacite: 80,
      places: [
      { id: 1, rangee: "A", numero: 1, statut: "disponible" },
      { id: 2, rangee: "A", numero: 2, statut: "disponible" },
      { id: 3, rangee: "A", numero: 3, statut: "reservee" },
      { id: 4, rangee: "B", numero: 1, statut: "disponible" },
      { id: 5, rangee: "B", numero: 2, statut: "reservee" }
    ]
    }
  ]
  },
  {
    id: 3,
    titre: "Le Roi Lion",
    description: "L'histoire de Simba.",
    duree: 118,
    genre: "Animation",
    actif: true,
  seances: [
    {
      id: 5,
      date: "2026-11-03",
      heure: "15:00",
      salle: "Salle 1",
      capacite: 100,
      places: [
        { id: 1, rangee: "A", numero: 1, statut: "disponible" },
        { id: 2, rangee: "A", numero: 2, statut: "disponible" },
        { id: 3, rangee: "A", numero: 3, statut: "reservee" },
        { id: 4, rangee: "B", numero: 1, statut: "disponible" },
        { id: 5, rangee: "B", numero: 2, statut: "reservee" }
      ]
    },
    {
      id: 6,
      date: "2026-11-03",
      heure: "19:00",
      salle: "Salle 2",
      capacite: 80,
      places: [
      { id: 1, rangee: "A", numero: 1, statut: "disponible" },
      { id: 2, rangee: "A", numero: 2, statut: "disponible" },
      { id: 3, rangee: "A", numero: 3, statut: "reservee" },
      { id: 4, rangee: "B", numero: 1, statut: "disponible" },
      { id: 5, rangee: "B", numero: 2, statut: "reservee" }
    ]
    }
  ]
  }
];
let prochainIdSeance = Math.max(
  ...films.flatMap(film => film.seances.map(seance => seance.id))
) + 1;
let prochainIdFilm = Math.max(...films.map(film => film.id)) + 1;
app.put("/salles/:nom/capacite", (req, res) => {
  const nomSalle = decodeURIComponent(req.params.nom);
  const { capacite } = req.body;

  if (!Number.isInteger(capacite) || capacite <= 0) {
    return res.status(400).json({
      message: "La capacité doit être un entier positif"
    });
  }

  const seancesSalle = films.flatMap((film) =>
    film.seances.filter((seance) => seance.salle === nomSalle)
  );

  if (seancesSalle.length === 0) {
    return res.status(404).json({
      message: "Salle introuvable"
    });
  }

  const placesReservees = seancesSalle.map((seance) =>
    seance.places.filter((place) => place.statut === "reservee").length
  );

  if (placesReservees.some((nombre) => capacite < nombre)) {
    return res.status(400).json({
      message: "La capacité ne peut pas être inférieure au nombre de places réservées"
    });
  }

  seancesSalle.forEach((seance) => {
    const reservees = seance.places.filter(
      (place) => place.statut === "reservee"
    );

    seance.capacite = capacite;
    seance.places = reservees;

    for (let i = 0; i < capacite; i++) {
      const rangee = String.fromCharCode(65 + Math.floor(i / 10));
      const numero = (i % 10) + 1;

      const dejaReservee = reservees.some(
        (place) => place.rangee === rangee && place.numero === numero
      );

      if (!dejaReservee) {
        seance.places.push({
          id: i + 1,
          rangee,
          numero,
          statut: "disponible"
        });
      }
    }
  });

  return res.status(200).json({
    message: "Capacité de la salle modifiée avec succès",
    salle: nomSalle,
    capacite
  });
});
app.get("/salles", (req, res) => {
  const salles = [
    ...new Set(
      films.flatMap((film) =>
        film.seances.map((seance) => seance.salle)
      )
    )
  ];

  return res.status(200).json({
    message: "Liste des salles récupérée avec succès",
    salles
  });
});
app.get("/films", (req, res) => {
  res.json(films);
}); 
app.post("/films", (req, res) => {
  const { titre, description, duree, genre } = req.body;

  // Vérifier les champs obligatoires
  if (!titre || !description || !duree || !genre) {
    return res.status(400).json({
      message: "Tous les champs sont obligatoires"
    });
  }

  // Vérifier la durée
  if (!Number.isInteger(duree) || duree <= 0) {
    return res.status(400).json({
      message: "La durée doit être un nombre entier positif"
    });
  }

  // Créer le nouveau film
  const nouveauFilm = {
    id: prochainIdFilm++,
    titre: titre.trim(),
    description: description.trim(),
    duree,
    genre: genre.trim(),
    seances: []
  };

  films.push(nouveauFilm);

  return res.status(201).json({
    message: "Film ajouté avec succès",
    film: nouveauFilm
  });
});
app.get("/films/:id", (req, res) => {
  const id = parseInt(req.params.id);

  const film = films.find((film) => film.id === id);

  if (!film) {
    return res.status(404).json({
      message: "Film introuvable"
    });
  }

  res.json(film);
});
app.post("/films/:id/seances", (req, res) => {
  const filmId = parseInt(req.params.id);
  const film = films.find((f) => f.id === filmId);

  if (!film) {
    return res.status(404).json({
      message: "Film introuvable"
    });
  }

  const { date, heure, salle, capacite } = req.body;

  if (!date || !heure || !salle || !capacite) {
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

  const places = [];

  for (let i = 0; i < capacite; i++) {
    places.push({
      id: i + 1,
      rangee: String.fromCharCode(65 + Math.floor(i / 10)),
      numero: (i % 10) + 1,
      statut: "disponible"
    });
  }

  const nouvelleSeance = {
    id: prochainIdSeance++,
    date,
    heure,
    salle: salle.trim(),
    capacite,
    places
  };

  film.seances.push(nouvelleSeance);

  return res.status(201).json({
    message: "Séance créée avec succès",
    seance: nouvelleSeance
  });
});
app.put("/seances/:id", (req, res) => {
  const id = parseInt(req.params.id);

  const film = films.find((f) =>
    f.seances.some((s) => s.id === id)
  );

  if (!film) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  const seance = film.seances.find((s) => s.id === id);

  const { date, heure, salle, capacite } = req.body;

  if (!date || !heure || !salle || !capacite) {
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
    capacite <= 0 ||
    capacite < seance.places.filter(
      (p) => p.statut === "reservee"
    ).length
  ) {
    return res.status(400).json({
      message: "Les informations de la séance sont invalides"
    });
  }

  seance.date = date;
  seance.heure = heure;
  seance.salle = salle.trim();

  const placesReservees = seance.places.filter(
    (p) => p.statut === "reservee"
  );

  seance.capacite = capacite;

  seance.places = placesReservees;

  for (let i = placesReservees.length; i < capacite; i++) {
    seance.places.push({
      id: i + 1,
      rangee: String.fromCharCode(65 + Math.floor(i / 10)),
      numero: (i % 10) + 1,
      statut: "disponible"
    });
  }

  return res.status(200).json({
    message: "Séance modifiée avec succès",
    seance
  });
});
app.patch("/seances/:id/annuler", (req, res) => {
  const id = parseInt(req.params.id);

  const film = films.find((f) =>
    f.seances.some((s) => s.id === id)
  );

  if (!film) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  const seance = film.seances.find((s) => s.id === id);

  if (seance.statut === "annulee") {
    return res.status(400).json({
      message: "Cette séance est déjà annulée"
    });
  }

  seance.statut = "annulee";
  seance.dateAnnulation = new Date().toISOString();

  return res.status(200).json({
    message: "Séance annulée avec succès",
    seance
  });
});
app.put("/films/:id", (req, res) => {
  const id = parseInt(req.params.id);

  const film = films.find((f) => f.id === id);

  if (!film) {
    return res.status(404).json({
      message: "Film introuvable"
    });
  }

  const { titre, description, duree, genre } = req.body;

  if (!titre || !description || !duree || !genre) {
    return res.status(400).json({
      message: "Tous les champs sont obligatoires"
    });
  }

  if (
    typeof titre !== "string" ||
    typeof description !== "string" ||
    typeof genre !== "string" ||
    !Number.isInteger(duree) ||
    duree <= 0 ||
    !titre.trim() ||
    !description.trim() ||
    !genre.trim()
  ) {
    return res.status(400).json({
      message: "Les informations du film sont invalides"
    });
  }

  film.titre = titre.trim();
  film.description = description.trim();
  film.duree = duree;
  film.genre = genre.trim();

  return res.status(200).json({
    message: "Film modifié avec succès",
    film
  });
});
app.patch("/films/:id/desactiver", (req, res) => {
  const id = parseInt(req.params.id);

  const film = films.find((f) => f.id === id);

  if (!film) {
    return res.status(404).json({
      message: "Film introuvable"
    });
  }

  if (!film.actif) {
    return res.status(400).json({
      message: "Ce film est déjà désactivé"
    });
  }

  film.actif = false;

  return res.status(200).json({
    message: "Film désactivé avec succès",
    film
  });
});
app.get("/films/:id/seances", (req, res) => {
  const id = parseInt(req.params.id);

  const film = films.find((film) => film.id === id);

  if (!film) {
    return res.status(404).json({
      message: "Film introuvable"
    });
  }

  res.json(film.seances);
});
app.post("/reservations/selection-seance", (req, res) => {
  const { seanceId } = req.body;

  if (!seanceId) {
    return res.status(400).json({
      message: "Veuillez sélectionner une séance"
    });
  }

  let seanceTrouvee = null;
  let filmAssocie = null;

  for (const film of films) {
    const seance = film.seances.find(
      (s) => s.id === parseInt(seanceId)
    );

    if (seance) {
      seanceTrouvee = seance;
      filmAssocie = film;
      break;
    }
  }

  if (!seanceTrouvee) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  res.json({
    message: "Séance sélectionnée avec succès",
    film: filmAssocie.titre,
    seance: seanceTrouvee
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
app.get("/seances/:id", (req, res) => {
  const id = parseInt(req.params.id);

  let seanceTrouvee = null;

  for (const film of films) {
    const seance = film.seances.find((s) => s.id === id);

    if (seance) {
      seanceTrouvee = {
        film: film.titre,
        ...seance
      };
      break;
    }
  }

  if (!seanceTrouvee) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  res.json(seanceTrouvee);
});

app.get("/seances/:id/places", (req, res) => {
  const id = parseInt(req.params.id);

  let seanceTrouvee = null;

  for (const film of films) {
    const seance = film.seances.find((s) => s.id === id);

    if (seance) {
      seanceTrouvee = seance;
      break;
    }
  }

  if (!seanceTrouvee) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  res.json({
    seanceId: seanceTrouvee.id,
    salle: seanceTrouvee.salle,
    places: seanceTrouvee.places
  });
});
app.get("/seances/:id/places/disponibles", (req, res) => {
  const id = parseInt(req.params.id);

  let seanceTrouvee = null;

  for (const film of films) {
    const seance = film.seances.find((s) => s.id === id);

    if (seance) {
      seanceTrouvee = seance;
      break;
    }
  }

  if (!seanceTrouvee) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  const placesDisponibles = seanceTrouvee.places.filter(
    (place) => place.statut === "disponible"
  );

  res.json({
    seanceId: seanceTrouvee.id,
    salle: seanceTrouvee.salle,
    placesDisponibles: placesDisponibles
  });
});
app.get("/films/recherche", (req, res) => {
  const recherche = req.query.titre;

  if (!recherche) {
    return res.status(400).json({
      message: "Veuillez saisir un titre de film"
    });
  }

  const resultats = films.filter((film) =>
    film.titre.toLowerCase().includes(recherche.toLowerCase())
  );

  res.json(resultats);
});
app.post("/seances/:id/places/selection", (req, res) => {
  const id = parseInt(req.params.id);

  const { placesIds } = req.body;

  if (!Array.isArray(placesIds) || placesIds.length === 0) {
    return res.status(400).json({
      message: "Veuillez sélectionner au moins une place"
    });
  }

  let seanceTrouvee = null;

  for (const film of films) {
    const seance = film.seances.find((s) => s.id === id);

    if (seance) {
      seanceTrouvee = seance;
      break;
    }
  }

  if (!seanceTrouvee) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  const placesSelectionnees = seanceTrouvee.places.filter(
    (place) => placesIds.includes(place.id)
  );

  if (placesSelectionnees.length !== placesIds.length) {
    return res.status(400).json({
      message: "Une ou plusieurs places sont introuvables"
    });
  }

  const placesIndisponibles = placesSelectionnees.filter(
    (place) => place.statut !== "disponible"
  );

  if (placesIndisponibles.length > 0) {
    return res.status(400).json({
      message: "Une ou plusieurs places ne sont pas disponibles"
    });
  }

  res.json({
    message: "Places sélectionnées avec succès",
    seanceId: seanceTrouvee.id,
    placesSelectionnees: placesSelectionnees
  });
});
app.get("/seances/:id/places/reservees", (req, res) => {
  const id = parseInt(req.params.id);

  let seanceTrouvee = null;

  for (const film of films) {
    const seance = film.seances.find((s) => s.id === id);

    if (seance) {
      seanceTrouvee = seance;
      break;
    }
  }

  if (!seanceTrouvee) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  const placesReservees = seanceTrouvee.places.filter(
    (place) => place.statut === "reservee"
  );

  res.json({
    seanceId: seanceTrouvee.id,
    salle: seanceTrouvee.salle,
    placesReservees: placesReservees
  });
});
app.post("/reservations/confirmer", (req, res) => {
  const { seanceId, placesIds, nom, prenom, email, telephone } = req.body;

  if (!seanceId || !Array.isArray(placesIds) || placesIds.length === 0 ||
      !nom || !prenom || !email || !telephone) {
    return res.status(400).json({
      message: "Informations de réservation incomplètes"
    });
  }

  let seanceTrouvee = null;

  for (const film of films) {
    const seance = film.seances.find(
      (s) => s.id === parseInt(seanceId)
    );

    if (seance) {
      seanceTrouvee = seance;
      break;
    }
  }

  if (!seanceTrouvee) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  const placesSelectionnees = seanceTrouvee.places.filter(
    (place) => placesIds.includes(place.id)
  );

  if (placesSelectionnees.length !== placesIds.length) {
    return res.status(400).json({
      message: "Une ou plusieurs places sont introuvables"
    });
  }

  if (placesSelectionnees.some((place) => place.statut !== "disponible")) {
    return res.status(400).json({
      message: "Une ou plusieurs places ne sont plus disponibles"
    });
  }

  const idReservation = prochainIdReservation++;

const reservation = {
  id: idReservation,
  numeroReservation: `RES-${String(idReservation).padStart(6, "0")}`,
    seanceId: parseInt(seanceId),
    client: { nom, prenom, email, telephone },
    places: placesSelectionnees.map((place) => ({
      id: place.id,
      rangee: place.rangee,
      numero: place.numero
    })),
    dateReservation: new Date().toISOString(),
    statut: "confirmee"
  };

  placesSelectionnees.forEach((place) => {
    place.statut = "reservee";
  });

  reservations.push(reservation);
const utilisateur = utilisateurs.find(
  (u) => u.email.trim().toLowerCase() ===
    reservation.client.email.trim().toLowerCase()
);

notifications.push({
  id: prochainIdNotification++,
  utilisateurId: utilisateur ? utilisateur.id : null,
  message: `Votre réservation ${reservation.numeroReservation} a été confirmée.`,
  date: new Date().toISOString(),
  lu: false
});
console.log("Notifications enregistrées :", notifications);
console.log("Utilisateurs enregistrés :", utilisateurs);
  res.status(201).json({
    message: "Réservation confirmée avec succès",
    reservation
  });
});
app.post("/reservations/:id/billet", (req, res) => {
  const reservationId = parseInt(req.params.id);

  const reservation = reservations.find(
    (r) => r.id === reservationId
  );

  if (!reservation) {
    return res.status(404).json({
      message: "Réservation introuvable"
    });
  }

  const billetExistant = billets.find(
    (b) => b.reservationId === reservationId
  );

  if (billetExistant) {
    return res.status(409).json({
      message: "Un billet existe déjà pour cette réservation",
      billet: billetExistant
    });
  }

  const billet = {
    id: prochainIdBillet++,
    numeroBillet: `BIL-${String(prochainIdBillet - 1).padStart(6, "0")}`,
    reservationId: reservation.id,
    numeroReservation: reservation.numeroReservation,
    client: reservation.client,
    seanceId: reservation.seanceId,
    places: reservation.places,
    dateGeneration: new Date().toISOString(),
    statut: "valide"
  };

  billets.push(billet);

  res.status(201).json({
    message: "Billet généré avec succès",
    billet
  });
});
app.get("/billets/:numero", (req, res) => {
  const numero = req.params.numero;

  const billet = billets.find(
    (b) => b.numeroBillet === numero
  );

  if (!billet) {
    return res.status(404).json({
      message: "Billet introuvable"
    });
  }

  res.json({
    message: "Billet trouvé",
    billet
  });
});
app.get("/billets/:numero/qr-code", async (req, res) => {
   console.log("Route QR code appelée");
  const numero = req.params.numero;

  const billet = billets.find(
    (b) => b.numeroBillet === numero
  );

  if (!billet) {
    return res.status(404).json({
      message: "Billet introuvable"
    });
  }

  try {
    const contenuQR = JSON.stringify({
      numeroBillet: billet.numeroBillet,
      numeroReservation: billet.numeroReservation,
      reservationId: billet.reservationId
    });

    const qrCode = await QRCode.toDataURL(contenuQR);

    res.json({
      message: "QR code généré avec succès",
      numeroBillet: billet.numeroBillet,
      qrCode
    });

  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la génération du QR code"
    });
  }
});
app.post("/billets/:numero/valider", (req, res) => {
  const numero = req.params.numero;

  const billet = billets.find(
    (b) => b.numeroBillet === numero
  );

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

  billet.statut = "utilise";
  billet.dateUtilisation = new Date().toISOString();

  res.json({
    message: "Billet validé avec succès. Accès autorisé.",
    billet
  });
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

  const emailNormalise = email.trim().toLowerCase();

  const utilisateurExistant = utilisateurs.find(
    (u) => u.email === emailNormalise
  );

  if (utilisateurExistant) {
    return res.status(409).json({
      message: "Cette adresse email est déjà utilisée"
    });
  }

  try {
    const motDePasseHache = await bcrypt.hash(motDePasse, 10);

    const utilisateur = {
      id: prochainIdUtilisateur++,
      nom: nom.trim(),
      prenom: prenom.trim(),
      email: emailNormalise,
      motDePasse: motDePasseHache,
      role: "utilisateur",
      dateCreation: new Date().toISOString()
    };

    utilisateurs.push(utilisateur);

    return res.status(201).json({
      message: "Compte utilisateur créé avec succès",
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        prenom: utilisateur.prenom,
        email: utilisateur.email,
        role: utilisateur.role,
        dateCreation: utilisateur.dateCreation
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erreur lors de la création du compte"
    });
  }
});
app.post("/utilisateurs/connexion", async (req, res) => {
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

  // Rechercher l'utilisateur
  const emailNormalise = email.trim().toLowerCase();

  const utilisateur = utilisateurs.find(
    (u) => u.email === emailNormalise
  );

  if (!utilisateur) {
    return res.status(401).json({
      message: "Email ou mot de passe incorrect"
    });
  }

  // Vérifier le mot de passe
  const motDePasseCorrect = await bcrypt.compare(
    motDePasse,
    utilisateur.motDePasse
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
});
app.get("/utilisateurs/mes-reservations", verifierToken, (req, res) => {
  const mesReservations = reservations.filter(
    (reservation) =>
      reservation.client.email.toLowerCase() ===
      req.utilisateur.email.toLowerCase()
  );

  return res.status(200).json({
    message: "Liste de vos réservations",
    reservations: mesReservations
  });
});
app.get("/utilisateurs/mes-billets", verifierToken, (req, res) => {
  const mesReservations = reservations.filter(
    (reservation) =>
      reservation.client.email.toLowerCase() ===
      req.utilisateur.email.toLowerCase()
  );

  const mesBillets = billets.filter((billet) =>
    mesReservations.some(
      (reservation) => reservation.id === billet.reservationId
    )
  );

  return res.status(200).json({
    message: "Liste de vos billets",
    billets: mesBillets
  });
});
app.put("/utilisateurs/mes-informations", verifierToken, (req, res) => {
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

  const utilisateur = utilisateurs.find(
    (u) => u.id === req.utilisateur.id
  );

  if (!utilisateur) {
    return res.status(404).json({
      message: "Utilisateur introuvable"
    });
  }

  const emailDejaUtilise = utilisateurs.find(
    (u) => u.email === emailNormalise && u.id !== utilisateur.id
  );

  if (emailDejaUtilise) {
    return res.status(409).json({
      message: "Cette adresse email est déjà utilisée"
    });
  }

  utilisateur.nom = nom.trim();
  utilisateur.prenom = prenom.trim();
  utilisateur.email = emailNormalise;

  return res.status(200).json({
    message: "Informations personnelles modifiées avec succès",
    utilisateur: {
      id: utilisateur.id,
      nom: utilisateur.nom,
      prenom: utilisateur.prenom,
      email: utilisateur.email,
      role: utilisateur.role
    }
  });
});
app.put("/reservations/:id/annuler", verifierToken, (req, res) => {
  const idReservation = parseInt(req.params.id);

  const reservation = reservations.find(
    (r) => r.id === idReservation
  );

  if (!reservation) {
    return res.status(404).json({
      message: "Réservation introuvable"
    });
  }

  if (
    reservation.client.email.toLowerCase() !==
    req.utilisateur.email.toLowerCase()
  ) {
    return res.status(403).json({
      message: "Vous ne pouvez pas annuler cette réservation"
    });
  }

  if (reservation.statut === "annulee") {
    return res.status(400).json({
      message: "Cette réservation est déjà annulée"
    });
  }

  // Retrouver la séance concernée
  const seance = films
    .flatMap((film) => film.seances)
    .find((s) => s.id === reservation.seanceId);

  if (!seance) {
    return res.status(404).json({
      message: "Séance introuvable"
    });
  }

  // Libérer les places réservées
  reservation.places.forEach((placeReservation) => {
    const place = seance.places.find(
      (p) => p.id === placeReservation.id
    );

    if (place) {
      place.statut = "disponible";
    }
  });

  reservation.statut = "annulee";
  notifications.push({
  id: prochainIdNotification++,
  utilisateurId: req.utilisateur.id,
  message: `Votre réservation ${reservation.numeroReservation} a été annulée.`,
  date: new Date().toISOString(),
  lu: false
});
  reservation.dateAnnulation = new Date().toISOString();

  return res.status(200).json({
    message: "Réservation annulée avec succès",
    reservation
  });
});
app.get("/utilisateurs/mes-notifications", verifierToken, (req, res) => {
  const mesNotifications = notifications.filter(
    (notification) =>
      notification.utilisateurId === req.utilisateur.id
  );

  return res.status(200).json({
    message: "Liste de vos notifications",
    notifications: mesNotifications
  });
});
 console.log("Route QR code chargée");
app.listen(PORT, () => {
 
  console.log(`Serveur lancé sur le port ${PORT}`);
});
