const { ListaVenta } = require("../models/lista_venta");
const { Venta } = require("../models/venta");
const { VentaEntrada } = require("../models/venta_entrada");
const { Entrada } = require("../models/entrada");
const { ServicioTienda } = require("../models/servicio_tienda");
const { Servicio } = require("../models/servicio");
const { Producto } = require("../models/producto");
const { Tienda } = require("../models/tienda");
const { Usuario } = require("../models/usuario");
const { Cuenta } = require("../models/cuenta");
const { Operacion } = require("../models/operacion");
const { Op, Sequelize } = require("sequelize");
const { throwError } = require("../helpers/errorLauncher");

// ===== FUNCIONES AUXILIARES =====

// Obtener lista con todas sus relaciones (para respuestas)
const getListaVentaWithRelations = async (id) => {
  const lista = await ListaVenta.findByPk(id, {
    include: [
      {
        model: Venta,
        as: "ventas",
        include: [
          {
            model: ServicioTienda,
            as: "servicioTienda",
            include: [
              { model: Tienda, as: "tienda" },
              { model: Servicio, as: "servicio", include: [{ model: Producto, as: "producto" }] },
            ],
          },
          {
            model: VentaEntrada,
            as: "ventaEntradas",
            include: [{ model: Entrada, as: "entrada" }],
          },
        ],
      },
      {
        model: Operacion,
        as: "operaciones",
        include: [
          { model: Usuario, as: "usuario" },
          { model: Cuenta, as: "cuenta" },
        ],
      },
    ],
    order: [
      [{ model: Venta, as: "ventas" }, "id_venta", "ASC"],
      [{ model: Operacion, as: "operaciones" }, "id_operacion", "ASC"],
    ],
  });
  if (!lista) throwError("Lista de ventas no encontrada.", 404);
  return lista;
};

// Validar que un servicio_tienda exista y sea producto, devolver el registro con relaciones
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

// Validar que una cuenta exista
const validateCuentaExists = async (id_cuenta) => {
  const cuenta = await Cuenta.findByPk(id_cuenta);
  if (!cuenta) throwError(`La cuenta con id ${id_cuenta} no existe.`, 404);
  return cuenta;
};

// Actualizar fondo de cuenta (suma o resta)
const actualizarFondoCuenta = async (cuentaId, delta, transaction) => {
  const cuenta = await Cuenta.findByPk(cuentaId, { transaction });
  if (!cuenta) throwError("Cuenta no encontrada.", 404);
  const nuevoFondo = parseFloat(cuenta.fondo) + delta;
  if (nuevoFondo < 0) {
    throwError(`Fondos insuficientes en la cuenta "${cuenta.nombre}". Saldo actual: ${cuenta.fondo}`, 400);
  }
  await cuenta.update({ fondo: nuevoFondo }, { transaction });
  return cuenta;
};

// ---- Funciones de descuento de entradas (similar a salidas) ----

/**
 * Obtiene las entradas disponibles con cantidad_restante > 0 para un servicio_tienda dado,
 * ordenadas según la política de despacho (FIFO por vencimiento/fecha).
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
 * Descuenta una cantidad de entradas disponibles para un servicio_tienda,
 * creando registros en VentaEntrada (uno por entrada usada).
 * Similar a descontarEntradas en salidas.
 */
const descontarEntradasParaVenta = async (id_venta, id_servicio_tienda, cantidadTotal, transaction) => {
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
    // Restar de la entrada
    await entrada.update(
      { cantidad_restante: entrada.cantidad_restante - cantidadAUsar },
      { transaction }
    );
    // Crear registro intermedio (uno por entrada)
    await VentaEntrada.create(
      {
        id_venta,
        id_entrada: entrada.id_entrada,
        cantidad: cantidadAUsar,
      },
      { transaction }
    );
    cantidadPendiente -= cantidadAUsar;
  }

  if (cantidadPendiente > 0) {
    throwError("No hay suficiente cantidad en las entradas para cubrir la venta.", 400);
  }
};

/**
 * Revertir el descuento de una venta: devolver cantidad a las entradas
 * y eliminar los registros intermedios.
 */
const revertirVentaEntradas = async (id_venta, transaction) => {
  const ventaEntradas = await VentaEntrada.findAll({
    where: { id_venta },
    transaction,
  });

  for (const ve of ventaEntradas) {
    const entrada = await Entrada.findByPk(ve.id_entrada, { transaction });
    if (entrada) {
      await entrada.update(
        { cantidad_restante: entrada.cantidad_restante + ve.cantidad },
        { transaction }
      );
    }
    await ve.destroy({ transaction });
  }
};

// ===== FUNCIONES PRINCIPALES =====

// GET by ID
const getListaVentaById = async (id) => {
  return await getListaVentaWithRelations(id);
};

// FILTER (sin cambios)
const filterListaVentas = async (filters, limit, offset) => {
  // ... (código anterior sin cambios) ...
};

// CREATE (con descuento real de entradas)
const createListaVenta = async (listaData) => {
  const {
    fecha_hora,
    nota,
    cantidad_cobrada_efectivo_cup,
    cantidad_cobrada_efectivo_usd,
    cantidad_cobrada_transferencia_cup,
    cantidad_cobrada_transferencia_usd,
    id_cuenta_efectivo_cup,
    id_cuenta_efectivo_usd,
    id_cuenta_transferencia_cup,
    id_cuenta_transferencia_usd,
    id_usuario,
    cambio_moneda,
    ventas,
  } = listaData;

  // 1. Validar usuario
  const usuario = await Usuario.findByPk(id_usuario);
  if (!usuario) throwError("Usuario no encontrado.", 404);

  // 2. Validar cuentas (si se usan)
  const cuentas = {};
  if (cantidad_cobrada_efectivo_cup > 0) {
    cuentas.efectivo_cup = await validateCuentaExists(id_cuenta_efectivo_cup);
  }
  if (cantidad_cobrada_efectivo_usd > 0) {
    cuentas.efectivo_usd = await validateCuentaExists(id_cuenta_efectivo_usd);
  }
  if (cantidad_cobrada_transferencia_cup > 0) {
    cuentas.transferencia_cup = await validateCuentaExists(id_cuenta_transferencia_cup);
  }
  if (cantidad_cobrada_transferencia_usd > 0) {
    cuentas.transferencia_usd = await validateCuentaExists(id_cuenta_transferencia_usd);
  }

  // 3. Validar ventas y sumar totales
  const ventasData = [];
  let totalCupVentas = 0;
  let totalUsdVentas = 0;

  for (const v of ventas) {
    if (!v.id_servicio_tienda) throwError("Cada venta debe tener id_servicio_tienda.", 400);
    if (v.cantidad === undefined || v.cantidad === null || isNaN(v.cantidad) || v.cantidad <= 0) {
      throwError("La cantidad de cada venta debe ser un número mayor que cero.", 400);
    }
    if (v.precio_cobrado_cup === undefined || v.precio_cobrado_cup === null || isNaN(v.precio_cobrado_cup) || v.precio_cobrado_cup < 0) {
      throwError("precio_cobrado_cup debe ser un número no negativo.", 400);
    }
    if (v.precio_cobrado_usd === undefined || v.precio_cobrado_usd === null || isNaN(v.precio_cobrado_usd) || v.precio_cobrado_usd < 0) {
      throwError("precio_cobrado_usd debe ser un número no negativo.", 400);
    }

    const st = await validateServicioTiendaProducto(v.id_servicio_tienda);
    const stock = parseFloat(st.cantidad || 0);
    if (stock < v.cantidad) {
      throwError(
        `Stock insuficiente para el producto "${st.servicio.nombre}" en tienda "${st.tienda.nombre}". Disponible: ${stock}, solicitado: ${v.cantidad}`,
        400
      );
    }

    const precio_original_cup = parseFloat(st.precio_cup || 0);
    const precio_original_usd = parseFloat(st.precio_usd || 0);
    const costo_original_cup = parseFloat(st.costo_cup || 0);
    const costo_original_usd = parseFloat(st.costo_usd || 0);

    ventasData.push({
      id_servicio_tienda: v.id_servicio_tienda,
      cantidad: v.cantidad,
      precio_original_cup,
      precio_original_usd,
      costo_original_cup,
      costo_original_usd,
      precio_cobrado_cup: v.precio_cobrado_cup,
      precio_cobrado_usd: v.precio_cobrado_usd,
    });

    totalCupVentas += v.cantidad * v.precio_cobrado_cup;
    totalUsdVentas += v.cantidad * v.precio_cobrado_usd;
  }

  // 4. Validar que la suma de cantidades cobradas coincida con el total de ventas
  const totalCobradoCup = cantidad_cobrada_efectivo_cup + cantidad_cobrada_transferencia_cup;
  const totalCobradoUsd = cantidad_cobrada_efectivo_usd + cantidad_cobrada_transferencia_usd;

  if (Math.abs(totalCobradoCup - totalCupVentas) > 0.001) {
    throwError(
      `La suma de cantidades cobradas en CUP (${totalCobradoCup}) no coincide con el total de ventas en CUP (${totalCupVentas}).`,
      400
    );
  }
  if (Math.abs(totalCobradoUsd - totalUsdVentas) > 0.001) {
    throwError(
      `La suma de cantidades cobradas en USD (${totalCobradoUsd}) no coincide con el total de ventas en USD (${totalUsdVentas}).`,
      400
    );
  }

  const transaction = await ListaVenta.sequelize.transaction();

  try {
    // 5.1 Crear la lista de ventas
    const nuevaLista = await ListaVenta.create(
      {
        fecha_hora,
        nota,
        cantidad_cobrada_efectivo_cup,
        cantidad_cobrada_efectivo_usd,
        cantidad_cobrada_transferencia_cup,
        cantidad_cobrada_transferencia_usd,
      },
      { transaction }
    );

    // 5.2 Crear ventas, descontar entradas y actualizar stock
    const ventasCreadas = [];
    for (const v of ventasData) {
      // Crear la venta
      const venta = await Venta.create(
        {
          id_servicio_tienda: v.id_servicio_tienda,
          id_lista_venta: nuevaLista.id_lista_venta,
          cantidad: v.cantidad,
          precio_original_cup: v.precio_original_cup,
          precio_original_usd: v.precio_original_usd,
          costo_original_cup: v.costo_original_cup,
          costo_original_usd: v.costo_original_usd,
          precio_cobrado_cup: v.precio_cobrado_cup,
          precio_cobrado_usd: v.precio_cobrado_usd,
        },
        { transaction }
      );

      // ✅ Descontar de entradas (crea registros en VentaEntrada)
      await descontarEntradasParaVenta(venta.id_venta, v.id_servicio_tienda, v.cantidad, transaction);

      // Actualizar stock en servicio_tienda
      const st = await ServicioTienda.findByPk(v.id_servicio_tienda, { transaction });
      const nuevoStock = parseFloat(st.cantidad || 0) - v.cantidad;
      if (nuevoStock < 0) throwError("Stock inconsistente (negativo).", 500);
      await st.update({ cantidad: nuevoStock }, { transaction });

      ventasCreadas.push(venta);
    }

    // 5.3 Crear operaciones por cada forma de cobro con monto > 0
    const operacionesCreadas = [];
    const tiposCobro = [
      { key: "efectivo_cup", cantidad: cantidad_cobrada_efectivo_cup, cuenta: cuentas.efectivo_cup },
      { key: "efectivo_usd", cantidad: cantidad_cobrada_efectivo_usd, cuenta: cuentas.efectivo_usd },
      { key: "transferencia_cup", cantidad: cantidad_cobrada_transferencia_cup, cuenta: cuentas.transferencia_cup },
      { key: "transferencia_usd", cantidad: cantidad_cobrada_transferencia_usd, cuenta: cuentas.transferencia_usd },
    ];

    for (const item of tiposCobro) {
      if (item.cantidad > 0) {
        const cuenta = item.cuenta;
        if (!cuenta) throwError(`Falta cuenta para ${item.key}`, 400);

        const operacion = await Operacion.create(
          {
            id_cuenta: cuenta.id_cuenta,
            id_usuario,
            id_lista_venta: nuevaLista.id_lista_venta,
            cantidad_operacion: item.cantidad,
            tipo_operacion: "Ingreso",
            fecha_hora,
            motivo: "Ingreso por Venta",
            cambio_moneda,
          },
          { transaction }
        );

        await actualizarFondoCuenta(cuenta.id_cuenta, item.cantidad, transaction);
        operacionesCreadas.push(operacion);
      }
    }

    await transaction.commit();

    return await getListaVentaWithRelations(nuevaLista.id_lista_venta);
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

// DELETE (revertir descuento de entradas)
const deleteListaVenta = async (id) => {
  const transaction = await ListaVenta.sequelize.transaction();

  try {
    const lista = await ListaVenta.findByPk(id, {
      include: [
        { model: Venta, as: "ventas" },
        { model: Operacion, as: "operaciones" },
      ],
      transaction,
    });
    if (!lista) throwError("Lista de ventas no encontrada.", 404);

    // 1. Revertir operaciones: restar fondos de cuentas y eliminar operaciones
    for (const op of lista.operaciones) {
      await actualizarFondoCuenta(op.id_cuenta, -op.cantidad_operacion, transaction);
      await op.destroy({ transaction });
    }

    // 2. Revertir ventas: devolver stock y eliminar registros intermedios
    for (const venta of lista.ventas) {
      // ✅ Revertir el descuento de entradas (sumar de vuelta)
      await revertirVentaEntradas(venta.id_venta, transaction);

      // Devolver stock a servicio_tienda
      const st = await ServicioTienda.findByPk(venta.id_servicio_tienda, { transaction });
      if (st) {
        await st.update(
          { cantidad: parseFloat(st.cantidad || 0) + venta.cantidad },
          { transaction }
        );
      }

      // Eliminar la venta
      await venta.destroy({ transaction });
    }

    // 3. Eliminar la lista
    await lista.destroy({ transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  getListaVentaById,
  filterListaVentas,
  createListaVenta,
  deleteListaVenta,
};