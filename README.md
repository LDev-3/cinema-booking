# Cinema Booking

API de réservation de cinéma : films, séances, salles, places, réservations, billets avec QR code, notifications et statistiques administrateur.

## Liens

- Application : https://cinema-booking-58636.containers.snapdeploy.app
- Documentation Swagger : https://cinema-booking-58636.containers.snapdeploy.app/api-docs

## Comptes de test

Les identifiants du compte administrateur et du compte utilisateur sont fournis dans le dossier rendu (PDF).

## Comment tester

1. Se connecter : `POST /utilisateurs/connexion` avec `{ "email": "...", "motDePasse": "..." }`. La réponse contient un token.
2. Dans Swagger, cliquer sur **Authorize** et coller le token. Pour un autre outil, ajouter l'en-tête `Authorization: Bearer <token>`.
3. Exemples :
   - Administrateur : `GET /reservations` (liste de toutes les réservations).
   - Utilisateur : `GET /utilisateurs/mes-reservations` (ses réservations).
   - Utilisateur : `GET /reservations` renvoie 403 (accès refusé).

## Technologies

Node.js, Express 5, Supabase (PostgreSQL), JWT, bcrypt, Swagger, Jest, Supertest, ESLint. Hébergement : SnapDeploy.

## Installation et lancement

```bash
npm install
npm start
npm test
npm run lint
```

Variables d'environnement (fichier `.env`, jamais envoyé sur GitHub) : `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `JWT_SECRET`.

## Base de données

Les scripts SQL du dossier `database/` recréent la base depuis zéro. L'ordre d'exécution est décrit dans `database/README.md`.

## Architecture

Le backend est organisé en couches, chacune avec une seule responsabilité :

| Couche | Dossier | Rôle |
|---|---|---|
| Routes | `routes/` | associer un chemin à une méthode du contrôleur |
| Contrôleurs | `controllers/` | lire la requête, choisir le code HTTP de la réponse |
| Services | `services/` | logique métier (validation, formatage, règles) |
| Repositories | `repositories/` | accès à Supabase uniquement |
| Middlewares | `middlewares/` | vérification du token JWT et du rôle administrateur |

Tous les domaines sont découpés en couches :

| Domaine | Fichiers |
|---|---|
| Films | `FilmRepository`, `FilmService`, `FilmController`, `films.routes.js` |
| Utilisateurs | `UtilisateurRepository`, `UtilisateurService`, `UtilisateurController`, `utilisateurs.routes.js` |
| Séances | `SeanceRepository`, `SeanceService`, `SeanceController`, `seances.routes.js` |
| Salles | `SalleRepository`, `SalleService`, `SalleController`, `salles.routes.js` |
| Réservations | `ReservationRepository`, `ReservationService`, `ReservationController`, `reservations.routes.js` |
| Billets | `BilletRepository`, `BilletService`, `BilletController`, `billets.routes.js` |
| Statistiques | `StatistiqueRepository`, `StatistiqueService`, `StatistiqueController`, `statistiques.routes.js` |

Le fichier `server.js` ne contient plus que la configuration, la documentation Swagger, le branchement des routeurs et le démarrage du serveur (environ 150 lignes, contre 2 500 avant le découpage).

Les erreurs métier sont gérées par une classe `ErreurHttp` (dossier `utils/`) : un service lève l'erreur avec son code HTTP, et le contrôleur la transforme en réponse.

## Tests

222 tests automatisés avec Jest et Supertest. Supabase est simulé (`tests/helpers/supabaseMock.js`) : les tests sont rapides, reproductibles et ne modifient jamais la vraie base. Couverture supérieure à 95 % sur le code applicatif.

## Remarques

- Hébergement gratuit avec mise en veille : si l'application met du temps à répondre, patienter environ une minute (réveil automatique).
- Les données sont stockées dans Supabase et ne sont pas perdues au redémarrage.

## Convention de nommage des branches

- `main` : version stable de l'application.
- `develop` : branche d'intégration des nouvelles fonctionnalités.
- `feature/nom-fonctionnalite` : développer une nouvelle fonctionnalité.
- `fix/nom-correction` : corriger un problème.
- `hotfix/nom-correction-urgente` : corriger rapidement un problème critique.

Règles : lettres minuscules, mots séparés par des tirets, préfixe adapté au type de travail, pas d'espaces ni d'accents.

Exemples : `feature/recherche-films`, `feature/reservation-seances`, `fix/selection-sieges`, `hotfix/erreur-paiement`.