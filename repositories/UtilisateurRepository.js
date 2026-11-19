class UtilisateurRepository {
  constructor(supabase) {
    this.supabase = supabase;
  }

  trouverIdParEmail(email) {
    return this.supabase.from("utilisateurs").select("id").eq("email", email).maybeSingle();
  }

  trouverParEmail(email) {
    return this.supabase.from("utilisateurs").select("*").eq("email", email).maybeSingle();
  }

  creer(utilisateur) {
    return this.supabase
      .from("utilisateurs")
      .insert(utilisateur)
      .select("id, nom, prenom, email, role, date_creation")
      .single();
  }

  trouverProfil(id) {
    return this.supabase
      .from("utilisateurs")
      .select("id, nom, prenom, email, role")
      .eq("id", id)
      .maybeSingle();
  }

  trouverMotDePasse(id) {
    return this.supabase
      .from("utilisateurs")
      .select("id, mot_de_passe")
      .eq("id", id)
      .maybeSingle();
  }

  emailUtiliseParAutre(email, id) {
    return this.supabase
      .from("utilisateurs")
      .select("id")
      .eq("email", email)
      .neq("id", id)
      .maybeSingle();
  }

  mettreAJourInformations(id, informations) {
    return this.supabase
      .from("utilisateurs")
      .update(informations)
      .eq("id", id)
      .select("id, nom, prenom, email, role")
      .maybeSingle();
  }

  mettreAJourMotDePasse(id, motDePasseHache) {
    return this.supabase
      .from("utilisateurs")
      .update({ mot_de_passe: motDePasseHache })
      .eq("id", id);
  }

  reservationsParEmail(email) {
    return this.supabase
      .from("reservations")
      .select(`
        id,
        numero_reservation,
        seance_id,
        nom,
        prenom,
        email,
        telephone,
        date_reservation,
        statut,
        reservation_places (
          places (
            id,
            rangee,
            numero
          )
        )
      `)
      .eq("email", email)
      .order("date_reservation", { ascending: false });
  }

  billetsParEmail(email) {
    return this.supabase
      .from("billets")
      .select(`
        id,
        numero_billet,
        reservation_id,
        date_generation,
        statut,
        date_utilisation,
        reservations!inner (
          id,
          numero_reservation,
          seance_id,
          nom,
          prenom,
          email,
          telephone,
          reservation_places (
            places (
              id,
              rangee,
              numero
            )
          )
        )
      `)
      .eq("reservations.email", email)
      .order("date_generation", { ascending: false });
  }

  notificationsParUtilisateur(utilisateurId) {
    return this.supabase
      .from("notifications")
      .select("*")
      .eq("utilisateur_id", utilisateurId)
      .order("date", { ascending: false });
  }

  marquerNotificationLue(id, utilisateurId) {
    return this.supabase
      .from("notifications")
      .update({ lu: true })
      .eq("id", id)
      .eq("utilisateur_id", utilisateurId)
      .select("*")
      .maybeSingle();
  }
}

module.exports = UtilisateurRepository;