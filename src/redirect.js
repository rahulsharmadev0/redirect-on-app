import { platforms, detectPlatformParam } from './config/platforms.js';

(function(){
  const params = new URLSearchParams(window.location.search);
  const debug = params.get('debug') === '1';
  const intentMode = params.get('intent') === 'web';
  const delayParam = parseInt(params.get('delay')||'',10);
  // Default fallback delay shortened for snappier behaviour; clamp between 150-2000ms
  const delay = isFinite(delayParam) ? Math.min(2000, Math.max(150, delayParam)) : 350;

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

  // Attempt deep link: try each candidate quickly (staggered) and fall back to the web URL.
  // Use a short stagger so the OS/browser can pick up the first scheme that works.
  let navigated = false;
  const attemptTimers = [];
  const iframeHandles = [];

  function attemptOpen(url) {
    // Primary approach: set location.href
    try { window.location.href = url; } catch (e) { /* ignore */ }

    // Secondary approach: inject a hidden iframe as a fallback trigger for some environments
    try {
      const ifr = document.createElement('iframe');
      ifr.style.display = 'none';
      ifr.src = url;
      document.body.appendChild(ifr);
      iframeHandles.push(ifr);
      // remove iframe after a short time
      setTimeout(() => {
        try { ifr.parentNode && ifr.parentNode.removeChild(ifr); } catch (e) {}
      }, 1000);
    } catch (e) { /* ignore iframe errors */ }
  }

  if (descriptor.appUrlCandidates && descriptor.appUrlCandidates.length) {
    const stagger = 150; // ms between attempts
    descriptor.appUrlCandidates.forEach((candidate, i) => {
      const t = setTimeout(() => attemptOpen(candidate), i * stagger);
      attemptTimers.push(t);
    });
  }

  const fallbackTimer = setTimeout(() => {
    if (document.hidden) { navigated = true; }
    if (!navigated) {
      try { window.location.href = descriptor.canonicalWebUrl; } catch (e) {}
    }
    // cleanup any remaining iframes
    iframeHandles.forEach(ifr => { try { ifr.parentNode && ifr.parentNode.removeChild(ifr); } catch (e) {} });
  }, delay);

  // Visibility change heuristic: if page becomes hidden, assume navigation succeeded
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      navigated = true;
      // clear pending timers to avoid race conditions
      attemptTimers.forEach(t => clearTimeout(t));
      clearTimeout(fallbackTimer);
      // cleanup any remaining iframes
      iframeHandles.forEach(ifr => { try { ifr.parentNode && ifr.parentNode.removeChild(ifr); } catch (e) {} });
    }
  });

})();
