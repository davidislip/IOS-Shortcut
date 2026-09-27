import { JuliaRunner } from './runner.js';
import { arrayRows, printable, jsonValue } from './value.js';
import { createJuliaEditor } from './editor.js';
import { createShell } from './shell.js';

const byId = id => document.getElementById(id);
const shell = createShell();
const DRAFT_KEY = 'basis.julia-draft.v1';
const STARTER = `using LinearAlgebra

# Reconstruct b from the columns of A.
A = [2.0 1.0; 1.0 3.0]
b = [4.0, 5.0]

x = A \\ b
println("Reconstruction error: ", norm(b - A * x))
x
`;
let lastSource = null;
let runtimeReady = false;
let runtimeFailure = false;
let cached = false;
let metadata;
let registration;
let initialSource = STARTER;
try {
  const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  initialSource = saved?.version === 1 && typeof saved.source === 'string' ? saved.source : STARTER;
  byId('save-status').textContent = saved ? 'Draft restored' : 'Ready to edit';
} catch {
  byId('save-status').textContent = 'Local save unavailable — export your code';
}
const source = createJuliaEditor({
  parent: byId('source'), value: initialSource,
  onRun: () => { if (!byId('run').disabled) run(); },
  onChange: () => {
    save();
    if (lastSource !== null) byId('result-context').textContent = source.value === lastSource ? 'Result for the code shown.' : 'Code changed. This result belongs to the previous run.';
  },
});
function save() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ version: 1, source: source.value, savedAt: new Date().toISOString() }));
    byId('save-status').textContent = 'Saved on this device';
  } catch { byId('save-status').textContent = 'Could not save — export your code'; }
}
function offlineStatus() {
  document.body.dataset.offlineReady = String(cached && runtimeReady && !runtimeFailure);
  if (runtimeFailure) byId('offline-state').textContent = 'Julia is not ready. Reload to retry; your draft is saved separately.';
  else if (registration?.waiting) {
    byId('update').hidden = false;
    byId('offline-state').textContent = 'An update is ready. Load it to see the latest lab; your draft will be preserved.';
  }
  else if (cached && runtimeReady) byId('offline-state').textContent = 'Ready for offline use — all assets cached and Julia self-check passed.';
  else if (cached) byId('offline-state').textContent = 'Assets cached. Waiting for Julia execution self-check…';
}
function showResult(event) {
  byId('empty-state').hidden = true;
  document.body.dataset.runState = event.result.success ? 'complete' : 'error';
  lastSource = event.source;
  const { result } = event;
  byId('result-context').textContent = `${(event.ms / 1000).toFixed(2)} seconds · ${source.value === lastSource ? 'Result for the code shown.' : 'Code changed during this run; result is for its starting snapshot.'}`;
  byId('output').className = result.success ? '' : 'error';
  byId('output').textContent = [result.output, result.error || result.error_message, result.truncated ? '[Display shortened for responsiveness.]' : ''].filter(Boolean).join('\n');
  const view = byId('value');
  view.replaceChildren();
  const value = result.typed_value;
  byId('structured').hidden = !value;
  byId('structured-value').textContent = value ? jsonValue(value).slice(0, 100000) : '';
  if (result.success && value) {
    const type = document.createElement('p');
    type.className = 'value-type';
    type.textContent = `${value.julia_type || value.type}${value.shape ? ` · ${value.shape.join(' × ')}` : ''}`;
    view.append(type);
    const rows = arrayRows(value);
    if (rows?.length) {
      const table = document.createElement('table');
      table.setAttribute('aria-label', 'Computed array in Julia row and column order');
      const body = document.createElement('tbody');
      for (const row of rows) {
        const tr = document.createElement('tr');
        for (const element of row) { const td = document.createElement('td'); td.textContent = printable(element); tr.append(td); }
        body.append(tr);
      }
      table.append(body);
      view.append(table);
    } else {
      const text = document.createElement('pre');
      text.className = 'scalar';
      text.textContent = printable(value).slice(0, 100000);
      view.append(text);
    }
  } else if (result.success && result.value !== null && result.value !== undefined) {
    const text = document.createElement('pre'); text.textContent = String(result.value); view.append(text);
  }
}
const runner = new JuliaRunner({ notify(event) {
  if (event.type === 'loading') {
    document.body.dataset.runState = 'loading';
    runtimeReady = false;
    runtimeFailure = false;
    byId('run').disabled = true;
    byId('stop').disabled = true;
    byId('run-state').textContent = 'Loading runtime…';
    offlineStatus();
  } else if (event.type === 'ready') {
    document.body.dataset.runState = 'ready';
    runtimeReady = true;
    byId('run').disabled = false;
    byId('run-state').textContent = 'Ready';
    byId('runtime-state').textContent = `SubsetJuliaVM ${event.version}${event.abi === null ? '' : ` · ABI ${event.abi}`} · Julia subset, local WebAssembly`;
    offlineStatus();
  } else if (event.type === 'running') {
    document.body.dataset.runState = 'running';
    byId('empty-state').hidden = true;
    shell.showResults();
    byId('run').disabled = true;
    byId('stop').disabled = false;
    byId('run-state').textContent = 'Running…';
    byId('result-context').textContent = 'Executing a snapshot of your code. You can continue editing.';
  } else if (event.type === 'result') {
    byId('run').disabled = false;
    byId('stop').disabled = true;
    byId('run-state').textContent = event.result.success ? 'Complete' : 'Error';
    showResult(event);
  } else if (event.type === 'stopped') {
    byId('result-context').textContent = event.reason;
  } else if (event.type === 'fatal') {
    document.body.dataset.runState = 'error';
    runtimeReady = false;
    runtimeFailure = true;
    byId('run').disabled = true;
    byId('stop').disabled = true;
    byId('run-state').textContent = 'Runtime failed';
    byId('runtime-state').textContent = event.error;
    offlineStatus();
  }
} });
function run() { save(); runner.run(source.value, Number(byId('timeout').value)); }
byId('run').addEventListener('click', run);
byId('stop').addEventListener('click', () => runner.stop());
byId('download').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([source.value], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'basis-experiment.jl'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
byId('structured').hidden = true;
let reloading = false;
let cacheCheck = 0;
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (reloading) { save(); location.reload(); }
  else checkCache();
});
async function checkCache() {
  if (!metadata || !navigator.serviceWorker.controller) return;
  const id = ++cacheCheck;
  cached = false;
  byId('offline-state').textContent = 'Checking the downloaded offline pack…';
  offlineStatus();
  const channel = new MessageChannel();
  const timer = setTimeout(() => {
    channel.port1.close();
    if (id !== cacheCheck) return;
    cached = false;
    byId('offline-state').textContent = 'Offline cache check timed out. Reload while connected to retry.';
    offlineStatus();
  }, 15000);
  channel.port1.onmessage = ({ data }) => {
    clearTimeout(timer); channel.port1.close();
    if (id !== cacheCheck) return;
    cached = data.complete && data.version === metadata.build;
    if (cached) offlineStatus();
    else byId('offline-state').textContent = 'Offline pack incomplete or a different build is active. Reload while connected to finish.';
    if (runtimeFailure || registration?.waiting) offlineStatus();
  };
  navigator.serviceWorker.controller.postMessage({ type: 'CHECK_CACHE' }, [channel.port2]);
}
async function installOffline() {
  if (!('serviceWorker' in navigator) || !isSecureContext) throw new Error('Offline installation needs HTTPS or localhost.');
  metadata = await fetch('./provenance.json').then(response => { if (!response.ok) throw new Error('Build metadata unavailable'); return response.json(); });
  byId('offline-state').textContent = 'Downloading and checking the complete offline pack…';
  const scope = new URL('./', location.href).href;
  registration = await navigator.serviceWorker.getRegistration(scope);
  if (registration?.scope !== scope) registration = null;
  // An existing installation must open without a successful update request.
  if (!registration) registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
  const pendingUpdate = () => {
    if (registration.waiting) { byId('update').hidden = false; byId('offline-state').textContent = 'An update has downloaded. Your current offline pack remains available.'; }
  };
  const watched = new WeakSet();
  const watchInstalling = () => {
    const installing = registration.installing;
    if (!installing || watched.has(installing)) return;
    watched.add(installing);
    const changed = () => {
      if (installing.state === 'installed') { pendingUpdate(); checkCache(); }
      if (installing.state === 'redundant') byId('offline-state').textContent = 'Offline download did not finish. Existing cached versions are retained; reconnect and reload to retry.';
    };
    installing.addEventListener('statechange', changed);
    changed();
  };
  registration.addEventListener('updatefound', watchInstalling);
  // updatefound may have fired before getRegistration returned this registration.
  watchInstalling();
  pendingUpdate();
  // The complete active pack remains usable when this network check fails offline.
  registration.update().catch(() => {});
  await navigator.serviceWorker.ready;
  await checkCache();
}
byId('update').addEventListener('click', () => {
  if (!registration?.waiting) return;
  save(); reloading = true;
  registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
});
installOffline().catch(error => {
  cached = false;
  byId('offline-state').textContent = `Not ready for offline use: ${error.message}`;
  offlineStatus();
});
