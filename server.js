const express = require("express");

const app = express();
let reservations = [];
let prochainIdReservation = 1;
let billets = [];
let prochainIdBillet = 1;
app.use(express.json());
const PORT = 3000;

const films = [
  {
    id: 1,
    titre: "Jungle",
    description: "Un film d'aventure.",
    duree: 120,
    genre: "Aventure",
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

app.get("/films", (req, res) => {
  res.json(films);
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
app.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});
