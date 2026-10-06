/*
 * MATOLI API Client · js/api.js
 * ---------------------------------------------------------------------------
 * Este cliente abstrae todas las llamadas al backend de .NET para que
 * el resto de la interfaz (app.js) interactúe con él de forma transparente.
 * 
 * Además, implementa almacenamiento local en caché de las categorías y las tarifas
 * para un rendimiento óptimo e instantáneo tras la primera carga.
 */

window.MatoliAPI = (function () {
  'use strict';

  // En producción (Netlify), Netlify redirigirá las llamadas de /api/* al servidor de .NET.
  // En desarrollo local, se puede apuntar al localhost de .NET o usar el proxy local de Netlify CLI.
  var API_BASE = '/api';

  // Si estás probando de forma local sin usar netlify dev, podés cambiar API_BASE al localhost de dotnet:
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    API_BASE = 'https://calculadora-ml-back.onrender.com/api'; // O el puerto que use tu dotnet run local (ej. 5184, 5000, etc.)
  }

  function request(endpoint, method, body) {
    var options = {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(API_BASE + endpoint, options)
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (err) {
            throw new Error(err.error || 'Ocurrió un error en la solicitud.');
          }).catch(function () {
            throw new Error('Error ' + res.status + ' en el servidor backend.');
          });
        }
        return res.json();
      });
  }

  // Caché en memoria para optimizar búsquedas de categorías recurrentes y las tarifas generales
  var cache = {
    tarifas: null,
    buscarCategorias: {},
    categoriasPorId: {}
  };

  return {
    setBaseUrl: function (url) {
      API_BASE = url;
    },

    getBaseUrl: function () {
      return API_BASE;
    },

    /* --- Tarifas --- */
    getTarifas: function () {
      if (cache.tarifas) return Promise.resolve(cache.tarifas);
      return request('/tarifas')
        .then(function (data) {
          cache.tarifas = data;
          return data;
        });
    },

    /* --- Categorías --- */
    buscarCategorias: function (q, limit) {
      var queryKey = q.trim().toLowerCase() + '::' + (limit || 40);
      if (cache.buscarCategorias[queryKey]) {
        return Promise.resolve(cache.buscarCategorias[queryKey]);
      }
      return request('/categorias/buscar?q=' + encodeURIComponent(q) + '&limit=' + (limit || 40))
        .then(function (data) {
          cache.buscarCategorias[queryKey] = data;
          return data;
        });
    },

    getCategoriaPorId: function (id) {
      if (cache.categoriasPorId[id]) {
        return Promise.resolve(cache.categoriasPorId[id]);
      }
      return request('/categorias/' + encodeURIComponent(id))
        .then(function (data) {
          cache.categoriasPorId[id] = data;
          return data;
        });
    },

    getMetaCategorias: function () {
      return request('/categorias');
    },

    /* --- Motor de cálculo --- */
    calcular: function (input, precio) {
      return request('/calculo/calcular', 'POST', {
        input: input,
        precio: precio
      });
    },

    resolverPrecio: function (input, objetivo) {
      return request('/calculo/resolver-precio', 'POST', {
        input: input,
        objetivo: objetivo
      });
    },

    escenariosCuotas: function (input, modo, objetivo) {
      return request('/calculo/escenarios-cuotas', 'POST', {
        input: input,
        modo: modo,
        objetivo: objetivo
      });
    }
  };
})();
