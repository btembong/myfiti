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

// ── Define SENTINEL constant first ─────────────────────────────────────────────
// Sentinel v2 — bump version to re-apply over old conditional polyfills
const SENTINEL = 'myfiti-polyfill-v2'

// ── Next.js RSC React (react.react-server.js) — patch useEffectEvent + Activity ─
// app-page.runtime.prod.js loads this file at runtime (not react.production.js).
// It has 0 occurrences of useEffectEvent — must be patched here.
const RSC_BUNDLES = [
  path.join(NEXT_ROOT, 'compiled/react/react.react-server.js'),
  path.join(NEXT_ROOT, 'compiled/react/react.react-server.development.js'),
]
const RSC_POLYFILL = `
// ${SENTINEL}
exports.useEffectEvent = exports.useEffectEvent || function useEffectEvent(fn) { return fn; };
exports.Activity = exports.Activity || function Activity(props) { return props.children; };
`
for (const file of RSC_BUNDLES) {
  if (!fs.existsSync(file)) continue
  const src = fs.readFileSync(file, 'utf8')
  if (src.includes(SENTINEL)) continue
  fs.writeFileSync(file, src + RSC_POLYFILL)
  console.log(`  patched ${path.basename(file)}`)
  totalPatched++
}

// ── Workspace react — patch Activity + useEffectEvent for webpack ─────────────
//
// Webpack detects CJS named exports via STATIC analysis — it only picks up
// UNCONDITIONAL `exports.X =` or `module.exports.X =` patterns.
// Our previous polyfill used `if (!exports.X)` which webpack ignores.
// The new format uses `exports.X = exports.X || ...` which is detectable.
//
// We patch BOTH react/index.js (webpack's entry point) AND all cjs/*.js files.

// Polyfill for react/index.js — uses module.exports (entry point form)
const INDEX_POLYFILL = `
// ${SENTINEL}
module.exports.Activity = module.exports.Activity || function Activity(props) { return props.children; };
module.exports.useEffectEvent = module.exports.useEffectEvent || function useEffectEvent(fn) { return fn; };
`

// Polyfill for cjs/*.js — uses exports (direct CJS form)
const CJS_POLYFILL = `
// ${SENTINEL}
exports.Activity = exports.Activity || function Activity(props) { return props.children; };
exports.useEffectEvent = exports.useEffectEvent || function useEffectEvent(fn) { return fn; };
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

// Patch react/index.js — webpack's entry point for the react package
const reactIndex = path.join(REACT_ROOT, 'index.js')
if (fs.existsSync(reactIndex)) {
  const src = fs.readFileSync(reactIndex, 'utf8')
  if (!src.includes(SENTINEL)) {
    fs.writeFileSync(reactIndex, src + INDEX_POLYFILL)
    console.log('  patched workspace react: index.js')
    totalPatched++
  }
}

// Patch all CJS files (scan directory — covers any filename variant)
const reactCjsDir = path.join(REACT_ROOT, 'cjs')
if (fs.existsSync(reactCjsDir)) {
  for (const filename of fs.readdirSync(reactCjsDir)) {
    if (!filename.startsWith('react.') || !filename.endsWith('.js')) continue
    const file = path.join(reactCjsDir, filename)
    const src  = fs.readFileSync(file, 'utf8')
    if (src.includes(SENTINEL)) continue
    fs.writeFileSync(file, src + CJS_POLYFILL)
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
