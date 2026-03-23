module.exports = {
  apps: [
    {
      name: 'api',
      script: 'index.js',
      instances: process.env.WORKERS_API || 1,
      exec_mode: 'cluster'
    }
  ]
}
