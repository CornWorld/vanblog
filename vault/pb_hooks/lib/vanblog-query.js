// Shared utility: parse query string parameters in PB JSVM.
// The JSVM has no built-in URL/URLSearchParams, so we parse manually.
// Usage:
//   var getQuery = require("./pb_hooks/lib/vanblog-query.js");
//   var page = getQuery(e, "page");

/// <reference path="./vanblog.d.ts" />

module.exports = function getQuery(e, name) {
  try {
    if (e.request && e.request.url) {
      var rawQuery = e.request.url.rawQuery || "";
      if (!rawQuery) return null;
      var pairs = rawQuery.split("&");
      for (var i = 0; i < pairs.length; i++) {
        var eq = pairs[i].indexOf("=");
        if (eq === -1) continue;
        var key = decodeURIComponent(
          pairs[i].substring(0, eq).replace(/\+/g, " ")
        );
        if (key === name) {
          return decodeURIComponent(
            pairs[i].substring(eq + 1).replace(/\+/g, " ")
          );
        }
      }
    }
  } catch {}
  return null;
};
