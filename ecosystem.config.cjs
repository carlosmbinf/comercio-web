module.exports = {
  apps: [
    {
      name: "vidkar-comercio-web",
      script: "npm",
      args: "run dev",
      cwd: __dirname,
      interpreter: "none",
      autorestart: true,
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};