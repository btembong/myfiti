const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

// Watch shared source packages only — not node_modules (crashes OS watcher)
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages'),
]

// Resolve from project first, then monorepo root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

// Packages that must always resolve to a single copy from the monorepo root.
// extraNodeModules is not enough in pnpm — local node_modules symlinks escape it.
// resolveRequest intercepts at a lower level and wins every time.
const SINGLETON_PACKAGES = [
  'react',
  'react-dom',
  'react-native',
  'react-native-web',
  'scheduler',
]

const rootNodeModules = path.resolve(monorepoRoot, 'node_modules')

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const base = moduleName.split('/')[0]
  if (SINGLETON_PACKAGES.includes(base)) {
    try {
      const resolved = require.resolve(moduleName, { paths: [rootNodeModules] })
      return { filePath: resolved, type: 'sourceFile' }
    } catch {
      // fall through to default resolution
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
