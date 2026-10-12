/*
 * MATOLI API Client · js/api.js
 * ---------------------------------------------------------------------------
 * Este cliente abstrae todas las llamadas al backend de .NET para que
 * el resto de la interfaz (app.js) interactúe con él de forma transparente.
 * 
 * Además, implementa autenticación JWT y almacenamiento local en caché de 
 * las categorías y las tarifas para un rendimiento óptimo.
 */

window.MatoliAPI = (function () {
  'use strict';

  // Configuración automática para desarrollo local o producción
  var API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5191/api'
    : 'https://calculadora-ml-back.onrender.com/api';

  var cache = {
    tarifas: null,
    buscarCategorias: {},
    categoriasPorId: {}
  };

  function request(endpoint, method, body) {
    var options = {
      method: method || 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    // Añadir token si existe
    var token = localStorage.getItem('matoli.token');
    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    return fetch(API_BASE + endpoint, options)
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (err) {
            // Si es 401 en cualquier endpoint que no sea login, limpiar sesión
            if (res.status === 401 && endpoint !== '/auth/login') {
              localStorage.removeItem('matoli.token');
              localStorage.removeItem('matoli.user');
              if (window.onMatoliUnauthorized) {
                window.onMatoliUnauthorized();
              }
            }
            throw new Error(err.error || (res.status === 401 ? 'Credenciales incorrectas o sesión no autorizada' : 'Ocurrió un error en la solicitud.'));
          }).catch(function (e) {
            if (e.message) throw e;
            if (res.status === 401 && endpoint !== '/auth/login') {
              localStorage.removeItem('matoli.token');
              localStorage.removeItem('matoli.user');
              if (window.onMatoliUnauthorized) {
                window.onMatoliUnauthorized();
              }
            }
            throw new Error('Error ' + res.status + ' en el servidor backend.');
          });
        }
        return res.json();
      });
  }

  return {
    setBaseUrl: function (url) {
      API_BASE = url;
    },

    getBaseUrl: function () {
      return API_BASE;
    },

    /* --- Auth --- */
    login: function (username, password) {
      return request('/auth/login', 'POST', { username: username, password: password })
        .then(function (data) {
          if (data && data.token) {
            localStorage.setItem('matoli.token', data.token);
            localStorage.setItem('matoli.user', data.username || username);
          }
          return data;
        });
    },

    verifyToken: function () {
      return request('/auth/verify');
    },

    logout: function () {
      localStorage.removeItem('matoli.token');
      localStorage.removeItem('matoli.user');
      cache.tarifas = null;
      cache.buscarCategorias = {};
      cache.categoriasPorId = {};
    },

    getToken: function () {
      return localStorage.getItem('matoli.token');
    },

    getUser: function () {
      return localStorage.getItem('matoli.user') || 'admin';
    },

    isAuthenticated: function () {
      return !!localStorage.getItem('matoli.token');
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
