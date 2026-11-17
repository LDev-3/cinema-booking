const request = require("supertest");
const app = require("../server");
const jwt = require("jsonwebtoken");
const supabase = require("../supabase");
const tokenAdmin = jwt.sign(
  {
    id: 1,
    email: "admin@test.com",
    role: "admin"
  },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);
afterEach(() => {
  jest.restoreAllMocks();
});
describe("Tests de l'API Cinema Booking", () => {
  test("L'API répond correctement à une route inexistante", async () => {
    const response = await request(app).get("/route-inexistante");

    expect(response.status).toBe(404);
  });
});
beforeEach(() => {
  jest.spyOn(console, "error").mockImplementation(() => {});
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
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({ titre: "Film de test" });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Tous les champs sont obligatoires");
});




test("Ajouter un film avec des données valides", async () => {
  const response = await request(app)
    .post("/films")
    .set("Authorization", `Bearer ${tokenAdmin}`)
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
    .set("Authorization", `Bearer ${tokenAdmin}`)
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
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({
      titre: "Film Test Séance",
      description: "Film utilisé pour tester les séances",
      duree: 120,
      genre: "Action"
    });

  const filmId = filmResponse.body.film.id;

  const response = await request(app)
    .post(`/films/${filmId}/seances`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({
      date: "2026-12-15",
      heure: "18:00"
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Tous les champs sont obligatoires");
});




test("Modifier une séance avec des données valides", async () => {
  // Générer deux dates différentes pour éviter les conflits dans Supabase
  const jourAleatoire = Math.floor(Math.random() * 3650);

  const dateTest = new Date(
    Date.now() + jourAleatoire * 86400000
  ).toISOString().slice(0, 10);

  const dateModification = new Date(
    Date.now() + (jourAleatoire + 1) * 86400000
  ).toISOString().slice(0, 10);

  // Créer un film
  const filmResponse = await request(app)
    .post("/films")
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({
      titre: "Film Modification",
      description: "Film pour tester la modification",
      duree: 120,
      genre: "Action"
    });

  expect(filmResponse.status).toBe(201);

  const filmId = filmResponse.body.film.id;

  // Créer une séance
  const seanceResponse = await request(app)
    .post(`/films/${filmId}/seances`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({
      date: dateTest,
      heure: "18:00",
      salle: "Salle 1",
      capacite: 5
    });

  expect(seanceResponse.status).toBe(201);

  const seanceId = seanceResponse.body.seance.id;

  // Modifier la séance
  const response = await request(app)
    .put(`/seances/${seanceId}`)
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({
      date: dateModification,
      heure: "20:00",
      salle: "Salle 2",
      capacite: 10
    });

  console.log("Réponse de modification :", response.status, response.body);

  expect(response.status).toBe(200);
});



test("Refuser une réservation avec une adresse e-mail invalide", async () => {
  const response = await request(app)
    .post("/reservations/confirmer")
    .set("Authorization", `Bearer ${tokenAdmin}`)
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


test("Refuser l'accès aux réservations sans authentification", async () => {
  const response = await request(app).get("/reservations");

  expect(response.status).toBe(401);
});

test("Autoriser l'accès aux réservations avec un compte administrateur", async () => {
  const response = await request(app)
    .get("/reservations")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(200);
});

test("Refuser l'accès aux réservations avec un compte utilisateur", async () => {
  const tokenUtilisateur = jwt.sign(
    {
      id: 2,
      email: "utilisateur@test.com",
      role: "user"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .get("/reservations")
    .set("Authorization", `Bearer ${tokenUtilisateur}`);

  expect(response.status).toBe(403);
});

test("Refuser l'accès aux réservations avec un token invalide", async () => {
  const response = await request(app)
    .get("/reservations")
    .set("Authorization", "Bearer faux-token");

  expect(response.status).toBe(401);
});

test("Refuser l'ajout d'un film avec un compte utilisateur", async () => {
  const tokenUtilisateur = jwt.sign(
    {
      id: 2,
      email: "utilisateur@test.com",
      role: "user"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .post("/films")
    .set("Authorization", `Bearer ${tokenUtilisateur}`)
    .send({
      titre: "Film non autorisé",
      description: "Test de sécurité",
      duree: 120,
      genre: "Action"
    });

  expect(response.status).toBe(403);
});

test("Refuser l'ajout d'un film avec un token invalide", async () => {
  const response = await request(app)
    .post("/films")
    .set("Authorization", "Bearer faux-token")
    .send({
      titre: "Film non autorisé",
      description: "Test de sécurité",
      duree: 120,
      genre: "Action"
    });

  expect(response.status).toBe(401);
});

test("Refuser le changement de mot de passe si les champs sont manquants", async () => {
  const response = await request(app)
    .put("/utilisateurs/changer-mot-de-passe")
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({
      ancienMotDePasse: "",
      nouveauMotDePasse: ""
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe(
    "Les deux mots de passe sont obligatoires"
  );
});

test("Refuser un nouveau mot de passe trop court", async () => {
  const response = await request(app)
    .put("/utilisateurs/changer-mot-de-passe")
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({
      ancienMotDePasse: "AncienMotDePasse123",
      nouveauMotDePasse: "abc"
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe(
    "Le nouveau mot de passe doit contenir au moins 8 caractères"
  );
});

test("Refuser le changement avec un ancien mot de passe incorrect", async () => {
  const response = await request(app)
    .put("/utilisateurs/changer-mot-de-passe")
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({
      ancienMotDePasse: "AncienMotDePasseIncorrect_2026!",
      nouveauMotDePasse: "NouveauMotDePasse123!"
    });

  expect(response.status).toBe(401);
  expect(response.body.message).toBe("Ancien mot de passe incorrect");
});

test("Refuser le changement de mot de passe pour un utilisateur inexistant", async () => {
  const tokenInexistant = jwt.sign(
    {
      id: 999999,
      email: "inexistant@test.com",
      role: "user"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .put("/utilisateurs/changer-mot-de-passe")
    .set("Authorization", `Bearer ${tokenInexistant}`)
    .send({
      ancienMotDePasse: "AncienMotDePasse123!",
      nouveauMotDePasse: "NouveauMotDePasse123!"
    });

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Utilisateur introuvable");
});

test("Récupérer les informations personnelles de l'administrateur", async () => {
  const response = await request(app)
    .get("/utilisateurs/mes-informations")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(200);
  expect(response.body.utilisateur).toBeDefined();
  expect(response.body.utilisateur.id).toBe(1);
  expect(response.body.utilisateur).toHaveProperty("email");
  expect(response.body.utilisateur).toHaveProperty("role");
  expect(response.body.utilisateur).not.toHaveProperty("mot_de_passe");
});

test("Refuser la récupération du profil d'un utilisateur inexistant", async () => {
  const tokenInexistant = jwt.sign(
    {
      id: 999999,
      email: "inexistant@test.com",
      role: "user"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .get("/utilisateurs/mes-informations")
    .set("Authorization", `Bearer ${tokenInexistant}`);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Utilisateur introuvable");
});

test("Refuser l'annulation avec un identifiant de réservation invalide", async () => {
  const response = await request(app)
    .put("/reservations/abc/annuler")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(400);
  expect(response.body.message).toBe(
    "Identifiant de réservation invalide"
  );
});

test("Refuser l'annulation d'une réservation inexistante", async () => {
  const response = await request(app)
    .put("/reservations/999999999/annuler")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(404);
  expect(response.body.message).toMatch(/introuvable/i);
});

test("Récupérer les réservations de l'utilisateur connecté", async () => {
  const response = await request(app)
    .get("/utilisateurs/mes-reservations")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe("Liste de vos réservations");
  expect(Array.isArray(response.body.reservations)).toBe(true);
});

test("Récupérer les billets de l'utilisateur connecté", async () => {
  const response = await request(app)
    .get("/utilisateurs/mes-billets")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe("Liste de vos billets");
  expect(Array.isArray(response.body.billets)).toBe(true);
});

test("Refuser la modification du profil si des champs sont manquants", async () => {
  const response = await request(app)
    .put("/utilisateurs/mes-informations")
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({
      nom: "",
      prenom: "Test",
      email: "admin@test.com"
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Tous les champs sont obligatoires");
});

test("Refuser la modification du profil avec une adresse email invalide", async () => {
  const response = await request(app)
    .put("/utilisateurs/mes-informations")
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({
      nom: "Test",
      prenom: "Admin",
      email: "adresse-invalide"
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Adresse email invalide");
});


test("Refuser la modification du profil avec une adresse email déjà utilisée", async () => {
  const tokenUtilisateurTest = jwt.sign(
    {
      id: 2,
      email: "paul.test@example.com",
      role: "utilisateur"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .put("/utilisateurs/mes-informations")
    .set("Authorization", `Bearer ${tokenUtilisateurTest}`)
    .send({
      nom: "Martin",
      prenom: "Paul",
      email: "jean.dupont.test@gmail.com"
    });

  expect(response.status).toBe(409);
  expect(response.body.message).toBe(
    "Cette adresse email est déjà utilisée"
  );
});


test("Retourner 404 si l'utilisateur est introuvable lors de la modification du profil", async () => {
  const tokenInexistant = jwt.sign(
    {
      id: 999999,
      email: "inexistant@test.com",
      role: "user"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .put("/utilisateurs/mes-informations")
    .set("Authorization", `Bearer ${tokenInexistant}`)
    .send({
      nom: "Test",
      prenom: "Utilisateur",
      email: "profil.inexistant.999999@test.com"
    });

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Utilisateur introuvable");
});

test("Modifier le profil avec les informations actuelles", async () => {
  const tokenTest = jwt.sign(
    {
      id: 2,
      email: "paul.test@example.com",
      role: "utilisateur"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .put("/utilisateurs/mes-informations")
    .set("Authorization", `Bearer ${tokenTest}`)
    .send({
      nom: "Martin",
      prenom: "Paul",
      email: "paul.test@example.com"
    });

  expect(response.status).toBe(200);
  expect(response.body.message).toBe(
    "Informations personnelles modifiées avec succès"
  );
  expect(response.body.utilisateur.email).toBe("paul.test@example.com");
});

test("Normaliser l'adresse email lors de la modification du profil", async () => {
  const tokenTest = jwt.sign(
    {
      id: 2,
      email: "paul.test@example.com",
      role: "utilisateur"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .put("/utilisateurs/mes-informations")
    .set("Authorization", `Bearer ${tokenTest}`)
    .send({
      nom: "Martin",
      prenom: "Paul",
      email: " PAUL.TEST@EXAMPLE.COM "
    });

  expect(response.status).toBe(200);
  expect(response.body.utilisateur.email).toBe("paul.test@example.com");
});
test("GET /utilisateurs/mes-notifications doit retourner les notifications de l'utilisateur", async () => {
  const response = await request(app)
    .get("/utilisateurs/mes-notifications")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe("Liste de vos notifications");
  expect(Array.isArray(response.body.notifications)).toBe(true);
});
test("PUT /utilisateurs/notifications/:id/lue doit refuser un identifiant invalide", async () => {
  const response = await request(app)
    .put("/utilisateurs/notifications/abc/lue")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Identifiant de notification invalide");
});
test("PUT /utilisateurs/notifications/:id/lue doit retourner 404 si la notification est introuvable", async () => {
  const response = await request(app)
    .put("/utilisateurs/notifications/999999999/lue")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Notification introuvable");
});
test("GET /statistiques/seances-proches-saturation doit refuser l'accès à un utilisateur non administrateur", async () => {
  const tokenUtilisateur = jwt.sign(
    {
      id: 2,
      email: "paul.test@example.com",
      role: "utilisateur"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .get("/statistiques/seances-proches-saturation")
    .set("Authorization", `Bearer ${tokenUtilisateur}`);

  expect(response.status).toBe(403);
  expect(response.body.message).toBe("Accès réservé aux administrateurs");
});
test("GET /statistiques/seances-proches-saturation doit retourner les statistiques pour un administrateur", async () => {
  const response = await request(app)
    .get("/statistiques/seances-proches-saturation")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe(
    "Séances proches de la saturation récupérées avec succès"
  );
  expect(Array.isArray(response.body.seances)).toBe(true);
  expect(typeof response.body.nombreSeances).toBe("number");
});
test("GET /statistiques/horaires-plus-demandes doit retourner les horaires pour un administrateur", async () => {
  const response = await request(app)
    .get("/statistiques/horaires-plus-demandes")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe(
    "Horaires les plus demandés récupérés avec succès"
  );
  expect(Array.isArray(response.body.horaires)).toBe(true);
});


test("GET /statistiques/journees-plus-frequentees doit retourner les journées pour un administrateur", async () => {
  const response = await request(app)
    .get("/statistiques/journees-plus-frequentees")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe(
    "Journées les plus fréquentées récupérées avec succès"
  );
  expect(Array.isArray(response.body.journees)).toBe(true);
});
test("GET /statistiques/periodes-forte-affluence doit retourner les périodes pour un administrateur", async () => {
  const response = await request(app)
    .get("/statistiques/periodes-forte-affluence")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe(
    "Périodes de forte affluence récupérées avec succès"
  );
  expect(Array.isArray(response.body.periodes)).toBe(true);
});
test("GET /statistiques/horaires-plus-demandes doit refuser l'accès à un utilisateur non administrateur", async () => {
  const tokenUtilisateur = jwt.sign(
    {
      id: 2,
      email: "paul.test@example.com",
      role: "utilisateur"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .get("/statistiques/horaires-plus-demandes")
    .set("Authorization", `Bearer ${tokenUtilisateur}`);

  expect(response.status).toBe(403);
  expect(response.body.message).toBe("Accès réservé aux administrateurs");
});
test("GET /statistiques/journees-plus-frequentees doit refuser l'accès à un utilisateur non administrateur", async () => {
  const tokenUtilisateur = jwt.sign(
    {
      id: 2,
      email: "paul.test@example.com",
      role: "utilisateur"
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .get("/statistiques/journees-plus-frequentees")
    .set("Authorization", `Bearer ${tokenUtilisateur}`);

  expect(response.status).toBe(403);
  expect(response.body.message).toBe("Accès réservé aux administrateurs");
});
test("GET /statistiques/horaires-plus-demandes doit refuser l'accès à un utilisateur classique", async () => {
  const tokenUtilisateur = jwt.sign(
    { id: 2, email: "paul.test@example.com", role: "utilisateur" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .get("/statistiques/horaires-plus-demandes")
    .set("Authorization", `Bearer ${tokenUtilisateur}`);

  expect(response.status).toBe(403);
  expect(response.body.message).toBe("Accès réservé aux administrateurs");
});
test("GET /statistiques/journees-plus-frequentees doit refuser l'accès à un utilisateur classique", async () => {
  const tokenUtilisateur = jwt.sign(
    { id: 2, email: "paul.test@example.com", role: "utilisateur" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .get("/statistiques/journees-plus-frequentees")
    .set("Authorization", `Bearer ${tokenUtilisateur}`);

  expect(response.status).toBe(403);
  expect(response.body.message).toBe("Accès réservé aux administrateurs");
});
test("GET /statistiques/periodes-forte-affluence doit refuser l'accès à un utilisateur classique", async () => {
  const tokenUtilisateur = jwt.sign(
    { id: 2, email: "paul.test@example.com", role: "utilisateur" },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  const response = await request(app)
    .get("/statistiques/periodes-forte-affluence")
    .set("Authorization", `Bearer ${tokenUtilisateur}`);

  expect(response.status).toBe(403);
  expect(response.body.message).toBe("Accès réservé aux administrateurs");
});
test("GET /statistiques/periodes-forte-affluence doit refuser l'accès sans token", async () => {
  const response = await request(app)
    .get("/statistiques/periodes-forte-affluence");

  expect(response.status).toBe(401);
  expect(response.body.message).toBe("Authentification requise");
});
test("GET /utilisateurs/mes-notifications doit retourner 500 en cas d'erreur Supabase", async () => {
  const requete = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Erreur Supabase simulée" }
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app)
    .get("/utilisateurs/mes-notifications")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors de la récupération des notifications"
  );
});
test("GET /statistiques/horaires-plus-demandes doit retourner 500 si les réservations sont indisponibles", async () => {
  const requete = {
    select: jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Erreur réservations simulée" }
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app)
    .get("/statistiques/horaires-plus-demandes")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors de la récupération des réservations"
  );
});
test("GET /statistiques/horaires-plus-demandes doit retourner 500 si les séances sont indisponibles", async () => {
  jest.spyOn(supabase, "from")
    .mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [],
        error: null
      })
    })
    .mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Erreur séances simulée" }
      })
    });

  const response = await request(app)
    .get("/statistiques/horaires-plus-demandes")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors de la récupération des séances"
  );
});
test("GET /statistiques/journees-plus-frequentees doit retourner 500 si les séances sont indisponibles", async () => {
  jest.spyOn(supabase, "from")
    .mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [],
        error: null
      })
    })
    .mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Erreur séances simulée" }
      })
    });

  const response = await request(app)
    .get("/statistiques/journees-plus-frequentees")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors de la récupération des séances"
  );
});
test("GET /statistiques/journees-plus-frequentees doit retourner 500 si les réservations sont indisponibles", async () => {
  const requete = {
    select: jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Erreur réservations simulée" }
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app)
    .get("/statistiques/journees-plus-frequentees")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors de la récupération des réservations"
  );
});
test("GET /statistiques/periodes-forte-affluence doit retourner 500 si les réservations sont indisponibles", async () => {
  const requete = {
    select: jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Erreur réservations simulée" }
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app)
    .get("/statistiques/periodes-forte-affluence")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors de la récupération des réservations"
  );
});
test("GET /statistiques/periodes-forte-affluence doit retourner 500 si les séances sont indisponibles", async () => {
  jest.spyOn(supabase, "from")
    .mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [],
        error: null
      })
    })
    .mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Erreur séances simulée" }
      })
    });

  const response = await request(app)
    .get("/statistiques/periodes-forte-affluence")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors de la récupération des séances"
  );
});
test("GET /statistiques/seances-proches-saturation doit retourner 500 en cas d'erreur Supabase", async () => {
  const requete = {
    select: jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Erreur Supabase simulée" }
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app)
    .get("/statistiques/seances-proches-saturation")
    .set("Authorization", `Bearer ${tokenAdmin}`);

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors du calcul des statistiques"
  );
});
test("GET /salles doit retourner 500 en cas d'erreur Supabase", async () => {
  const requete = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Erreur Supabase simulée" }
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app).get("/salles");

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors de la récupération des salles"
  );
});
test("GET /films/recherche doit retourner 400 si aucun titre n'est fourni", async () => {
  const response = await request(app).get("/films/recherche");

  expect(response.status).toBe(400);
  expect(response.body.message).toBe(
    "Veuillez saisir un titre de film"
  );
});
test("GET /films/recherche doit retourner 500 en cas d'erreur Supabase", async () => {
  const requete = {
    select: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Erreur de recherche simulée" }
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app)
    .get("/films/recherche?titre=Batman");

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors de la recherche des films"
  );
});
test("GET /seances/:id/places/reservees doit refuser un identifiant invalide", async () => {
  const response = await request(app)
    .get("/seances/abc/places/reservees");

  expect(response.status).toBe(400);
  expect(response.body.message).toBe(
    "Identifiant de séance invalide"
  );
});
test("GET /films/:id doit retourner 400 si l'identifiant est invalide", async () => {
  const response = await request(app).get("/films/abc");

  expect(response.status).toBe(400);
  expect(response.body.message).toBe("Identifiant du film invalide");
});
test("GET /films/:id doit retourner 500 en cas d'erreur Supabase", async () => {
  const requete = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Erreur simulée", code: "XX000" }
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app).get("/films/1");

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors de la récupération du film"
  );
});
test("GET /seances/:id/places/reservees doit retourner 404 si la séance est introuvable", async () => {
  const requete = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: null,
      error: null
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app)
    .get("/seances/999999/places/reservees");

  expect(response.status).toBe(404);
  expect(response.body.message).toBe("Séance introuvable");
});
test("GET /seances/:id/places/reservees doit retourner 500 en cas d'erreur Supabase", async () => {
  const requete = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: null,
      error: { message: "Erreur simulée" }
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app)
    .get("/seances/1/places/reservees");

  expect(response.status).toBe(500);
  expect(response.body.message).toBe(
    "Erreur lors de la récupération des places"
  );
});
test("GET /salles doit retourner la liste des salles", async () => {
  const salles = [
    { id: 1, nom: "Salle test", capacite: 100 }
  ];

  const requete = {
    select: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({
      data: salles,
      error: null
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app).get("/salles");

  expect(response.status).toBe(200);
  expect(response.body.salles).toEqual(salles);
});
test("GET /films/recherche doit retourner les films correspondants", async () => {
  const films = [
    { id: 1, titre: "Batman" }
  ];

  const requete = {
    select: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockResolvedValue({
      data: films,
      error: null
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app)
    .get("/films/recherche?titre=Batman");

  expect(response.status).toBe(200);
  expect(response.body.films || response.body).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ titre: "Batman" })
    ])
  );
});
test("GET /films/:id doit retourner un film existant", async () => {
  const film = {
    id: 1,
    titre: "Batman",
    seances: []
  };

  const requete = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: film,
      error: null
    })
  };

  jest.spyOn(supabase, "from").mockReturnValue(requete);

  const response = await request(app).get("/films/1");

  expect(response.status).toBe(200);
});
test("POST /films doit refuser une durée négative", async () => {
  const response = await request(app)
    .post("/films")
    .set("Authorization", `Bearer ${tokenAdmin}`)
    .send({
      titre: "Film de test",
      description: "Description de test",
      duree: -1,
      genre: "Action"
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe(
    "La durée doit être un nombre entier positif"
  );
});
