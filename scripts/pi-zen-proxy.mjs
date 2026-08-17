#!/usr/bin/env node
import { createServer } from "node:http";
import { request as httpsRequest } from "node:https";

const port = parseInt(process.env.VANBLOG_PI_PROXY_PORT || "4330", 10);
const target = "https://opencode.ai";

createServer((clientReq, clientRes) => {
  const options = { method: clientReq.method, headers: { ...clientReq.headers } };
  delete options.headers.authorization;
  delete options.headers.host;
  const proxy = httpsRequest(target + clientReq.url, options, (proxyRes) => {
    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(clientRes);
  });
  proxy.on("error", (error) => {
    if (!clientRes.headersSent) clientRes.writeHead(502);
    clientRes.end(JSON.stringify({ error: error.message }));
  });
  clientReq.pipe(proxy);
}).listen(port, "127.0.0.1", () => {
  console.log(`[pi-proxy] listening on http://127.0.0.1:${port} → ${target}`);
});
