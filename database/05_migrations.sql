-- Synchroniser les identifiants automatiques de films
SELECT setval(
  pg_get_serial_sequence('public.films', 'id'),
  COALESCE((SELECT MAX(id) FROM public.films), 0) + 1,
  false
);

-- Synchroniser les identifiants automatiques de seances
SELECT setval(
  pg_get_serial_sequence('public.seances', 'id'),
  COALESCE((SELECT MAX(id) FROM public.seances), 0) + 1,
  false
);