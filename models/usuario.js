const { DataTypes } = require("sequelize");
const sequelize = require("../helpers/database.js");

const roles = ["Administrador", "Médico", "Técnico", "Estilista"];

const Usuario = sequelize.define("usuario", {
  id_usuario: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre_natural: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  telefono: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  direccion: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  nombre_usuario: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  contrasenna: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  salario_diario: {
    type: DataTypes.DOUBLE,
    allowNull: false,
    defaultValue: 0.00,
  },
  rol: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: {
        args: [roles],
        msg: "El rol especificado no es válido",
      },
    },
  },
  activo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  timestamps: true,
});

module.exports = { Usuario, roles };
