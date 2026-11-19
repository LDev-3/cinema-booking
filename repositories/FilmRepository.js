class FilmRepository {
  constructor(supabase) {
    this.supabase = supabase;
  }

  lister() {
    return this.supabase.from("films").select("*").order("id", { ascending: true });
  }

  rechercherParTitre(titre) {
    return this.supabase.from("films").select("*").ilike("titre", `%${titre}%`);
  }

  trouverAvecSeances(id) {
    return this.supabase
      .from("films")
      .select(`
        id,
        titre,
        description,
        duree,
        genre,
        actif,
        seances (
          id,
          date_seance,
          heure,
          capacite,
          salles (nom),
          places (
            id,
            rangee,
            numero,
            statut
          )
        )
      `)
      .eq("id", id)
      .single();
  }

  trouverParId(id) {
    return this.supabase.from("films").select("*").eq("id", id).single();
  }

  existe(id) {
    return this.supabase.from("films").select("id").eq("id", id).single();
  }

  creer(film) {
    return this.supabase.from("films").insert(film).select().single();
  }

  supprimer(id) {
    return this.supabase.from("films").delete().eq("id", id).select().maybeSingle();
  }

  desactiver(id) {
    return this.supabase
      .from("films")
      .update({ actif: false })
      .eq("id", id)
      .select()
      .single();
  }

  listerSeances(filmId) {
    return this.supabase
      .from("seances")
      .select("*")
      .eq("film_id", filmId)
      .order("date_seance", { ascending: true });
  }
}

module.exports = FilmRepository;