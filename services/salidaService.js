const { Salida } = require("../models/salida");
const { SalidaEntrada } = require("../models/salida_entrada");
const { Entrada } = require("../models/entrada");
const { ServicioTienda } = require("../models/servicio_tienda");
const { Servicio } = require("../models/servicio");
const { Producto } = require("../models/producto");
const { Usuario } = require("../models/usuario");
const { Tienda } = require("../models/tienda");
const { Op, Sequelize } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

// ===== FUNCIONES AUXILIARES =====

/**
 * Valida que el servicio_tienda corresponda a un producto y devuelve el registro completo con relaciones.
 */
const validateServicioTiendaProducto = async (id_servicio_tienda) => {
  const st = await ServicioTienda.findByPk(id_servicio_tienda, {
    include: [
      {
        model: Servicio,
        as: "servicio",
        include: [{ model: Producto, as: "producto" }],
      },
      { model: Tienda, as: "tienda" },
    ],
  });
  if (!st) {
    throwError("El registro de servicio-tienda no existe.", 404);
  }
  if (!st.servicio || !st.servicio.producto) {
    throwError("El servicio seleccionado no es un producto. Solo se permiten salidas de productos.", 400);
  }
  return st;
};

/**
 * Obtiene las entradas disponibles con cantidad_restante > 0 para un servicio_tienda dado,
 * ordenadas según la política de despacho:
 * - Si el producto es vencible (isVencible = true):
 *   1. Primero las entradas con fecha_vencimiento más cercana (ASC).
 *   2. Luego, si hay empate o fechas nulas, las más antiguas por fecha de creación (ASC).
 * - Si el producto no es vencible:
 *   Solo se ordenan por fecha de creación ASC (más antiguas primero).
 */
const getEntradasDisponibles = async (id_servicio_tienda, isVencible) => {
  const where = {
    id_servicio_tienda,
    cantidad_restante: { [Op.gt]: 0 },
  };
  let order = [];
  if (isVencible) {
    // 1. NULL al final, luego fecha_vencimiento ASC (más cercana primero)
    // 2. Luego fecha ASC (más vieja primero)
    order = [
      [Sequelize.literal('CASE WHEN "fecha_vencimiento" IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['fecha_vencimiento', 'ASC NULLS LAST'],
      ['fecha', 'ASC'],
    ];
  } else {
    // Solo fecha ASC (más vieja primero)
    order = [['fecha', 'ASC']];
  }

  const entradas = await Entrada.findAll({
    where,
    order,
  });
  return entradas;
};

/**
 * Descuenta la cantidad total de la salida de las entradas disponibles,
 * creando registros en la tabla intermedia SalidaEntrada.
 * Se asume que la cantidad total es válida y hay stock suficiente.
 */
const descontarEntradas = async (id_salida, id_servicio_tienda, cantidadTotal, transaction) => {
  // Obtener información del producto para saber si es vencible
  const st = await ServicioTienda.findByPk(id_servicio_tienda, {
    include: [
      {
        model: Servicio,
        as: "servicio",
        include: [{ model: Producto, as: "producto" }],
      },
    ],
    transaction,
  });
  if (!st) throwError("Servicio-tienda no encontrado", 404);
  const isVencible = st.servicio.producto.isVencible;

  // Obtener entradas en el orden definido por la política
  const entradas = await getEntradasDisponibles(id_servicio_tienda, isVencible);

  let cantidadPendiente = cantidadTotal;
  for (const entrada of entradas) {
    if (cantidadPendiente <= 0) break;
    const disponible = entrada.cantidad_restante;
    const cantidadAUsar = Math.min(disponible, cantidadPendiente);
    // Restar de la entrada
    await entrada.update(
      { cantidad_restante: entrada.cantidad_restante - cantidadAUsar },
      { transaction }
    );
    // Crear registro intermedio
    await SalidaEntrada.create(
      {
        id_salida,
        id_entrada: entrada.id_entrada,
        cantidad: cantidadAUsar,
      },
      { transaction }
    );
    cantidadPendiente -= cantidadAUsar;
  }

  if (cantidadPendiente > 0) {
    throwError("No hay suficiente cantidad en las entradas para cubrir la salida.", 400);
  }
};

/**
 * Revertir una salida: suma de vuelta a las entradas y elimina los registros intermedios.
 */
const revertirSalida = async (id_salida, transaction) => {
  const salidaEntradas = await SalidaEntrada.findAll({
    where: { id_salida },
    transaction,
  });

  for (const se of salidaEntradas) {
    const entrada = await Entrada.findByPk(se.id_entrada, { transaction });
    if (entrada) {
      await entrada.update(
        { cantidad_restante: entrada.cantidad_restante + se.cantidad },
        { transaction }
      );
    }
    await se.destroy({ transaction });
  }
};

/**
 * Obtiene una salida con todas sus relaciones (usuario, servicio_tienda, entradas).
 */
const getSalidaWithRelations = async (id) => {
  const salida = await Salida.findByPk(id, {
    include: [
      { model: Usuario, as: "usuario" },
      {
        model: ServicioTienda,
        as: "servicioTienda",
        include: [
          { model: Tienda, as: "tienda" },
          { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
        ],
      },
      {
        model: SalidaEntrada,
        as: "salidaEntradas",
        include: [{ model: Entrada, as: "entrada" }],
      },
    ],
  });
  if (!salida) throwError("Salida no encontrada.", 404);
  return salida;
};

// ===== FUNCIONES PRINCIPALES =====

const createSalida = async (salidaData) => {
  const { id_servicio_tienda, cantidad_total, descripcion, tipo_salida, fecha, id_usuario } = salidaData;

  if (!id_usuario) throwError("El ID de usuario es requerido.", 400);
  const usuario = await Usuario.findByPk(id_usuario);
  if (!usuario) throwError("El usuario especificado no existe.", 404);

  const transaction = await Salida.sequelize.transaction();

  try {
    // Validar que el servicio_tienda sea producto y obtener datos
    const st = await validateServicioTiendaProducto(id_servicio_tienda);
    const cantidadDisponible = parseFloat(st.cantidad || 0);
    if (cantidadDisponible < cantidad_total) {
      throwError(
        `No hay suficiente cantidad en la tienda "${st.tienda.nombre}" para el producto "${st.servicio.nombre}". Disponible: ${cantidadDisponible}, solicitado: ${cantidad_total}`,
        400
      );
    }

    // Tomar costos del servicio_tienda
    const costo_cup = parseFloat(st.costo_cup || 0);
    const costo_usd = parseFloat(st.costo_usd || 0);

    const fechaRegistro = fecha ? new Date(fecha) : new Date();

    // 1. Crear la salida con costos temporales (0)
    const nuevaSalida = await Salida.create(
      {
        id_usuario,
        id_servicio_tienda,
        fecha: fechaRegistro,
        descripcion,
        tipo_salida,
        cantidad_total,
        costo_cup: 0,
        costo_usd: 0,
      },
      { transaction }
    );

    // 2. Descontar de entradas (crea registros intermedios)
    await descontarEntradas(nuevaSalida.id_salida, id_servicio_tienda, cantidad_total, transaction);

    // 3. Restar de servicio_tienda.cantidad
    await st.update(
      { cantidad: cantidadDisponible - cantidad_total },
      { transaction }
    );

    // 4. Actualizar la salida con los costos reales
    await nuevaSalida.update(
      { costo_cup, costo_usd },
      { transaction }
    );

    await transaction.commit();

    // Obtener la salida con relaciones (fuera de la transacción)
    return await getSalidaWithRelations(nuevaSalida.id_salida);
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

const getSalidaById = async (id) => {
  return await getSalidaWithRelations(id);
};

const updateSalida = async (id, updateData) => {
  const transaction = await Salida.sequelize.transaction();

  try {
    const salidaActual = await Salida.findByPk(id, { transaction });
    if (!salidaActual) throwError("Salida no encontrada.", 404);

    // Construir objeto con datos actualizados
    const newData = { ...salidaActual.get() };
    let cambios = false;

    if (updateData.id_servicio_tienda !== undefined && updateData.id_servicio_tienda !== salidaActual.id_servicio_tienda) {
      newData.id_servicio_tienda = updateData.id_servicio_tienda;
      cambios = true;
    }
    if (updateData.cantidad_total !== undefined && updateData.cantidad_total !== salidaActual.cantidad_total) {
      newData.cantidad_total = updateData.cantidad_total;
      cambios = true;
    }
    if (updateData.descripcion !== undefined && updateData.descripcion !== salidaActual.descripcion) {
      newData.descripcion = updateData.descripcion;
      cambios = true;
    }
    if (updateData.tipo_salida !== undefined && updateData.tipo_salida !== salidaActual.tipo_salida) {
      newData.tipo_salida = updateData.tipo_salida;
      cambios = true;
    }
    if (updateData.fecha !== undefined) {
      const newFecha = new Date(updateData.fecha);
      if (isNaN(newFecha.getTime())) throwError("Fecha inválida", 400);
      if (newFecha.getTime() !== salidaActual.fecha.getTime()) {
        newData.fecha = newFecha;
        cambios = true;
      }
    }
    if (updateData.id_usuario !== undefined && updateData.id_usuario !== salidaActual.id_usuario) {
      const usuario = await Usuario.findByPk(updateData.id_usuario);
      if (!usuario) throwError("El usuario especificado no existe.", 404);
      newData.id_usuario = updateData.id_usuario;
      cambios = true;
    }

    if (!cambios) {
      await transaction.commit();
      return await getSalidaWithRelations(id);
    }

    // --- Revertir salida actual (deshacer los efectos en entradas y stock) ---
    await revertirSalida(id, transaction);

    const stActual = await ServicioTienda.findByPk(salidaActual.id_servicio_tienda, { transaction });
    if (stActual) {
      await stActual.update(
        { cantidad: parseFloat(stActual.cantidad || 0) + salidaActual.cantidad_total },
        { transaction }
      );
    }

    // Actualizar los datos de la salida (sin costos aún)
    await salidaActual.update(newData, { transaction });

    // --- Aplicar la nueva lógica de creación con los datos actualizados ---
    const nuevoIdST = newData.id_servicio_tienda;
    const nuevaCantidad = newData.cantidad_total;

    const stNuevo = await validateServicioTiendaProducto(nuevoIdST);
    const cantidadDisponibleNueva = parseFloat(stNuevo.cantidad || 0);
    if (cantidadDisponibleNueva < nuevaCantidad) {
      throwError(
        `No hay suficiente cantidad en la tienda "${stNuevo.tienda.nombre}" para el producto "${stNuevo.servicio.nombre}". Disponible: ${cantidadDisponibleNueva}, solicitado: ${nuevaCantidad}`,
        400
      );
    }

    const nuevoCosto_cup = parseFloat(stNuevo.costo_cup || 0);
    const nuevoCosto_usd = parseFloat(stNuevo.costo_usd || 0);

    await descontarEntradas(id, nuevoIdST, nuevaCantidad, transaction);

    await stNuevo.update(
      { cantidad: cantidadDisponibleNueva - nuevaCantidad },
      { transaction }
    );

    await salidaActual.update(
      { costo_cup: nuevoCosto_cup, costo_usd: nuevoCosto_usd },
      { transaction }
    );

    await transaction.commit();

    return await getSalidaWithRelations(id);
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

const deleteSalida = async (id) => {
  const transaction = await Salida.sequelize.transaction();

  try {
    const salida = await Salida.findByPk(id, { transaction });
    if (!salida) throwError("Salida no encontrada.", 404);

    // Revertir efectos en entradas y eliminar registros intermedios
    await revertirSalida(id, transaction);

    // Devolver cantidad al servicio_tienda
    const st = await ServicioTienda.findByPk(salida.id_servicio_tienda, { transaction });
    if (st) {
      await st.update(
        { cantidad: parseFloat(st.cantidad || 0) + salida.cantidad_total },
        { transaction }
      );
    }

    // Eliminar la salida
    await salida.destroy({ transaction });

    await transaction.commit();
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
};

/**
 * Filtra salidas con paginación.
 * - Los resultados se ordenan por fecha DESC (más recientes primero).
 * - Incluye todas las relaciones necesarias.
 */
const filterSalidas = async (filters, limit, offset) => {
  const where = {};

  if (filters.id_servicio_tienda) where.id_servicio_tienda = filters.id_servicio_tienda;
  if (filters.id_usuario) where.id_usuario = filters.id_usuario;
  if (filters.tipo_salida) where.tipo_salida = { [Op.iLike]: `%${filters.tipo_salida}%` };
  if (filters.descripcion) where.descripcion = { [Op.iLike]: `%${filters.descripcion}%` };

  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha = {};
    if (filters.fecha_desde) where.fecha[Op.gte] = filters.fecha_desde;
    if (filters.fecha_hasta) {
      const end = new Date(filters.fecha_hasta);
      end.setDate(end.getDate() + 1);
      where.fecha[Op.lt] = end;
    }
  }

  const include = [
    { model: Usuario, as: "usuario" },
    {
      model: ServicioTienda,
      as: "servicioTienda",
      include: [
        { model: Tienda, as: "tienda" },
        { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
      ],
    },
    {
      model: SalidaEntrada,
      as: "salidaEntradas",
      include: [{ model: Entrada, as: "entrada" }],
    },
  ];

  const { rows, count } = await Salida.findAndCountAll({
    where,
    include,
    order: [["fecha", "DESC"]], // ✅ Las salidas más recientes primero
    limit,
    offset,
    distinct: true,
  });

  return { rows, count };
};

module.exports = {
  createSalida,
  getSalidaById,
  updateSalida,
  deleteSalida,
  filterSalidas,
};