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

app.listen(PORT, () => {
  console.log(`Serveur lancé sur le port ${PORT}`);
});
