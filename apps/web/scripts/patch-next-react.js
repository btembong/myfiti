/**
 * Patches React builds to add missing exports required by Mantine 9.x:
 *   - useEffectEvent: missing from Next.js canary bundle
 *   - Activity: only in React 19.2-canary; polyfilled for webpack + react@19.1.0
 * Run automatically via postinstall.
 */
const fs   = require('fs')
const path = require('path')

const NEXT_ROOT  = path.resolve(__dirname, '../../../node_modules/next/dist')
const REACT_ROOT = path.resolve(__dirname, '../../../node_modules/react')

// ── Next.js bundled React (canary) — patch useEffectEvent ────────────────────
const NEXT_BUNDLES = [
  {
    file: path.join(NEXT_ROOT, 'compiled/next-server/app-page-turbo.runtime.dev.js'),
    marker: 'exports.version="19.2.0-canary-0bdb9206-20250818"',
    polyfill: ';if(!exports.useEffectEvent)exports.useEffectEvent=function useEffectEvent(fn){return fn;}',
  },
  {
    file: path.join(NEXT_ROOT, 'compiled/next-server/app-page.runtime.dev.js'),
    marker: 'exports.version="19.2.0-canary-0bdb9206-20250818"',
    polyfill: ';if(!exports.useEffectEvent)exports.useEffectEvent=function useEffectEvent(fn){return fn;}',
  },
  {
    file: path.join(NEXT_ROOT, 'compiled/react/cjs/react.development.js'),
    marker: 'exports.version = "19.2.0-canary-0bdb9206-20250818"',
    polyfill: '\n    if (!exports.useEffectEvent) {\n      exports.useEffectEvent = function useEffectEvent(fn) { return fn; };\n    }',
  },
  {
    file: path.join(NEXT_ROOT, 'compiled/next-server/app-page-turbo.runtime.prod.js'),
    marker: '.version="19.2.0-canary-0bdb9206-20250818"',
    polyfill: ';if(!e.useEffectEvent)e.useEffectEvent=function(n){return n;}',
  },
  {
    file: path.join(NEXT_ROOT, 'compiled/next-server/app-page.runtime.prod.js'),
    marker: '.version="19.2.0-canary-0bdb9206-20250818"',
    polyfill: ';if(!e.useEffectEvent)e.useEffectEvent=function(n){return n;}',
  },
  {
    file: path.join(NEXT_ROOT, 'compiled/react/cjs/react.production.js'),
    marker: 'exports.version = "19.2.0-canary-0bdb9206-20250818"',
    polyfill: '\nif (!exports.useEffectEvent) {\n  exports.useEffectEvent = function useEffectEvent(fn) { return fn; };\n}',
  },
]

// ── Workspace react — patch Activity + useEffectEvent for webpack ─────────────
// Webpack resolves ESM named imports against the workspace react package.
// Mantine 9.x imports Activity which only exists in React 19.2-canary.
// We scan ALL files in react/cjs/ so we're not sensitive to exact filenames
// (react.production.min.js vs react.production.js etc.).
const SENTINEL = 'Polyfills added by patch-next-react.js'
const WORKSPACE_POLYFILL = `
// ${SENTINEL}
if (!exports.Activity) {
  exports.Activity = function Activity(props) { return props.children; };
}
if (!exports.useEffectEvent) {
  exports.useEffectEvent = function useEffectEvent(fn) { return fn; };
}
`

let totalPatched = 0

// Patch Next.js bundles (marker-based)
for (const { file, marker, polyfill } of NEXT_BUNDLES) {
  if (!fs.existsSync(file)) continue
  const src = fs.readFileSync(file, 'utf8')
  if (src.includes(polyfill)) continue
  const patched = src.replaceAll(marker, marker + polyfill)
  if (patched === src) continue
  fs.writeFileSync(file, patched)
  console.log(`  patched ${path.basename(file)}`)
  totalPatched++
}

// Patch ALL workspace react CJS files (scan directory — version-agnostic)
const reactCjsDir = path.join(REACT_ROOT, 'cjs')
if (fs.existsSync(reactCjsDir)) {
  for (const filename of fs.readdirSync(reactCjsDir)) {
    if (!filename.startsWith('react.') || !filename.endsWith('.js')) continue
    const file = path.join(reactCjsDir, filename)
    const src  = fs.readFileSync(file, 'utf8')
    if (src.includes(SENTINEL)) continue  // already patched
    fs.writeFileSync(file, src + WORKSPACE_POLYFILL)
    console.log(`  patched workspace react: ${filename}`)
    totalPatched++
  }
} else {
  console.log(`  warning: workspace react/cjs not found at ${reactCjsDir}`)
}

if (totalPatched > 0) {
  console.log(`patch-next-react: applied ${totalPatched} file(s)`)
} else {
  console.log('patch-next-react: nothing to patch (already applied or version changed)')
}
