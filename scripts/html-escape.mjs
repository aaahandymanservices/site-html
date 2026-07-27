/**
 * Escaping helpers shared by the static page generators.
 *
 * Every generator interpolates values from public/data/*.json into HTML, XML,
 * and JSON-LD. Those values are plain text — no field is meant to carry markup —
 * so each one has to be neutralised at the point it is written into output.
 * Without that, a service or city name containing `&`, `<`, or a quote produces
 * broken markup at best, and a `</script>` inside any string ends the JSON-LD
 * block early and turns the rest of the value into executable page content.
 *
 * Escape at the sink, not in the data: several values are used both in HTML and
 * inside JSON-LD objects, and those two destinations need different treatment.
 * Pass raw values into the JSON-LD objects and let `jsonLdScript` handle them.
 */

/**
 * Escapes a value for use in HTML text or in a quoted attribute. Both quote
 * styles are covered so the same helper is safe in either position.
 */
export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Escapes a value for use in XML text (sitemaps). */
export const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Serialises a value for embedding inside a `<script>` element.
 *
 * `JSON.stringify` alone is not enough: the HTML parser looks for `</script` in
 * the raw text and does not care that it sits inside a JSON string, so a data
 * value containing one would close the element and expose everything after it
 * as markup. Escaping `<`, `>`, and `&` as `\uXXXX` keeps the payload valid,
 * equivalent JSON while making that impossible. U+2028/U+2029 are escaped too
 * because they are literal line terminators to a JavaScript parser.
 */
export const jsonForScript = (value, space = 2) =>
  JSON.stringify(value, null, space)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

/**
 * Builds a complete, indented `<script type="application/ld+json">` block for
 * one or more schema.org objects.
 */
export const jsonLdScript = (objects, indent = '    ') => {
  const list = Array.isArray(objects) ? objects : [objects];
  return list
    .map((obj) => {
      const body = jsonForScript(obj)
        .split('\n')
        .map((line) => indent + line)
        .join('\n');
      return `${indent}<script type="application/ld+json">\n${body}\n${indent}</script>`;
    })
    .join('\n');
};
