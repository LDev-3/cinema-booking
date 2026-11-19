-- ==========================================
-- Comptes de test de Cinema Booking
-- Les mots de passe sont stockés hachés (bcrypt).
-- ==========================================

INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role)
VALUES
  ('Admin', 'Cinema', 'jean.dupont.test@gmail.com', '$2b$10$dYY.OFGrRUZJau0Ffy1c5evOY9RxxepZ1.p89LmojAVE0nMjSEuuu', 'admin'),
  ('User', 'Test', 'paul.test@example.com', '$2b$10$9HI4BoNg2okCKaieEMdf/.kzeshEMk985hr3S8EEXPrODA0eYYIJu', 'utilisateur')
ON CONFLICT (email) DO NOTHING;