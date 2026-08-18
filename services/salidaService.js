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
    order = [
      [Sequelize.literal('CASE WHEN "fecha_vencimiento" IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['fecha_vencimiento', 'ASC NULLS LAST'],
      ['fecha', 'ASC'],
    ];
  } else {
    order = [['fecha', 'ASC']];
  }

  const entradas = await Entrada.findAll({
    where,
    order,
  });
  return entradas;
};

/**
 * Descuenta una cantidad de entradas disponibles para un servicio_tienda, creando o actualizando registros en SalidaEntrada.
 * Si ya existe un registro intermedio para la misma combinación (id_salida, id_entrada), se suma la cantidad.
 * Si no existe, se crea uno nuevo.
 */
const descontarEntradas = async (id_salida, id_servicio_tienda, cantidadTotal, transaction) => {
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

  const entradas = await getEntradasDisponibles(id_servicio_tienda, isVencible);

  let cantidadPendiente = cantidadTotal;
  for (const entrada of entradas) {
    if (cantidadPendiente <= 0) break;
    const disponible = entrada.cantidad_restante;
    const cantidadAUsar = Math.min(disponible, cantidadPendiente);

    // 🔽 Buscar si ya existe un registro intermedio para esta salida y esta entrada
    const [registroExistente, creado] = await SalidaEntrada.findOrCreate({
      where: {
        id_salida,
        id_entrada: entrada.id_entrada,
      },
      defaults: {
        cantidad: 0,
      },
      transaction,
    });

    // Actualizar la cantidad (sumar la nueva cantidad)
    await registroExistente.update(
      { cantidad: registroExistente.cantidad + cantidadAUsar },
      { transaction }
    );

    // Restar de la entrada
    await entrada.update(
      { cantidad_restante: entrada.cantidad_restante - cantidadAUsar },
      { transaction }
    );

    cantidadPendiente -= cantidadAUsar;
  }

  if (cantidadPendiente > 0) {
    throwError("No hay suficiente cantidad en las entradas para cubrir la salida.", 400);
  }
};

/**
 * Devuelve una cantidad a las entradas (cuando la salida disminuye) en orden LIFO inverso.
 * Elimina o reduce los registros intermedios.
 */
const devolverEntradas = async (id_salida, cantidadADevolver, transaction) => {
  if (cantidadADevolver <= 0) return;

  // Obtener registros intermedios ordenados por ID descendente (último creado primero)
  const salidaEntradas = await SalidaEntrada.findAll({
    where: { id_salida },
    order: [['id_salida', 'DESC'], ['id_entrada', 'DESC']],
    transaction,
  });

  let cantidadPendiente = cantidadADevolver;
  for (const se of salidaEntradas) {
    if (cantidadPendiente <= 0) break;
    const cantidadActual = se.cantidad;
    const cantidadADevolverDeEste = Math.min(cantidadActual, cantidadPendiente);
    const entrada = await Entrada.findByPk(se.id_entrada, { transaction });
    if (entrada) {
      await entrada.update(
        { cantidad_restante: entrada.cantidad_restante + cantidadADevolverDeEste },
        { transaction }
      );
    }
    if (cantidadADevolverDeEste === cantidadActual) {
      await se.destroy({ transaction });
    } else {
      await se.update(
        { cantidad: cantidadActual - cantidadADevolverDeEste },
        { transaction }
      );
    }
    cantidadPendiente -= cantidadADevolverDeEste;
  }

  if (cantidadPendiente > 0) {
    throwError("No se pudo devolver toda la cantidad a las entradas. Inconsistencia en los registros intermedios.", 400);
  }
};

/**
 * Revertir completamente una salida: suma de vuelta a las entradas y elimina todos los registros intermedios.
 */
const revertirSalidaCompleta = async (id_salida, transaction) => {
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
    const st = await validateServicioTiendaProducto(id_servicio_tienda);
    const cantidadDisponible = parseFloat(st.cantidad || 0);
    if (cantidadDisponible < cantidad_total) {
      throwError(
        `No hay suficiente cantidad en la tienda "${st.tienda.nombre}" para el producto "${st.servicio.nombre}". Disponible: ${cantidadDisponible}, solicitado: ${cantidad_total}`,
        400
      );
    }

    const costo_cup = parseFloat(st.costo_cup || 0);
    const costo_usd = parseFloat(st.costo_usd || 0);

    const fechaRegistro = fecha ? new Date(fecha) : new Date();

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

    await descontarEntradas(nuevaSalida.id_salida, id_servicio_tienda, cantidad_total, transaction);

    await st.update(
      { cantidad: cantidadDisponible - cantidad_total },
      { transaction }
    );

    await nuevaSalida.update(
      { costo_cup, costo_usd },
      { transaction }
    );

    await transaction.commit();

    return await getSalidaWithRelations(nuevaSalida.id_salida);
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    // Transformar errores de Sequelize en mensajes legibles
    if (error.name === "SequelizeValidationError" || error.name === "SequelizeForeignKeyConstraintError") {
      const messages = error.errors ? error.errors.map(e => e.message) : [error.message];
      throwError("Error al crear la salida", 400, messages);
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
    const salidaActual = await Salida.findByPk(id, {
      include: [
        { model: ServicioTienda, as: "servicioTienda" },
      ],
      transaction,
    });
    if (!salidaActual) throwError("Salida no encontrada.", 404);

    const nuevoIdST = updateData.id_servicio_tienda !== undefined
      ? updateData.id_servicio_tienda
      : salidaActual.id_servicio_tienda;
    const nuevaCantidad = updateData.cantidad_total !== undefined
      ? updateData.cantidad_total
      : salidaActual.cantidad_total;
    const cantidadActual = salidaActual.cantidad_total;

    if (nuevaCantidad <= 0) {
      throwError("La cantidad total debe ser mayor que cero.", 400);
    }

    // Caso: cambio de servicio_tienda (revertir y re-aplicar)
    if (nuevoIdST !== salidaActual.id_servicio_tienda) {
      await revertirSalidaCompleta(id, transaction);

      const stActual = await ServicioTienda.findByPk(salidaActual.id_servicio_tienda, { transaction });
      if (stActual) {
        await stActual.update(
          { cantidad: parseFloat(stActual.cantidad || 0) + cantidadActual },
          { transaction }
        );
      }

      const newData = { ...salidaActual.get(), ...updateData };
      await salidaActual.update(newData, { transaction });

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
    }

    // Caso: mismo servicio_tienda, manejo incremental
    const delta = nuevaCantidad - cantidadActual;

    const otrosCampos = {};
    if (updateData.descripcion !== undefined) otrosCampos.descripcion = updateData.descripcion;
    if (updateData.tipo_salida !== undefined) otrosCampos.tipo_salida = updateData.tipo_salida;
    if (updateData.fecha !== undefined) otrosCampos.fecha = new Date(updateData.fecha);
    if (updateData.id_usuario !== undefined) {
      const usuario = await Usuario.findByPk(updateData.id_usuario);
      if (!usuario) throwError("El usuario especificado no existe.", 404);
      otrosCampos.id_usuario = updateData.id_usuario;
    }

    if (delta === 0 && Object.keys(otrosCampos).length === 0) {
      await transaction.commit();
      return await getSalidaWithRelations(id);
    }

    if (Object.keys(otrosCampos).length > 0) {
      await salidaActual.update(otrosCampos, { transaction });
    }

    if (delta !== 0) {
      const stActual = await ServicioTienda.findByPk(salidaActual.id_servicio_tienda, { transaction });
      if (!stActual) throwError("Servicio-tienda no encontrado.", 404);

      if (delta > 0) {
        const cantidadDisponibleActual = parseFloat(stActual.cantidad || 0);
        if (cantidadDisponibleActual < delta) {
          throwError(
            `No hay suficiente cantidad en la tienda "${stActual.tienda.nombre}" para aumentar la salida. Disponible: ${cantidadDisponibleActual}, se necesita: ${delta}`,
            400
          );
        }
        // 🔽 Aquí usamos descontarEntradas que ahora actualiza en lugar de crear duplicados
        await descontarEntradas(id, salidaActual.id_servicio_tienda, delta, transaction);
        await stActual.update(
          { cantidad: cantidadDisponibleActual - delta },
          { transaction }
        );
        await salidaActual.update(
          { cantidad_total: nuevaCantidad },
          { transaction }
        );
      } else {
        const cantidadADevolver = -delta;
        await devolverEntradas(id, cantidadADevolver, transaction);
        await stActual.update(
          { cantidad: parseFloat(stActual.cantidad || 0) + cantidadADevolver },
          { transaction }
        );
        await salidaActual.update(
          { cantidad_total: nuevaCantidad },
          { transaction }
        );
      }
    }

    await transaction.commit();
    return await getSalidaWithRelations(id);
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    // Transformar errores de Sequelize en mensajes legibles
    if (error.name === "SequelizeValidationError" || error.name === "SequelizeForeignKeyConstraintError") {
      const messages = error.errors ? error.errors.map(e => e.message) : [error.message];
      throwError("Error al actualizar la salida", 400, messages);
    }
    throw error;
  }
};

const deleteSalida = async (id) => {
  const transaction = await Salida.sequelize.transaction();

  try {
    const salida = await Salida.findByPk(id, { transaction });
    if (!salida) throwError("Salida no encontrada.", 404);

    await revertirSalidaCompleta(id, transaction);

    const st = await ServicioTienda.findByPk(salida.id_servicio_tienda, { transaction });
    if (st) {
      await st.update(
        { cantidad: parseFloat(st.cantidad || 0) + salida.cantidad_total },
        { transaction }
      );
    }

    await salida.destroy({ transaction });

    await transaction.commit();
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    if (error.name === "SequelizeValidationError" || error.name === "SequelizeForeignKeyConstraintError") {
      const messages = error.errors ? error.errors.map(e => e.message) : [error.message];
      throwError("Error al eliminar la salida", 400, messages);
    }
    throw error;
  }
};

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

  if (filters.id_tienda) {
    const servicioTiendaInclude = include.find(
      (item) => item.model === ServicioTienda && item.as === "servicioTienda"
    );
    if (servicioTiendaInclude) {
      servicioTiendaInclude.where = { id_tienda: filters.id_tienda };
    }
  }

  const { rows, count } = await Salida.findAndCountAll({
    where,
    include,
    order: [["fecha", "DESC"]],
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