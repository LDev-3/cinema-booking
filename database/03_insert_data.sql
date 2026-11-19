
-- Ajouter les films
INSERT INTO films (id, titre, description, duree, genre, actif)
VALUES
  (1, 'Jungle', 'Un film d''aventure.', 120, 'Aventure', TRUE),
  (2, 'King', 'Un film dramatique.', 105, 'Drame', TRUE),
  (3, 'Le Roi Lion', 'L''histoire de Simba.', 118, 'Animation', TRUE)
ON CONFLICT (id) DO NOTHING;


-- Ajouter les salles
INSERT INTO salles (nom, capacite)
VALUES
  ('Salle 1', 100),
  ('Salle 2', 80)
ON CONFLICT (nom) DO NOTHING;


-- Ajouter les séances
INSERT INTO seances (
  id, film_id, salle_id, date_seance, heure, capacite, statut
)
VALUES
  (1, 1, (SELECT id FROM salles WHERE nom = 'Salle 1'), '2026-11-01', '14:00', 100, 'active'),
  (2, 1, (SELECT id FROM salles WHERE nom = 'Salle 2'), '2026-11-01', '18:00', 80, 'active'),
  (3, 2, (SELECT id FROM salles WHERE nom = 'Salle 1'), '2026-11-02', '16:00', 100, 'active'),
  (4, 2, (SELECT id FROM salles WHERE nom = 'Salle 2'), '2026-11-02', '20:00', 80, 'active'),
  (5, 3, (SELECT id FROM salles WHERE nom = 'Salle 1'), '2026-11-03', '15:00', 100, 'active'),
  (6, 3, (SELECT id FROM salles WHERE nom = 'Salle 2'), '2026-11-03', '19:00', 80, 'active')
ON CONFLICT (id) DO NOTHING;


-- Ajouter les places pour chaque séance
INSERT INTO places (seance_id, rangee, numero, statut)
SELECT
  s.id,
  p.rangee,
  p.numero,
  p.statut
FROM seances s
CROSS JOIN (
  VALUES
    ('A', 1, 'disponible'),
    ('A', 2, 'disponible'),
    ('A', 3, 'disponible'),
    ('B', 1, 'disponible'),
    ('B', 2, 'disponible')
) AS p(rangee, numero, statut)
ON CONFLICT (seance_id, rangee, numero) DO NOTHING;
