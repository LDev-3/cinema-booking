class ErreurHttp extends Error {
  constructor(statut, message) {
    super(message);
    this.name = "ErreurHttp";
    this.statut = statut;
  }
}

module.exports = ErreurHttp;