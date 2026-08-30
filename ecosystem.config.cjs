// PM2 process config
// First start: pm2 start ecosystem.config.cjs
// After deploy: pm2 reload ecosystem.config.cjs --update-env
const ROOT = __dirname

module.exports = {
  apps: [
    {
      name: 'myfiti-api',
      cwd: `${ROOT}/apps/api`,
      script: 'node',
      args: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
    },
    {
      name: 'myfiti-web',
      cwd: `${ROOT}/apps/web`,
      // pnpm hoists next binary to root node_modules
      script: `${ROOT}/node_modules/.bin/next`,
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
