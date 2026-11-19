
-- Vérifier les informations d'un film
SELECT *
FROM public.films
WHERE id = 1;


-- Vérifier les séances et le nombre de places
SELECT
  f.titre,
  s.id AS numero_seance,
  sa.nom AS salle,
  s.date_seance,
  s.heure,
  COUNT(p.id) AS nombre_de_places
FROM films f
JOIN seances s ON s.film_id = f.id
JOIN salles sa ON sa.id = s.salle_id
LEFT JOIN places p ON p.seance_id = s.id
GROUP BY f.titre, s.id, sa.nom, s.date_seance, s.heure
ORDER BY s.id;


-- Vérifier les politiques RLS de toutes les tables
SELECT
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;