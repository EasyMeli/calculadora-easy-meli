/* ==========================================================================
   Calculadora Easy Meli — interacciones de la interfaz
   ========================================================================== */
"use strict";

(function () {
  const C = window.EasyMeliCalc;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  let modo = "inversa";
  let reputacion = "verde";

  /* ---------- lectura de inputs ---------- */
  const num = (id) => {
    const v = parseFloat($("#" + id).value.replace(",", "."));
    return isNaN(v) ? 0 : v;
  };

  function leerDatos() {
    return {
      costo: num("in-costo"),
      empaque: num("in-empaque"),
      comision: num("in-comision") / 100,
      publicidad: num("in-publicidad") / 100,
      reputacion,
      pesoFisico: num("in-peso"),
      largo: num("in-largo"),
      ancho: num("in-ancho"),
      alto: num("in-alto"),
      margen: num("in-margen") / 100,
      precio: num("in-precio"),
    };
  }

  /* ---------- render ---------- */
  const tramoTxt = { 1: "menos de $9.990", 2: "$9.990 a $19.990", 3: "$19.990 o más" };

  function fila(label, valor, cls) {
    return `<div class="rrow ${cls || ""}"><span>${label}</span><b>${valor}</b></div>`;
  }

  function render() {
    const d = leerDatos();
    const r = modo === "inversa" ? C.calcularInversa(d) : C.calcularDirecta(d);

    // hint de peso (siempre)
    const vol = C.pesoVolumetrico(d.largo, d.ancho, d.alto);
    const fact = C.pesoFacturable(d.pesoFisico, d.largo, d.ancho, d.alto);
    const hp = $("#hint-peso");
    if (vol > d.pesoFisico && vol > 0) {
      hp.innerHTML = `Manda el <b>peso volumétrico</b>: ${vol.toLocaleString("es-CL", { maximumFractionDigits: 2 })} kg (más que los ${d.pesoFisico} kg reales). MercadoLibre te cobra por el tamaño.`;
    } else {
      hp.innerHTML = `Facturable: <b>${fact.toLocaleString("es-CL", { maximumFractionDigits: 2 })} kg</b>. Manda el peso real (es mayor que el volumétrico de ${vol.toLocaleString("es-CL", { maximumFractionDigits: 2 })} kg).`;
    }

    const big = $("#result-big");
    const label = $("#result-label");
    const meta = $("#result-meta");
    const brk = $("#result-break");
    const alerts = $("#result-alerts");

    if (r.error) {
      label.textContent = modo === "inversa" ? "Precio para publicar" : "Tu ganancia";
      big.textContent = "—";
      meta.textContent = "";
      brk.innerHTML = "";
      alerts.innerHTML = `<div class="alert alert--warn">${r.error}</div>`;
      actualizarPromo(0);
      return;
    }

    let html = "";
    if (modo === "inversa") {
      label.textContent = "Precio para publicar";
      big.textContent = C.clp(r.precio);
      meta.textContent = `Con este precio ganás ${C.pct(r.margenReal)} sobre tu costo total.`;
      html += fila("Costo del producto", C.clp(r.costo));
      html += fila(`Envío (${r.peso.toLocaleString("es-CL", { maximumFractionDigits: 2 })} kg)`, C.clp(r.envio));
      html += fila("Empaque", C.clp(r.empaque));
      html += fila("Comisión MercadoLibre", C.clp(r.comisionMonto));
      html += fila("Publicidad", C.clp(r.publicidadMonto));
      html += fila("Costo total", C.clp(r.costoTotal), "rrow--strong");
      html += fila("Te queda limpio (después de IVA)", C.clp(r.utilidadNeta), "rrow--strong rrow--net");
    } else {
      label.textContent = "Te queda limpio";
      big.textContent = C.clp(r.utilidadNeta);
      meta.textContent = `Margen ${C.pct(r.margenReal)} sobre tu costo, vendiendo a ${C.clp(r.precio)}.`;
      html += fila("Precio de venta", C.clp(r.precio));
      html += fila("Costo del producto", C.clp(r.costo));
      html += fila(`Envío (${r.peso.toLocaleString("es-CL", { maximumFractionDigits: 2 })} kg)`, C.clp(r.envio));
      html += fila("Empaque", C.clp(r.empaque));
      html += fila("Comisión MercadoLibre", C.clp(r.comisionMonto));
      html += fila("Publicidad", C.clp(r.publicidadMonto));
      html += fila("Margen sobre el costo", C.pct(r.margenReal), "rrow--strong");
      html += fila("Margen sobre la venta", C.pct(r.margenSobreVenta), "rrow--strong rrow--net");
    }
    brk.innerHTML = html;

    // alertas
    let al = "";
    al += `<div class="alert alert--info">Tramo de envío: precio de ${tramoTxt[r.tramo]}.</div>`;
    if (r.envioGratisObligatorio) {
      al += `<div class="alert alert--info">Desde $19.990 el envío gratis es obligatorio. Ya está incluido en el cálculo con el descuento de tu reputación.</div>`;
    }
    if (r.bajoMinimo) {
      al += `<div class="alert alert--warn">Este precio está bajo el mínimo de $1.100 que exige MercadoLibre. Agrupá unidades en un kit o subí el margen.</div>`;
    }
    if (modo === "directa" && r.utilidadNeta < 0) {
      al += `<div class="alert alert--warn">A ese precio estás perdiendo plata: el costo total supera lo que cobrás.</div>`;
    }
    alerts.innerHTML = al;

    // promo se basa en el precio final (inversa) o el precio ingresado (directa)
    actualizarPromo(r.precio);
  }

  function actualizarPromo(precioBase) {
    const desc = num("in-descuento") / 100;
    const lista = C.precioLista(precioBase, desc);
    $("#promo-lista").textContent = C.clp(lista);
    $("#promo-final").textContent = C.clp(precioBase);
  }

  /* ---------- modo ---------- */
  function setModo(m) {
    modo = m;
    $$(".modeswitch__btn").forEach((b) => {
      const on = b.dataset.mode === m;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$("[data-only]").forEach((el) => {
      el.hidden = el.dataset.only !== m;
    });
    render();
  }

  /* ---------- slider margen ---------- */
  function syncSliderFill() {
    const range = $("#in-margen-range");
    const pct = ((range.value - range.min) / (range.max - range.min)) * 100;
    range.style.setProperty("--fill", pct + "%");
  }

  /* ---------- init ---------- */
  function init() {
    // inputs -> render en vivo
    $$("#calculadora input").forEach((inp) => {
      inp.addEventListener("input", render);
    });

    // switch de modo
    $$(".modeswitch__btn").forEach((b) => b.addEventListener("click", () => setModo(b.dataset.mode)));

    // reputación segmented
    $$(".seg").forEach((s) => {
      s.addEventListener("click", () => {
        reputacion = s.dataset.rep;
        $$(".seg").forEach((x) => {
          const on = x === s;
          x.classList.toggle("is-active", on);
          x.setAttribute("aria-checked", on ? "true" : "false");
        });
        render();
      });
    });

    // slider <-> número
    const range = $("#in-margen-range");
    const nummargen = $("#in-margen");
    range.addEventListener("input", () => { nummargen.value = range.value; syncSliderFill(); render(); });
    nummargen.addEventListener("input", () => { range.value = nummargen.value; syncSliderFill(); });
    syncSliderFill();

    // tooltips
    const tip = $("#tip");
    $$(".q").forEach((q) => {
      const show = () => {
        tip.textContent = q.dataset.tip;
        const rect = q.getBoundingClientRect();
        tip.classList.add("is-on");
        const tr = tip.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - tr.width / 2;
        left = Math.max(12, Math.min(left, window.innerWidth - tr.width - 12));
        let top = rect.top - tr.height - 9;
        if (top < 12) top = rect.bottom + 9;
        tip.style.left = left + "px";
        tip.style.top = top + "px";
      };
      const hide = () => tip.classList.remove("is-on");
      q.addEventListener("mouseenter", show);
      q.addEventListener("mouseleave", hide);
      q.addEventListener("focus", show);
      q.addEventListener("blur", hide);
      q.setAttribute("tabindex", "0");
    });

    // reveal on scroll
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$(".reveal").forEach((el) => io.observe(el));

    setModo("inversa");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
