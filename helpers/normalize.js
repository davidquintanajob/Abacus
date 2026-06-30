const normalizeString = (str) => {
  return str
    .normalize("NFD") // Separa los caracteres y sus tildes
    .replace(/[\u0300-\u036f]/g, "") // Elimina las tildes
    .toLowerCase(); // Convierte a minúsculas
};

module.exports = { normalizeString };