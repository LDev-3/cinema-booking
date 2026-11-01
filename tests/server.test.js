const request = require("supertest");
const app = require("../server");

describe("Tests de l'API Cinema Booking", () => {
  test("L'API répond correctement à une route inexistante", async () => {
    const response = await request(app).get("/route-inexistante");

    expect(response.status).toBe(404);
  });
});
test("Récupérer la liste des films", async () => {
  const response = await request(app).get("/films");

  expect(response.status).toBe(200);
  expect(response.headers["content-type"]).toMatch(/json/);
  expect(Array.isArray(response.body)).toBe(true);
});
test("Film inexistant : retourner une erreur 404", async () => {
  const response = await request(app).get("/films/999999");

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Film introuvable");
});
test("Refuser l'ajout d'un film avec des champs manquants", async () => {
  const response = await request(app)
    .post("/films")
    .send({ titre: "Film de test" });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Tous les champs sont obligatoires");
});
test("Ajouter un film avec des données valides", async () => {
  const response = await request(app)
    .post("/films")
    .send({
      titre: "Film Test",
      description: "Un film pour les tests",
      duree: 120,
      genre: "Action"
    });

  expect(response.status).toBe(201);
  expect(response.body.film.titre).toBe("Film Test");
});
test("Refuser la création d'une séance pour un film inexistant", async () => {
  const response = await request(app)
    .post("/films/999999/seances")
    .send({
      date: "2026-12-15",
      heure: "18:00",
      salle: "Salle 1",
      capacite: 50
    });

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Film introuvable");
});
test("Refuser la création d'une séance avec des champs manquants", async () => {
  // Créer d'abord un film pour pouvoir lui associer une séance
  const filmResponse = await request(app)
    .post("/films")
    .send({
      titre: "Film Test Séance",
      description: "Film utilisé pour tester les séances",
      duree: 120,
      genre: "Action"
    });

  const filmId = filmResponse.body.film.id;

  const response = await request(app)
    .post(`/films/${filmId}/seances`)
    .send({
      date: "2026-12-15",
      heure: "18:00"
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Tous les champs sont obligatoires");
});
test("Modifier une séance avec des données valides", async () => {
  const filmResponse = await request(app)
    .post("/films")
    .send({
      titre: "Film Modification",
      description: "Film pour tester la modification",
      duree: 120,
      genre: "Action"
    });

  const filmId = filmResponse.body.film.id;

  const seanceResponse = await request(app)
    .post(`/films/${filmId}/seances`)
    .send({
      date: "2026-12-15",
      heure: "18:00",
      salle: "Salle 1",
      capacite: 5
    });

  const seanceId = seanceResponse.body.seance.id;

  const response = await request(app)
    .put(`/seances/${seanceId}`)
    .send({
      date: "2026-12-16",
      heure: "20:00",
      salle: "Salle 2",
      capacite: 10
    });

  expect(response.status).toBe(200);
});
test("Refuser une réservation avec une adresse e-mail invalide", async () => {
  const response = await request(app)
    .post("/reservations/confirmer")
    .send({
      seanceId: 1,
      placesIds: [1],
      nom: "Dupont",
      prenom: "Jean",
      email: "adresse-invalide",
      telephone: "0612345678"
    });

  expect(response.status).toBe(400);
});