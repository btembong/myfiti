/**
 * Patches React builds to add missing exports required by Mantine 9.x:
 *   - useEffectEvent: required by Mantine but missing from Next.js canary bundle
 *   - Activity: required by Mantine 9.x, only in React 19.2-canary; polyfilled here
 *     so webpack builds work with the stable react@19.1.0 workspace package.
 * Run automatically via postinstall.
 */
const fs = require('fs')
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

// ── Workspace react@19.1.0 — patch Activity + useEffectEvent for webpack ─────
// Webpack resolves named ESM imports against the workspace react package.
// Mantine 9.x imports Activity which doesn't exist in 19.1.0.
// This polyfill is a no-op pass-through — same UI, no behavior change.
const WORKSPACE_POLYFILL = `
// Polyfills added by patch-next-react.js for Mantine 9.x compat
if (!exports.Activity) {
  exports.Activity = function Activity(props) { return props.children; };
}
if (!exports.useEffectEvent) {
  exports.useEffectEvent = function useEffectEvent(fn) { return fn; };
}
`

const WORKSPACE_REACT_FILES = [
  path.join(REACT_ROOT, 'cjs', 'react.development.js'),
  path.join(REACT_ROOT, 'cjs', 'react.production.min.js'),
]

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

// Patch workspace React (append — version-agnostic)
for (const file of WORKSPACE_REACT_FILES) {
  if (!fs.existsSync(file)) continue
  const src = fs.readFileSync(file, 'utf8')
  if (src.includes('Polyfills added by patch-next-react.js')) continue
  fs.writeFileSync(file, src + WORKSPACE_POLYFILL)
  console.log(`  patched ${path.basename(file)}`)
  totalPatched++
}

if (totalPatched > 0) {
  console.log(`patch-next-react: applied ${totalPatched} file(s)`)
} else {
  console.log('patch-next-react: nothing to patch (already applied or version changed)')
}
