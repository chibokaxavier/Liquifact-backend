'use strict';

/**
 * LiquiFact API Gateway
 * Express app configuration for invoice financing, auth, and Stellar integration.
 * Server startup lives in server.js so this module can be imported cleanly in tests.
 */

const express = require('express');
const cors = require('cors');
const { createSecurityMiddleware } = require('./middleware/security');
require('dotenv').config();

const app = express();

// Security headers — applied first so every response is protected
app.use(createSecurityMiddleware());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'liquifact-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'LiquiFact API',
    description: 'Global Invoice Liquidity Network on Stellar',
    endpoints: {
      health: 'GET /health',
      invoices: 'GET/POST /api/invoices',
      escrow: 'GET/POST /api/escrow',
    },
  });
});

// Placeholder: Invoices (to be wired to Invoice Service + DB)
app.get('/api/invoices', (req, res) => {
  res.json({
    data: [],
    message: 'Invoice service will list tokenized invoices here.',
  });
});

app.post('/api/invoices', (req, res) => {
  res.status(201).json({
    data: { id: 'placeholder', status: 'pending_verification' },
    message: 'Invoice upload will be implemented with verification and tokenization.',
  });
});

// Placeholder: Escrow (to be wired to Soroban)
app.get('/api/escrow/:invoiceId', (req, res) => {
  const { invoiceId } = req.params;
  res.json({
    data: { invoiceId, status: 'not_found', fundedAmount: 0 },
    message: 'Escrow state will be read from Soroban contract.',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

/**
 * Express error handler — catches errors forwarded via next(err).
 * Returns a generic 500 response to avoid leaking internal details.
 *
 * @param {Error}            err  - The error object
 * @param {express.Request}  req  - Express request
 * @param {express.Response} res  - Express response
 * @param {express.NextFunction} _next - Unused (required by Express signature)
 */
function errorHandler(err, req, res, _next) {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

app.use(errorHandler);

module.exports = app;
module.exports.errorHandler = errorHandler;
