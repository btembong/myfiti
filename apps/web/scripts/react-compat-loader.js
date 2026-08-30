/**
 * Webpack loader that appends Mantine 9.x compatibility polyfills to
 * react.production.js after module.exports is fully set up.
 *
 * File patches (patch-next-react.js) append to the raw CJS source, but
 * react.production.js may reassign module.exports after our patch runs,
 * making the stale exports reference dead. This loader appends an IIFE that
 * reads module.exports at the END of module execution, guaranteeing the
 * polyfill lands on whatever object require('react') actually returns.
 */

const SENTINEL = '__gymio_react_compat__'

module.exports = function reactCompatLoader(source) {
  if (source.includes(SENTINEL)) return source
  return (
    source +
    `
;(function(){
  // ${SENTINEL}
  var t = (typeof module !== "undefined" && module.exports) || exports;
  if (typeof t.useEffectEvent !== "function") {
    t.useEffectEvent = function useEffectEvent(fn) { return fn; };
  }
  if (typeof t.Activity !== "function") {
    t.Activity = function Activity(props) { return props.children; };
  }
})();
`
  )
}
