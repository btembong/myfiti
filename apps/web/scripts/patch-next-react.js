/**
 * Patches Next.js bundled React canary builds to add useEffectEvent,
 * which is required by Mantine 9.x but missing from Next.js's canary bundle.
 * Run automatically via postinstall.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../../node_modules/next/dist')

const BUNDLES = [
  // dev bundles use `exports.X =` style
  {
    file: 'compiled/next-server/app-page-turbo.runtime.dev.js',
    marker: 'exports.version="19.2.0-canary-0bdb9206-20250818"',
    polyfill: ';if(!exports.useEffectEvent)exports.useEffectEvent=function useEffectEvent(fn){return fn;}',
  },
  {
    file: 'compiled/next-server/app-page.runtime.dev.js',
    marker: 'exports.version="19.2.0-canary-0bdb9206-20250818"',
    polyfill: ';if(!exports.useEffectEvent)exports.useEffectEvent=function useEffectEvent(fn){return fn;}',
  },
  {
    file: 'compiled/react/cjs/react.development.js',
    marker: 'exports.version = "19.2.0-canary-0bdb9206-20250818"',
    polyfill: '\n    if (!exports.useEffectEvent) {\n      exports.useEffectEvent = function useEffectEvent(fn) { return fn; };\n    }',
  },
  // prod bundles use minified `e.X =` style
  {
    file: 'compiled/next-server/app-page-turbo.runtime.prod.js',
    marker: '.version="19.2.0-canary-0bdb9206-20250818"',
    polyfill: ';if(!e.useEffectEvent)e.useEffectEvent=function(n){return n;}',
  },
  {
    file: 'compiled/next-server/app-page.runtime.prod.js',
    marker: '.version="19.2.0-canary-0bdb9206-20250818"',
    polyfill: ';if(!e.useEffectEvent)e.useEffectEvent=function(n){return n;}',
  },
  {
    file: 'compiled/react/cjs/react.production.js',
    marker: 'exports.version = "19.2.0-canary-0bdb9206-20250818"',
    polyfill: '\nif (!exports.useEffectEvent) {\n  exports.useEffectEvent = function useEffectEvent(fn) { return fn; };\n}',
  },
]

let totalPatched = 0

for (const { file, marker, polyfill } of BUNDLES) {
  const fullPath = path.join(ROOT, file)
  if (!fs.existsSync(fullPath)) continue
  const src = fs.readFileSync(fullPath, 'utf8')
  if (src.includes(polyfill)) continue  // already patched
  const patched = src.replaceAll(marker, marker + polyfill)
  if (patched === src) continue  // marker not found
  fs.writeFileSync(fullPath, patched)
  const count = (patched.match(/useEffectEvent/) || []).length
  console.log(`  patched ${file.split('/').pop()}`)
  totalPatched++
}

if (totalPatched > 0) {
  console.log(`patch-next-react: applied ${totalPatched} file(s)`)
} else {
  console.log('patch-next-react: nothing to patch (already applied or version changed)')
}
