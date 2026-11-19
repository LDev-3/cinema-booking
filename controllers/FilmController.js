class FilmController {
  constructor(filmService) {
    this.filmService = filmService;
  }

  lister = async (req, res) => {
    try {
      const { data, error } = await this.filmService.lister();

      if (error) {
        console.error("Erreur Supabase :", error.message);
        return res.status(500).json({
          message: "Erreur lors de la récupération des films"
        });
      }

      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({
        message: "Erreur serveur",
        error: error.message
      });
    }
  };

  rechercher = async (req, res) => {
    const recherche = req.query.titre;

    if (!recherche) {
      return res.status(400).json({ message: "Veuillez saisir un titre de film" });
    }

    const { data, error } = await this.filmService.rechercher(recherche);

    if (error) {
      console.error("Erreur Supabase :", error.message);
      return res.status(500).json({
        message: "Erreur lors de la recherche des films"
      });
    }

    return res.status(200).json(data);
  };

  detail = async (req, res) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ message: "Identifiant du film invalide" });
    }

    const { film, error } = await this.filmService.detail(id);

    if (error && error.code !== "PGRST116") {
      console.error("Erreur Supabase :", error.message);
      return res.status(500).json({
        message: "Erreur lors de la récupération du film"
      });
    }

    if (!film) {
      return res.status(404).json({ message: "Film introuvable" });
    }

    return res.json(film);
  };

  creer = async (req, res) => {
    const erreurValidation = this.filmService.validerNouveauFilm(req.body);

    if (erreurValidation) {
      return res.status(400).json({ message: erreurValidation });
    }

    const { data: film, error } = await this.filmService.creer(req.body);

    if (error) {
      console.error("Erreur Supabase :", error.message);
      return res.status(500).json({ message: "Erreur lors de l'ajout du film" });
    }

    return res.status(201).json({
      message: "Film ajouté avec succès",
      film: { ...film, seances: [] }
    });
  };

  supprimer = async (req, res) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ message: "Identifiant du film invalide" });
    }

    const { data: filmSupprime, error } = await this.filmService.supprimer(id);

    if (error) {
      console.error("Erreur Supabase :", error.message);
      return res.status(500).json({
        message: "Erreur lors de la suppression du film"
      });
    }

    if (!filmSupprime) {
      return res.status(404).json({ message: "Film introuvable" });
    }

    return res.status(200).json({
      message: "Film supprimé avec succès",
      film: filmSupprime
    });
  };

  desactiver = async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const resultat = await this.filmService.desactiver(id);

      if (resultat.code === "introuvable") {
        return res.status(404).json({ message: "Film introuvable" });
      }

      if (resultat.code === "deja_desactive") {
        return res.status(400).json({ message: "Ce film est déjà désactivé" });
      }

      return res.status(200).json({
        message: "Film désactivé avec succès",
        film: resultat.film
      });
    } catch (error) {
      console.error("Erreur désactivation film :", error);
      return res.status(500).json({
        message: "Erreur lors de la désactivation du film"
      });
    }
  };

  listerSeances = async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const resultat = await this.filmService.listerSeances(id);

      if (resultat.code === "introuvable") {
        return res.status(404).json({ message: "Film introuvable" });
      }

      return res.status(200).json(resultat.seances);
    } catch (error) {
      console.error("Erreur récupération séances :", error);
      return res.status(500).json({
        message: "Erreur lors de la récupération des séances"
      });
    }
  };
}

module.exports = FilmController;