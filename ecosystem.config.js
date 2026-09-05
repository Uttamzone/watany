module.exports = {
  apps: [
    {
      name: "watani-backend",
      cwd: "./watani-b2c-service",
      script: "src/server.js",
      env: {
        NODE_ENV: "production",
        PORT: 8080
      },
      restart_delay: 3000,
      max_restarts: 10
    },
    {
      name: "watani-frontend",
      cwd: "./watani-b2c-website",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      },
      restart_delay: 3000,
      max_restarts: 10
    }
  ]
};
