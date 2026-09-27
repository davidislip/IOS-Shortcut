// Owns one disposable worker. Killing its thread interrupts synchronous WASM too.
export class JuliaRunner {
  constructor({ makeWorker = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }), notify = () => {}, startupTimeout = 120000 } = {}) {
    this.makeWorker = makeWorker;
    this.notify = notify;
    this.startupTimeout = startupTimeout;
    this.sequence = 0;
    this.generation = 0;
    this.start();
  }
  start() {
    clearTimeout(this.timer);
    this.worker?.terminate();
    this.ready = false;
    this.active = null;
    const generation = ++this.generation;
    this.notify({ type: 'loading' });
    try { this.worker = this.makeWorker(); }
    catch (error) { this.notify({ type: 'fatal', error: String(error) }); return; }
    this.timer = setTimeout(() => this.fail('Runtime startup exceeded two minutes. Reload to retry.'), this.startupTimeout);
    this.worker.onmessage = ({ data }) => {
      if (generation !== this.generation) return;
      if (data.type === 'ready') {
        clearTimeout(this.timer);
        this.ready = true;
        this.notify(data);
      } else if (data.type === 'fatal') {
        this.fail(data.error);
      } else if (data.type === 'result' && data.id === this.active?.id) {
        clearTimeout(this.timer);
        const source = this.active.source;
        this.active = null;
        this.notify({ ...data, source });
      }
    };
    this.worker.onerror = event => {
      if (generation === this.generation) this.fail(event.message || 'Worker failed. Reload to retry.');
    };
  }
  fail(error) {
    clearTimeout(this.timer);
    ++this.generation;
    this.worker?.terminate();
    this.ready = false;
    this.active = null;
    this.notify({ type: 'fatal', error });
  }
  run(source, timeout = 60000) {
    if (!this.ready || this.active) return false;
    const id = ++this.sequence;
    this.active = { id, source };
    this.notify({ type: 'running', id, source });
    this.timer = setTimeout(() => this.stop('Time limit reached. Worker stopped; restarting…'), timeout);
    this.worker.postMessage({ type: 'run', id, source });
    return true;
  }
  stop(reason = 'Stopped. Restarting runtime…') {
    if (!this.active) return;
    this.notify({ type: 'stopped', reason });
    this.start();
  }
  dispose() {
    clearTimeout(this.timer);
    ++this.generation;
    this.worker?.terminate();
  }
}
