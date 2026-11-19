const QRCode = require("qrcode");
const ErreurHttp = require("../utils/ErreurHttp");

const BILLET_EXISTANT = "Un billet existe déjà pour cette réservation";
const BILLET_INTROUVABLE = "Billet introuvable";
const BILLET_UTILISE = "Ce billet a déjà été utilisé";

class BilletService {
  constructor(billetRepository, reservationRepository) {
    this.billetRepository = billetRepository;
    this.reservationRepository = reservationRepository;
  }

  async generer(reservationId) {
    if (!Number.isInteger(reservationId) || reservationId <= 0) {
      throw new ErreurHttp(400, "Identifiant de réservation invalide");
    }

    const { data: reservation, error: erreurReservation } =
      await this.reservationRepository.trouverParId(reservationId);

    if (erreurReservation) {
      throw erreurReservation;
    }

    if (!reservation) {
      throw new ErreurHttp(404, "Réservation introuvable");
    }

    const { data: billetExistant, error: erreurBillet } =
      await this.billetRepository.trouverParReservation(reservationId);

    if (erreurBillet) {
      throw erreurBillet;
    }

    if (billetExistant) {
      throw new ErreurHttp(409, BILLET_EXISTANT);
    }

    const { data: associations, error: erreurPlaces } =
      await this.reservationRepository.placesDeReservation(reservationId);

    if (erreurPlaces) {
      throw erreurPlaces;
    }

    const places = associations.map((association) => association.places);

    const { data: nouveauBillet, error: erreurCreation } = await this.billetRepository.creer({
      numero_billet: `BIL-${String(reservationId).padStart(6, "0")}`,
      reservation_id: reservationId,
      statut: "valide"
    });

    if (erreurCreation) {
      if (erreurCreation.code === "23505") {
        throw new ErreurHttp(409, BILLET_EXISTANT);
      }
      throw erreurCreation;
    }

    return {
      id: nouveauBillet.id,
      numeroBillet: nouveauBillet.numero_billet,
      reservationId: reservation.id,
      numeroReservation: reservation.numero_reservation,
      client: {
        nom: reservation.nom,
        prenom: reservation.prenom,
        email: reservation.email,
        telephone: reservation.telephone
      },
      seanceId: reservation.seance_id,
      places,
      dateGeneration: nouveauBillet.date_generation,
      statut: nouveauBillet.statut
    };
  }

  async genererQrCode(numero) {
    const { data: billet, error } = await this.billetRepository.trouverAvecReservation(numero);

    if (error) {
      throw error;
    }

    if (!billet) {
      throw new ErreurHttp(404, BILLET_INTROUVABLE);
    }

    const contenuQR = JSON.stringify({
      numeroBillet: billet.numero_billet,
      numeroReservation: billet.reservations.numero_reservation,
      reservationId: billet.reservation_id
    });

    return {
      numeroBillet: billet.numero_billet,
      qrCode: await QRCode.toDataURL(contenuQR)
    };
  }

  async valider(numero) {
    const { data: billet, error } = await this.billetRepository.trouverParNumero(numero);

    if (error) {
      throw error;
    }

    if (!billet) {
      throw new ErreurHttp(404, BILLET_INTROUVABLE);
    }

    if (billet.statut === "utilise") {
      throw new ErreurHttp(400, BILLET_UTILISE);
    }

    const { data: billetValide, error: erreurMiseAJour } =
      await this.billetRepository.marquerUtilise(billet.id);

    if (erreurMiseAJour) {
      throw erreurMiseAJour;
    }

    if (!billetValide) {
      throw new ErreurHttp(400, BILLET_UTILISE);
    }

    return {
      id: billetValide.id,
      numeroBillet: billetValide.numero_billet,
      reservationId: billetValide.reservation_id,
      statut: billetValide.statut,
      dateUtilisation: billetValide.date_utilisation
    };
  }
}

module.exports = BilletService;