import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/empresa/EmpresaMercadoLibrePanel.jsx', import.meta.url), 'utf8');
const start = source.indexOf("  React.useEffect(() => {\n    if (!integration?.enabled || !['pending'");
const end = source.indexOf('\n  React.useEffect(', start + 1);
assert.ok(start >= 0 && end > start);

const loadPolling = (responses) => {
  const state = { timers: [], sync: { status: 'processing', jobId: 'job' }, error: '', calls: 0, cleanup: null };
  new Function('React', 'integration', 'syncState', 'window', 'callMeteor', 'setSyncState', 'setSyncStateError', 'getErrorMessage', source.slice(start, end))(
    { useEffect: (effect) => { state.cleanup = effect(); } },
    { enabled: true },
    state.sync,
    { setTimeout: (callback) => { state.timers.push(callback); return state.timers.length; }, clearTimeout: () => {} },
    async (method) => {
      assert.equal(method, 'comercio.mercadoLibre.estadoSincronizacion');
      state.calls += 1;
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return response;
    },
    (sync) => { state.sync = sync; },
    (error) => { state.error = error; },
    (error, fallback) => error.reason || error.message || fallback,
  );
  return state;
};

test('un 403 terminal deja de mostrar sincronizando y no programa más consultas', async () => {
  const state = loadPolling([{ status: 'failed', lastErrorCode: 'forbidden', message: 'Acceso denegado' }]);
  await state.timers.shift()();
  assert.equal(state.sync.status, 'failed');
  assert.equal(state.timers.length, 0);
  assert.equal(state.error, '');
});

test('un error al consultar progreso es visible, conserva estado y permite recuperarse', async () => {
  const state = loadPolling([new Error('Sin conexión'), { status: 'completed', processed: 3 }]);
  await state.timers.shift()();
  assert.equal(state.error, 'Sin conexión');
  assert.equal(state.sync.status, 'processing');
  assert.equal(state.timers.length, 1);
  await state.timers.shift()();
  assert.equal(state.sync.status, 'completed');
  assert.equal(state.error, '');
  assert.equal(state.timers.length, 0);
});

test('desmontar el panel descarta respuestas tardías sin actualizar otro trabajo', async () => {
  const state = loadPolling([{ status: 'failed' }]);
  state.cleanup();
  await state.timers.shift()();
  assert.equal(state.sync.status, 'processing');
  assert.equal(state.timers.length, 0);
});
