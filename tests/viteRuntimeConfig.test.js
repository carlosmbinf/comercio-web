import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createCommerceViteServerOptions, isVidkarCommerceHost } from "../src/viteRuntimeConfig.js";

test("Vite runtime usa loopback, puerto estricto, host de la tienda y sin HMR en producción", () => {
  const options = createCommerceViteServerOptions({
    commerceHost: "tienda.vidkar.com",
    host: "127.0.0.1",
    mode: "production",
    port: "5237",
    productionRuntime: true,
  });

  assert.equal(options.host, "127.0.0.1");
  assert.equal(options.port, 5237);
  assert.equal(options.strictPort, true);
  assert.deepEqual(options.allowedHosts, ["tienda.vidkar.com"]);
  assert.equal(options.hmr, false);
  assert.equal(options.cors, false);
  assert.ok(options.fs.deny.includes(".env"));
  assert.ok(options.fs.deny.includes("**/.env.*"));
});

test("host fallback local y rechazo de hostnames ajenos a vidkar.com", () => {
  assert.equal(isVidkarCommerceHost("tienda.vidkar.com"), true);
  assert.equal(isVidkarCommerceHost("evil.example"), false);
  assert.equal(isVidkarCommerceHost("tienda.vidkar.com.evil.example"), false);

  const options = createCommerceViteServerOptions({ mode: "development" });
  assert.equal(options.host, "0.0.0.0");
  assert.deepEqual(options.allowedHosts, ["odeshop.vidkar.com"]);
  assert.equal(options.hmr, undefined);
  assert.throws(
    () => createCommerceViteServerOptions({ host: "127.0.0.1", mode: "production", port: 5200, productionRuntime: true }),
    /COMERCIO_HOST/,
  );
  assert.throws(
    () => createCommerceViteServerOptions({ commerceHost: "tienda.vidkar.com", host: "0.0.0.0", mode: "production", port: 5200, productionRuntime: true }),
    /127\.0\.0\.1/,
  );
  assert.doesNotThrow(() => createCommerceViteServerOptions({ mode: "production", port: 5200 }));
});

test("PM2 arranca el servidor Vite directamente, sin depender de dist", async () => {
  const config = await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../ecosystem.config.cjs"), "utf8");

  assert.match(config, /node_modules\/vite\/bin\/vite\.js/);
  assert.match(config, /--strictPort/);
  assert.match(config, /--mode", "production"/);
  assert.match(config, /VIDKAR_PM2_RUNTIME: "1"/);
  assert.doesNotMatch(config, /src\/serve-dist\.mjs/);
});
