-- Synchroniser l'identifiant automatique avec les identifiants existants
SELECT setval(
  pg_get_serial_sequence('public.films', 'id'),
  COALESCE((SELECT MAX(id) FROM public.films), 0) + 1,
  false
);