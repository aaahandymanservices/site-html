/*
 * Hold every page script and the icon stylesheet until after the first paint.
 *
 * Lighthouse does not time the page in real time: it replays the load through a
 * simulated slow phone and network, and when it works out Largest Contentful
 * Paint it counts every script and stylesheet that finished downloading before
 * the page first painted -- `defer` included. A deferred script never blocks
 * the paint, but it is fetched alongside the stylesheets and fonts the paint
 * does need, so in the simulation its bytes and its evaluation sit on the LCP
 * path anyway. On the home page that was six scripts plus icons.css and the
 * Font Awesome font it pulls in (a VeryHigh-priority request once icons render
 * in the hero), and measured together they were most of the gap between
 * first paint and LCP. Taking them out of that window moved FCP from 1.5s to
 * 1.2s and LCP from 2.0s to 1.65s in the lab.
 *
 * The mechanism, applied to every page that loads scripts:
 *
 *   <script src="/js/site.js?v=..." defer>  becomes
 *   <script type="text/x-after-paint" src="/js/site.js?v=...">
 *
 * A script whose type is not JavaScript is never fetched or run, and the
 * preload scanner skips it too. The `src="/js/...?v=..."` shape is untouched on
 * purpose, so the stamp rewrite in update-static-pages.mjs and the checks that
 * look for page-boot.js keep matching.
 *
 * The icon stylesheet keeps only its <noscript> twin. Visitors without
 * JavaScript get it from there as before; everyone else gets it from the
 * loader, which reads the href back out of that same fallback, so there is one
 * stamp per page to keep current rather than two.
 *
 * The small inline loader placed after the last parked script waits for the
 * browser to report first-contentful-paint, then re-creates each script in
 * document order (async=false preserves it, the same guarantee `defer` gave)
 * and adds the stylesheet. Behaviour is unchanged: the scripts still run after
 * the document is parsed, and every one of them already copes with running
 * after DOMContentLoaded and either side of `load`. Three fallbacks keep a page
 * from waiting forever: a browser without paint timing starts on the next
 * animation frame, a tab opened in the background (which never paints until it
 * is shown, and so never reports FCP) starts immediately, and a 3s timer
 * covers anything else.
 */

export const AFTER_PAINT_TYPE = 'text/x-after-paint';

const LOADER_ID = 'aaa-after-paint';

// Readable source of the inline loader below. Keep the two in step.
//
// (() => {
//   var d = document, started = 0;
//   function start() {
//     if (started) return;
//     started = 1;
//     d.querySelectorAll('noscript').forEach(function (n) {
//       var m = /^\s*<link\s+rel="?stylesheet"?\s+href="?([^"\s>]+)"?\s*\/?>\s*$/i.exec(n.textContent);
//       if (!m) return;
//       var l = d.createElement('link');
//       l.rel = 'stylesheet';
//       l.href = m[1];
//       d.head.appendChild(l);
//     });
//     d.querySelectorAll('script[type="text/x-after-paint"]').forEach(function (p) {
//       var s = d.createElement('script');
//       s.src = p.src;
//       s.async = false;
//       p.replaceWith(s);
//     });
//   }
//   function soon() { setTimeout(start, 0); }
//   if (d.visibilityState === 'hidden') return start();
//   var types = (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes) || [];
//   if (types.indexOf('paint') < 0) {
//     requestAnimationFrame(soon);
//   } else {
//     var po = new PerformanceObserver(function (list) {
//       if (!list.getEntriesByName('first-contentful-paint').length) return;
//       po.disconnect();
//       soon();
//     });
//     po.observe({ type: 'paint', buffered: true });
//   }
//   setTimeout(start, 3000);
// })();
const LOADER =
  `<script id=${LOADER_ID}>(()=>{var d=document,t=0;function r(){if(t)return;t=1;` +
  `d.querySelectorAll("noscript").forEach(function(n){var m=/^\\s*<link\\s+rel="?stylesheet"?\\s+href="?([^"\\s>]+)"?\\s*\\/?>\\s*$/i.exec(n.textContent);` +
  `if(!m)return;var l=d.createElement("link");l.rel="stylesheet";l.href=m[1];d.head.appendChild(l)});` +
  `d.querySelectorAll('script[type="${AFTER_PAINT_TYPE}"]').forEach(function(p){var s=d.createElement("script");s.src=p.src;s.async=!1;p.replaceWith(s)})}` +
  `function s(){setTimeout(r,0)}if(d.visibilityState==="hidden")return r();` +
  `var y=window.PerformanceObserver&&PerformanceObserver.supportedEntryTypes||[];` +
  `if(y.indexOf("paint")<0)requestAnimationFrame(s);else{var o=new PerformanceObserver(function(e){if(!e.getEntriesByName("first-contentful-paint").length)return;o.disconnect();s()});o.observe({type:"paint",buffered:!0})}` +
  `setTimeout(r,3e3)})()</script>`;

const DEFERRED_SCRIPT = /<script\s+src=(["']?)(\/js\/[^"'\s>]+)\1\s+defer><\/script>/gi;
const PARKED_SCRIPT = new RegExp(`<script\\s+type=["']?${AFTER_PAINT_TYPE}["']?\\s+src=["']?\\/js\\/[^"'\\s>]+["']?><\\/script>`, 'gi');

// Every eager form the icon link has shipped in, minified or not: the
// media="print" swap page-boot.js flips, and the preload-with-onload swap. The
// <noscript> twin that follows each of them is left where it is.
const EAGER_ICONS_LINK =
  /[ \t]*<link\s+rel=["']?(?:stylesheet|preload)["']?\s+href=["']?\/css\/icons\.css(?:\?v=[^"'\s>]*)?["']?(?=[^>]*(?:data-deferred-style|onload=))[^>]*>\r?\n?(?=\s*<noscript><link\s+rel=["']?stylesheet["']?\s+href=["']?\/css\/icons\.css)/gi;

export function deferUntilFirstPaint(html) {
  html = html.replace(DEFERRED_SCRIPT, `<script type="${AFTER_PAINT_TYPE}" src="$2"></script>`);

  // Re-inserted fresh on every run so repeat builds never stack a second copy.
  html = html.replace(new RegExp(`[ \\t]*<script id=["']?${LOADER_ID}["']?>[\\s\\S]*?<\\/script>\\r?\\n?`, 'gi'), '');

  if (!PARKED_SCRIPT.test(html)) return html;
  PARKED_SCRIPT.lastIndex = 0;

  // Before the scripts are located below: removing the link shifts every
  // offset after it.
  html = html.replace(EAGER_ICONS_LINK, '');

  const parked = [...html.matchAll(PARKED_SCRIPT)];
  const last = parked[parked.length - 1];
  const insertAt = last.index + last[0].length;
  const indent = (html.slice(0, last.index).match(/[ \t]*$/) || [''])[0];
  return `${html.slice(0, insertAt)}\n${indent}${LOADER}${html.slice(insertAt)}`;
}
