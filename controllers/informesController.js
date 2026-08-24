const { Op } = require("sequelize");
const { ServicioTienda } = require("../models/servicio_tienda");
const { Servicio } = require("../models/servicio");
const { Producto } = require("../models/producto");
const { Tienda } = require("../models/tienda");
const { Venta } = require("../models/venta");
const { ListaVenta } = require("../models/lista_venta");
const { Operacion } = require("../models/operacion");
const { Cuenta } = require("../models/cuenta");
const { Usuario } = require("../models/usuario");

const handleError = (res, error) => {
  const status = error.status || 500;
  const message = error.message || "Error interno del servidor";
  res.status(status).json({ errors: [message] });
};

const getLocalDayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { [Op.gte]: start, [Op.lt]: end };
};

const getGeneralInformation = async (req, res) => {
  try {
    const fechaHoy = getLocalDayRange();

    const [cantidadProductos, ventasDelDia, ventasConIngreso, usuariosActivos] = await Promise.all([
      ServicioTienda.count({
        where: { cantidad: { [Op.gt]: 0 } },
        include: [
          {
            model: Servicio,
            as: "servicio",
            required: true,
            include: [{ model: Producto, as: "producto", required: true }],
          },
        ],
      }),
      Venta.findAll({
        include: [
          {
            model: ListaVenta,
            as: "listaVenta",
            required: true,
            where: { fecha_hora: fechaHoy },
          },
        ],
      }),
      Venta.findAll({
        include: [
          {
            model: ListaVenta,
            as: "listaVenta",
            required: true,
            where: { fecha_hora: fechaHoy },
            include: [
              {
                model: Operacion,
                as: "operaciones",
                required: true,
                where: { tipo_operacion: "Ingreso por Venta" },
                include: [
                  {
                    model: Cuenta,
                    as: "cuenta",
                    required: true,
                    where: {
                      tipo_cuenta: { [Op.in]: ["Efectivo CUP", "Transferencia CUP"] },
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
      Usuario.count({ where: { activo: true } }),
    ]);

    const ventasUnicasDelDia = [...new Map(ventasDelDia.map((venta) => [venta.id_venta, venta])).values()];
    const ventasUnicasConIngreso = [...new Map(ventasConIngreso.map((venta) => [venta.id_venta, venta])).values()];
    const totalVentasCUP = ventasUnicasDelDia.reduce(
      (total, venta) => total + parseFloat(venta.precio_cobrado_cup || 0),
      0
    );
    const totalVentasUSD = ventasUnicasDelDia.reduce(
      (total, venta) => total + parseFloat(venta.precio_cobrado_usd || 0),
      0
    );
    const gananciaCUP = ventasUnicasConIngreso.reduce(
      (total, venta) =>
        total + parseFloat(venta.precio_cobrado_cup || 0) - parseFloat(venta.costo_original_cup || 0),
      0
    );

    res.status(200).json({
      cantidad_productos: cantidadProductos,
      total_ventas_cup: totalVentasCUP,
      total_ventas_usd: totalVentasUSD,
      usuarios_activos: usuariosActivos,
      ganancia_cup: gananciaCUP,
    });
  } catch (error) {
    handleError(res, error);
  }
};

module.exports = { getGeneralInformation };