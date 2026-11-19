
-- ==========================================
-- Configuration des permissions Cinema Booking
-- ==========================================

-- 1. Autoriser la lecture publique des données du cinéma
GRANT SELECT ON TABLE
  public.films,
  public.seances,
  public.salles,
  public.places
TO anon;

-- 2. Retirer le droit d'insertion publique des films
REVOKE INSERT ON TABLE public.films FROM anon;

-- Supprimer l'ancienne politique d'insertion publique
DROP POLICY IF EXISTS "Insertion publique des films"
ON public.films;

-- 3. Activer la sécurité RLS sur toutes les tables
ALTER TABLE public.films ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utilisateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Créer les politiques de lecture publique

DROP POLICY IF EXISTS "Lecture publique des films"
ON public.films;

CREATE POLICY "Lecture publique des films"
ON public.films
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Lecture publique des seances"
ON public.seances;

CREATE POLICY "Lecture publique des seances"
ON public.seances
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Lecture publique des salles"
ON public.salles;

CREATE POLICY "Lecture publique des salles"
ON public.salles
FOR SELECT
TO anon
USING (true);

DROP POLICY IF EXISTS "Lecture publique des places"
ON public.places;

CREATE POLICY "Lecture publique des places"
ON public.places
FOR SELECT
TO anon
USING (true);

-- 5. Aucune lecture publique des données personnelles,
-- réservations, billets et notifications.
-- Leur accès est géré par le backend sécurisé.




-- 6. Retirer les accès directs des rôles publics
REVOKE ALL PRIVILEGES ON TABLE
  public.utilisateurs,
  public.reservations,
  public.reservation_places,
  public.billets,
  public.notifications
FROM anon, authenticated;