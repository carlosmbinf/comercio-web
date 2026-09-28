import test from 'node:test';
import assert from 'node:assert/strict';
import { getProductImageSources } from '../src/domain/productImages.js';

const backend = 'https://api.example.test';
const path = '/cdn/storage/Images/image-test/original/image-test.jpg';

test('mantiene imágenes históricas y reintenta archivos nuevos en el servidor conectado', () => {
  const original = `https://old.example.test${path}`;
  assert.deepEqual(getProductImageSources(original, backend), [original, `${backend}${path}`]);
});

test('no duplica solicitudes cuando imágenes y backend comparten origen', () => {
  assert.deepEqual(getProductImageSources(`${backend}${path}`, backend), [`${backend}${path}`]);
  assert.deepEqual(getProductImageSources(path, backend), [`${backend}${path}`]);
});

test('preserva vistas previas locales y no redirige imágenes externas ni otras colecciones', () => {
  for (const source of ['blob:https://shop.example.test/preview', 'https://cdn.example.test/photo.jpg', 'https://old.example.test/cdn/storage/PrivateReceipts/file']) {
    assert.deepEqual(getProductImageSources(source, backend), [source]);
  }
});

test('rechaza fuentes inseguras y no copia parámetros al servidor alternativo', () => {
  for (const source of ['', null, {}, 'javascript:alert(1)', 'data:text/html,test']) {
    assert.deepEqual(getProductImageSources(source, backend), []);
  }
  const original = `https://old.example.test${path}?token=fixture`;
  assert.deepEqual(getProductImageSources(original, backend), [original, `${backend}${path}`]);
  assert.deepEqual(getProductImageSources(original, 'file:///tmp'), [original]);
});