/** Eel-call compatibility for the pywebview desktop bridge. */
(function () {
  'use strict';

  const localCallbacks = Object.create(null);
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });

  function markReady() {
    if (window.pywebview && window.pywebview.api) resolveReady(window.pywebview.api);
  }

  if (window.pywebview && window.pywebview.api) {
    markReady();
  } else {
    window.addEventListener('pywebviewready', markReady, { once: true });
  }

  function expose(callback, name) {
    const callbackName = name || (callback && callback.name);
    if (callbackName && typeof callback === 'function') {
      localCallbacks[callbackName] = callback;
    }
    return callback;
  }

  window.eel = new Proxy({ expose }, {
    get(target, method) {
      if (method in target) return target[method];
      if (method === 'then') return undefined;

      return function (...args) {
        const promise = ready.then(api => {
          const fn = api[method];
          if (typeof fn !== 'function') {
            throw new Error(`桌面 API 不存在：${String(method)}`);
          }
          return fn(...args.map(value => value === undefined ? null : value));
        });

        return function (callback) {
          if (typeof callback === 'function') {
            promise.then(callback).catch(error => {
              console.error(`[desktop-api] ${String(method)}`, error);
            });
          }
          return promise;
        };
      };
    }
  });

  // Reserved for future Python-to-JavaScript notifications.
  window.desktopCallbacks = localCallbacks;
})();
