class FilmService {
  constructor(filmRepository) {
    this.filmRepository = filmRepository;
  }

  lister() {
    return this.filmRepository.lister();
  }

  rechercher(titre) {
    return this.filmRepository.rechercherParTitre(titre);
  }

  // Retourne un message d'erreur, ou null si le film est valide
  validerNouveauFilm({ titre, description, duree, genre } = {}) {
    if (
      !titre || typeof titre !== "string" || !titre.trim() ||
      !description || typeof description !== "string" || !description.trim() ||
      !duree ||
      !genre || typeof genre !== "string" || !genre.trim()
    ) {
      return "Tous les champs sont obligatoires";
    }

    if (typeof duree !== "number" || !Number.isInteger(duree) || duree <= 0) {
      return "La durée doit être un nombre entier positif";
    }

    return null;
  }

  creer({ titre, description, duree, genre }) {
    return this.filmRepository.creer({
      titre: titre.trim(),
      description: description.trim(),
      duree,
      genre: genre.trim(),
      actif: true
    });
  }

  formaterFilm(film) {
    return {
      ...film,
      seances: (film.seances || []).map((seance) => ({
        id: seance.id,
        date: seance.date_seance,
        heure: seance.heure,
        salle: seance.salles?.nom,
        capacite: seance.capacite,
        places: seance.places || []
      }))
    };
  }

  async detail(id) {
    const { data, error } = await this.filmRepository.trouverAvecSeances(id);

    if (error || !data) {
      return { film: null, error };
    }

    return { film: this.formaterFilm(data), error: null };
  }

  supprimer(id) {
    return this.filmRepository.supprimer(id);
  }

  async desactiver(id) {
    const { data: film, error } = await this.filmRepository.trouverParId(id);

    if (error || !film) {
      return { code: "introuvable" };
    }

    if (!film.actif) {
      return { code: "deja_desactive" };
    }

    const { data, error: erreurMiseAJour } = await this.filmRepository.desactiver(id);

    if (erreurMiseAJour) {
      throw erreurMiseAJour;
    }

    return { code: "ok", film: data };
  }

  async listerSeances(id) {
    const { data: film, error } = await this.filmRepository.existe(id);

    if (error || !film) {
      return { code: "introuvable" };
    }

    const { data, error: erreurSeances } = await this.filmRepository.listerSeances(id);

    if (erreurSeances) {
      throw erreurSeances;
    }

    return { code: "ok", seances: data };
  }
}

module.exports = FilmService;