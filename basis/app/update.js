const status = document.getElementById('update-progress');
const retry = document.getElementById('retry-update');

function activate(worker) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('The update is taking longer than expected. Try again while connected.')), 120000);
    function finish(error) {
      clearTimeout(timer);
      worker.removeEventListener('statechange', changed);
      if (error) reject(error); else resolve();
    }
    function changed() {
      if (worker.state === 'installed') {
        status.textContent = 'The offline pack is downloaded. Opening the updated lab…';
        worker.postMessage({ type: 'ACTIVATE_UPDATE' });
      } else if (worker.state === 'activated') finish();
      else if (worker.state === 'redundant') finish(new Error('The update did not finish. Your previous offline pack is still available.'));
    }
    worker.addEventListener('statechange', changed);
    changed();
  });
}

async function update() {
  retry.hidden = true;
  status.textContent = 'Checking for the latest offline pack…';
  try {
    if (!('serviceWorker' in navigator) || !isSecureContext) throw new Error('Open this page on localhost or HTTPS to update the offline lab.');
    const scope = new URL('./', location.href).href;
    let registration = await navigator.serviceWorker.getRegistration(scope);
    if (registration?.scope !== scope) registration = null;
    if (!registration) registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
    else await registration.update();
    // This recovery page is outside older asset manifests. It can reach an
    // update even when the old app itself is still served from its offline cache.
    const worker = registration.installing || registration.waiting;
    if (worker) {
      status.textContent = 'Downloading the latest offline pack. This can take a moment…';
      await activate(worker);
    }
    const active = (await navigator.serviceWorker.ready).active;
    if (navigator.serviceWorker.controller !== active) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { cleanup(); reject(new Error('The updated lab is not ready yet. Try the update again.')); }, 15000);
        function cleanup() { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', changed); }
        function changed() { if (navigator.serviceWorker.controller === active) { cleanup(); resolve(); } }
        navigator.serviceWorker.addEventListener('controllerchange', changed);
        changed();
      });
    }
    location.replace('./');
  } catch (error) {
    status.textContent = error.message;
    retry.hidden = false;
  }
}
retry.addEventListener('click', update);
update();
