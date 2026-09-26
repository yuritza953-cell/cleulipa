/**
 * Identificador de aplicación (solo uso interno del cliente Discord).
 * Ofuscación multi-capa. El Client ID es público por diseño en Discord;
 * esto solo dificulta extracción casual del fuente.
 * NUNCA incluir Client Secret aquí.
 */
(function (global) {
  "use strict";

  // --- capa 1: tabla opaca (valores + ruido intercalado) ---
  var _t = [
    1049, 75, 1053, 92, 1051, 109, 1049, 36, 1055, 53, 1049, 70, 1056, 87,
    1049, 104, 1056, 121, 1049, 48, 1050, 65, 1049, 82, 1051, 99, 1055, 116,
    1048, 43, 1052, 60, 1050, 77, 1049, 94, 1050, 111
  ];

  // --- capa 2: máscaras derivadas en runtime (no constantes literales del ID) ---
  function _m(i) {
    return ((i * 17 + 42) % 90) + 33;
  }

  function _strip(arr) {
    var out = [];
    for (var i = 0; i < arr.length; i += 2) {
      out.push(arr[i] - 1000);
    }
    return out;
  }

  // --- capa 3: verificación cruzada con aritmética de bloques ---
  function _blocks() {
    var a = (0x5A3C19 ^ 5794378);
    var b = (0x2F8E41 ^ 2356616);
    var c = (0x1C7A03 ^ 2424727);
    return String(a) + String(b) + String(c);
  }

  // --- capa 4: ensamblado + comprobación; sin variable global con el valor ---
  function _assemble() {
    var codes = _strip(_t);
    var s = "";
    for (var i = 0; i < codes.length; i++) {
      // anti-tamper leve: el ruido esperado debe coincidir con _m
      if (_t[i * 2 + 1] !== _m(i)) {
        // datos corruptos → fallback a bloques
        return _blocks();
      }
      s += String.fromCharCode(codes[i]);
    }
    var chk = _blocks();
    return s === chk ? s : chk;
  }

  // Solo exporta un getter; no deja el string en window
  var _cache = null;
  function resolveApplicationId() {
    if (_cache !== null) return _cache;
    _cache = _assemble();
    return _cache;
  }

  // API mínima
  global.__cid = {
    resolve: resolveApplicationId
  };
})(typeof window !== "undefined" ? window : this);
