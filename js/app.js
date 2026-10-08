/* MATOLI · Interfaz de la calculadora (Versión Backend .NET) */
(function () {
  'use strict';

  var D = null; 
  var STORE_STATE = 'matoli.estado.v2';
  var STORE_PROD = 'matoli.productos.v1';
  var STORE_PROFILE = 'matoli.perfil.v1';

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

  function isProfileAtDefaults() {
    var defaults = {
      reputacion: 'sinrep', condFiscal: 'cf', ivaProducto: '21', ivaIncluido: true,
      iibbPct: '0', credDeb: false, adsPct: '0', otrosPct: '0', fijoMensual: '0', unidadesMes: '0'
    };
    return PROFILE_KEYS.every(function(k) {
      return String(state[k]) === String(defaults[k]);
    });
  }

  function updateProfileWarning() {
    var warningEl = $('#profile-warning');
    if (warningEl) {
      warningEl.hidden = !isProfileAtDefaults();
    }
  }

  function actualizarPesoInfo() {
    var p = num(state.peso);
    var vol = (num(state.largo) * num(state.ancho) * num(state.alto)) / 4000;
    var el = $('#peso-info');
    if (!el) return;
    
    // Si no hay peso seleccionado, mostramos un mensaje
    if (p === 0 && vol === 0) {
      el.textContent = 'Seleccioná el peso o ingresá las dimensiones para calcular el envío.';
      return;
    }
    
    var facturable = Math.max(p, vol);
    
    var tramoTxt = "";
    if (D && D.pesos) {
      for (var i = 0; i < D.pesos.length; i++) {
        if (D.pesos[i] === null || facturable <= D.pesos[i]) {
          tramoTxt = D.pesos[i] ? "Tramo: hasta " + D.pesos[i] + " kg" : "Tramo: más de 180 kg";
          break;
        }
      }
    }

    var html = 'Peso seleccionado: ' + (p > 0 ? p + ' kg' : '0 kg');
    if (vol > 0) html += ' | Volumétrico: ' + vol.toFixed(2) + ' kg';
    html += ' ➔ <strong>Facturable: ' + facturable.toFixed(2) + ' kg</strong>';
    if (tramoTxt) html += ' <br><span class="badge">' + tramoTxt + '</span>';
    el.innerHTML = html;
  }

  /* --- Lógica de actualización --- */
  function renderLoading() {
    var h = $('#hero'); 
    h.className = 'hero';
    h.innerHTML = '<div class="lbl">Calculando...</div><div class="big" style="display: flex; align-items: center; justify-content: center; min-height: 50px;"><div class="spinner" style="margin-top: 0; width: 36px; height: 36px; border-width: 3px;"></div></div><div class="sub">Actualizando resultados...</div>';
    
    var ul = $('#breakdown');
    ul.innerHTML = '<li><span>Calculando...</span><span class="v"><div class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin: 0; display: inline-block;"></div></span></li>';
    
    var el = $('#deposit');
    el.innerHTML = '<h2>Te acreditan</h2><div class="amount" style="color: var(--muted);">-</div><div class="when">Calculando...</div>';

    var bar = $('#mobile-bar');
    bar.hidden = false;
    bar.className = 'mobile-bar';
    $('#mb-label').textContent = 'Calculando...';
    $('#mb-value').textContent = '...';

    var tbl = $('#escenarios');
    $('#escenarios-card').hidden = false;
    tbl.innerHTML = '<thead><tr><th>Cuotas</th><th>Precio</th><th>Ganancia</th></tr></thead><tbody><tr><td colspan="3" style="text-align: center; padding: 15px;"><div class="spinner" style="margin: 0 auto; width: 24px; height: 24px; border-width: 2px;"></div></td></tr></tbody>';
  }

  async function update() {
    var counter = ++updateCounter;
    applyVisibility();
    try {
      var inp = buildInp(state);
      var res = null;
      var needsApi = (state.modo === 'objetivo') || (state.modo === 'precio' && num(state.precio) > 0);
      
      if (needsApi) {
        renderLoading();
      }

      if (state.modo === 'objetivo') res = await window.MatoliAPI.resolverPrecio(inp, objetivoDe(state));
      else if (num(state.precio) > 0) res = await window.MatoliAPI.calcular(inp, state.precio);
      
      if (counter !== updateCounter) return;
      actualizarPesoInfo();
      lastResult = res;
      renderApp(res);
    } catch (err) {
      if (counter === updateCounter) {
        $('#hero').innerHTML = '<div class="sub" style="color: var(--bad);">Error: ' + esc(err.message) + '</div>';
        $('#breakdown').innerHTML = '<li><span>Error al calcular</span></li>';
        $('#deposit').innerHTML = '';
        $('#escenarios-card').hidden = true;
        $('#mobile-bar').hidden = true;
      }
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
    updateProfileWarning();
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
    if (isProfileAtDefaults()) {
      var n = document.createElement('div');
      n.className = 'note err';
      n.textContent = '⚠️ Alerta de Seguridad: Tu perfil de vendedor no está configurado (tiene valores por defecto). Completá esta sección para obtener costos reales.';
      div.appendChild(n);
    }
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
    if (!cat) { el.textContent = 'Buscá tu categoría para aplicar el porcentaje correcto automáticamente.'; $('#f-cargoPct').value = state.cargoPct; return; }
    
    var fixedText = (cat.fixedFee !== undefined && cat.fixedFee !== null && cat.fixedFee > 0) ? ' + $ ' + cat.fixedFee + ' fijo por unidad' : '';
    el.innerHTML = '<span class="cat-chip"><span>' + esc(cat.ruta) + ' — <strong>' + (cat.exacto ? '' : '≈ ') + fmtPct(cat.cargoPct) + fixedText + '</strong></span><button type="button" id="btn-cat-clear">×</button></span>';
    $('#btn-cat-clear').onclick = function() { state.categoriaId = ''; state.cargoPct = '14'; renderCategoriaHint(null); syncInputs(); update(); };
  }

  async function initCategoria() {
    var input = $('#f-categoria'), list = $('#cat-list');
    input.addEventListener('input', async function() {
      var q = input.value.trim();
      if (q.length < 2) { list.hidden = true; return; }
      var results = await window.MatoliAPI.buscarCategorias(q);
      list.innerHTML = results.map(function(r) {
        return '<li data-id="'+r.id+'"><div class="nm"><strong>'+esc(r.leafName)+'</strong><small>'+esc(r.parentPath)+'</small></div><div class="pc'+(r.exacto?'':' est')+'">'+fmtPct(r.cargoPct)+'</div></li>';
      }).join('');
      list.hidden = false;
    });
    list.addEventListener('mousedown', async function(e) {
      var li = e.target.closest('li');
      if (li) {
        var cat = await window.MatoliAPI.getCategoriaPorId(li.dataset.id);
        state.categoriaId = cat.id; 
        state.cargoPct = String(cat.cargoPct);
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
    
    tbl.innerHTML = '<thead><tr><th>Producto</th><th>Precio</th><th>Ganancia</th><th>Acciones</th></tr></thead><tbody><tr><td colspan="4" style="text-align: center; padding: 20px;"><div class="spinner" style="margin: 0 auto; width: 30px; height: 30px; border-width: 3px;"></div></td></tr></tbody>';

    var rows = await Promise.all(productos.map(async function(p) {
      var res = await window.MatoliAPI.calcular(Object.assign({}, state, p.campos), p.campos.precio);
      return { p: p, res: res };
    }));

    tbl.innerHTML = '<thead><tr><th>Producto</th><th>Precio</th><th>Ganancia</th><th>Acciones</th></tr></thead><tbody>' +
      rows.map(function(r) {
        return '<tr><td>'+esc(r.p.campos.nombre)+'</td><td>'+fmtMoney(r.res.precio)+'</td><td class="'+(r.res.ganancia>=0?'good':'bad')+'">'+signed(r.res.ganancia)+'</td>' +
          '<td class="actions-cell">' +
            '<button class="btn small" onclick="MatoliApp.cargar(\''+r.p.id+'\')">Abrir</button>' +
            '<button class="btn small btn-danger" onclick="MatoliApp.eliminar(\''+r.p.id+'\')">Eliminar</button>' +
          '</td></tr>';
      }).join('') + '</tbody>';
  }

  /* --- Tarifas --- */
  async function renderTarifas() {
    var cont = $('#tarifas-content');
    if (!D) return;

    var html = '<div class="card"><h2>Tarifas Vigentes</h2><p>Actualizado: ' + fmtDate(D.meta.actualizado) + '</p></div>';
    
    // Categorías Summary
    try {
        var catMeta = await window.MatoliAPI.getMetaCategorias();
        html += '<div class="card"><h3>Resumen de Cargos por Categoría</h3><ul>';
        html += '<li>Categorías totales: ' + catMeta.exactas + '</li>';
        html += '<li>Cargo mínimo: ' + fmtPct(catMeta.resumen.min) + '</li>';
        html += '<li>Cargo mediano: ' + fmtPct(catMeta.resumen.mediana) + '</li>';
        html += '<li>Cargo máximo: ' + fmtPct(catMeta.resumen.max) + '</li>';
        html += '</ul><p class="hint">Debido a la gran cantidad de categorías, el cargo específico se calcula al buscar en la calculadora. El cargo puede incluir un monto fijo según la categoría.</p></div>';
    } catch(e) {}

    // Meta & Cargo por vender
    html += '<div class="card"><h3>Parámetros Generales</h3><ul>';
    html += '<li>Umbral Envío Gratis: ' + fmtMoney(D.meta.umbralEnvioGratis) + '</li>';
    html += '<li>Cargo por Vender (Base): ' + D.cargoPorVender.defaultPct + '%</li>';
    html += '<li>Rango de Cargo por Vender: ' + D.cargoPorVender.minPct + '% - ' + D.cargoPorVender.maxPct + '%</li>';
    html += '</ul></div>';

    // Cuotas
    html += '<div class="card"><h3>Costo por Cuotas</h3><table class="table"><thead><tr><th>Opción</th><th>Cargo (%)</th></tr></thead><tbody>';
    D.cuotas.forEach(function(c) {
      html += '<tr><td>' + esc(c.label) + '</td><td>' + c.pct + '%</td></tr>';
    });
    html += '</tbody></table></div>';

    // Envío (Ejemplo)
    html += '<div class="card"><h3>Costo de Envío (Ejemplo: Reputación Verde)</h3><div class="table-scroll"><table class="table"><thead><tr><th>Peso (kg)</th><th>Precio</th></tr></thead><tbody>';
    D.envio.verde.slice(0, 5).forEach(function(row) {
        html += '<tr><td>' + (row[0] ? row[0] + ' kg' : 'Más de 180 kg') + '</td><td>' + fmtMoney(row[1]) + '</td></tr>';
    });
    html += '</tbody></table></div><p class="hint">El costo de envío varía según reputación, categoría y peso. Los valores exactos se calculan automáticamente en la calculadora.</p></div>';

    // Full
    html += '<div class="card"><h3>Full · Almacenamiento</h3><table class="table"><thead><tr><th>Tamaño</th><th>Tarifa diaria</th></tr></thead><tbody>';
    D.full.almacenamientoDiario.forEach(function(f) {
      html += '<tr><td>' + esc(f.label) + '</td><td>' + f.tarifa + '</td></tr>';
    });
    html += '</tbody></table></div>';

    cont.innerHTML = html;
  }

  /* --- Tabs --- */
  function switchTab(name, fromHash) {
    $$('.tabpanel').forEach(function(p) { p.hidden = p.id !== 'tab-' + name; });
    $$('.tab').forEach(function(b) { b.setAttribute('aria-selected', b.dataset.tab === name); });
    if (name === 'productos') renderProductos();
    if (name === 'tarifas') renderTarifas();
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

      // Cargar estado previo y aplicar perfil guardado
      var savedState = loadJSON(STORE_STATE);
      var savedProfile = loadJSON(STORE_PROFILE);
      if (savedState) {
        state = Object.assign({}, DEFAULTS, savedState);
      }
      if (savedProfile) {
        PROFILE_KEYS.forEach(function(k) {
          if (savedProfile[k] !== undefined) {
            state[k] = savedProfile[k];
          }
        });
      }

      persistProductos();
      syncInputs();
      bindControls();
      initCategoria();
      if (state.categoriaId) {
        var c = await window.MatoliAPI.getCategoriaPorId(state.categoriaId);
        renderCategoriaHint(c);
      } else {
        renderCategoriaHint(null);
      }
      updateProfileWarning();
      actualizarPesoInfo();
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
        var key = el.dataset.f;
        state[key] = el.type === 'checkbox' ? el.checked : el.value;
        
        // Guardar el perfil por separado si el input que cambió es parte del perfil
        if (PROFILE_KEYS.indexOf(key) !== -1) {
          var profileObj = {};
          PROFILE_KEYS.forEach(function(pk) {
            profileObj[pk] = state[pk];
          });
          saveJSON(STORE_PROFILE, profileObj);
        }
        
        saveJSON(STORE_STATE, state);
        updateProfileWarning();
        actualizarPesoInfo();
        update();
      });
    });
    $$('.tab').forEach(function(b) { b.onclick = function() { switchTab(b.dataset.tab); }; });
    $('#btn-limpiar').onclick = function() {
      var savedProfile = loadJSON(STORE_PROFILE);
      var newState = Object.assign({}, DEFAULTS);
      if (savedProfile) {
        PROFILE_KEYS.forEach(function(k) {
          if (savedProfile[k] !== undefined) {
            newState[k] = savedProfile[k];
          }
        });
      }
      state = newState;
      editingId = null;
      syncInputs();
      updateProfileWarning();
      actualizarPesoInfo();
      update();
    };
    $('#mb-go').onclick = function() { $('#results').scrollIntoView({ behavior: 'smooth' }); };
    
    // Botón Guardar con validaciones de UX
    $('#btn-guardar').onclick = function() {
      var campos = buildInp(state);
      
      if (!campos.nombre || campos.nombre.trim() === '') {
        showModal({
          icon: '⚠️',
          title: 'Falta información',
          message: 'Por favor, ponéle un nombre al producto para identificarlo.',
          okText: 'Entendido',
          onOk: function() { $('#f-nombre').focus(); }
        });
        return;
      }
      if (!campos.costo || campos.costo <= 0) {
        showModal({
          icon: '⚠️',
          title: 'Falta información',
          message: 'Por favor, ingresá el costo del producto.',
          okText: 'Entendido',
          onOk: function() { $('#f-costo').focus(); }
        });
        return;
      }
      if (state.modo === 'precio' && (!campos.precio || campos.precio <= 0)) {
        showModal({
          icon: '⚠️',
          title: 'Falta información',
          message: 'Ingresá el precio de venta para poder calcular.',
          okText: 'Entendido',
          onOk: function() { $('#f-precio').focus(); }
        });
        return;
      }

      if (editingId) {
        var idx = productos.findIndex(function(p) { return p.id === editingId; });
        if (idx !== -1) productos[idx].campos = Object.assign({}, campos);
        showModal({
          icon: '🎉',
          title: '¡Producto actualizado!',
          message: 'Los cambios se guardaron correctamente en "Mis productos".',
          okText: 'Aceptar'
        });
      } else {
        productos.push({ id: Date.now().toString(), campos: Object.assign({}, campos) });
        showModal({
          icon: '🎉',
          title: '¡Producto guardado!',
          message: 'El producto ya está disponible en la sección "Mis productos".',
          okText: 'Ver mis productos',
          onOk: function() {
            switchTab('productos');
          }
        });
      }
      
      persistProductos();
      editingId = null;
    };

    // Botones de Exportar/Importar
    $('#btn-csv').onclick = exportarProductos;
    $('#btn-backup').onclick = exportarProductos;
    $('#file-import').onchange = importarProductos;
  }

  function applyVisibility() {
    $$('[data-show]').forEach(function(el) {
      var parts = el.dataset.show.split('=');
      var key = parts[0];
      var possibleValues = parts[1].split('|');
      el.hidden = possibleValues.indexOf(String(state[key])) === -1;
    });
  }

  function persistProductos() { 
    saveJSON(STORE_PROD, productos); 
    var countEl = $('#count-productos');
    if (countEl) countEl.textContent = productos.length; 
    renderProductos();
  }

  function eliminarProducto(id) {
    showModal({
      icon: '🗑️',
      title: 'Eliminar producto',
      message: '¿Estás seguro de que querés eliminar este producto de tus guardados?',
      okText: 'Sí, eliminar',
      showCancel: true,
      onOk: function() {
        productos = productos.filter(function(p) { return p.id !== id; });
        persistProductos();
        showModal({
          icon: '✅',
          title: '¡Eliminado!',
          message: 'El producto fue eliminado correctamente.',
          okText: 'Aceptar'
        });
      }
    });
  }

  function showModal(opts) {
    var oldOverlay = $('.matoli-overlay');
    if (oldOverlay) oldOverlay.remove();
    var oldPopup = $('.matoli-popup');
    if (oldPopup) oldPopup.remove();

    var overlay = document.createElement('div');
    overlay.className = 'matoli-overlay';
    
    var popup = document.createElement('div');
    popup.className = 'matoli-popup';
    
    var html = '';
    if (opts.icon) html += '<div class="popup-icon">' + opts.icon + '</div>';
    if (opts.title) html += '<h3 class="popup-title">' + esc(opts.title) + '</h3>';
    if (opts.message) html += '<p class="popup-body">' + esc(opts.message) + '</p>';
    
    html += '<div class="popup-actions">';
    if (opts.showCancel) {
      html += '<button type="button" class="btn" id="modal-cancel">Cancelar</button>';
    }
    html += '<button type="button" class="btn primary" id="modal-ok">' + (opts.okText || 'Aceptar') + '</button>';
    html += '</div>';

    popup.innerHTML = html;

    document.body.appendChild(overlay);
    document.body.appendChild(popup);

    setTimeout(function() {
      overlay.classList.add('active');
      popup.classList.add('active');
      $('#modal-ok').focus();
    }, 10);

    function closeModal() {
      overlay.classList.remove('active');
      popup.classList.remove('active');
      setTimeout(function() {
        overlay.remove();
        popup.remove();
      }, 250);
    }

    $('#modal-ok').onclick = function() {
      closeModal();
      if (opts.onOk) opts.onOk();
    };

    if (opts.showCancel) {
      $('#modal-cancel').onclick = function() {
        closeModal();
        if (opts.onCancel) opts.onCancel();
      };
    }

    overlay.onclick = function(e) {
      if (e.target === overlay && opts.allowOverlayClick) {
        closeModal();
        if (opts.onCancel) opts.onCancel();
      }
    };
  }

  function toast(m) { 
    showModal({
      icon: 'ℹ️',
      title: 'Aviso',
      message: m,
      okText: 'Entendido'
    });
  }

  function exportarProductos() {
    var data = JSON.stringify(productos);
    var blob = new Blob([data], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'matoli-productos.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importarProductos(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          productos = imported;
          persistProductos();
          toast('Productos importados correctamente.');
        } else {
          toast('Error: El archivo no tiene el formato correcto.');
        }
      } catch (err) {
        toast('Error al importar: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
  
  function toast(m) { alert(m); } // Simplificado para este ejemplo

  // Exponer algunas funciones globalmente para los onclick de la tabla
  window.MatoliApp = {
    eliminar: eliminarProducto,
    cargar: function(id) {
      var p = productos.find(function(x){return x.id === id;});
      if(p) { 
        var savedProfile = loadJSON(STORE_PROFILE);
        state = Object.assign({}, DEFAULTS, p.campos); 
        if (savedProfile) {
          PROFILE_KEYS.forEach(function(k) {
            if (savedProfile[k] !== undefined) {
              state[k] = savedProfile[k];
            }
          });
        }
        editingId = id; 
        syncInputs(); 
        updateProfileWarning();
        update(); 
        switchTab('calc'); 
      }
    }
  };

  // Actualizar contador apenas cargue el DOM por si la API tarda en responder
  document.addEventListener('DOMContentLoaded', function() {
    var countEl = $('#count-productos');
    if (countEl) countEl.textContent = productos.length;
  });

  init();
})();
