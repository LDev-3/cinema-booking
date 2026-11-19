class SalleRepository {
  constructor(supabase) {
    this.supabase = supabase;
  }

  lister() {
    return this.supabase
      .from("salles")
      .select("id, nom, capacite")
      .order("id", { ascending: true });
  }

  trouverParNom(nom) {
    return this.supabase
      .from("salles")
      .select("id, nom, capacite")
      .eq("nom", nom)
      .single();
  }
}

module.exports = SalleRepository;