const express = require("express");

const app = express();
const PORT = 3000;

const films = [
  { id: 1, titre: "Jungle" },
  { id: 2, titre: "King" },
  { id: 3, titre: "Le Roi Lion" }
];

app.get("/films", (req, res) => {
  res.json(films);
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
