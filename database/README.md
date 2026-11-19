# Base de données Cinema Booking

Base PostgreSQL hébergée sur Supabase. Les scripts permettent de la recréer depuis zéro.

## Ordre d'exécution

Dans l'éditeur SQL de Supabase, exécuter les scripts dans cet ordre :

1. `01_create_tables.sql` : création des 9 tables
2. `03_insert_data.sql` : films, salles, séances et places d'exemple
3. `04_configure_permissions.sql` : sécurité RLS et droits
4. `05_migrations.sql` : synchronisation des compteurs d'identifiants
5. `07_create_functions.sql` : fonctions de réservation (`confirmer_reservation`, `annuler_reservation`, `modifier_seance`)
6. `08_seed_utilisateurs.sql` : comptes de test (admin et utilisateur)
7. `06_verification_donnees.sql` : requêtes de vérification (facultatif)

## Sécurité

- RLS activé sur toutes les tables.
- Lecture publique limitée aux films, séances, salles et places.
- Les données personnelles (utilisateurs, réservations, billets, notifications) ne sont accessibles que par le backend (`service_role`).
- Les fonctions de réservation sont exécutables uniquement par `service_role`.
- Une réservation est faite dans une seule transaction, avec verrouillage des places (`FOR UPDATE`) : deux clients ne peuvent pas réserver la même place.

## Évolutions par rapport au MCD initial

| MCD initial | Base réelle | Raison |
|---|---|---|
| `Place` liée à `Salle` | `places.seance_id`, avec `UNIQUE (seance_id, rangee, numero)` | un statut de place par séance et une unicité garantie par la base |
| `Seance.date_heure` | `date_seance`, `heure`, `capacite`, `statut`, `date_annulation` | séparer la date et l'heure, gérer l'annulation |
| `Utilisateur` sans rôle | colonnes `role` et `date_creation` | distinguer administrateur et utilisateur |
| `Reservation` simple | `numero_reservation`, coordonnées du client, `date_annulation` | affichage et annulation d'une réservation |
| tables absentes | `billets`, `notifications`, `films.actif` | billets avec QR code, notifications, désactivation d'un film |