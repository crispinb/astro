import esbuild from "esbuild";
import * as fs from "fs";
import * as npath from "path";
import { fileURLToPath } from "url";
const SHIM = `globalThis.process = {
	argv: [],
	env: Deno.env.toObject(),
};`;
function getAdapter(args) {
  return {
    name: "@astrojs/deno",
    serverEntrypoint: "@astrojs/deno/server.js",
    args: args ?? {},
    exports: ["stop", "handle", "start", "running"]
  };
}
function createIntegration(args) {
  let _buildConfig;
  let _vite;
  return {
    name: "@astrojs/deno",
    hooks: {
      "astro:config:done": ({ setAdapter, config }) => {
        setAdapter(getAdapter(args));
        _buildConfig = config.build;
        if (config.output === "static") {
          console.warn(`[@astrojs/deno] \`output: "server"\` is required to use this adapter.`);
          console.warn(
            `[@astrojs/deno] Otherwise, this adapter is not required to deploy a static site to Deno.`
          );
        }
      },
      "astro:build:setup": ({ vite, target }) => {
        if (target === "server") {
          _vite = vite;
          vite.resolve = vite.resolve || {};
          vite.resolve.alias = vite.resolve.alias || {};
          const aliases = [{ find: "react-dom/server", replacement: "react-dom/server.browser" }];
          if (Array.isArray(vite.resolve.alias)) {
            vite.resolve.alias = [...vite.resolve.alias, ...aliases];
          } else {
            for (const alias of aliases) {
              vite.resolve.alias[alias.find] = alias.replacement;
            }
          }
          vite.ssr = {
            noExternal: true
          };
        }
      },
      "astro:build:done": async () => {
        var _a, _b, _c;
        const entryUrl = new URL(_buildConfig.serverEntry, _buildConfig.server);
        const pth = fileURLToPath(entryUrl);
        await esbuild.build({
          target: "es2020",
          platform: "browser",
          entryPoints: [pth],
          outfile: pth,
          allowOverwrite: true,
          format: "esm",
          bundle: true,
          external: ["@astrojs/markdown-remark"],
          banner: {
            js: SHIM
          }
        });
        try {
          const chunkFileNames = ((_c = (_b = (_a = _vite == null ? void 0 : _vite.build) == null ? void 0 : _a.rollupOptions) == null ? void 0 : _b.output) == null ? void 0 : _c.chunkFileNames) ?? `chunks/chunk.[hash].mjs`;
          const chunkPath = npath.dirname(chunkFileNames);
          const chunksDirUrl = new URL(chunkPath + "/", _buildConfig.server);
          await fs.promises.rm(chunksDirUrl, { recursive: true, force: true });
        } catch {
        }
      }
    }
  };
}
export {
  createIntegration as default,
  getAdapter
};
