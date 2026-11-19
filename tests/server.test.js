// Tests de l'API avec Supabase SIMULÉ (aucune vraie base utilisée).
// Chaque test prépare les réponses de la base avec db.enqueue(...), dans
// l'ordre exact où la route appelle supabase.from(...) / supabase.rpc(...).

process.env.JWT_SECRET = process.env.JWT_SECRET || "secret-de-test";

jest.mock("../supabase", () => require("./helpers/supabaseMock").supabase);

const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const app = require("../server");
const db = require("./helpers/supabaseMock");

const { ok, ko, lance } = db;

// ---------- Outils ----------

const creerToken = (role, id, email) =>
  `Bearer ${jwt.sign({ id, email, role }, process.env.JWT_SECRET, { expiresIn: "1h" })}`;

const admin = creerToken("admin", 1, "admin@test.com");
const user = creerToken("utilisateur", 2, "paul@test.com");

const envoyer = (methode, url, auth, corps) => {
  let requete = request(app)[methode](url);
  if (auth) {requete = requete.set("Authorization", auth);}
  return corps ? requete.send(corps) : requete;
};

const GET = (url, auth) => envoyer("get", url, auth);
const POST = (url, auth, corps) => envoyer("post", url, auth, corps);
const PUT = (url, auth, corps) => envoyer("put", url, auth, corps);
const PATCH = (url, auth, corps) => envoyer("patch", url, auth, corps);
const DELETE = (url, auth) => envoyer("delete", url, auth);

// Arguments passés à une méthode (insert, update...) lors d'un appel Supabase
const argumentsDe = (type, nom, methode) => {
  const appel = db.appels.find(
    (a) => a.type === type && a.nom === nom && a.methodes.some((m) => m[0] === methode)
  );
  return appel.methodes.find((m) => m[0] === methode)[1];
};

beforeEach(() => {
  db.reinitialiser();
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------- Sécurité ----------

describe("Authentification et rôles", () => {
  test("refuse une requête sans en-tête Authorization", async () => {
    const res = await GET("/reservations");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Authentification requise");
  });

  test("refuse un en-tête qui n'est pas de type Bearer", async () => {
    const res = await GET("/reservations", "Basic abc");
    expect(res.status).toBe(401);
  });

  test("refuse un token invalide", async () => {
    const res = await GET("/reservations", "Bearer faux-token");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Token invalide ou expiré");
  });

  test("refuse un utilisateur simple sur une route admin (403)", async () => {
    const res = await GET("/reservations", user);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Accès réservé aux administrateurs");
  });

  test("retourne 404 sur une route inconnue", async () => {
    const res = await GET("/route-inexistante");
    expect(res.status).toBe(404);
  });

  test("sert la documentation Swagger", async () => {
    const res = await GET("/api-docs/");
    expect(res.status).toBe(200);
  });
});

// ---------- Films ----------

describe("GET /films", () => {
  test("retourne la liste des films", async () => {
    db.enqueue(ok([{ id: 1, titre: "Jungle" }]));
    const res = await GET("/films");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, titre: "Jungle" }]);
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await GET("/films");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la récupération des films");
  });

  test("retourne 500 si une exception est levée", async () => {
    db.enqueue(lance(new Error("panne")));
    const res = await GET("/films");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur serveur");
  });
});

describe("POST /films", () => {
  const filmValide = { titre: "Film", description: "Desc", duree: 120, genre: "Action" };

  test("refuse un utilisateur simple", async () => {
    const res = await POST("/films", user, filmValide);
    expect(res.status).toBe(403);
  });

  test("refuse des champs manquants", async () => {
    const res = await POST("/films", admin, { titre: "Film" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Tous les champs sont obligatoires");
  });

  test.each([
    ["non entière", 1.5],
    ["sous forme de texte", "120"],
    ["négative", -5]
  ])("refuse une durée %s", async (_nom, duree) => {
    const res = await POST("/films", admin, { ...filmValide, duree });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("La durée doit être un nombre entier positif");
  });

  test("retourne 500 si l'insertion échoue", async () => {
    db.enqueue(ko());
    const res = await POST("/films", admin, filmValide);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de l'ajout du film");
  });

  test("crée un film (201) et nettoie les espaces", async () => {
    db.enqueue(ok({ id: 5, ...filmValide, actif: true }));
    const res = await POST("/films", admin, { ...filmValide, titre: "  Film  " });
    expect(res.status).toBe(201);
    expect(res.body.film.seances).toEqual([]);
    expect(argumentsDe("from", "films", "insert")[0].titre).toBe("Film");
  });
});

describe("GET /films/recherche", () => {
  test("refuse une recherche sans titre", async () => {
    const res = await GET("/films/recherche");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Veuillez saisir un titre de film");
  });

  test("retourne les films trouvés", async () => {
    db.enqueue(ok([{ id: 1, titre: "Batman" }]));
    const res = await GET("/films/recherche?titre=bat");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, titre: "Batman" }]);
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await GET("/films/recherche?titre=bat");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la recherche des films");
  });
});

describe("GET /films/:id", () => {
  test("refuse un identifiant invalide", async () => {
    const res = await GET("/films/abc");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Identifiant du film invalide");
  });

  test("retourne 500 sur une erreur Supabase inattendue", async () => {
    db.enqueue(ko("panne", { code: "XX000" }));
    const res = await GET("/films/1");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la récupération du film");
  });

  test("retourne 404 si la base signale « aucune ligne »", async () => {
    db.enqueue(ko("Aucune ligne", { code: "PGRST116" }));
    const res = await GET("/films/1");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Film introuvable");
  });

  test("retourne 404 si le film n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await GET("/films/1");
    expect(res.status).toBe(404);
  });

  test("retourne le film avec ses séances formatées", async () => {
    db.enqueue(
      ok({
        id: 1,
        titre: "Jungle",
        seances: [
          {
            id: 3,
            date_seance: "2026-11-01",
            heure: "14:00",
            capacite: 100,
            salles: { nom: "Salle 1" },
            places: [{ id: 1 }]
          }
        ]
      })
    );
    const res = await GET("/films/1");
    expect(res.status).toBe(200);
    expect(res.body.seances[0]).toEqual({
      id: 3,
      date: "2026-11-01",
      heure: "14:00",
      salle: "Salle 1",
      capacite: 100,
      places: [{ id: 1 }]
    });
  });

  test("gère un film sans séance et une séance sans places", async () => {
    db.enqueue(ok({ id: 1, titre: "A", seances: null }));
    const res1 = await GET("/films/1");
    expect(res1.body.seances).toEqual([]);

    db.enqueue(ok({ id: 1, titre: "A", seances: [{ id: 1, salles: null }] }));
    const res2 = await GET("/films/1");
    expect(res2.body.seances[0].places).toEqual([]);
  });
});

describe("DELETE /films/:id", () => {
  test("refuse un identifiant invalide", async () => {
    const res = await DELETE("/films/abc", admin);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Identifiant du film invalide");
  });

  test("retourne 500 si la suppression échoue", async () => {
    db.enqueue(ko());
    const res = await DELETE("/films/1", admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la suppression du film");
  });

  test("retourne 404 si le film n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await DELETE("/films/1", admin);
    expect(res.status).toBe(404);
  });

  test("supprime le film", async () => {
    db.enqueue(ok({ id: 1, titre: "Jungle" }));
    const res = await DELETE("/films/1", admin);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Film supprimé avec succès");
  });
});

describe("PATCH /films/:id/desactiver", () => {
  test("retourne 404 si le film n'existe pas", async () => {
    db.enqueue(ko());
    const res = await PATCH("/films/1/desactiver", admin);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Film introuvable");
  });

  test("refuse de désactiver un film déjà désactivé", async () => {
    db.enqueue(ok({ id: 1, actif: false }));
    const res = await PATCH("/films/1/desactiver", admin);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Ce film est déjà désactivé");
  });

  test("retourne 500 si la mise à jour échoue", async () => {
    db.enqueue(ok({ id: 1, actif: true }), ko());
    const res = await PATCH("/films/1/desactiver", admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la désactivation du film");
  });

  test("désactive le film", async () => {
    db.enqueue(ok({ id: 1, actif: true }), ok({ id: 1, actif: false }));
    const res = await PATCH("/films/1/desactiver", admin);
    expect(res.status).toBe(200);
    expect(res.body.film.actif).toBe(false);
  });
});

describe("GET /films/:id/seances", () => {
  test("retourne 404 si le film n'existe pas", async () => {
    db.enqueue(ko());
    const res = await GET("/films/1/seances");
    expect(res.status).toBe(404);
  });

  test("retourne 500 si la lecture des séances échoue", async () => {
    db.enqueue(ok({ id: 1 }), ko());
    const res = await GET("/films/1/seances");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la récupération des séances");
  });

  test("retourne les séances du film", async () => {
    db.enqueue(ok({ id: 1 }), ok([{ id: 1 }]));
    const res = await GET("/films/1/seances");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1 }]);
  });
});

// ---------- Salles ----------

describe("GET /salles", () => {
  test("retourne la liste des salles", async () => {
    const salles = [{ id: 1, nom: "Salle 1", capacite: 100 }];
    db.enqueue(ok(salles));
    const res = await GET("/salles");
    expect(res.status).toBe(200);
    expect(res.body.salles).toEqual(salles);
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await GET("/salles");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la récupération des salles");
  });

  test("retourne 500 si une exception est levée", async () => {
    db.enqueue(lance(new Error("panne")));
    const res = await GET("/salles");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur serveur");
  });
});

describe("PUT /salles/:nom/capacite", () => {
  const url = "/salles/Salle%201/capacite";
  const salle = ok({ id: 1, nom: "Salle 1" });
  const seances = ok([{ id: 1 }]);

  test("refuse une capacité invalide", async () => {
    const res = await PUT(url, admin, { capacite: -3 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("La capacité doit être un entier positif");
  });

  test("retourne 404 si la salle n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await PUT(url, admin, { capacite: 50 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Salle introuvable");
  });

  test("retourne 404 si la salle n'a aucune séance", async () => {
    db.enqueue(salle, ok([]));
    const res = await PUT(url, admin, { capacite: 50 });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Aucune séance trouvée pour cette salle");
  });

  test("refuse une capacité inférieure aux places réservées", async () => {
    db.enqueue(salle, seances, ok([{ id: 1 }, { id: 2 }, { id: 3 }]));
    const res = await PUT(url, admin, { capacite: 2 });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "La capacité ne peut pas être inférieure au nombre de places réservées"
    );
  });

  test("modifie la capacité en gardant les places réservées", async () => {
    db.enqueue(
      salle,
      seances,
      ok([{ id: 1 }]), // places réservées (contrôle)
      ok(null), // mise à jour de la séance
      ok(null), // suppression des places disponibles
      ok([{ rangee: "A", numero: 1 }]), // places réservées à conserver
      ok(null) // insertion des nouvelles places
    );
    const res = await PUT(url, admin, { capacite: 5 });
    expect(res.status).toBe(200);
    expect(res.body.capacite).toBe(5);

    const nouvellesPlaces = argumentsDe("from", "places", "insert")[0];
    expect(nouvellesPlaces).toHaveLength(4);
    expect(nouvellesPlaces.some((p) => p.rangee === "A" && p.numero === 1)).toBe(false);
  });

  test("n'insère rien si toutes les places sont déjà réservées", async () => {
    db.enqueue(
      salle,
      seances,
      ok([{ id: 1 }]),
      ok(null),
      ok(null),
      ok([{ rangee: "A", numero: 1 }])
    );
    const res = await PUT(url, admin, { capacite: 1 });
    expect(res.status).toBe(200);
  });

  // Une erreur Supabase à chacune des 7 étapes doit donner un 500
  test.each([0, 1, 2, 3, 4, 5, 6])(
    "retourne 500 si l'étape %i échoue",
    async (etape) => {
      const etapes = [
        salle,
        seances,
        ok([{ id: 1 }]),
        ok(null),
        ok(null),
        ok([{ rangee: "A", numero: 1 }]),
        ok(null)
      ];
      etapes[etape] = ko();
      db.enqueue(...etapes);
      const res = await PUT(url, admin, { capacite: 5 });
      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Erreur lors de la modification de la capacité");
    }
  );
});

// ---------- Séances ----------

describe("POST /films/:id/seances", () => {
  const seance = { date: "2026-12-15", heure: "18:00", salle: "Salle 1", capacite: 50 };
  const film = ok({ id: 1 });
  const salle = ok({ id: 1, nom: "Salle 1", capacite: 100 });

  test("refuse un identifiant de film invalide", async () => {
    const res = await POST("/films/abc/seances", admin, seance);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Identifiant du film invalide");
  });

  test("refuse des champs manquants", async () => {
    const res = await POST("/films/1/seances", admin, { date: "2026-12-15", heure: "18:00" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Tous les champs sont obligatoires");
  });

  test("refuse une capacité absente", async () => {
    const sansCapacite = { date: seance.date, heure: seance.heure, salle: seance.salle };
    const res = await POST("/films/1/seances", admin, sansCapacite);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Tous les champs sont obligatoires");
  });

  test.each([
    ["une heure invalide", { heure: "25:00" }],
    ["une date invalide", { date: "15/12/2026" }],
    ["une capacité négative", { capacite: -2 }]
  ])("refuse %s", async (_nom, modification) => {
    const res = await POST("/films/1/seances", admin, { ...seance, ...modification });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Les informations de la séance sont invalides");
  });

  test("retourne 404 si le film n'existe pas", async () => {
    db.enqueue(ko());
    const res = await POST("/films/1/seances", admin, seance);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Film introuvable");
  });

  test("retourne 404 si la salle n'existe pas", async () => {
    db.enqueue(film, ko());
    const res = await POST("/films/1/seances", admin, seance);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Salle introuvable");
  });

  test("refuse une capacité supérieure à celle de la salle", async () => {
    db.enqueue(film, ok({ id: 1, nom: "Salle 1", capacite: 30 }));
    const res = await POST("/films/1/seances", admin, seance);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("La capacité dépasse celle de la salle");
  });

  test("retourne 500 si la vérification de conflit échoue", async () => {
    db.enqueue(film, salle, ko());
    const res = await POST("/films/1/seances", admin, seance);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la création de la séance");
  });

  test("retourne 409 si la salle est déjà utilisée à cet horaire", async () => {
    db.enqueue(film, salle, ok([{ id: 7 }]));
    const res = await POST("/films/1/seances", admin, seance);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe("Cette salle est déjà utilisée à cet horaire");
  });

  test("retourne 500 si la création de la séance échoue", async () => {
    db.enqueue(film, salle, ok([]), ko());
    const res = await POST("/films/1/seances", admin, seance);
    expect(res.status).toBe(500);
  });

  test("supprime la séance si la création des places échoue", async () => {
    db.enqueue(film, salle, ok([]), ok({ id: 10 }), ko(), ok(null));
    const res = await POST("/films/1/seances", admin, seance);
    expect(res.status).toBe(500);
    const dernier = db.appels[db.appels.length - 1];
    expect(dernier.nom).toBe("seances");
    expect(dernier.methodes.some((m) => m[0] === "delete")).toBe(true);
  });

  test("retourne 500 même si le nettoyage échoue aussi", async () => {
    db.enqueue(film, salle, ok([]), ok({ id: 10 }), ko(), ko("nettoyage"));
    const res = await POST("/films/1/seances", admin, seance);
    expect(res.status).toBe(500);
  });

  test("crée la séance et ses 50 places (201)", async () => {
    db.enqueue(film, salle, ok([]), ok({ id: 10, film_id: 1 }), ok(null));
    const res = await POST("/films/1/seances", admin, seance);
    expect(res.status).toBe(201);
    expect(res.body.seance.id).toBe(10);
    expect(res.body.seance.salle).toBe("Salle 1");

    const places = argumentsDe("from", "places", "insert")[0];
    expect(places).toHaveLength(50);
    expect(places[0]).toMatchObject({ rangee: "A", numero: 1, statut: "disponible" });
    expect(places[10]).toMatchObject({ rangee: "B", numero: 1 });
  });
});

describe("PUT /seances/:id", () => {
  const corps = { date: "2026-12-16", heure: "20:00", salle: "Salle 2", capacite: 10 };

  test("refuse un identifiant invalide", async () => {
    const res = await PUT("/seances/abc", admin, corps);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Identifiant de séance invalide");
  });

  test("refuse des informations incomplètes", async () => {
    const res = await PUT("/seances/1", admin, { date: "2026-12-16" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Les informations de la séance sont invalides");
  });

  test("retourne 404 si la salle n'existe pas", async () => {
    db.enqueue(ko());
    const res = await PUT("/seances/1", admin, corps);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Salle introuvable");
  });

  test.each([
    ["Séance introuvable", 404],
    ["Nouvelle capacité inférieure aux places réservées", 400],
    ["Salle déjà utilisée à cet horaire", 400]
  ])("traduit l'erreur métier « %s » en code %i", async (message, statut) => {
    db.enqueue(ok({ id: 2 }), ko(message));
    const res = await PUT("/seances/1", admin, corps);
    expect(res.status).toBe(statut);
    expect(res.body.message).toBe(message);
  });

  test("retourne 500 sur une erreur inattendue", async () => {
    db.enqueue(ok({ id: 2 }), ko("panne"));
    const res = await PUT("/seances/1", admin, corps);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la modification de la séance");
  });

  test("modifie la séance", async () => {
    db.enqueue(ok({ id: 2 }), ok({ message: "Séance modifiée avec succès" }));
    const res = await PUT("/seances/1", admin, corps);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Séance modifiée avec succès");
  });
});

describe("PUT /seances/:id/salle", () => {
  const seance = ok({ id: 1, date_seance: "2026-12-01", heure: "18:00", salle_id: 1 });
  const salle = ok({ id: 2, nom: "Salle 2" });

  test("refuse un identifiant invalide", async () => {
    const res = await PUT("/seances/abc/salle", admin, { salle: "Salle 2" });
    expect(res.status).toBe(400);
  });

  test("refuse un nom de salle absent", async () => {
    const res = await PUT("/seances/1/salle", admin, {});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Le nom de la salle est obligatoire");
  });

  test("retourne 404 si la séance n'existe pas", async () => {
    db.enqueue(ko());
    const res = await PUT("/seances/1/salle", admin, { salle: "Salle 2" });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Séance introuvable");
  });

  test("retourne 404 si la salle n'existe pas", async () => {
    db.enqueue(seance, ko());
    const res = await PUT("/seances/1/salle", admin, { salle: "Salle 9" });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Salle introuvable");
  });

  test("retourne 500 si la vérification de conflit échoue", async () => {
    db.enqueue(seance, salle, ko());
    const res = await PUT("/seances/1/salle", admin, { salle: "Salle 2" });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors du changement de salle");
  });

  test("retourne 409 si la salle est déjà occupée", async () => {
    db.enqueue(seance, salle, ok([{ id: 9 }]));
    const res = await PUT("/seances/1/salle", admin, { salle: "Salle 2" });
    expect(res.status).toBe(409);
  });

  test("retourne 500 si la mise à jour échoue", async () => {
    db.enqueue(seance, salle, ok([]), ko());
    const res = await PUT("/seances/1/salle", admin, { salle: "Salle 2" });
    expect(res.status).toBe(500);
  });

  test("associe la nouvelle salle à la séance", async () => {
    db.enqueue(seance, salle, ok([]), ok(null));
    const res = await PUT("/seances/1/salle", admin, { salle: "Salle 2" });
    expect(res.status).toBe(200);
    expect(res.body.salle).toBe("Salle 2");
  });
});

describe("PATCH /seances/:id/annuler", () => {
  test("refuse un identifiant invalide", async () => {
    const res = await PATCH("/seances/abc/annuler", admin);
    expect(res.status).toBe(400);
  });

  test("retourne 404 si la séance n'existe pas", async () => {
    db.enqueue(ko());
    const res = await PATCH("/seances/1/annuler", admin);
    expect(res.status).toBe(404);
  });

  test("refuse d'annuler une séance déjà annulée", async () => {
    db.enqueue(ok({ id: 1, statut: "annulee" }));
    const res = await PATCH("/seances/1/annuler", admin);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Cette séance est déjà annulée");
  });

  test("retourne 500 si la mise à jour échoue", async () => {
    db.enqueue(ok({ id: 1, statut: "programmee" }), ko());
    const res = await PATCH("/seances/1/annuler", admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de l'annulation de la séance");
  });

  test("annule la séance", async () => {
    db.enqueue(ok({ id: 1, statut: "programmee" }), ok({ id: 1, statut: "annulee" }));
    const res = await PATCH("/seances/1/annuler", admin);
    expect(res.status).toBe(200);
    expect(res.body.seance.statut).toBe("annulee");
  });
});

describe("GET /seances/:id et ses places", () => {
  const seance = {
    id: 1,
    capacite: 3,
    date_seance: "2026-11-01",
    heure: "14:00",
    films: { titre: "Jungle" },
    salles: { nom: "Salle 1" },
    places: [
      { id: 1, rangee: "A", numero: 1, statut: "disponible" },
      { id: 2, rangee: "A", numero: 2, statut: "reservee" },
      { id: 3, rangee: "A", numero: 3, statut: "reservee" }
    ]
  };

  describe.each([
    ["/seances/abc", "/seances/1"],
    ["/seances/abc/places", "/seances/1/places"],
    ["/seances/abc/places/etat", "/seances/1/places/etat"],
    ["/seances/abc/places/reservees", "/seances/1/places/reservees"]
  ])("%s", (urlInvalide, urlValide) => {
    test("refuse un identifiant invalide", async () => {
      const res = await GET(urlInvalide);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Identifiant de séance invalide");
    });

    test("retourne 500 si Supabase renvoie une erreur", async () => {
      db.enqueue(ko());
      const res = await GET(urlValide);
      expect(res.status).toBe(500);
    });

    test("retourne 404 si la séance n'existe pas", async () => {
      db.enqueue(ok(null));
      const res = await GET(urlValide);
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Séance introuvable");
    });
  });

  test("GET /seances/:id retourne la séance", async () => {
    db.enqueue(ok(seance));
    const res = await GET("/seances/1");
    expect(res.status).toBe(200);
    expect(res.body.film).toBe("Jungle");
    expect(res.body.salle).toBe("Salle 1");
    expect(res.body.date).toBe("2026-11-01");
  });

  test("GET /seances/:id/places retourne toutes les places", async () => {
    db.enqueue(ok(seance));
    const res = await GET("/seances/1/places");
    expect(res.status).toBe(200);
    expect(res.body.places).toHaveLength(3);
  });

  test("GET /seances/:id/places/etat compte les places", async () => {
    db.enqueue(ok(seance));
    const res = await GET("/seances/1/places/etat");
    expect(res.status).toBe(200);
    expect(res.body.nombrePlacesDisponibles).toBe(1);
    expect(res.body.nombrePlacesOccupees).toBe(2);
  });

  test("GET /seances/:id/places/reservees ne garde que les réservées", async () => {
    db.enqueue(ok(seance));
    const res = await GET("/seances/1/places/reservees");
    expect(res.status).toBe(200);
    expect(res.body.placesReservees).toHaveLength(2);
    expect(res.body.salle).toBe("Salle 1");
  });

  test("GET /seances/:id/places/reservees gère une séance sans places", async () => {
    db.enqueue(ok({ id: 1, salles: null }));
    const res = await GET("/seances/1/places/reservees");
    expect(res.status).toBe(200);
    expect(res.body.placesReservees).toEqual([]);
  });
});

// ---------- Réservations ----------

describe("POST /reservations/selection-seance", () => {
  test.each([[{}], [{ seanceId: "abc" }]])("refuse %j", async (corps) => {
    const res = await POST("/reservations/selection-seance", null, corps);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Veuillez sélectionner une séance valide");
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await POST("/reservations/selection-seance", null, { seanceId: 1 });
    expect(res.status).toBe(500);
  });

  test("retourne 404 si la séance n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await POST("/reservations/selection-seance", null, { seanceId: 1 });
    expect(res.status).toBe(404);
  });

  test("retourne la séance sélectionnée", async () => {
    db.enqueue(
      ok({
        id: 1,
        date_seance: "2026-11-01",
        heure: "14:00",
        capacite: 100,
        statut: "programmee",
        films: { titre: "Jungle" },
        salles: { nom: "Salle 1" },
        places: []
      })
    );
    const res = await POST("/reservations/selection-seance", null, { seanceId: 1 });
    expect(res.status).toBe(200);
    expect(res.body.film).toBe("Jungle");
    expect(res.body.seance.salle).toBe("Salle 1");
  });
});

describe("POST /reservations/informations-client", () => {
  const client = { nom: "Dupont", prenom: "Jean", email: "jean@test.com", telephone: "0612345678" };

  test("refuse des informations incomplètes", async () => {
    const res = await POST("/reservations/informations-client", null, { nom: "Dupont" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Veuillez renseigner toutes les informations");
  });

  test("refuse une adresse e-mail invalide", async () => {
    const res = await POST("/reservations/informations-client", null, { ...client, email: "x" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Adresse e-mail invalide");
  });

  test("enregistre les informations du client", async () => {
    const res = await POST("/reservations/informations-client", null, client);
    expect(res.status).toBe(200);
    expect(res.body.client).toEqual(client);
  });
});

describe("POST /reservations/confirmer", () => {
  const valide = {
    seanceId: 1,
    placesIds: [1, 2],
    telephone: "0612345678"
  };

  const utilisateurConnecte = ok({
    id: 2,
    nom: "Martin",
    prenom: "Paul",
    email: "paul@test.com"
  });

  test("refuse une réservation sans authentification", async () => {
    const res = await POST("/reservations/confirmer", null, valide);
    expect(res.status).toBe(401);
  });

  test.each([
    ["sans séance", { seanceId: undefined }],
    ["sans place", { placesIds: [] }],
    ["avec des places qui ne sont pas un tableau", { placesIds: "1" }],
    ["avec des identifiants de places non numériques", { placesIds: ["a"] }],
    ["sans téléphone", { telephone: "" }]
  ])("refuse une réservation %s", async (_nom, modification) => {
    const res = await POST(
      "/reservations/confirmer",
      user,
      { ...valide, ...modification }
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Informations de réservation invalides ou incomplètes"
    );
  });

  test("confirme la réservation avec le compte connecté", async () => {
    db.enqueue(
      utilisateurConnecte,
      ok({ id: 1, numero_reservation: "RES-000001" })
    );

    const res = await POST("/reservations/confirmer", user, valide);

    expect(res.status).toBe(201);
    expect(res.body.reservation.numero_reservation).toBe("RES-000001");

    const appelRpc = db.appels.find(
      (appel) => appel.nom === "confirmer_reservation"
    );

    expect(appelRpc).toBeDefined();
    expect(appelRpc.args.p_seance_id).toBe(1);
    expect(appelRpc.args.p_utilisateur_id).toBe(2);
    expect(appelRpc.args.p_nom).toBe("Martin");
    expect(appelRpc.args.p_prenom).toBe("Paul");
    expect(appelRpc.args.p_email).toBe("paul@test.com");
  });

  test("retourne 404 si le compte utilisateur est introuvable", async () => {
    db.enqueue(ko("Utilisateur introuvable"));

    const res = await POST("/reservations/confirmer", user, valide);

    expect(res.status).toBe(404);
  });

  test("retourne 404 si la séance est introuvable", async () => {
    db.enqueue(
      utilisateurConnecte,
      ko("Séance introuvable")
    );

    const res = await POST("/reservations/confirmer", user, valide);

    expect(res.status).toBe(404);
  });

  test("retourne 400 si des places ne sont plus disponibles", async () => {
    db.enqueue(
      utilisateurConnecte,
      ko("Une ou plusieurs places ne sont plus disponibles")
    );

    const res = await POST("/reservations/confirmer", user, valide);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Une ou plusieurs places ne sont plus disponibles"
    );
  });

  test("retourne 500 sur une erreur inattendue de la base", async () => {
    db.enqueue(
      utilisateurConnecte,
      ko("connexion perdue")
    );

    const res = await POST("/reservations/confirmer", user, valide);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe(
      "Erreur lors de la confirmation de la réservation"
    );
  });

  test("retourne 500 si une exception est levée", async () => {
    db.enqueue(
      utilisateurConnecte,
      lance(new Error("panne"))
    );

    const res = await POST("/reservations/confirmer", user, valide);

    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur interne du serveur");
  });
});

describe("GET /reservations (admin)", () => {
  test("retourne la liste des réservations", async () => {
    db.enqueue(ok([{ id: 1 }]));
    const res = await GET("/reservations", admin);
    expect(res.status).toBe(200);
    expect(res.body.reservations).toEqual([{ id: 1 }]);
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await GET("/reservations", admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la récupération des réservations");
  });

  test("retourne 500 si une exception est levée", async () => {
    db.enqueue(lance(new Error("panne")));
    const res = await GET("/reservations", admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur serveur");
  });
});

describe("GET /reservations/recherche/:numero (admin)", () => {
  test("refuse un utilisateur simple", async () => {
    const res = await GET("/reservations/recherche/RES-000001", user);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Accès réservé aux administrateurs");
  });

  test("retourne 404 si la réservation n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await GET("/reservations/recherche/RES-000001", admin);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Réservation introuvable");
  });

  test("trouve la réservation (numéro mis en majuscules)", async () => {
    db.enqueue(ok({ id: 1, numero_reservation: "RES-000001" }));
    const res = await GET("/reservations/recherche/res-000001", admin);
    expect(res.status).toBe(200);
    const eq = db.appels[0].methodes.find((m) => m[0] === "eq");
    expect(eq[1]).toEqual(["numero_reservation", "RES-000001"]);
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await GET("/reservations/recherche/RES-000001", admin);
    expect(res.status).toBe(500);
  });
});

describe("GET /reservations/seance/:seanceId (admin)", () => {
  test("refuse un utilisateur simple", async () => {
    const res = await GET("/reservations/seance/1", user);
    expect(res.status).toBe(403);
  });

  test("refuse un identifiant invalide", async () => {
    const res = await GET("/reservations/seance/abc", admin);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Identifiant de séance invalide");
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await GET("/reservations/seance/1", admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la récupération des réservations");
  });

  test("retourne les réservations de la séance", async () => {
    db.enqueue(ok([{ id: 1 }, { id: 2 }]));
    const res = await GET("/reservations/seance/1", admin);
    expect(res.status).toBe(200);
    expect(res.body.nombreReservations).toBe(2);
  });
});

describe("PUT /reservations/:id/annuler", () => {
  test("refuse sans authentification", async () => {
    const res = await PUT("/reservations/1/annuler");
    expect(res.status).toBe(401);
  });

  test("refuse un identifiant invalide", async () => {
    const res = await PUT("/reservations/abc/annuler", user);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Identifiant de réservation invalide");
  });

  test.each([
    ["Réservation introuvable", 404],
    ["Vous ne pouvez pas annuler cette réservation", 403],
    ["Seul le propriétaire peut annuler", 403],
    ["Réservation déjà annulée", 400]
  ])("traduit l'erreur « %s » en code %i", async (message, statut) => {
    db.enqueue(ko(message));
    const res = await PUT("/reservations/1/annuler", user);
    expect(res.status).toBe(statut);
    expect(res.body.message).toBe(message);
  });

  test("retourne 500 sur une erreur inattendue", async () => {
    db.enqueue(ko("panne"));
    const res = await PUT("/reservations/1/annuler", user);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de l'annulation de la réservation");
  });

  test("annule la réservation d'un utilisateur", async () => {
    db.enqueue(ok({ message: "Réservation annulée avec succès" }));
    const res = await PUT("/reservations/1/annuler", user);
    expect(res.status).toBe(200);
    expect(db.appels[0].args).toMatchObject({
      p_reservation_id: 1,
      p_utilisateur_id: 2,
      p_est_admin: false
    });
  });

  test("transmet le rôle admin à la fonction SQL", async () => {
    db.enqueue(ok({ message: "ok" }));
    await PUT("/reservations/1/annuler", admin);
    expect(db.appels[0].args.p_est_admin).toBe(true);
  });
});

// ---------- Billets ----------

describe("POST /reservations/:id/billet (admin)", () => {
  const reservation = ok({
    id: 1,
    numero_reservation: "RES-000001",
    nom: "Dupont",
    prenom: "Jean",
    email: "jean@test.com",
    telephone: "0612345678",
    seance_id: 1
  });
  const aucunBillet = ok(null);
  const places = ok([{ places: { id: 1, rangee: "A", numero: 1 } }]);

  test("refuse un utilisateur simple", async () => {
    const res = await POST("/reservations/1/billet", user);
    expect(res.status).toBe(403);
  });

  test("refuse un identifiant invalide", async () => {
    const res = await POST("/reservations/abc/billet", admin);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Identifiant de réservation invalide");
  });

  test("retourne 500 si la lecture de la réservation échoue", async () => {
    db.enqueue(ko());
    const res = await POST("/reservations/1/billet", admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la génération du billet");
  });

  test("retourne 404 si la réservation n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await POST("/reservations/1/billet", admin);
    expect(res.status).toBe(404);
  });

  test("retourne 409 si un billet existe déjà", async () => {
    db.enqueue(reservation, ok({ id: 1 }));
    const res = await POST("/reservations/1/billet", admin);
    expect(res.status).toBe(409);
  });

  test("retourne 500 si la lecture du billet échoue", async () => {
    db.enqueue(reservation, ko());
    const res = await POST("/reservations/1/billet", admin);
    expect(res.status).toBe(500);
  });

  test("retourne 500 si la lecture des places échoue", async () => {
    db.enqueue(reservation, aucunBillet, ko());
    const res = await POST("/reservations/1/billet", admin);
    expect(res.status).toBe(500);
  });

  test("retourne 409 si la base signale un doublon", async () => {
    db.enqueue(reservation, aucunBillet, places, ko("doublon", { code: "23505" }));
    const res = await POST("/reservations/1/billet", admin);
    expect(res.status).toBe(409);
  });

  test("retourne 500 si la création du billet échoue", async () => {
    db.enqueue(reservation, aucunBillet, places, ko());
    const res = await POST("/reservations/1/billet", admin);
    expect(res.status).toBe(500);
  });

  test("génère le billet (201)", async () => {
    db.enqueue(
      reservation,
      aucunBillet,
      places,
      ok({
        id: 3,
        numero_billet: "BIL-000001",
        date_generation: "2026-11-17T10:00:00Z",
        statut: "valide"
      })
    );
    const res = await POST("/reservations/1/billet", admin);
    expect(res.status).toBe(201);
    expect(res.body.billet.numeroBillet).toBe("BIL-000001");
    expect(res.body.billet.client.nom).toBe("Dupont");
    expect(res.body.billet.places).toEqual([{ id: 1, rangee: "A", numero: 1 }]);
  });
});

describe("GET /billets/:numero/qr-code", () => {
  test("retourne 404 si le billet n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await GET("/billets/BIL-000001/qr-code");
    expect(res.status).toBe(404);
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await GET("/billets/BIL-000001/qr-code");
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la génération du QR code");
  });

  test("génère le QR code", async () => {
    db.enqueue(
      ok({
        id: 1,
        numero_billet: "BIL-000001",
        reservation_id: 1,
        reservations: { numero_reservation: "RES-000001" }
      })
    );
    const res = await GET("/billets/BIL-000001/qr-code");
    expect(res.status).toBe(200);
    expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);
  });
});

describe("POST /billets/:numero/valider (admin)", () => {
  const billetValide = ok({ id: 1, statut: "valide" });

  test("retourne 500 si la recherche échoue", async () => {
    db.enqueue(ko());
    const res = await POST("/billets/BIL-000001/valider", admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la validation du billet");
  });

  test("retourne 404 si le billet n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await POST("/billets/BIL-000001/valider", admin);
    expect(res.status).toBe(404);
  });

  test("refuse un billet déjà utilisé", async () => {
    db.enqueue(ok({ id: 1, statut: "utilise" }));
    const res = await POST("/billets/BIL-000001/valider", admin);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Ce billet a déjà été utilisé");
  });

  test("refuse si le billet a été utilisé entre-temps", async () => {
    db.enqueue(billetValide, ok(null));
    const res = await POST("/billets/BIL-000001/valider", admin);
    expect(res.status).toBe(400);
  });

  test("retourne 500 si la mise à jour échoue", async () => {
    db.enqueue(billetValide, ko());
    const res = await POST("/billets/BIL-000001/valider", admin);
    expect(res.status).toBe(500);
  });

  test("valide le billet", async () => {
    db.enqueue(
      billetValide,
      ok({
        id: 1,
        numero_billet: "BIL-000001",
        reservation_id: 1,
        statut: "utilise",
        date_utilisation: "2026-11-17T10:00:00Z"
      })
    );
    const res = await POST("/billets/BIL-000001/valider", admin);
    expect(res.status).toBe(200);
    expect(res.body.billet.statut).toBe("utilise");
  });
});

// ---------- Utilisateurs ----------

describe("POST /utilisateurs/inscription", () => {
  const valide = {
    nom: "Martin",
    prenom: "Paul",
    email: "Paul@Test.com",
    motDePasse: "MotDePasse123!"
  };

  test("refuse des champs manquants", async () => {
    const res = await POST("/utilisateurs/inscription", null, {});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Tous les champs sont obligatoires");
  });

  test("refuse une adresse e-mail invalide", async () => {
    const res = await POST("/utilisateurs/inscription", null, { ...valide, email: "x" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Adresse email invalide");
  });

  test("refuse un mot de passe trop court", async () => {
    const res = await POST("/utilisateurs/inscription", null, { ...valide, motDePasse: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Le mot de passe doit contenir au moins 8 caractères");
  });

  test("retourne 500 si la recherche de l'e-mail échoue", async () => {
    db.enqueue(ko());
    const res = await POST("/utilisateurs/inscription", null, valide);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la création du compte");
  });

  test("retourne 409 si l'e-mail existe déjà", async () => {
    db.enqueue(ok({ id: 1 }));
    const res = await POST("/utilisateurs/inscription", null, valide);
    expect(res.status).toBe(409);
  });

  test("retourne 409 si la base signale un doublon", async () => {
    db.enqueue(ok(null), ko("doublon", { code: "23505" }));
    const res = await POST("/utilisateurs/inscription", null, valide);
    expect(res.status).toBe(409);
  });

  test("retourne 500 si l'insertion échoue", async () => {
    db.enqueue(ok(null), ko());
    const res = await POST("/utilisateurs/inscription", null, valide);
    expect(res.status).toBe(500);
  });

  test("crée le compte avec un mot de passe haché", async () => {
    db.enqueue(
      ok(null),
      ok({
        id: 3,
        nom: "Martin",
        prenom: "Paul",
        email: "paul@test.com",
        role: "utilisateur",
        date_creation: "2026-11-17"
      })
    );
    const res = await POST("/utilisateurs/inscription", null, valide);
    expect(res.status).toBe(201);
    expect(res.body.utilisateur.role).toBe("utilisateur");
    expect(res.body.utilisateur).not.toHaveProperty("mot_de_passe");

    const enregistre = argumentsDe("from", "utilisateurs", "insert")[0];
    expect(enregistre.mot_de_passe).not.toBe(valide.motDePasse);
    expect(bcrypt.compareSync(valide.motDePasse, enregistre.mot_de_passe)).toBe(true);
    expect(enregistre.email).toBe("paul@test.com");
  });
});

describe("POST /utilisateurs/connexion", () => {
  const motDePasse = "MotDePasse123!";
  const compte = {
    id: 2,
    nom: "Martin",
    prenom: "Paul",
    email: "paul@test.com",
    mot_de_passe: bcrypt.hashSync(motDePasse, 4),
    role: "utilisateur"
  };

  test("refuse des champs manquants", async () => {
    const res = await POST("/utilisateurs/connexion", null, {});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("L'email et le mot de passe sont obligatoires");
  });

  test("retourne 401 si l'utilisateur n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await POST("/utilisateurs/connexion", null, { email: "x@test.com", motDePasse });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Email ou mot de passe incorrect");
  });

  test("retourne 401 si le mot de passe est incorrect", async () => {
    db.enqueue(ok(compte));
    const res = await POST("/utilisateurs/connexion", null, {
      email: "paul@test.com",
      motDePasse: "mauvais-mot-de-passe"
    });
    expect(res.status).toBe(401);
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await POST("/utilisateurs/connexion", null, { email: "paul@test.com", motDePasse });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la connexion");
  });

  test("connecte l'utilisateur et fournit un token valide", async () => {
    db.enqueue(ok(compte));
    const res = await POST("/utilisateurs/connexion", null, {
      email: " Paul@Test.com ",
      motDePasse
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Connexion réussie");
    expect(res.body.utilisateur).not.toHaveProperty("mot_de_passe");

    const contenu = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(contenu).toMatchObject({ id: 2, email: "paul@test.com", role: "utilisateur" });
  });
});

describe("GET /utilisateurs/mes-reservations", () => {
  test("retourne les réservations de l'utilisateur", async () => {
    db.enqueue(
      ok([
        {
          id: 1,
          numero_reservation: "RES-000001",
          seance_id: 1,
          nom: "Martin",
          prenom: "Paul",
          email: "paul@test.com",
          telephone: "0600000000",
          date_reservation: "2026-11-01",
          statut: "confirmee",
          reservation_places: [{ places: { id: 1, rangee: "A", numero: 1 } }]
        }
      ])
    );
    const res = await GET("/utilisateurs/mes-reservations", user);
    expect(res.status).toBe(200);
    expect(res.body.reservations[0].numeroReservation).toBe("RES-000001");
    expect(res.body.reservations[0].places).toEqual([{ id: 1, rangee: "A", numero: 1 }]);
    expect(res.body.reservations[0].client.nom).toBe("Martin");
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await GET("/utilisateurs/mes-reservations", user);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la récupération de vos réservations");
  });
});

describe("GET /utilisateurs/mes-billets", () => {
  test("retourne les billets de l'utilisateur", async () => {
    db.enqueue(
      ok([
        {
          id: 1,
          numero_billet: "BIL-000001",
          reservation_id: 1,
          date_generation: "2026-11-01",
          statut: "valide",
          date_utilisation: null,
          reservations: {
            id: 1,
            numero_reservation: "RES-000001",
            seance_id: 1,
            nom: "Martin",
            prenom: "Paul",
            email: "paul@test.com",
            telephone: "0600000000",
            reservation_places: [{ places: { id: 1, rangee: "A", numero: 1 } }]
          }
        }
      ])
    );
    const res = await GET("/utilisateurs/mes-billets", user);
    expect(res.status).toBe(200);
    expect(res.body.billets[0].numeroBillet).toBe("BIL-000001");
    expect(res.body.billets[0].places).toEqual([{ id: 1, rangee: "A", numero: 1 }]);
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await GET("/utilisateurs/mes-billets", user);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la récupération de vos billets");
  });
});

describe("PUT /utilisateurs/mes-informations", () => {
  const corps = { nom: "Martin", prenom: "Paul", email: " PAUL@Test.com " };

  test("refuse des champs manquants", async () => {
    const res = await PUT("/utilisateurs/mes-informations", user, { ...corps, nom: "" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Tous les champs sont obligatoires");
  });

  test("refuse une adresse e-mail invalide", async () => {
    const res = await PUT("/utilisateurs/mes-informations", user, { ...corps, email: "x" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Adresse email invalide");
  });

  test("retourne 500 si la vérification de l'e-mail échoue", async () => {
    db.enqueue(ko());
    const res = await PUT("/utilisateurs/mes-informations", user, corps);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe(
      "Erreur lors de la modification des informations personnelles"
    );
  });

  test("retourne 409 si l'e-mail est utilisé par un autre compte", async () => {
    db.enqueue(ok({ id: 9 }));
    const res = await PUT("/utilisateurs/mes-informations", user, corps);
    expect(res.status).toBe(409);
  });

  test("retourne 500 si la mise à jour échoue", async () => {
    db.enqueue(ok(null), ko());
    const res = await PUT("/utilisateurs/mes-informations", user, corps);
    expect(res.status).toBe(500);
  });

  test("retourne 404 si l'utilisateur n'existe plus", async () => {
    db.enqueue(ok(null), ok(null));
    const res = await PUT("/utilisateurs/mes-informations", user, corps);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Utilisateur introuvable");
  });

  test("modifie les informations et normalise l'e-mail", async () => {
    db.enqueue(
      ok(null),
      ok({ id: 2, nom: "Martin", prenom: "Paul", email: "paul@test.com", role: "utilisateur" })
    );
    const res = await PUT("/utilisateurs/mes-informations", user, corps);
    expect(res.status).toBe(200);
    expect(argumentsDe("from", "utilisateurs", "update")[0].email).toBe("paul@test.com");
  });
});

describe("GET /utilisateurs/mes-informations", () => {
  test("retourne le profil", async () => {
    db.enqueue(ok({ id: 2, nom: "Martin", prenom: "Paul", email: "paul@test.com", role: "utilisateur" }));
    const res = await GET("/utilisateurs/mes-informations", user);
    expect(res.status).toBe(200);
    expect(res.body.utilisateur.email).toBe("paul@test.com");
  });

  test("retourne 404 si l'utilisateur n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await GET("/utilisateurs/mes-informations", user);
    expect(res.status).toBe(404);
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await GET("/utilisateurs/mes-informations", user);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe(
      "Erreur lors de la récupération des informations personnelles"
    );
  });
});

describe("PUT /utilisateurs/changer-mot-de-passe", () => {
  const corps = { ancienMotDePasse: "Ancien123!", nouveauMotDePasse: "Nouveau123!" };
  const compte = ok({ id: 2, mot_de_passe: bcrypt.hashSync("Ancien123!", 4) });

  test("refuse des champs manquants", async () => {
    const res = await PUT("/utilisateurs/changer-mot-de-passe", user, {});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Les deux mots de passe sont obligatoires");
  });

  test("refuse un nouveau mot de passe trop court", async () => {
    const res = await PUT("/utilisateurs/changer-mot-de-passe", user, {
      ...corps,
      nouveauMotDePasse: "abc"
    });
    expect(res.status).toBe(400);
  });

  test("retourne 500 si la lecture de l'utilisateur échoue", async () => {
    db.enqueue(ko());
    const res = await PUT("/utilisateurs/changer-mot-de-passe", user, corps);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors du changement de mot de passe");
  });

  test("retourne 404 si l'utilisateur n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await PUT("/utilisateurs/changer-mot-de-passe", user, corps);
    expect(res.status).toBe(404);
  });

  test("retourne 401 si l'ancien mot de passe est incorrect", async () => {
    db.enqueue(compte);
    const res = await PUT("/utilisateurs/changer-mot-de-passe", user, {
      ...corps,
      ancienMotDePasse: "Incorrect123!"
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Ancien mot de passe incorrect");
  });

  test("retourne 500 si la mise à jour échoue", async () => {
    db.enqueue(compte, ko());
    const res = await PUT("/utilisateurs/changer-mot-de-passe", user, corps);
    expect(res.status).toBe(500);
  });

  test("change le mot de passe en le hachant", async () => {
    db.enqueue(compte, ok(null));
    const res = await PUT("/utilisateurs/changer-mot-de-passe", user, corps);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Mot de passe modifié avec succès");

    const enregistre = argumentsDe("from", "utilisateurs", "update")[0].mot_de_passe;
    expect(enregistre).not.toBe("Nouveau123!");
    expect(bcrypt.compareSync("Nouveau123!", enregistre)).toBe(true);
  });
});

// ---------- Notifications ----------

describe("Notifications", () => {
  test("liste les notifications de l'utilisateur", async () => {
    db.enqueue(ok([{ id: 1, utilisateur_id: 2, message: "m", date: "d", lu: false }]));
    const res = await GET("/utilisateurs/mes-notifications", user);
    expect(res.status).toBe(200);
    expect(res.body.notifications[0]).toEqual({
      id: 1,
      utilisateurId: 2,
      message: "m",
      date: "d",
      lu: false
    });
  });

  test("retourne 500 si la lecture échoue", async () => {
    db.enqueue(ko());
    const res = await GET("/utilisateurs/mes-notifications", user);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la récupération des notifications");
  });

  test("refuse un identifiant de notification invalide", async () => {
    const res = await PUT("/utilisateurs/notifications/abc/lue", user);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Identifiant de notification invalide");
  });

  test("retourne 500 si la mise à jour échoue", async () => {
    db.enqueue(ko());
    const res = await PUT("/utilisateurs/notifications/1/lue", user);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la mise à jour de la notification");
  });

  test("retourne 404 si la notification n'existe pas", async () => {
    db.enqueue(ok(null));
    const res = await PUT("/utilisateurs/notifications/1/lue", user);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Notification introuvable");
  });

  test("marque la notification comme lue", async () => {
    db.enqueue(ok({ id: 1, lu: true }));
    const res = await PUT("/utilisateurs/notifications/1/lue", user);
    expect(res.status).toBe(200);
    expect(res.body.notification.lu).toBe(true);
  });
});

// ---------- Statistiques (admin) ----------

describe("GET /statistiques/seances-proches-saturation", () => {
  const url = "/statistiques/seances-proches-saturation";

  test("refuse un utilisateur simple", async () => {
    const res = await GET(url, user);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Accès réservé aux administrateurs");
  });

  test("retourne 500 si Supabase renvoie une erreur", async () => {
    db.enqueue(ko());
    const res = await GET(url, admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors du calcul des statistiques");
  });

  test("ne retient que les séances remplies à 80 % ou plus", async () => {
    const reservee = { statut: "reservee" };
    const libre = { statut: "disponible" };
    db.enqueue(
      ok([
        {
          id: 1,
          films: { titre: "Jungle" },
          salles: { nom: "Salle 1" },
          places: [reservee, reservee, reservee, reservee, libre] // 80 %
        },
        { id: 2, films: { titre: "King" }, salles: { nom: "Salle 2" }, places: [reservee, libre] }, // 50 %
        { id: 3, films: { titre: "Vide" }, salles: { nom: "Salle 3" }, places: [] } // 0 %
      ])
    );
    const res = await GET(url, admin);
    expect(res.status).toBe(200);
    expect(res.body.nombreSeances).toBe(1);
    expect(res.body.seances[0]).toMatchObject({
      film: "Jungle",
      seanceId: 1,
      placesReservees: 4,
      tauxRemplissage: 80
    });
  });
});

describe.each([
  {
    chemin: "/statistiques/horaires-plus-demandes",
    champ: "heure",
    valeurs: ["14:00", "18:00"],
    cle: "horaires",
    libelle: "horaire"
  },
  {
    chemin: "/statistiques/journees-plus-frequentees",
    champ: "date_seance",
    valeurs: ["2026-11-01", "2026-11-02"],
    cle: "journees",
    libelle: "date"
  },
  {
    chemin: "/statistiques/periodes-forte-affluence",
    champ: "date_seance",
    valeurs: ["2026-11-05", "2026-12-10"],
    cle: "periodes",
    libelle: "periode",
    attendu: ["2026-12", "2026-11"]
  }
])("GET $chemin", ({ chemin, champ, valeurs, cle, libelle, attendu }) => {
  test("refuse un utilisateur simple", async () => {
    const res = await GET(chemin, user);
    expect(res.status).toBe(403);
  });

  test("retourne 500 si la lecture des réservations échoue", async () => {
    db.enqueue(ko());
    const res = await GET(chemin, admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la récupération des réservations");
  });

  test("retourne 500 si la lecture des séances échoue", async () => {
    db.enqueue(ok([]), ko());
    const res = await GET(chemin, admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur lors de la récupération des séances");
  });

  test("retourne 500 si une exception est levée", async () => {
    db.enqueue(lance(new Error("panne")));
    const res = await GET(chemin, admin);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Erreur serveur");
  });

  test("compte les réservations actives et trie par fréquence", async () => {
    db.enqueue(
      ok([
        { seance_id: 1, statut: "confirmee" },
        { seance_id: 2, statut: "confirmee" },
        { seance_id: 2, statut: "confirmee" },
        { seance_id: 3, statut: "annulee" }, // ignorée : annulée
        { seance_id: 99, statut: "confirmee" } // ignorée : séance inconnue
      ]),
      ok([
        { id: 1, [champ]: valeurs[0] },
        { id: 2, [champ]: valeurs[1] },
        { id: 3, [champ]: valeurs[0] }
      ])
    );
    const res = await GET(chemin, admin);
    expect(res.status).toBe(200);

    const resultat = res.body[cle];
    expect(resultat.map((ligne) => ligne[libelle])).toEqual(
      attendu || [valeurs[1], valeurs[0]]
    );
    expect(resultat.map((ligne) => ligne.nombreReservations)).toEqual([2, 1]);
  });
});
