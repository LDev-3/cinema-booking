class ReservationRepository {
  constructor(supabase) {
    this.supabase = supabase;
  }

  seancePourSelection(id) {
    return this.supabase
      .from("seances")
      .select(`
        id,
        date_seance,
        heure,
        capacite,
        statut,
        films (titre),
        salles (nom),
        places (
          id,
          rangee,
          numero,
          statut
        )
      `)
      .eq("id", id)
      .maybeSingle();
  }

  trouverUtilisateur(id) {
    return this.supabase
      .from("utilisateurs")
      .select("id, nom, prenom, email")
      .eq("id", id)
      .single();
  }

  confirmer(parametres) {
    return this.supabase.rpc("confirmer_reservation", parametres);
  }

  annuler(parametres) {
    return this.supabase.rpc("annuler_reservation", parametres);
  }

  lister() {
    return this.supabase.from("reservations").select("*");
  }

  rechercherParNumero(numero) {
    return this.supabase
      .from("reservations")
      .select(`
        *,
        reservation_places (
          places (
            id,
            seance_id,
            rangee,
            numero,
            statut
          )
        )
      `)
      .eq("numero_reservation", numero)
      .maybeSingle();
  }

  parSeance(seanceId) {
    return this.supabase
      .from("reservations")
      .select(`
        *,
        reservation_places (
          places (
            id,
            rangee,
            numero,
            statut
          )
        )
      `)
      .eq("seance_id", seanceId)
      .order("date_reservation", { ascending: false });
  }

  trouverParId(id) {
    return this.supabase.from("reservations").select("*").eq("id", id).maybeSingle();
  }

  placesDeReservation(reservationId) {
    return this.supabase
      .from("reservation_places")
      .select("places(id, rangee, numero)")
      .eq("reservation_id", reservationId);
  }
}

module.exports = ReservationRepository;