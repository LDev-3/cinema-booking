class BilletRepository {
  constructor(supabase) {
    this.supabase = supabase;
  }

  trouverParReservation(reservationId) {
    return this.supabase
      .from("billets")
      .select("*")
      .eq("reservation_id", reservationId)
      .maybeSingle();
  }

  trouverParNumero(numero) {
    return this.supabase
      .from("billets")
      .select("*")
      .eq("numero_billet", numero)
      .maybeSingle();
  }

  trouverAvecReservation(numero) {
    return this.supabase
      .from("billets")
      .select(`
        id,
        numero_billet,
        reservation_id,
        reservations (
          numero_reservation
        )
      `)
      .eq("numero_billet", numero)
      .maybeSingle();
  }

  creer(billet) {
    return this.supabase.from("billets").insert(billet).select().single();
  }

  marquerUtilise(id) {
    return this.supabase
      .from("billets")
      .update({ statut: "utilise", date_utilisation: new Date().toISOString() })
      .eq("id", id)
      .neq("statut", "utilise")
      .select()
      .maybeSingle();
  }
}

module.exports = BilletRepository;