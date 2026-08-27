/* ==========================================================================
   Calculadora Easy Meli — motor de cálculo
   Réplica exacta de la lógica validada en el Excel (hoja "Calculadora").
   Todo afecto a IVA (19%): utilidad neta = (precio - costos) / 1.19
   Margen = utilidad neta / costo total (compra + envío + empaque + comisión + publicidad)
   ========================================================================== */

"use strict";

/* Tabla oficial de costos de envío de MercadoLibre Chile.
   Filas = tramo de peso (kg, límite inferior). Columnas por reputación y tramo de precio:
   [peso_desde, Verde_t1, Verde_t2, Verde_t3, Amar_t1, Amar_t2, Amar_t3, Roja_t1, Roja_t2, Roja_t3]
   Tramo de precio:  t1 = precio < $9.990  ·  t2 = $9.990 a $19.990  ·  t3 = $19.990 o mas */
const TARIFAS = [
  [0,    800,  1000, 3050,  914,  1143, 3660,  1142, 1428, 6100],
  [0.3,  810,  1020, 3150,  926,  1166, 3780,  1157, 1457, 6300],
  [0.5,  830,  1040, 3250,  948,  1188, 3900,  1185, 1485, 6500],
  [1,    850,  1060, 3400,  972,  1212, 4080,  1214, 1514, 6800],
  [1.5,  870,  1080, 3600,  994,  1234, 4320,  1242, 1542, 7200],
  [2,    900,  1100, 3950,  1028, 1257, 4740,  1285, 1571, 7900],
  [3,    1040, 1280, 4550,  1188, 1463, 5460,  1485, 1828, 9100],
  [4,    1180, 1460, 4900,  1348, 1668, 5880,  1685, 2085, 9800],
  [5,    1330, 1640, 5200,  1520, 1874, 6240,  1900, 2342, 10400],
  [6,    1470, 1820, 5800,  1680, 2080, 6960,  2100, 2600, 11600],
  [8,    1590, 1990, 6200,  1817, 2274, 7440,  2271, 2842, 12400],
  [10,   1740, 2290, 7200,  1988, 2617, 8640,  2485, 3271, 14400],
  [15,   1890, 2590, 8500,  2160, 2960, 10200, 2700, 3700, 17000],
  [20,   2040, 2890, 10000, 2332, 3303, 12000, 2914, 4128, 20000],
  [25,   2190, 3190, 13050, 2503, 3646, 15660, 3128, 4557, 26100],
  [30,   2390, 3590, 15000, 2732, 4103, 18000, 3414, 5128, 30000],
  [40,   2590, 3990, 17300, 2960, 4560, 20760, 3700, 5700, 34600],
  [50,   2790, 4390, 19000, 3188, 5017, 22800, 3985, 6271, 38000],
  [60,   2990, 4790, 20000, 3417, 5474, 24000, 4271, 6842, 40000],
  [70,   3190, 5190, 22300, 3646, 5932, 26760, 4557, 7414, 44600],
  [80,   3390, 5590, 24200, 3874, 6388, 29040, 4842, 7985, 48400],
  [90,   3590, 5990, 26300, 4103, 6846, 31560, 5128, 8557, 52600],
  [100,  3790, 6390, 28400, 4332, 7303, 34080, 5414, 9128, 56800],
  [110,  3990, 6790, 31600, 4560, 7760, 37920, 5700, 9700, 63200],
  [120,  4190, 7190, 34900, 4788, 8217, 41880, 5985, 10271, 69800],
  [130,  4390, 7590, 38400, 5017, 8674, 46080, 6271, 10842, 76800],
  [140,  4590, 7990, 41600, 5246, 9132, 49920, 6557, 11414, 83200],
  [150,  4790, 8390, 47400, 5474, 9588, 56880, 6842, 11985, 94800],
  [175,  4990, 8790, 55600, 5703, 10046, 66720, 7128, 12557, 111200],
  [200,  5190, 9190, 63900, 5932, 10503, 76680, 7414, 13128, 127800],
  [225,  5390, 9590, 70900, 6160, 10960, 85080, 7700, 13700, 141800],
  [250,  5590, 9990, 78400, 6388, 11417, 94080, 7985, 14271, 156800],
  [275,  5790, 10390, 85900, 6617, 11874, 103080, 8271, 14842, 171800],
  [300,  5990, 10990, 93400, 6846, 12560, 112080, 8557, 15700, 186800],
];

const IVA = 1.19;
const PRECIO_MINIMO = 1100;      // ML no deja publicar por menos de $1.100
const UMBRAL_ENVIO_GRATIS = 19990; // envio gratis obligatorio desde $19.990

/* Reputacion -> indice de bloque (0 Verde, 1 Amarilla, 2 Roja) */
const REPUTACION_IDX = { verde: 0, amarilla: 1, roja: 2 };

/* Peso volumetrico = (L x A x H) / 4000. ML cobra el mayor entre fisico y volumetrico. */
function pesoVolumetrico(largo, ancho, alto) {
  return (largo * ancho * alto) / 4000;
}
function pesoFacturable(fisico, largo, ancho, alto) {
  return Math.max(fisico || 0, pesoVolumetrico(largo, ancho, alto));
}

/* Encuentra la fila de la tabla segun el peso facturable (limite inferior, tipo MATCH ...,1) */
function filaTarifa(peso) {
  let idx = 0;
  for (let i = 0; i < TARIFAS.length; i++) {
    if (peso >= TARIFAS[i][0]) idx = i;
    else break;
  }
  return idx;
}

/* Tramo de precio: 1 (<9990), 2 (9990..19990), 3 (>=19990) */
function tramoPorPrecio(precio) {
  if (precio < 9990) return 1;
  if (precio < UMBRAL_ENVIO_GRATIS) return 2;
  return 3;
}

/* Costo de envio para un peso, reputacion y tramo dados */
function envio(peso, reputacion, tramo) {
  const fila = filaTarifa(peso);
  const repIdx = REPUTACION_IDX[reputacion] ?? 0;
  const col = 1 + repIdx * 3 + (tramo - 1); // +1 porque la col 0 es peso_desde
  return TARIFAS[fila][col];
}

/* ---------------------------------------------------------------------------
   MODO INVERSA: elijo un margen objetivo -> me da el precio de publicacion.
   P = (C + E + K)(1 + 1.19 m) / ((1 - c - a) - 1.19 m (c + a))
   Se resuelve el escalon de envio probando los 3 tramos y quedandose con el
   precio auto-consistente (mismo criterio que el Excel).
   --------------------------------------------------------------------------- */
function calcularInversa(d) {
  const C = d.costo, K = d.empaque, c = d.comision, a = d.publicidad, m = d.margen;
  const peso = pesoFacturable(d.pesoFisico, d.largo, d.ancho, d.alto);

  const denom = (1 - c - a) - IVA * m * (c + a);
  if (denom <= 0) {
    return { error: "Con esa comisión, publicidad y margen no hay precio posible (los costos porcentuales se comen toda la venta). Bajá el margen o revisá los %." };
  }

  const precioConTramo = (tramo) => {
    const E = envio(peso, d.reputacion, tramo);
    return (C + E + K) * (1 + IVA * m) / denom;
  };

  const p1 = precioConTramo(1);
  const p2 = precioConTramo(2);
  const p3 = precioConTramo(3);

  let precio, tramo;
  if (p1 < 9990) { precio = p1; tramo = 1; }
  else if (p2 < UMBRAL_ENVIO_GRATIS) { precio = p2; tramo = 2; }
  else { precio = p3; tramo = 3; }

  return desglose(precio, tramo, peso, d);
}

/* ---------------------------------------------------------------------------
   MODO DIRECTA: pongo un precio -> me dice cuanto gano.
   --------------------------------------------------------------------------- */
function calcularDirecta(d) {
  const peso = pesoFacturable(d.pesoFisico, d.largo, d.ancho, d.alto);
  const tramo = tramoPorPrecio(d.precio);
  return desglose(d.precio, tramo, peso, d);
}

/* Desglose comun: dado un precio final y su tramo, calcula todos los costos. */
function desglose(precio, tramo, peso, d) {
  const C = d.costo, K = d.empaque, c = d.comision, a = d.publicidad;
  const E = envio(peso, d.reputacion, tramo);
  const comisionMonto = c * precio;
  const publicidadMonto = a * precio;
  const costoTotal = C + E + K + comisionMonto + publicidadMonto;
  const utilidadNeta = (precio - costoTotal) / IVA;
  const margenReal = costoTotal > 0 ? utilidadNeta / costoTotal : 0;
  const margenSobreVenta = precio > 0 ? utilidadNeta / precio : 0;

  return {
    precio,
    tramo,
    peso,
    pesoVol: pesoVolumetrico(d.largo, d.ancho, d.alto),
    mandaVolumetrico: pesoVolumetrico(d.largo, d.ancho, d.alto) > (d.pesoFisico || 0),
    envio: E,
    comisionMonto,
    publicidadMonto,
    empaque: K,
    costo: C,
    costoTotal,
    utilidadNeta,
    margenReal,
    margenSobreVenta,
    bajoMinimo: precio < PRECIO_MINIMO,
    envioGratisObligatorio: precio >= UMBRAL_ENVIO_GRATIS,
  };
}

/* Promo: precio de lista inflado para mostrar un descuento y aun cobrar el precio objetivo. */
function precioLista(precioObjetivo, descuento) {
  if (descuento >= 1) return Infinity;
  return precioObjetivo / (1 - descuento);
}

/* Formato de moneda chilena, sin decimales. */
function clp(n) {
  if (!isFinite(n)) return "$ —";
  return "$" + Math.round(n).toLocaleString("es-CL");
}
function pct(n) {
  if (!isFinite(n)) return "—";
  return (n * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 }) + "%";
}

/* Exponer para el front */
window.EasyMeliCalc = {
  calcularInversa, calcularDirecta, precioLista,
  pesoVolumetrico, pesoFacturable, envio, tramoPorPrecio,
  clp, pct, PRECIO_MINIMO, UMBRAL_ENVIO_GRATIS,
};
