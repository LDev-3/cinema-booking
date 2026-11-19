class SeanceRepository {
  constructor(supabase) {
    this.supabase = supabase;
  }

  trouverParId(id) {
    return this.supabase.from("seances").select("*").eq("id", id).single();
  }

  trouverAvecPlaces(id) {
    return this.supabase
      .from("seances")
      .select(`
        id,
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

  trouverEtat(id) {
    return this.supabase
      .from("seances")
      .select(`
        id,
        capacite,
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

  trouverDetail(id) {
    return this.supabase
      .from("seances")
      .select(`
        id,
        film_id,
        salle_id,
        date_seance,
        heure,
        capacite,
        films (
          titre
        ),
        salles (
          nom
        ),
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

  conflitHoraire(salleId, date, heure) {
    return this.supabase
      .from("seances")
      .select("id")
      .eq("salle_id", salleId)
      .eq("date_seance", date)
      .eq("heure", heure)
      .limit(1);
  }

  conflitHoraireHorsSeance(salleId, date, heure, seanceId) {
    return this.supabase
      .from("seances")
      .select("id")
      .eq("salle_id", salleId)
      .eq("date_seance", date)
      .eq("heure", heure)
      .neq("id", seanceId)
      .limit(1);
  }

  creer(seance) {
    return this.supabase.from("seances").insert(seance).select().single();
  }

  supprimer(id) {
    return this.supabase.from("seances").delete().eq("id", id);
  }

  changerSalle(id, salleId) {
    return this.supabase.from("seances").update({ salle_id: salleId }).eq("id", id);
  }

  annuler(id) {
    return this.supabase
      .from("seances")
      .update({ statut: "annulee", date_annulation: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
  }

  modifier(parametres) {
    return this.supabase.rpc("modifier_seance", parametres);
  }

  seancesDeSalle(salleId) {
    return this.supabase.from("seances").select("id").eq("salle_id", salleId);
  }

  mettreAJourCapacite(id, capacite) {
    return this.supabase.from("seances").update({ capacite }).eq("id", id);
  }

  placesReservees(seanceId) {
    return this.supabase
      .from("places")
      .select("id")
      .eq("seance_id", seanceId)
      .eq("statut", "reservee");
  }

  placesReserveesDetail(seanceId) {
    return this.supabase
      .from("places")
      .select("rangee, numero")
      .eq("seance_id", seanceId)
      .eq("statut", "reservee");
  }

  supprimerPlacesDisponibles(seanceId) {
    return this.supabase
      .from("places")
      .delete()
      .eq("seance_id", seanceId)
      .eq("statut", "disponible");
  }

  insererPlaces(places) {
    return this.supabase.from("places").insert(places);
  }
}

module.exports = SeanceRepository;