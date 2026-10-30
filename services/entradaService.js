const { Entrada } = require("../models/entrada");
const { ServicioTienda } = require("../models/servicio_tienda");
const { Fabricacion } = require("../models/fabricacion");
const { FabricacionEntrada } = require("../models/fabricacion_entrada");
const { FabricacionMovimiento } = require("../models/fabricacion_movimiento");
const { Servicio } = require("../models/servicio");
const { Producto } = require("../models/producto");
const { Usuario } = require("../models/usuario");
const { Tienda } = require("../models/tienda");
const { Movimiento } = require("../models/movimiento");
const { MovimientoLista } = require("../models/movimiento_lista");
const { Op, Sequelize } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

const getEntradaIncludes = () => [
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
    model: Fabricacion,
    as: "fabricaciones",
    include: [
      {
        model: ServicioTienda,
        as: "servicioTienda",
        include: [
          { model: Tienda, as: "tienda" },
          { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
        ],
      },
      { model: FabricacionEntrada, as: "entradasInsumo", include: [{ model: Entrada, as: "entrada" }] },
      { model: FabricacionMovimiento, as: "movimientosInsumo", include: [{ model: Movimiento, as: "movimiento" }] },
    ],
  },
];

const aggregateFabricaciones = (fabricaciones) => {
  const cantidades = new Map();
  for (const fabricacion of fabricaciones) {
    const id = Number(fabricacion.id_servicio_tienda);
    cantidades.set(id, (cantidades.get(id) || 0) + Number(fabricacion.cantidad_insumo));
  }
  return cantidades;
};

const validateFabricacionesDisponibles = async (
  cantidadesFabricacion,
  servicioTiendasBloqueados,
  transaction,
  ajustesDisponibles = new Map()
) => {
  for (const [id, cantidadSolicitada] of cantidadesFabricacion) {
    const servicioTienda = servicioTiendasBloqueados.get(Number(id));
    const disponible = Number(servicioTienda.cantidad || 0) + Number(ajustesDisponibles.get(Number(id)) || 0);
    if (cantidadSolicitada > disponible) {
      const servicioTiendaConRelaciones = await ServicioTienda.findByPk(id, {
        transaction,
        include: [
          { model: Tienda, as: "tienda" },
          { model: Servicio, as: "servicio" },
        ],
      });
      if (!servicioTiendaConRelaciones?.servicio || !servicioTiendaConRelaciones?.tienda) {
        throwError("No se pudo identificar el servicio o la tienda para informar el inventario insuficiente.", 500);
      }

      throwError(
        `No hay suficiente inventario de "${servicioTiendaConRelaciones.servicio.nombre}" en la tienda "${servicioTiendaConRelaciones.tienda.nombre}". Cantidad disponible: ${disponible}; cantidad solicitada como insumo: ${cantidadSolicitada}.`,
        400
      );
    }
  }
};

const getEntradasInsumoDisponibles = async (idServicioTienda, isVencible, transaction, entradaExcluirId) => {
  const where = {
    id_servicio_tienda: idServicioTienda,
    cantidad_restante: { [Op.gt]: 0 },
  };
  if (entradaExcluirId) where.id_entrada = { [Op.ne]: entradaExcluirId };

  const order = isVencible
    ? [
      [Sequelize.literal('CASE WHEN "fecha_vencimiento" IS NULL THEN 1 ELSE 0 END'), "ASC"],
      ["fecha_vencimiento", "ASC NULLS LAST"],
      ["fecha", "ASC"],
    ]
    : [["fecha", "ASC"]];

  return Entrada.findAll({
    where,
    order,
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
};

const descontarInsumosFabricacion = async (fabricacion, servicioTienda, transaction, entradaExcluirId) => {
  const isVencible = servicioTienda.servicio.producto.isVencible;
  const entradas = await getEntradasInsumoDisponibles(
    fabricacion.id_servicio_tienda,
    isVencible,
    transaction,
    entradaExcluirId
  );
  let pendiente = Number(fabricacion.cantidad_insumo);

  for (const entrada of entradas) {
    if (pendiente <= 0) break;
    const disponible = Number(entrada.cantidad_restante);
    const cantidadUsada = Math.min(disponible, pendiente);
    await entrada.update({ cantidad_restante: disponible - cantidadUsada }, { transaction });
    await FabricacionEntrada.create({
      id_fabricacion: fabricacion.id_fabricacion,
      id_entrada: entrada.id_entrada,
      cantidad: cantidadUsada,
    }, { transaction });
    pendiente -= cantidadUsada;
  }

  if (pendiente > 0) {
    const movimientos = await Movimiento.findAll({
      where: {
        id_tienda_destino: servicioTienda.id_tienda,
        id_servicio: servicioTienda.id_servicio,
        cantidad_restante: { [Op.gt]: 0 },
      },
      include: [{
        model: MovimientoLista,
        as: "movimientoLista",
        required: true,
        where: { estado: true },
      }],
      order: [
        [{ model: MovimientoLista, as: "movimientoLista" }, "fecha_hora", "ASC"],
        ["id_movimiento", "ASC"],
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    for (const movimiento of movimientos) {
      if (pendiente <= 0) break;
      const disponible = Number(movimiento.cantidad_restante);
      const cantidadUsada = Math.min(disponible, pendiente);
      await movimiento.update({ cantidad_restante: disponible - cantidadUsada }, { transaction });
      await FabricacionMovimiento.create({
        id_fabricacion: fabricacion.id_fabricacion,
        id_movimiento: movimiento.id_movimiento,
        cantidad: cantidadUsada,
      }, { transaction });
      pendiente -= cantidadUsada;
    }
  }

  if (pendiente > 0) {
    throwError("No hay suficientes entradas y movimientos disponibles para cubrir los insumos de la fabricación.", 400);
  }
};

const revertirInsumosFabricacion = async (fabricaciones, transaction) => {
  const ids = fabricaciones.map((fabricacion) => fabricacion.id_fabricacion);
  if (ids.length === 0) return;

  const entradasFabricacion = await FabricacionEntrada.findAll({
    where: { id_fabricacion: { [Op.in]: ids } },
    transaction,
  });
  for (const asignacion of entradasFabricacion) {
    const entrada = await Entrada.findByPk(asignacion.id_entrada, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!entrada) {
      throwError(`No se encontró la entrada ${asignacion.id_entrada} para devolver el insumo de fabricación.`, 409);
    }
    await entrada.update({
      cantidad_restante: Number(entrada.cantidad_restante) + Number(asignacion.cantidad),
    }, { transaction });
  }

  const movimientosFabricacion = await FabricacionMovimiento.findAll({
    where: { id_fabricacion: { [Op.in]: ids } },
    transaction,
  });
  for (const asignacion of movimientosFabricacion) {
    const movimiento = await Movimiento.findByPk(asignacion.id_movimiento, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!movimiento) {
      throwError(`No se encontró el movimiento ${asignacion.id_movimiento} para devolver el insumo de fabricación.`, 409);
    }
    await movimiento.update({
      cantidad_restante: Number(movimiento.cantidad_restante) + Number(asignacion.cantidad),
    }, { transaction });
  }
};

const lockServicioTiendaRows = async (ids, transaction) => {
  const registros = new Map();
  const uniqueIds = [...new Set(ids.map(Number))].sort((a, b) => a - b);
  for (const id of uniqueIds) {
    const servicioTienda = await ServicioTienda.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!servicioTienda) {
      throwError("El registro de servicio-tienda no existe.", 404);
    }
    registros.set(id, servicioTienda);
  }
  return registros;
};

const prepareFabricaciones = async (
  fabricaciones,
  idServicioTiendaEntrada,
  transaction,
  { fabricacionesAnteriores = [], permitirVacio = false } = {}
) => {
  if (!Array.isArray(fabricaciones) || (!permitirVacio && fabricaciones.length === 0)) {
    throwError("La lista de fabricaciones debe ser un arreglo no vacío.", 400);
  }

  const normalizadas = fabricaciones.map((fabricacion, index) => {
    if (!fabricacion || typeof fabricacion !== "object" || Array.isArray(fabricacion)) {
      throwError(`La fabricación ${index + 1} no es válida.`, 400);
    }

    const idServicioTienda = Number(fabricacion.id_servicio_tienda);
    const cantidadInsumo = Number(fabricacion.cantidad_insumo);
    const costoInsumoCup = Number(fabricacion.costo_insumo_cup);
    const costoInsumoUsd = Number(fabricacion.costo_insumo_usd);

    if (!Number.isInteger(idServicioTienda) || idServicioTienda <= 0) {
      throwError(`El id_servicio_tienda de la fabricación ${index + 1} debe ser un entero positivo.`, 400);
    }
    if (!Number.isFinite(cantidadInsumo) || cantidadInsumo <= 0) {
      throwError(`La cantidad_insumo de la fabricación ${index + 1} debe ser mayor que cero.`, 400);
    }
    if (!Number.isFinite(costoInsumoCup) || costoInsumoCup < 0) {
      throwError(`El costo_insumo_cup de la fabricación ${index + 1} no puede ser negativo.`, 400);
    }
    if (!Number.isFinite(costoInsumoUsd) || costoInsumoUsd < 0) {
      throwError(`El costo_insumo_usd de la fabricación ${index + 1} no puede ser negativo.`, 400);
    }

    return {
      id_servicio_tienda: idServicioTienda,
      cantidad_insumo: cantidadInsumo,
      costo_insumo_cup: costoInsumoCup,
      costo_insumo_usd: costoInsumoUsd,
    };
  });

  const idsNuevos = normalizadas.map((fabricacion) => fabricacion.id_servicio_tienda);
  if (new Set(idsNuevos).size !== idsNuevos.length) {
    throwError("No se puede repetir el servicio-tienda dentro de la lista de fabricaciones.", 400);
  }

  const ids = [
    idServicioTiendaEntrada,
    ...normalizadas.map((fabricacion) => fabricacion.id_servicio_tienda),
    ...fabricacionesAnteriores.map((fabricacion) => fabricacion.id_servicio_tienda),
  ];
  const servicioTiendasBloqueados = await lockServicioTiendaRows(ids, transaction);

  for (const id of new Set(idsNuevos)) {
    await validateServicioTiendaProducto(id, transaction);
  }

  return { normalizadas, servicioTiendasBloqueados };
};

const applyInventoryDeltas = async (deltas, servicioTiendasBloqueados, transaction) => {
  for (const [id, delta] of deltas) {
    if (delta === 0) continue;
    const servicioTienda = servicioTiendasBloqueados.get(Number(id));
    if (!servicioTienda) {
      throwError("Servicio-tienda no encontrado.", 404);
    }
    const cantidadActual = Number(servicioTienda.cantidad || 0);
    const nuevaCantidad = cantidadActual + delta;
    if (nuevaCantidad < 0) {
      throwError("La operación dejaría la cantidad del producto en la tienda negativa. Verifique el inventario.", 400);
    }
    await servicioTienda.update({ cantidad: nuevaCantidad }, { transaction });
  }
};

// Generar código de lote único: sufijo + 5 dígitos aleatorios
const generateCodigoLote = async (sufijo) => {
  let codigo;
  let exists = true;
  let attempts = 0;
  const maxAttempts = 100;
  while (exists && attempts < maxAttempts) {
    const random = Math.floor(10000 + Math.random() * 90000); // 5 dígitos
    codigo = `${sufijo}-${random}`;
    const count = await Entrada.count({ where: { codigo_lote: codigo } });
    exists = count > 0;
    attempts++;
  }
  if (exists) {
    throwError("No se pudo generar un código de lote único, intente de nuevo", 500);
  }
  return codigo;
};

// Validar que el servicio_tienda corresponda a un producto y obtener su isVencible
const validateServicioTiendaProducto = async (id_servicio_tienda, transaction) => {
  const st = await ServicioTienda.findByPk(id_servicio_tienda, {
    transaction,
    include: [
      {
        model: Servicio,
        as: "servicio",
        include: [{ model: Producto, as: "producto" }],
      },
    ],
  });
  if (!st) {
    throwError("El registro de servicio-tienda no existe.", 404);
  }
  if (!st.servicio || !st.servicio.producto) {
    throwError("El servicio seleccionado no es un producto. Solo se permiten entradas para productos.", 400);
  }
  const isVencible = st.servicio.producto.isVencible;
  return { st, isVencible };
};

// Actualizar cantidad en ServicioTienda sumando o restando
const updateCantidadServicioTienda = async (id_servicio_tienda, delta, transaction) => {
  const st = await ServicioTienda.findByPk(id_servicio_tienda, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!st) {
    throwError("Servicio-tienda no encontrado.", 404);
  }
  const newCantidad = parseFloat(st.cantidad || 0) + Number(delta);
  if (newCantidad < 0) {
    throwError("La operación dejaría la cantidad del producto en la tienda negativa. Verifique el inventario.", 400);
  }
  await st.update({ cantidad: newCantidad }, { transaction });
};

// Obtener entrada con relaciones (para respuesta)
const getEntradaWithRelations = async (id) => {
  const entrada = await Entrada.findByPk(id, {
    include: getEntradaIncludes(),
  });
  if (!entrada) throwError("Entrada no encontrada.", 404);
  return entrada;
};

// Validar que el usuario exista
const validateUsuarioExists = async (id_usuario, transaction) => {
  const count = await Usuario.count({ where: { id_usuario }, transaction });
  if (count === 0) {
    throwError("El usuario especificado no existe.", 404);
  }
};

// ===== FUNCIÓN AUXILIAR PARA CREAR UNA SOLA ENTRADA (usada por createEntrada y createEntradasBulk) =====
const createSingleEntrada = async (entradaData, transaction) => {
  const { id_servicio_tienda, cantidad_entrada, costo_usd, costo_cup, fecha_vencimiento, nombre_proveedor, id_usuario, fecha } = entradaData;

  await validateUsuarioExists(id_usuario, transaction);

  const { st, isVencible } = await validateServicioTiendaProducto(id_servicio_tienda, transaction);

  if (isVencible && !fecha_vencimiento) {
    throwError("El producto requiere fecha de vencimiento, este campo es obligatorio.", 400);
  }

  const sufijo = st.servicio.producto.sufijo;
  const codigo_lote = await generateCodigoLote(sufijo);

  const fechaRegistro = fecha ? new Date(fecha) : new Date();

  const nuevaEntrada = await Entrada.create(
    {
      id_usuario,
      id_servicio_tienda,
      codigo_lote,
      cantidad_entrada,
      cantidad_restante: cantidad_entrada,
      costo_usd,
      costo_cup,
      fecha: fechaRegistro,
      fecha_vencimiento: fecha_vencimiento || null,
      nombre_proveedor: nombre_proveedor || null,
    },
    { transaction }
  );

  await updateCantidadServicioTienda(id_servicio_tienda, cantidad_entrada, transaction);

  return nuevaEntrada;
};

// ========== FUNCIONES PRINCIPALES ==========

const createEntrada = async (entradaData) => {
  const { id_usuario } = entradaData;
  if (!id_usuario) throwError("El ID de usuario es requerido.", 400);
  await validateUsuarioExists(id_usuario);

  const transaction = await Entrada.sequelize.transaction();

  try {
    const nuevaEntrada = await createSingleEntrada(entradaData, transaction);
    await transaction.commit();
    return await getEntradaWithRelations(nuevaEntrada.id_entrada);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const createEntradaWithFabricaciones = async (entradaData, fabricacionesData) => {
  const transaction = await Entrada.sequelize.transaction();

  try {
    const { normalizadas, servicioTiendasBloqueados } = await prepareFabricaciones(
      fabricacionesData,
      entradaData.id_servicio_tienda,
      transaction
    );
    const cantidadesFabricacion = aggregateFabricaciones(normalizadas);
    await validateFabricacionesDisponibles(cantidadesFabricacion, servicioTiendasBloqueados, transaction);

    const nuevaEntrada = await createSingleEntrada(entradaData, transaction);
    const servicioTiendaEntrada = servicioTiendasBloqueados.get(Number(entradaData.id_servicio_tienda));
    servicioTiendaEntrada.set(
      "cantidad",
      Number(servicioTiendaEntrada.cantidad || 0) + Number(entradaData.cantidad_entrada)
    );
    const deltas = new Map(
      [...cantidadesFabricacion].map(([id, cantidad]) => [id, -cantidad])
    );
    await applyInventoryDeltas(deltas, servicioTiendasBloqueados, transaction);
    for (const fabricacionData of normalizadas) {
      const fabricacion = await Fabricacion.create({
        ...fabricacionData,
        id_entrada: nuevaEntrada.id_entrada,
      }, { transaction });
      const { st } = await validateServicioTiendaProducto(fabricacion.id_servicio_tienda, transaction);
      await descontarInsumosFabricacion(
        fabricacion,
        st,
        transaction,
        nuevaEntrada.id_entrada
      );
    }

    await transaction.commit();
    return await getEntradaWithRelations(nuevaEntrada.id_entrada);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const createEntradasBulk = async (entradasData) => {
  if (!Array.isArray(entradasData) || entradasData.length === 0) {
    throwError("La lista de entradas no puede estar vacía.", 400);
  }

  // Validar que todos los usuarios existan
  const userIds = entradasData.map(item => item.id_usuario);
  for (const uid of userIds) {
    if (!uid) {
      throwError("Todas las entradas deben tener un ID de usuario válido.", 400);
    }
    await validateUsuarioExists(uid);
  }

  const transaction = await Entrada.sequelize.transaction();

  try {
    const createdEntradas = [];
    for (const data of entradasData) {
      const nuevaEntrada = await createSingleEntrada(data, transaction);
      createdEntradas.push(nuevaEntrada);
    }
    await transaction.commit();

    const ids = createdEntradas.map(e => e.id_entrada);
    const entradasConRelaciones = await Entrada.findAll({
      where: { id_entrada: { [Op.in]: ids } },
      include: getEntradaIncludes(),
      order: [["id_entrada", "ASC"]],
    });
    return entradasConRelaciones;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const getEntradaById = async (id) => {
  return await getEntradaWithRelations(id);
};

const updateEntrada = async (id, updateData, fabricacionesData) => {
  const reemplazarFabricaciones = fabricacionesData !== undefined;
  const transaction = await Entrada.sequelize.transaction();

  try {
    const entrada = await Entrada.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!entrada) throwError("Entrada no encontrada.", 404);

    if (updateData.codigo_lote !== undefined) {
      throwError("No se puede modificar el código de lote.", 400);
    }
    if (updateData.cantidad_restante !== undefined) {
      throwError("No se puede modificar la cantidad restante manualmente.", 400);
    }

    if (updateData.id_usuario) {
      await validateUsuarioExists(updateData.id_usuario, transaction);
    }

    let currentServicioTiendaId = entrada.id_servicio_tienda;
    let newServicioTiendaId = currentServicioTiendaId;
    let isChangingServicioTienda = false;

    if (updateData.id_servicio_tienda !== undefined) {
      if (updateData.id_servicio_tienda === currentServicioTiendaId) {
        // mismo, no hacer nada
      } else {
        newServicioTiendaId = updateData.id_servicio_tienda;
        isChangingServicioTienda = true;
        await validateServicioTiendaProducto(newServicioTiendaId, transaction);
      }
    }

    let targetServicioTiendaId = isChangingServicioTienda ? newServicioTiendaId : currentServicioTiendaId;
    const { isVencible } = await validateServicioTiendaProducto(targetServicioTiendaId, transaction);

    let fabricacionesAnteriores = [];
    let contextoFabricaciones;
    if (reemplazarFabricaciones) {
      fabricacionesAnteriores = await Fabricacion.findAll({
        where: { id_entrada: entrada.id_entrada },
        transaction,
      });
      contextoFabricaciones = await prepareFabricaciones(
        fabricacionesData,
        targetServicioTiendaId,
        transaction,
        {
          fabricacionesAnteriores,
          permitirVacio: true,
        }
      );
    }

    let newFechaVencimiento = updateData.fecha_vencimiento !== undefined ? updateData.fecha_vencimiento : entrada.fecha_vencimiento;
    if (isVencible && !newFechaVencimiento) {
      throwError("El producto requiere fecha de vencimiento, este campo es obligatorio.", 400);
    }

    const updateFields = {};
    let deltaCantidad = 0;
    const cantidadEntradaActual = parseFloat(entrada.cantidad_entrada);
    const cantidadRestanteActual = parseFloat(entrada.cantidad_restante);
    let nuevaCantidadRestante = cantidadRestanteActual;

    if (updateData.cantidad_entrada !== undefined) {
      const newCantidad = parseFloat(updateData.cantidad_entrada);
      if (isNaN(newCantidad) || newCantidad <= 0) {
        throwError("La cantidad de entrada debe ser un número mayor que cero.", 400);
      }
      deltaCantidad = newCantidad - cantidadEntradaActual;
      const cantidadConsumida = cantidadEntradaActual - cantidadRestanteActual;
      if (newCantidad < cantidadConsumida) {
        throwError(
          `La cantidad de entrada no puede ser menor que la cantidad ya consumida (${cantidadConsumida}).`,
          400
        );
      }
      nuevaCantidadRestante = newCantidad - cantidadConsumida;
      updateFields.cantidad_entrada = newCantidad;
      updateFields.cantidad_restante = nuevaCantidadRestante;
    }

    if (updateData.costo_usd !== undefined) {
      if (isNaN(updateData.costo_usd) || updateData.costo_usd < 0) {
        throwError("El costo en USD no puede ser negativo.", 400);
      }
      updateFields.costo_usd = updateData.costo_usd;
    }
    if (updateData.costo_cup !== undefined) {
      if (isNaN(updateData.costo_cup) || updateData.costo_cup < 0) {
        throwError("El costo en CUP no puede ser negativo.", 400);
      }
      updateFields.costo_cup = updateData.costo_cup;
    }
    if (updateData.fecha_vencimiento !== undefined) {
      updateFields.fecha_vencimiento = updateData.fecha_vencimiento || null;
    }
    if (updateData.nombre_proveedor !== undefined) {
      updateFields.nombre_proveedor = updateData.nombre_proveedor || null;
    }
    if (updateData.id_usuario !== undefined) {
      updateFields.id_usuario = updateData.id_usuario;
    }
    if (updateData.fecha !== undefined) {
      const fechaObj = new Date(updateData.fecha);
      if (isNaN(fechaObj.getTime())) throwError("La fecha proporcionada no es válida.", 400);
      updateFields.fecha = fechaObj;
    }

    if (isChangingServicioTienda) {
      updateFields.id_servicio_tienda = newServicioTiendaId;
    }

    if (Object.keys(updateFields).length === 0 && !reemplazarFabricaciones) {
      throwError("No se proporcionaron campos válidos para actualizar.", 400);
    }

    const cantidadAUsar = deltaCantidad !== 0 ? nuevaCantidadRestante : cantidadRestanteActual;

    if (reemplazarFabricaciones) {
      const deltas = new Map();
      const addDelta = (servicioTiendaId, delta) => {
        const key = Number(servicioTiendaId);
        deltas.set(key, (deltas.get(key) || 0) + delta);
      };

      if (isChangingServicioTienda) {
        addDelta(currentServicioTiendaId, -cantidadAUsar);
        addDelta(newServicioTiendaId, cantidadAUsar);
      } else if (deltaCantidad !== 0) {
        addDelta(currentServicioTiendaId, deltaCantidad);
      }
      for (const [idServicioTienda, cantidad] of aggregateFabricaciones(fabricacionesAnteriores)) {
        addDelta(idServicioTienda, cantidad);
      }
      for (const [idServicioTienda, cantidad] of aggregateFabricaciones(contextoFabricaciones.normalizadas)) {
        addDelta(idServicioTienda, -cantidad);
      }

      const cantidadesFabricacionSolicitadas = aggregateFabricaciones(contextoFabricaciones.normalizadas);
      const ajustesDisponibles = new Map(
        [...cantidadesFabricacionSolicitadas].map(([id, cantidad]) => [
          id,
          (deltas.get(id) || 0) + cantidad,
        ])
      );
      await validateFabricacionesDisponibles(
        cantidadesFabricacionSolicitadas,
        contextoFabricaciones.servicioTiendasBloqueados,
        transaction,
        ajustesDisponibles
      );

      await applyInventoryDeltas(deltas, contextoFabricaciones.servicioTiendasBloqueados, transaction);
      await revertirInsumosFabricacion(fabricacionesAnteriores, transaction);
      await Fabricacion.destroy({
        where: { id_entrada: entrada.id_entrada },
        transaction,
      });
      for (const fabricacionData of contextoFabricaciones.normalizadas) {
        const fabricacion = await Fabricacion.create({
          ...fabricacionData,
          id_entrada: entrada.id_entrada,
        }, { transaction });
        const { st } = await validateServicioTiendaProducto(fabricacion.id_servicio_tienda, transaction);
        await descontarInsumosFabricacion(fabricacion, st, transaction, entrada.id_entrada);
      }
    } else {
      if (isChangingServicioTienda) {
        await updateCantidadServicioTienda(currentServicioTiendaId, -cantidadAUsar, transaction);
        await updateCantidadServicioTienda(newServicioTiendaId, cantidadAUsar, transaction);
      } else if (deltaCantidad !== 0) {
        await updateCantidadServicioTienda(currentServicioTiendaId, deltaCantidad, transaction);
      }
    }

    if (Object.keys(updateFields).length > 0) {
      await entrada.update(updateFields, { transaction });
    }

    await transaction.commit();

    return await getEntradaWithRelations(id);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const deleteEntrada = async (id) => {
  const transaction = await Entrada.sequelize.transaction();

  try {
    const entrada = await Entrada.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!entrada) throwError("Entrada no encontrada.", 404);

    const cantidadEntrada = Number(entrada.cantidad_entrada);
    const cantidadRestante = Number(entrada.cantidad_restante);
    if (cantidadEntrada !== cantidadRestante) {
      throwError(
        `No se puede eliminar esta entrada porque ya se realizaron operaciones con ella. Cantidad original: ${cantidadEntrada}; cantidad restante: ${cantidadRestante}.`,
        400
      );
    }

    const asignacionFabricacion = await FabricacionEntrada.findOne({
      where: { id_entrada: entrada.id_entrada },
      transaction,
    });
    if (asignacionFabricacion) {
      throwError("No se puede eliminar esta entrada porque contiene insumos utilizados en una fabricación.", 400);
    }

    const fabricaciones = await Fabricacion.findAll({
      where: { id_entrada: entrada.id_entrada },
      transaction,
    });
    await lockServicioTiendaRows(
      [entrada.id_servicio_tienda, ...fabricaciones.map((fabricacion) => fabricacion.id_servicio_tienda)],
      transaction
    );
    await revertirInsumosFabricacion(fabricaciones, transaction);
    for (const [idServicioTienda, cantidad] of aggregateFabricaciones(fabricaciones)) {
      await updateCantidadServicioTienda(idServicioTienda, cantidad, transaction);
    }

    await updateCantidadServicioTienda(
      entrada.id_servicio_tienda,
      -parseFloat(entrada.cantidad_restante),
      transaction
    );

    await Fabricacion.destroy({
      where: { id_entrada: entrada.id_entrada },
      transaction,
    });
    await entrada.destroy({ transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const filterEntradas = async (filters, limit, offset) => {
  const where = {};

  // Filtros directos
  if (filters.id_servicio_tienda) where.id_servicio_tienda = filters.id_servicio_tienda;
  if (filters.id_usuario) where.id_usuario = filters.id_usuario;
  if (filters.codigo_lote) where.codigo_lote = { [Op.iLike]: `%${filters.codigo_lote}%` };

  // Filtro por fecha de creación
  if (filters.fecha_desde || filters.fecha_hasta) {
    where.fecha = {};
    if (filters.fecha_desde) where.fecha[Op.gte] = filters.fecha_desde;
    if (filters.fecha_hasta) {
      const end = new Date(filters.fecha_hasta);
      end.setDate(end.getDate() + 1);
      where.fecha[Op.lt] = end;
    }
  }

  // Filtro por cantidad_restante
  if (filters.cantidad_restante_min !== undefined && filters.cantidad_restante_max !== undefined) {
    where.cantidad_restante = { [Op.between]: [filters.cantidad_restante_min, filters.cantidad_restante_max] };
  } else if (filters.cantidad_restante_min !== undefined) {
    where.cantidad_restante = { [Op.gte]: filters.cantidad_restante_min };
  } else if (filters.cantidad_restante_max !== undefined) {
    where.cantidad_restante = { [Op.lte]: filters.cantidad_restante_max };
  }

  // Filtro por fecha_vencimiento
  if (filters.fecha_vencimiento_desde && filters.fecha_vencimiento_hasta) {
    where.fecha_vencimiento = { [Op.between]: [filters.fecha_vencimiento_desde, filters.fecha_vencimiento_hasta] };
  } else if (filters.fecha_vencimiento_desde) {
    where.fecha_vencimiento = { [Op.gte]: filters.fecha_vencimiento_desde };
  } else if (filters.fecha_vencimiento_hasta) {
    where.fecha_vencimiento = { [Op.lte]: filters.fecha_vencimiento_hasta };
  }

  // Construir include con condiciones anidadas
  const servicioTiendaWhere = {};
  if (filters.id_tienda) servicioTiendaWhere.id_tienda = filters.id_tienda;
  if (filters.id_servicio) servicioTiendaWhere.id_servicio = filters.id_servicio;

  const include = getEntradaIncludes();
  const servicioTiendaInclude = include.find((relation) => relation.as === "servicioTienda");

  if (Object.keys(servicioTiendaWhere).length > 0) {
    servicioTiendaInclude.required = true;
    servicioTiendaInclude.where = servicioTiendaWhere;
  }

  if (filters.nombre_servicio) {
    servicioTiendaInclude.required = true;
    servicioTiendaInclude.include[1].where = {
      nombre: { [Op.iLike]: `%${filters.nombre_servicio}%` },
    };
  }

  const countServicioTiendaInclude = {
    ...servicioTiendaInclude,
    include: servicioTiendaInclude.include.map((relation) => ({ ...relation })),
  };
  const count = await Entrada.count({
    where,
    include: [countServicioTiendaInclude],
    distinct: true,
    col: "id_entrada",
  });

  const paginationOptions = limit === undefined ? {} : { limit, offset };
  const rows = await Entrada.findAll({
    where,
    include,
    order: [["fecha", "DESC"]],
    ...paginationOptions,
  });

  return { rows, count };
};

module.exports = {
  createEntrada,
  createEntradaWithFabricaciones,
  createEntradasBulk,
  getEntradaById,
  updateEntrada,
  deleteEntrada,
  filterEntradas,
};