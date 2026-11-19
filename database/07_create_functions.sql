
-- ============================================================
-- 07 - Création des fonctions RPC de réservation
-- ============================================================

-- 1. ANNULER UNE RÉSERVATION
CREATE OR REPLACE FUNCTION public.annuler_reservation(
    p_reservation_id integer,
    p_utilisateur_id integer,
    p_est_admin boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_reservation RECORD;
    v_proprietaire_id INTEGER;
BEGIN
    SELECT *
    INTO v_reservation
    FROM public.reservations
    WHERE id = p_reservation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Réservation introuvable';
    END IF;

    SELECT id INTO v_proprietaire_id
    FROM public.utilisateurs
    WHERE LOWER(email) = LOWER(v_reservation.email);

    IF v_proprietaire_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur propriétaire introuvable';
    END IF;

    IF NOT p_est_admin AND v_proprietaire_id <> p_utilisateur_id THEN
        RAISE EXCEPTION 'Vous ne pouvez pas annuler cette réservation';
    END IF;

    IF v_reservation.statut = 'annulee' THEN
        RAISE EXCEPTION 'Cette réservation est déjà annulée';
    END IF;

    UPDATE public.places
    SET statut = 'disponible'
    WHERE id IN (
        SELECT place_id
        FROM public.reservation_places
        WHERE reservation_id = p_reservation_id
    );

    UPDATE public.reservations
    SET statut = 'annulee',
        date_annulation = NOW()
    WHERE id = p_reservation_id;

    INSERT INTO public.notifications (
        utilisateur_id, message, date, lu
    )
    VALUES (
        v_proprietaire_id,
        'Votre réservation ' || v_reservation.numero_reservation || ' a été annulée.',
        NOW(),
        FALSE
    );

    RETURN json_build_object(
        'message', 'Réservation annulée avec succès',
        'reservation_id', p_reservation_id,
        'statut', 'annulee'
    );
END;
$function$;


-- 2. CONFIRMER UNE RÉSERVATION
CREATE OR REPLACE FUNCTION public.confirmer_reservation(
    p_seance_id integer,
    p_places_ids integer[],
    p_nom character varying,
    p_prenom character varying,
    p_email character varying,
    p_telephone character varying,
    p_utilisateur_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_reservation_id INTEGER;
    v_numero_reservation VARCHAR(50);
    v_places JSONB;
    v_nombre_places INTEGER;
BEGIN
    -- Vérifier les informations
    IF p_utilisateur_id IS NULL
       OR p_places_ids IS NULL
       OR cardinality(p_places_ids) = 0
       OR array_position(p_places_ids, NULL) IS NOT NULL
       OR btrim(p_nom) = ''
       OR btrim(p_prenom) = ''
       OR btrim(p_email) = ''
       OR btrim(p_telephone) = '' THEN
        RAISE EXCEPTION 'Informations de réservation invalides';
    END IF;

    -- Vérifier l'utilisateur
    IF NOT EXISTS (
        SELECT 1
        FROM public.utilisateurs
        WHERE id = p_utilisateur_id
    ) THEN
        RAISE EXCEPTION 'Utilisateur introuvable';
    END IF;

    -- Empêcher les doublons de places
    IF EXISTS (
        SELECT 1
        FROM unnest(p_places_ids) AS ids(id)
        GROUP BY ids.id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Une place est sélectionnée plusieurs fois';
    END IF;

    -- Vérifier la séance
    IF NOT EXISTS (
        SELECT 1
        FROM public.seances
        WHERE id = p_seance_id
    ) THEN
        RAISE EXCEPTION 'Séance introuvable';
    END IF;

    -- Verrouiller les places sélectionnées
    PERFORM id
    FROM public.places
    WHERE id = ANY(p_places_ids)
      AND seance_id = p_seance_id
    ORDER BY id
    FOR UPDATE;

    -- Vérifier leur disponibilité
    SELECT COUNT(*)
    INTO v_nombre_places
    FROM public.places
    WHERE id = ANY(p_places_ids)
      AND seance_id = p_seance_id
      AND statut = 'disponible';

    IF v_nombre_places <> cardinality(p_places_ids) THEN
        RAISE EXCEPTION
            'Une ou plusieurs places sont introuvables ou indisponibles';
    END IF;

    -- Créer la réservation avec son propriétaire
    INSERT INTO public.reservations (
        numero_reservation,
        seance_id,
        nom,
        prenom,
        email,
        telephone,
        utilisateur_id
    )
    VALUES (
        'TEMP-' || gen_random_uuid()::text,
        p_seance_id,
        btrim(p_nom),
        btrim(p_prenom),
        lower(btrim(p_email)),
        btrim(p_telephone),
        p_utilisateur_id
    )
    RETURNING id INTO v_reservation_id;

    -- Générer le numéro définitif
    v_numero_reservation :=
        'RES-' || lpad(v_reservation_id::text, 6, '0');

    UPDATE public.reservations
    SET numero_reservation = v_numero_reservation
    WHERE id = v_reservation_id;

    -- Associer les places à la réservation
    INSERT INTO public.reservation_places (reservation_id, place_id)
    SELECT v_reservation_id, id
    FROM public.places
    WHERE id = ANY(p_places_ids)
      AND seance_id = p_seance_id;

    -- Marquer les places comme réservées
    UPDATE public.places
    SET statut = 'reservee'
    WHERE id = ANY(p_places_ids)
      AND seance_id = p_seance_id;

    -- Préparer les places pour la réponse
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', p.id,
            'rangee', p.rangee,
            'numero', p.numero
        )
        ORDER BY p.id
    )
    INTO v_places
    FROM public.places p
    WHERE p.id = ANY(p_places_ids)
      AND p.seance_id = p_seance_id;

    -- Retourner la réservation
    RETURN jsonb_build_object(
        'id', v_reservation_id,
        'numeroReservation', v_numero_reservation,
        'seanceId', p_seance_id,
        'utilisateurId', p_utilisateur_id,
        'client', jsonb_build_object(
            'nom', btrim(p_nom),
            'prenom', btrim(p_prenom),
            'email', lower(btrim(p_email)),
            'telephone', btrim(p_telephone)
        ),
        'places', v_places,
        'dateReservation', NOW(),
        'statut', 'confirmee'
    );
END;
$function$;


-- 3. MODIFIER UNE SÉANCE
CREATE OR REPLACE FUNCTION public.modifier_seance(
    p_seance_id integer,
    p_date_seance date,
    p_heure time without time zone,
    p_salle_id integer,
    p_capacite integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_places_reservees INTEGER;
    v_rangee TEXT;
    v_numero INTEGER;
    i INTEGER;
BEGIN
    IF p_capacite <= 0 THEN
        RAISE EXCEPTION 'La capacité doit être positive';
    END IF;

    PERFORM 1
    FROM public.seances
    WHERE id = p_seance_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Séance introuvable';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.salles WHERE id = p_salle_id
    ) THEN
        RAISE EXCEPTION 'Salle introuvable';
    END IF;

    SELECT COUNT(*) INTO v_places_reservees
    FROM public.places
    WHERE seance_id = p_seance_id
      AND statut = 'reservee';

    IF p_capacite < v_places_reservees THEN
        RAISE EXCEPTION 'La capacité est inférieure au nombre de places réservées';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.seances
        WHERE salle_id = p_salle_id
          AND date_seance = p_date_seance
          AND heure = p_heure
          AND id <> p_seance_id
    ) THEN
        RAISE EXCEPTION 'Cette salle est déjà utilisée à cet horaire';
    END IF;

    UPDATE public.seances
    SET date_seance = p_date_seance,
        heure = p_heure,
        salle_id = p_salle_id,
        capacite = p_capacite
    WHERE id = p_seance_id;

    FOR i IN 0..(p_capacite - 1) LOOP
        v_rangee := chr(65 + (i / 10));
        v_numero := (i % 10) + 1;

        IF NOT EXISTS (
            SELECT 1
            FROM public.places
            WHERE seance_id = p_seance_id
              AND rangee = v_rangee
              AND numero = v_numero
        ) THEN
            INSERT INTO public.places (
                seance_id, rangee, numero, statut
            )
            VALUES (
                p_seance_id, v_rangee, v_numero, 'disponible'
            );
        END IF;
    END LOOP;

    RETURN json_build_object(
        'message', 'Séance modifiée avec succès',
        'seance_id', p_seance_id,
        'capacite', p_capacite
    );
END;
$function$;


-- 4. CONFIGURATION DES DROITS D'EXÉCUTION
REVOKE ALL ON FUNCTION public.annuler_reservation(integer, integer, boolean)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.confirmer_reservation(integer, integer[], character varying, character varying, character varying, character varying, integer)
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.modifier_seance(integer, date, time without time zone, integer, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.annuler_reservation(integer, integer, boolean)
TO service_role;

GRANT EXECUTE ON FUNCTION public.confirmer_reservation(integer, integer[], character varying, character varying, character varying, character varying, integer)
TO service_role;

GRANT EXECUTE ON FUNCTION public.modifier_seance(integer, date, time without time zone, integer, integer)
TO service_role;
