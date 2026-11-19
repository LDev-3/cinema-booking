class StatistiqueRepository {
  constructor(supabase) {
    this.supabase = supabase;
  }

  seancesAvecPlaces() {
    return this.supabase
      .from("seances")
      .select(`
        id,
        capacite,
        date_seance,
        heure,
        films (titre),
        salles (nom),
        places (statut)
      `);
  }

  reservations() {
    return this.supabase.from("reservations").select("seance_id, statut");
  }

  seances(colonne) {
    return this.supabase.from("seances").select(`id, ${colonne}`);
  }
}

module.exports = StatistiqueRepository;