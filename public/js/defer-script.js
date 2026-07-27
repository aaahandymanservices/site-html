(function () {
  'use strict';

  var config = document.currentScript;
  if (!config) return;

  var source = config.getAttribute('data-src');
  var target = document.querySelector(config.getAttribute('data-target') || 'body');
  if (!source || !target) return;

  var loading = false;
  var observer;

  function load() {
    if (loading) return;
    loading = true;

    if (observer) observer.disconnect();
    target.removeEventListener('pointerdown', load, true);
    target.removeEventListener('focusin', load, true);
    target.removeEventListener('keydown', load, true);

    var script = document.createElement('script');
    script.src = source;
    document.head.appendChild(script);
  }

  target.addEventListener('pointerdown', load, true);
  target.addEventListener('focusin', load, true);
  target.addEventListener('keydown', load, true);

  if (target.id && location.hash === '#' + target.id) {
    load();
  } else if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      if (entries.some(function (entry) { return entry.isIntersecting; })) load();
    }, { rootMargin: '500px 0px' });
    observer.observe(target);
  } else {
    window.addEventListener('load', load, { once: true });
  }
})();
