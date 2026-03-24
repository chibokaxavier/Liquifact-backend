/**
 * LiquiFact API Gateway
 * Express server for invoice financing, auth, and Stellar integration.
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const asyncHandler = require('./utils/asyncHandler');
const errorHandler = require('./middleware/errorHandler');
const { callSorobanContract } = require('./services/soroban');

const app = express();
const PORT = process.env.PORT || 3001;

/**
 * Global Middlewares
 */
app.use(cors());
app.use(express.json());

/**
 * Health Check Route
 */
app.get(
  '/health',
  asyncHandler(async (req, res) => {
    res.json({
      status: 'ok',
      service: 'liquifact-api',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * API Info Route
 */
app.get(
  '/api',
  asyncHandler(async (req, res) => {
    res.json({
      name: 'LiquiFact API',
      description: 'Global Invoice Liquidity Network on Stellar',
      endpoints: {
        health: 'GET /health',
        invoices: 'GET/POST /api/invoices',
        escrow: 'GET /api/escrow/:invoiceId',
      },
    });
  })
);

/**
 * Invoices Routes (Placeholder)
 */
app.get(
  '/api/invoices',
  asyncHandler(async (req, res) => {
    res.json({
      data: [],
      message: 'Invoice service will list tokenized invoices here.',
    });
  })
);

app.post(
  '/api/invoices',
  asyncHandler(async (req, res) => {
    res.status(201).json({
      data: {
        id: 'placeholder',
        status: 'pending_verification',
      },
      message:
        'Invoice upload will be implemented with verification and tokenization.',
    });
  })
);

/**
 * Escrow Routes (Placeholder - Soroban Integration)
 */
app.get(
  '/api/escrow/:invoiceId',
  asyncHandler(async (req, res) => {
    const { invoiceId } = req.params;

    res.json({
      data: {
        invoiceId,
        status: 'not_found',
        fundedAmount: 0,
      },
      message: 'Escrow state will be read from Soroban contract.',
    });
  })
);

/**
 * Example Async Error Route (for testing error flow)
 */
app.get(
  '/error-test',
  asyncHandler(async () => {
    throw new Error('Test async error');
  })
);
// Placeholder: Escrow (to be wired to Soroban)
app.get('/api/escrow/:invoiceId', async (req, res) => {
  const { invoiceId } = req.params;

  try {
    // Simulated remote contract call
    const operation = async () => {
      return { invoiceId, status: 'not_found', fundedAmount: 0 };
    };

    const data = await callSorobanContract(operation);
    
    res.json({
      data,
      message: 'Escrow state read from Soroban contract via robust integration wrapper.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Error fetching escrow state' });
  }
});

/**
 * 404 Handler (Not Found)
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

/**
 * Centralized Error Handler
 */
app.use(errorHandler);

/**
 * Server Bootstrap
 */
app.listen(PORT, () => {
  console.log(`LiquiFact API running at http://localhost:${PORT}`);
});
