const express = require("express");

const app = express();
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
    capacite: 100
  },
  {
    id: 2,
    date: "2026-11-01",
    heure: "18:00",
    salle: "Salle 2",
    capacite: 80
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
      capacite: 100
    },
    {
      id: 4,
      date: "2026-11-02",
      heure: "20:00",
      salle: "Salle 2",
      capacite: 80
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
      capacite: 100
    },
    {
      id: 6,
      date: "2026-11-03",
      heure: "19:00",
      salle: "Salle 2",
      capacite: 80
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

app.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});
