
-- Autoriser la lecture des tables
GRANT SELECT ON TABLE
  public.films,
  public.seances,
  public.salles,
  public.places
TO anon;


-- Activer la sécurité RLS
ALTER TABLE public.films ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;


-- Autoriser la lecture publique des films
CREATE POLICY "Lecture publique des films"
ON public.films
FOR SELECT
TO anon
USING (true);


-- Autoriser la lecture publique des séances
CREATE POLICY "Lecture publique des seances"
ON public.seances
FOR SELECT
TO anon
USING (true);


-- Autoriser la lecture publique des salles
CREATE POLICY "Lecture publique des salles"
ON public.salles
FOR SELECT
TO anon
USING (true);


-- Autoriser la lecture publique des places
CREATE POLICY "Lecture publique des places"
ON public.places
FOR SELECT
TO anon
USING (true);


-- Autoriser l'insertion publique des films
GRANT INSERT ON TABLE public.films TO anon;

CREATE POLICY "Insertion publique des films"
ON public.films
FOR INSERT
TO anon
WITH CHECK (true);
