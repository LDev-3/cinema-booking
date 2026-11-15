
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testerConnexion() {
  const { data, error } = await supabase
    .from("films")
    .select("id, titre");

  if (error) {
    console.error("Erreur Supabase :", error.message);
  } else {
    console.log("Connexion à Supabase réussie !");
    console.log("Films trouvés :", data);
  }
}

testerConnexion();

module.exports = supabase;
