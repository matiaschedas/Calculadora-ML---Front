/* MATOLI · Interfaz de la calculadora (Versión Backend .NET) */
(function () {
  'use strict';

  var D = null; 
  var STORE_STATE = 'matoli.estado.v2';
  var STORE_PROD = 'matoli.productos.v1';

  var updateCounter = 0;
  var PROFILE_KEYS = ['reputacion', 'condFiscal', 'ivaProducto', 'ivaIncluido', 'iibbPct', 'credDeb', 'adsPct', 'otrosPct', 'fijoMensual', 'unidadesMes'];
  var PRODUCT_KEYS = ['canal', 'nombre', 'costo', 'extras', 'condicion', 'modo', 'precio', 'objetivoTipo', 'objetivoValor', 'redondeo',
    'categoriaId', 'cargoPct', 'cuotas', 'logistica', 'envioGratis', 'peso', 'largo', 'ancho', 'alto', 'tablaEnvio', 'envioManual', 'fijoManual',
    'flexZona', 'flexCostoPropio', 'flexBonifManual', 'envioPropio', 'envioMP', 'mpProvincia', 'mpPlazo', 'mpExtranjera'];

  var DEFAULTS = {
    canal: 'ml', nombre: '', costo: '', extras: '', condicion: 'nuevo',
    modo: 'precio', precio: '', objetivoTipo: 'margen', objetivoValor: '20', redondeo: 'entero',
    categoriaId: '', cargoPct: '14', cuotas: 'c6', logistica: 'ml', envioGratis: false,
    peso: '0.5', largo: '', ancho: '', alto: '', tablaEnvio: 'general', envioManual: '', fijoManual: '',
    flexZona: 'domicilio', flexCostoPropio: '', flexBonifManual: '', envioPropio: '', envioMP: '',
    mpProvincia: 'Buenos Aires', mpPlazo: '10', mpExtranjera: false,
    reputacion: 'sinrep', condFiscal: 'cf', ivaProducto: '21', ivaIncluido: true,
    iibbPct: '0', credDeb: false, adsPct: '0', otrosPct: '0', fijoMensual: '0', unidadesMes: '0'
  };

  var state = Object.assign({}, DEFAULTS);
  var productos = loadJSON(STORE_PROD) || [];
  var editingId = null;
  var lastResult = null;

  /* --- Utilidades --- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function num(v, d) { return (v === '' || v === null || v === undefined) ? (d === undefined ? 0 : d) : Number(v); }
  function fmtPct(n) { return (Math.round(n * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + '%'; }
  function fmtMoney(n) { var v = Math.abs(n) < 100 && n % 1 !== 0 ? 2 : 0; return '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: v, maximumFractionDigits: v }); }
  function pctOf(x) { return (Math.round(x * 1000) / 10).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%'; }
  function signed(n) { return (n < 0 ? '− ' : '') + fmtMoney(Math.abs(n)); }
  function fmtDate(iso) { if(!iso) return ''; var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0]; }
  function loadJSON(key) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
  function saveJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { } }

  /* --- Lógica de actualización --- */
  async function update() {
    var counter = ++updateCounter;
    applyVisibility();
    try {
      var inp = buildInp(state);
      var res = null;
      if (state.modo === 'objetivo') res = await window.MatoliAPI.resolverPrecio(inp, objetivoDe(state));
      else if (num(state.precio) > 0) res = await window.MatoliAPI.calcular(inp, state.precio);
      
      if (counter !== updateCounter) return;
      lastResult = res;
      renderApp(res);
    } catch (err) {
      if (counter === updateCounter) $('#hero').innerHTML = '<div class="sub">Error: ' + esc(err.message) + '</div>';
    }
  }

  function buildInp(st) {
    var o = {};
    PRODUCT_KEYS.concat(PROFILE_KEYS).forEach(function(k) { o[k] = st[k]; });
    // Ajustes de tipos numéricos para la API
    var numKeys = ['costo', 'extras', 'precio', 'cargoPct', 'peso', 'largo', 'ancho', 'alto', 'envioManual', 'fijoManual', 'flexCostoPropio', 'flexBonifManual', 'envioPropio', 'envioMP', 'ivaProducto', 'iibbPct', 'adsPct', 'otrosPct', 'fijoMensual', 'unidadesMes'];
    numKeys.forEach(function(k) {
      o[k] = (st[k] === '' || st[k] === null || st[k] === undefined) ? null : Number(st[k]);
    });
    o.credDebPct = st.credDeb ? D.meta.credDebPct : 0;
    return o;
  }
  function objetivoDe(st) { return { tipo: st.objetivoTipo, valor: num(st.objetivoValor), redondeo: st.redondeo }; }

  /* --- Renderizado --- */
  function renderApp(res) {
    dynamicTexts(res);
    renderHero(res);
    renderAvisos(res);
    renderBreakdown(res);
    renderDeposit(res);
    renderMobileBar(res);
    if (state.canal === 'ml' && res) renderEscenarios();
    else $('#escenarios-card').hidden = true;
    $('#btn-guardar').textContent = editingId ? 'Actualizar producto' : 'Guardar en Mis productos';
  }

  function renderHero(res) {
    var h = $('#hero'); h.className = 'hero';
    if (!res) { h.innerHTML = '<div class="sub">Ingresá los datos para calcular.</div>'; return; }
    h.classList.add(res.ganancia >= 0 ? 'good' : 'bad');
    var pills = '<span class="pill">Margen <strong>' + pctOf(res.margen) + '</strong></span>';
    h.innerHTML = '<div class="lbl">' + (state.modo === 'objetivo' ? 'Precio sugerido' : 'Ganancia por unidad') + '</div>' +
      '<div class="big">' + (state.modo === 'objetivo' ? fmtMoney(res.precio) : signed(res.ganancia)) + '</div>' +
      '<div class="sub">' + (state.modo === 'objetivo' ? 'Te deja ' + signed(res.ganancia) : 'Vendiendo a ' + fmtMoney(res.precio)) + '</div>' +
      '<div class="pills">' + pills + '</div>';
  }

  function renderBreakdown(res) {
    var ul = $('#breakdown');
    if (!res) { ul.innerHTML = '<li><span>Sin datos.</span></li>'; return; }
    var rows = [];
    function row(cls, label, val) { rows.push('<li class="' + cls + '"><span>' + label + '</span><span class="v">' + val + '</span></li>'); }
    row('sub', 'Precio de venta', fmtMoney(res.precio));
    res.cargos.forEach(function (c) { row('neg', esc(c.label), '− ' + fmtMoney(c.monto)); });
    if (res.iibb > 0) row('neg', 'Ingresos Brutos', '− ' + fmtMoney(res.iibb));
    row('total ' + (res.ganancia >= 0 ? 'good' : 'bad'), 'Ganancia neta', signed(res.ganancia));
    ul.innerHTML = rows.join('');
  }

  function renderDeposit(res) {
    var el = $('#deposit');
    if (!res) { el.innerHTML = ''; return; }
    el.innerHTML = '<h2>Te acreditan</h2><div class="amount">' + fmtMoney(res.acreditado) + '</div><div class="when">Disponible en ' + res.dias + ' días.</div>';
  }

  async function renderEscenarios() {
    var tbl = $('#escenarios');
    try {
      var rows = await window.MatoliAPI.escenariosCuotas(buildInp(state), state.modo, objetivoDe(state));
      $('#escenarios-card').hidden = false;
      tbl.innerHTML = '<thead><tr><th>Cuotas</th><th>Precio</th><th>Ganancia</th></tr></thead><tbody>' +
        rows.map(function (r) {
          if (!r.resultado) return '<tr><td>' + esc(r.cuota.label) + '</td><td colspan="2">No alcanzable</td></tr>';
          return '<tr><td>' + esc(r.cuota.label) + '</td><td>' + fmtMoney(r.resultado.precio) + '</td><td>' + signed(r.resultado.ganancia) + '</td></tr>';
        }).join('') + '</tbody>';
    } catch(e) {}
  }

  function dynamicTexts(res) {
    var isMargen = state.objetivoTipo === 'margen';
    $('#objUnidad').textContent = isMargen ? '%' : '$';
    $('#lbl-objValor').textContent = isMargen ? 'Margen objetivo' : 'Ganancia objetivo';
    var p = res ? res.precio : num(state.precio);
    var oblig = state.condicion !== 'usado' && p >= D.meta.umbralEnvioGratis;
    $('[data-f="envioGratis"]').disabled = oblig;
    if (oblig) { state.envioGratis = true; syncInputs(); }
  }

  function renderAvisos(res) {
    var div = $('#avisos'); div.innerHTML = '';
    if (!res) return;
    res.avisos.forEach(function(a) { 
      var n = document.createElement('div'); n.className = 'note warn'; n.textContent = a; div.appendChild(n); 
    });
  }

  function renderMobileBar(res) {
    var bar = $('#mobile-bar');
    if (!res) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.className = 'mobile-bar ' + (res.ganancia >= 0 ? 'good' : 'bad');
    $('#mb-label').textContent = state.modo === 'objetivo' ? 'Precio sugerido' : 'Ganancia';
    $('#mb-value').textContent = state.modo === 'objetivo' ? fmtMoney(res.precio) : signed(res.ganancia);
  }

  /* --- Categorías --- */
  function renderCategoriaHint(cat) {
    var el = $('#hint-categoria');
    if (!cat) { el.textContent = 'Buscá tu categoría para mayor precisión.'; return; }
    el.innerHTML = '<span class="cat-chip"><span>' + (cat.exacto ? '' : '≈ ') + fmtPct(cat.cargoPct) + '</span><button type="button" id="btn-cat-clear">×</button></span>';
    $('#btn-cat-clear').onclick = function() { state.categoriaId = ''; renderCategoriaHint(null); update(); };
  }

  async function initCategoria() {
    var input = $('#f-categoria'), list = $('#cat-list');
    input.addEventListener('input', async function() {
      var q = input.value.trim();
      if (q.length < 2) { list.hidden = true; return; }
      var results = await window.MatoliAPI.buscarCategorias(q);
      list.innerHTML = results.map(function(r) {
        return '<li data-id="'+r.id+'"><span>'+esc(r.leafName)+'</span><small>'+fmtPct(r.cargoPct)+'</small></li>';
      }).join('');
      list.hidden = false;
    });
    list.addEventListener('mousedown', async function(e) {
      var li = e.target.closest('li');
      if (li) {
        var cat = await window.MatoliAPI.getCategoriaPorId(li.dataset.id);
        state.categoriaId = cat.id; state.cargoPct = String(cat.cargoPct);
        renderCategoriaHint(cat);
        list.hidden = true; input.value = '';
        syncInputs(); update();
      }
    });
  }

  /* --- Productos --- */
  async function renderProductos() {
    var tbl = $('#tabla-productos');
    $('#productos-vacio').hidden = productos.length > 0;
    if (!productos.length) { tbl.innerHTML = ''; return; }
    
    var rows = await Promise.all(productos.map(async function(p) {
      var res = await window.MatoliAPI.calcular(Object.assign({}, state, p.campos), p.campos.precio);
      return { p: p, res: res };
    }));

    tbl.innerHTML = '<thead><tr><th>Producto</th><th>Precio</th><th>Ganancia</th><th>Acciones</th></tr></thead><tbody>' +
      rows.map(function(r) {
        return '<tr><td>'+esc(r.p.campos.nombre)+'</td><td>'+fmtMoney(r.res.precio)+'</td><td class="'+(r.res.ganancia>=0?'good':'bad')+'">'+signed(r.res.ganancia)+'</td>' +
          '<td><button class="btn" onclick="MatoliApp.cargar(\''+r.p.id+'\')">Abrir</button></td></tr>';
      }).join('') + '</tbody>';
  }

  /* --- Tarifas --- */
  function renderTarifas() {
    var cont = $('#tarifas-content');
    cont.innerHTML = '<div class="card"><h2>Tarifas Vigentes</h2><p>Actualizado: ' + fmtDate(D.meta.actualizado) + '</p></div>';
  }

  /* --- Tabs --- */
  function switchTab(name, fromHash) {
    $$('.tabpanel').forEach(function(p) { p.hidden = p.id !== 'tab-' + name; });
    $$('.tab').forEach(function(b) { b.setAttribute('aria-selected', b.dataset.tab === name); });
    if (name === 'productos') renderProductos();
    if (!fromHash) location.hash = name;
  }

  /* --- Inicialización --- */
  async function init() {
    try {
      // Intentar despertar al backend primero
      try {
        console.log("Intentando despertar backend en:", window.MatoliAPI.getBaseUrl());
        await fetch(window.MatoliAPI.getBaseUrl() + '/wake');
      } catch (e) { console.log("Error al despertar:", e); }
      
      // Ocultar el loader
      var loader = document.getElementById('loader');
      if (loader) loader.style.display = 'none';

      D = await window.MatoliAPI.getTarifas();
      initControls();
      syncInputs();
      bindControls();
      initCategoria();
      if (state.categoriaId) {
        var c = await window.MatoliAPI.getCategoriaPorId(state.categoriaId);
        renderCategoriaHint(c);
      }
      update();
    } catch(e) { 
      var loader = document.getElementById('loader');
      if (loader) loader.innerHTML = '<h1>Error de conexión</h1>';
      toast('Error de conexión'); 
    }
  }

  function initControls() {
    fillOptions($('#f-cuotas'), D.cuotas, function(c){return c.id;}, function(c){return c.label;});
    fillOptions($('#f-flexZona'), D.flex.zonas, function(z){return z.id;}, function(z){return z.label;});
    fillOptions($('#f-mpPlazo'), D.mp.plazos, function(p){return p.id;}, function(p){return p.label;});
  }

  function fillOptions(sel, items, valFn, lblFn) {
    sel.innerHTML = items.map(function(i){ return '<option value="'+valFn(i)+'">'+esc(lblFn(i))+'</option>'; }).join('');
  }

  function syncInputs() {
    $$('[data-f]').forEach(function(el) {
      var v = state[el.dataset.f];
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.type === 'radio') el.checked = el.value === String(v);
      else el.value = v;
    });
  }

  function bindControls() {
    $$('[data-f]').forEach(function(el) {
      el.addEventListener('input', function() {
        state[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
        saveJSON(STORE_STATE, state);
        update();
      });
    });
    $$('.tab').forEach(function(b) { b.onclick = function() { switchTab(b.dataset.tab); }; });
    $('#btn-limpiar').onclick = function() { state = Object.assign({}, DEFAULTS); editingId = null; syncInputs(); update(); };
    $('#mb-go').onclick = function() { $('#results').scrollIntoView({ behavior: 'smooth' }); };
  }

  function applyVisibility() {
    $$('[data-show]').forEach(function(el) {
      var parts = el.dataset.show.split('=');
      el.hidden = String(state[parts[0]]) !== parts[1];
    });
  }

  function persistProductos() { saveJSON(STORE_PROD, productos); $('#count-productos').textContent = productos.length; }
  
  function toast(m) { alert(m); } // Simplificado para este ejemplo

  // Exponer algunas funciones globalmente para los onclick de la tabla
  window.MatoliApp = {
    cargar: function(id) {
      var p = productos.find(function(x){return x.id === id;});
      if(p) { state = Object.assign({}, DEFAULTS, p.campos); editingId = id; syncInputs(); update(); switchTab('calc'); }
    }
  };

  init();
})();
