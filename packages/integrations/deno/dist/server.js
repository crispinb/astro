import { App } from "astro/app";
import { Server } from "https://deno.land/std@0.167.0/http/server.ts";
import { fetch } from "https://deno.land/x/file_fetch/mod.ts";
let _server = void 0;
let _startPromise = void 0;
function start(manifest, options) {
  if (options.start === false) {
    return;
  }
  const clientRoot = new URL("../client/", import.meta.url);
  const app = new App(manifest);
  const handler = async (request, connInfo) => {
    var _a;
    if (app.match(request)) {
      let ip = (_a = connInfo == null ? void 0 : connInfo.remoteAddr) == null ? void 0 : _a.hostname;
      Reflect.set(request, Symbol.for("astro.clientAddress"), ip);
      const response = await app.render(request);
      if (app.setCookieHeaders) {
        for (const setCookieHeader of app.setCookieHeaders(response)) {
          response.headers.append("Set-Cookie", setCookieHeader);
        }
      }
      return response;
    }
    const url = new URL(request.url);
    const localPath = new URL("./" + app.removeBase(url.pathname), clientRoot);
    const fileResp = await fetch(localPath.toString());
    if (fileResp.status == 404) {
      const response = await app.render(request);
      if (app.setCookieHeaders) {
        for (const setCookieHeader of app.setCookieHeaders(response)) {
          response.headers.append("Set-Cookie", setCookieHeader);
        }
      }
      return response;
    } else {
      if (options.staticCacheForSeconds) {
        fileResp.headers.append("Cache-control", `public, max-age=${options.staticCacheForSeconds}, immutable`);
      }
      return fileResp;
    }
  };
  const port = options.port ?? 8085;
  _server = new Server({
    port,
    hostname: options.hostname ?? "0.0.0.0",
    handler
  });
  _startPromise = Promise.resolve(_server.listenAndServe());
  console.error(`Server running on port ${port}`);
}
function createExports(manifest, options) {
  const app = new App(manifest);
  return {
    async stop() {
      if (_server) {
        _server.close();
        _server = void 0;
      }
      await Promise.resolve(_startPromise);
    },
    running() {
      return _server !== void 0;
    },
    async start() {
      return start(manifest, options);
    },
    async handle(request) {
      return app.render(request);
    }
  };
}
export {
  createExports,
  start
};
