// Vercel serverless: handler Express reexportado do build.
// A rota /api/* cai neste catch-all; o app Express trata o path completo.
const { app } = require('../dist/index.js');

module.exports = app;
