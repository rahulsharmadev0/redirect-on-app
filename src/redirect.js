import { platforms, detectPlatformParam } from './config/platforms.js';

(function(){
  const startTs = Date.now();
  const params = new URLSearchParams(window.location.search);
  const debug = params.get('debug') === '1';
  const intentMode = params.get('intent') === 'web';
  const delayParam = parseInt(params.get('delay')||'',10);
  const delay = isFinite(delayParam)? Math.min(2000, Math.max(200, delayParam)) : 800;

  function byPlatformName(name) { return platforms.find(p=>p.platform===name || p.keys.includes(name)); }

  const platformParam = detectPlatformParam(params);
  const outputEl = document.getElementById('status');

  if (!platformParam) {
    outputEl.textContent = 'No platform parameter found. Provide ?youtube= or ?instagram= etc.';
    return;
  }

  const { platform, value } = platformParam;
  const descriptor = platform.parse(value);

  if (debug) {
    outputEl.textContent = 'Debug mode (no redirect). Parsed descriptor shown below.';
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(descriptor, null, 2);
    document.body.appendChild(pre);
    const link = document.createElement('a');
    link.href = descriptor.canonicalWebUrl;
    link.textContent = 'Open Web URL';
    document.body.appendChild(link);
    return;
  }

  if (!descriptor.canonicalWebUrl) {
    outputEl.textContent = 'Unable to parse input.';
    return;
  }

  // Update link placeholder
  const manualLink = document.getElementById('manual-link');
  manualLink.href = descriptor.canonicalWebUrl;

  if (intentMode) {
    outputEl.textContent = 'Opening web version (intent=web).';
    window.location = descriptor.canonicalWebUrl;
    return;
  }

  // Attempt deep link
  let navigated = false;
  function tryNext(index) {
    if (index >= descriptor.appUrlCandidates.length) return;
    try {
      window.location = descriptor.appUrlCandidates[index];
    } catch (e) { /* ignore */ }
  }

  if (descriptor.appUrlCandidates.length) {
    tryNext(0);
  }

  const timer = setTimeout(()=>{
    if (document.hidden) { navigated = true; }
    if (!navigated) {
      window.location = descriptor.canonicalWebUrl;
    }
  }, delay);

  // Visibility change heuristic
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { navigated = true; clearTimeout(timer); }
  });

})();
