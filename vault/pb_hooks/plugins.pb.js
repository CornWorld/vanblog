/// <reference path="./lib/vanblog.d.ts" />

// ============================================================================
// Vanblog Plugin Loader — Go-level $vanblog library
// ============================================================================

// Nav aggregation endpoint — collects nav items registered by all plugins.
// Each plugin's pb_hooks/{name}.pb.js calls $vanblog.addNavItems() at load time;
// this endpoint returns the aggregated list to the frontend.
routerAdd("GET", "/_plugin/nav", function (e) {
  var items = $vanblog.getNavItems();
  return e.json(200, { items: items });
});

console.log("[plugins] $vanblog library ready");
