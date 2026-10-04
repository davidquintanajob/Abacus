const { Movimiento } = require("../models/movimiento");
const { MovimientoLista } = require("../models/movimiento_lista");
const { MovimientoEntrada } = require("../models/movimiento_entrada");
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
 * Obtiene una lista de movimientos con todas las relaciones.
 */
const getMovimientoListaWithRelations = async (id) => {
  const lista = await MovimientoLista.findByPk(id, {
    include: [
      { model: Usuario, as: "usuario" },
      {
        model: Movimiento,
        as: "movimientos",
        include: [
          {
            model: ServicioTienda,
            as: "servicioTiendaOrigen",
            include: [
              { model: Tienda, as: "tienda" },
              { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
            ],
          },
          {
            model: ServicioTienda,
            as: "servicioTiendaDestino",
            include: [
              { model: Tienda, as: "tienda" },
              { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
            ],
          },
          {
            model: MovimientoEntrada,
            as: "movimientoEntradas",
            include: [{ model: Entrada, as: "entrada" }],
          },
        ],
      },
    ],
    order: [[{ model: Movimiento, as: "movimientos" }, "id_movimiento", "ASC"]],
  });
  if (!lista) throwError("Movimiento no encontrado.", 404);
  return lista;
};

/**
 * Valida que un servicio_tienda exista y sea producto.
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
    throwError(`El servicio-tienda con id ${id_servicio_tienda} no existe.`, 404);
  }
  if (!st.servicio || !st.servicio.producto) {
    throwError(`El servicio-tienda ${id_servicio_tienda} no está asociado a un producto.`, 400);
  }
  return st;
};

/**
 * Obtiene las entradas disponibles (cantidad_restante > 0) para un servicio_tienda.
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
  return await Entrada.findAll({ where, order });
};

/**
 * Descuenta la cantidad de un movimiento de las entradas disponibles del origen.
 */
const descontarEntradasParaMovimiento = async (id_movimiento, id_servicio_tienda_origen, cantidadTotal, transaction) => {
  const st = await ServicioTienda.findByPk(id_servicio_tienda_origen, {
    include: [
      {
        model: Servicio,
        as: "servicio",
        include: [{ model: Producto, as: "producto" }],
      },
    ],
    transaction,
  });
  if (!st) throwError("Servicio-tienda origen no encontrado", 404);
  const isVencible = st.servicio.producto.isVencible;

  const entradas = await getEntradasDisponibles(id_servicio_tienda_origen, isVencible);

  let cantidadPendiente = cantidadTotal;
  for (const entrada of entradas) {
    if (cantidadPendiente <= 0) break;
    const disponible = entrada.cantidad_restante;
    const cantidadAUsar = Math.min(disponible, cantidadPendiente);

    await entrada.update(
      { cantidad_restante: entrada.cantidad_restante - cantidadAUsar },
      { transaction }
    );
    await MovimientoEntrada.create(
      {
        id_movimiento,
        id_entrada: entrada.id_entrada,
        cantidad: cantidadAUsar,
      },
      { transaction }
    );
    cantidadPendiente -= cantidadAUsar;
  }

  if (cantidadPendiente > 0) {
    throwError("No hay suficiente cantidad en las entradas para cubrir el movimiento.", 400);
  }
};

/**
 * Revierte las entradas de un movimiento (suma cantidad_restante de vuelta).
 */
const revertirMovimientoEntradas = async (id_movimiento, transaction) => {
  const movimientoEntradas = await MovimientoEntrada.findAll({
    where: { id_movimiento },
    transaction,
  });

  for (const me of movimientoEntradas) {
    const entrada = await Entrada.findByPk(me.id_entrada, { transaction });
    if (entrada) {
      await entrada.update(
        { cantidad_restante: entrada.cantidad_restante + me.cantidad },
        { transaction }
      );
    }
    await me.destroy({ transaction });
  }
};

/**
 * Revierte todos los efectos de una lista de movimientos si su estado era true.
 * También elimina los movimientos (y sus movimientos_entradas por cascade).
 */
const revertirMovimientoCompleto = async (id_movimiento_lista, transaction) => {
  const lista = await MovimientoLista.findByPk(id_movimiento_lista, {
    include: [{ model: Movimiento, as: "movimientos" }],
    transaction,
  });
  if (!lista) return;

  if (lista.estado) {
    for (const mov of lista.movimientos) {
      // 1. Revertir entradas del origen
      await revertirMovimientoEntradas(mov.id_movimiento, transaction);

      // 2. Sumar de vuelta al origen
      const stOrigen = await ServicioTienda.findByPk(mov.id_servicio_tienda_origen, { transaction });
      if (stOrigen) {
        await stOrigen.update(
          { cantidad: parseFloat(stOrigen.cantidad || 0) + mov.cantidad },
          { transaction }
        );
      }

      // 3. Restar del destino (validar stock suficiente)
      const stDestino = await ServicioTienda.findByPk(mov.id_servicio_tienda_destino, {
        include: [{ model: Tienda, as: "tienda" }],
        transaction,
      });
      if (stDestino) {
        const cantDestino = parseFloat(stDestino.cantidad || 0);
        if (cantDestino < mov.cantidad) {
          throwError(
            `No hay suficiente cantidad en el destino (tienda "${stDestino.tienda?.nombre || stDestino.id_tienda}") para revertir el movimiento. Disponible: ${cantDestino}, se necesita: ${mov.cantidad}`,
            400
          );
        }
        await stDestino.update(
          { cantidad: cantDestino - mov.cantidad },
          { transaction }
        );
      }
    }
  }

  // Eliminar movimientos (movimiento_entrada se elimina por cascade)
  await Movimiento.destroy({ where: { id_movimiento_lista }, transaction });
};

/**
 * Pre-valida un arreglo de items de movimiento.
 */
const preValidarMovimientos = async (movimientos, estado) => {
  if (!Array.isArray(movimientos) || movimientos.length === 0) {
    throwError("La lista de movimientos no puede estar vacía.", 400);
  }

  for (let i = 0; i < movimientos.length; i++) {
    const item = movimientos[i];
    const idx = i + 1;

    if (!item.id_servicio_tienda_origen) {
      throwError(`Movimiento ${idx}: id_servicio_tienda_origen es obligatorio.`, 400);
    }
    if (!item.id_servicio_tienda_destino) {
      throwError(`Movimiento ${idx}: id_servicio_tienda_destino es obligatorio.`, 400);
    }
    if (item.cantidad === undefined || item.cantidad === null || isNaN(item.cantidad) || item.cantidad <= 0) {
      throwError(`Movimiento ${idx}: cantidad debe ser un número mayor que cero.`, 400);
    }
    if (item.id_servicio_tienda_origen === item.id_servicio_tienda_destino) {
      throwError(`Movimiento ${idx}: el origen y el destino no pueden ser el mismo.`, 400);
    }

    const stOrigen = await validateServicioTiendaProducto(item.id_servicio_tienda_origen);
    const stDestino = await validateServicioTiendaProducto(item.id_servicio_tienda_destino);

    if (stOrigen.id_servicio !== stDestino.id_servicio) {
      throwError(
        `Movimiento ${idx}: el producto del origen (servicio ${stOrigen.id_servicio}) debe ser el mismo que el del destino (servicio ${stDestino.id_servicio}).`,
        400
      );
    }

    if (estado) {
      const stockOrigen = parseFloat(stOrigen.cantidad || 0);
      if (stockOrigen < item.cantidad) {
        throwError(
          `Movimiento ${idx}: stock insuficiente en la tienda origen "${stOrigen.tienda.nombre}" para el producto "${stOrigen.servicio.nombre}". Disponible: ${stockOrigen}, solicitado: ${item.cantidad}`,
          400
        );
      }
    }
  }
};

/**
 * Crea los movimientos para una lista y aplica los cambios si estado es true.
 */
const _crearMovimientosParaLista = async (id_movimiento_lista, movimientos, estado, transaction) => {
  for (const item of movimientos) {
    const movimiento = await Movimiento.create(
      {
        cantidad: item.cantidad,
        nota: item.nota || null,
        id_servicio_tienda_origen: item.id_servicio_tienda_origen,
        id_servicio_tienda_destino: item.id_servicio_tienda_destino,
        id_movimiento_lista,
      },
      { transaction }
    );

    if (estado) {
      // 1. Descontar entradas del origen
      await descontarEntradasParaMovimiento(
        movimiento.id_movimiento,
        item.id_servicio_tienda_origen,
        item.cantidad,
        transaction
      );

      // 2. Restar del stock del origen
      const stOrigen = await ServicioTienda.findByPk(item.id_servicio_tienda_origen, { transaction });
      await stOrigen.update(
        { cantidad: parseFloat(stOrigen.cantidad || 0) - item.cantidad },
        { transaction }
      );

      // 3. Sumar al stock del destino
      const stDestino = await ServicioTienda.findByPk(item.id_servicio_tienda_destino, { transaction });
      await stDestino.update(
        { cantidad: parseFloat(stDestino.cantidad || 0) + item.cantidad },
        { transaction }
      );
    }
  }
};

// ===== FUNCIONES PRINCIPALES =====

const getMovimientoById = async (id) => {
  return await getMovimientoListaWithRelations(id);
};

const createMovimiento = async (data) => {
  const { id_usuario, fecha_hora, tipo_movimiento, estado, nota, movimientos } = data;

  // Validar usuario
  const usuario = await Usuario.findByPk(id_usuario);
  if (!usuario) throwError("Usuario no encontrado.", 404);

  // Pre-validar todos los movimientos
  await preValidarMovimientos(movimientos, estado);

  const transaction = await MovimientoLista.sequelize.transaction();

  try {
    // Crear la lista
    const nuevaLista = await MovimientoLista.create(
      {
        id_usuario,
        fecha_hora,
        tipo_movimiento,
        estado,
        nota,
      },
      { transaction }
    );

    // Crear movimientos y aplicar lógica
    await _crearMovimientosParaLista(nuevaLista.id_movimiento_lista, movimientos, estado, transaction);

    await transaction.commit();
    return await getMovimientoListaWithRelations(nuevaLista.id_movimiento_lista);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const updateMovimiento = async (id, data) => {
  const { id_usuario, fecha_hora, tipo_movimiento, estado, nota, movimientos } = data;

  // Validar usuario
  const usuario = await Usuario.findByPk(id_usuario);
  if (!usuario) throwError("Usuario no encontrado.", 404);

  // Pre-validar todos los movimientos
  await preValidarMovimientos(movimientos, estado);

  const transaction = await MovimientoLista.sequelize.transaction();

  try {
    // Verificar que la lista existe
    const listaExistente = await MovimientoLista.findByPk(id, { transaction });
    if (!listaExistente) throwError("Movimiento no encontrado.", 404);

    // 1. Revertir todos los efectos anteriores (si estado era true) y eliminar movimientos
    await revertirMovimientoCompleto(id, transaction);

    // 2. Actualizar datos de la lista
    await listaExistente.update(
      {
        id_usuario,
        fecha_hora,
        tipo_movimiento,
        estado,
        nota,
      },
      { transaction }
    );

    // 3. Volver a crear los movimientos con los nuevos datos
    await _crearMovimientosParaLista(id, movimientos, estado, transaction);

    await transaction.commit();
    return await getMovimientoListaWithRelations(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const deleteMovimiento = async (id) => {
  const transaction = await MovimientoLista.sequelize.transaction();

  try {
    const lista = await MovimientoLista.findByPk(id, { transaction });
    if (!lista) throwError("Movimiento no encontrado.", 404);

    // Revertir todos los efectos y eliminar los movimientos
    await revertirMovimientoCompleto(id, transaction);

    // Eliminar la lista
    await lista.destroy({ transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const filterMovimientos = async (filters, limit, offset) => {
  const where = {};

  if (filters.id_usuario) where.id_usuario = filters.id_usuario;
  if (filters.tipo_movimiento) where.tipo_movimiento = { [Op.iLike]: `%${filters.tipo_movimiento}%` };
  if (filters.estado !== undefined) where.estado = filters.estado;

  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha_hora = {};
    if (filters.fecha_desde) where.fecha_hora[Op.gte] = filters.fecha_desde;
    if (filters.fecha_hasta) {
      const end = new Date(filters.fecha_hasta);
      end.setDate(end.getDate() + 1);
      where.fecha_hora[Op.lt] = end;
    }
  }

  const movimientoWhere = {};
  if (filters.id_servicio_tienda_origen && filters.id_servicio_tienda_destino) {
    movimientoWhere[Op.or] = [
      { id_servicio_tienda_origen: filters.id_servicio_tienda_origen },
      { id_servicio_tienda_destino: filters.id_servicio_tienda_destino },
    ];
  } else if (filters.id_servicio_tienda_origen) {
    movimientoWhere.id_servicio_tienda_origen = filters.id_servicio_tienda_origen;
  } else if (filters.id_servicio_tienda_destino) {
    movimientoWhere.id_servicio_tienda_destino = filters.id_servicio_tienda_destino;
  }

  const include = [
    { model: Usuario, as: "usuario" },
    {
      model: Movimiento,
      as: "movimientos",
      include: [
        {
          model: ServicioTienda,
          as: "servicioTiendaOrigen",
          include: [
            { model: Tienda, as: "tienda" },
            { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
          ],
        },
        {
          model: ServicioTienda,
          as: "servicioTiendaDestino",
          include: [
            { model: Tienda, as: "tienda" },
            { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
          ],
        },
        {
          model: MovimientoEntrada,
          as: "movimientoEntradas",
          include: [{ model: Entrada, as: "entrada" }],
        },
      ],
    },
  ];

  if (Object.keys(movimientoWhere).length > 0) {
    include[1].required = true;
    include[1].where = movimientoWhere;
  }

  const { rows, count } = await MovimientoLista.findAndCountAll({
    where,
    include,
    order: [["fecha_hora", "DESC"]],
    limit,
    offset,
    distinct: true,
  });

  return { rows, count };
};

module.exports = {
  getMovimientoById,
  filterMovimientos,
  createMovimiento,
  updateMovimiento,
  deleteMovimiento,
};