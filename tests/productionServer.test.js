import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createCommerceStaticServer } from "../src/staticServer.mjs";

const listen = (server) => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    server.off("error", reject);
    resolve(server.address().port);
  });
});

const close = (server) => new Promise((resolve, reject) => {
  server.close((error) => (error ? reject(error) : resolve()));
});

test("el servidor SPA entrega index para rutas React y mantiene el header OAuth requerido", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vidkar-commerce-static-"));
  await writeFile(path.join(root, "index.html"), "<!doctype html><div id=app>commerce</div>");
  const server = createCommerceStaticServer(root);
  const port = await listen(server);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/empresa`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /commerce/);
    assert.equal(response.headers.get("cross-origin-opener-policy"), "same-origin-allow-popups");
    assert.equal(response.headers.get("cache-control"), "no-cache");
  } finally {
    await close(server);
    await rm(root, { force: true, recursive: true });
  }
});

test("sirve assets con MIME y caché y no hace fallback de assets inexistentes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vidkar-commerce-static-"));
  await writeFile(path.join(root, "index.html"), "<!doctype html><div id=app></div>");
  await mkdir(path.join(root, "assets"));
  await writeFile(path.join(root, "assets", "app.js"), "console.log('ok')");
  const server = createCommerceStaticServer(root);
  const port = await listen(server);

  try {
    const asset = await fetch(`http://127.0.0.1:${port}/assets/app.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("content-type"), /javascript/);
    assert.match(asset.headers.get("cache-control"), /immutable/);
    const missing = await fetch(`http://127.0.0.1:${port}/assets/missing.js`);
    assert.equal(missing.status, 404);
    assert.equal(await missing.text(), "Not found");
  } finally {
    await close(server);
    await rm(root, { force: true, recursive: true });
  }
});

test("rechaza traversal, métodos mutantes y no sirve archivos fuera de dist", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "vidkar-commerce-static-"));
  await writeFile(path.join(root, "index.html"), "<!doctype html><div id=app></div>");
  const server = createCommerceStaticServer(root);
  const port = await listen(server);

  try {
    const traversal = await fetch(`http://127.0.0.1:${port}/%2e%2e/.env`);
    assert.equal(traversal.status, 404);
    const mutation = await fetch(`http://127.0.0.1:${port}/`, { method: "POST" });
    assert.equal(mutation.status, 405);
    assert.equal(mutation.headers.get("allow"), "GET, HEAD");
  } finally {
    await close(server);
    await rm(root, { force: true, recursive: true });
  }
});
