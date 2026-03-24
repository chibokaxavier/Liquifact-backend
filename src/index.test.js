'use strict';

/**
 * Security header integration tests for the LiquiFact API.
 *
 * Verifies that every endpoint returns the required secure HTTP headers
 * and that prohibited headers (e.g. X-Powered-By) are absent.
 *
 * Run with: bun test --coverage
 */

const request = require('supertest');
const app = require('./index');

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Performs a request against a given endpoint and returns the supertest Response.
 *
 * @param {string} method - HTTP method ('get' | 'post')
 * @param {string} path   - URL path
 * @returns {Promise<import('supertest').Response>}
 */
async function req(method, path) {
  return request(app)[method](path);
}

/**
 * Asserts that a response carries all mandatory Helmet-set security headers.
 *
 * @param {import('supertest').Response} res - supertest response object
 */
function expectSecureHeaders(res) {
  // X-Content-Type-Options
  expect(res.headers['x-content-type-options']).toBe('nosniff');

  // X-Frame-Options
  expect(res.headers['x-frame-options']).toBe('DENY');

  // Strict-Transport-Security — must include max-age, includeSubDomains, preload
  const hsts = res.headers['strict-transport-security'];
  expect(hsts).toBeDefined();
  expect(hsts).toContain('max-age=31536000');
  expect(hsts).toContain('includeSubDomains');
  expect(hsts).toContain('preload');

  // Content-Security-Policy — must restrict to 'self'
  const csp = res.headers['content-security-policy'];
  expect(csp).toBeDefined();
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-src 'none'");

  // Referrer-Policy
  expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

  // Cross-Origin-Opener-Policy
  expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');

  // Cross-Origin-Resource-Policy
  expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');

  // Cross-Origin-Embedder-Policy
  expect(res.headers['cross-origin-embedder-policy']).toBe('require-corp');

  // X-DNS-Prefetch-Control
  expect(res.headers['x-dns-prefetch-control']).toBe('off');

  // X-Permitted-Cross-Domain-Policies
  expect(res.headers['x-permitted-cross-domain-policies']).toBe('none');

  // Origin-Agent-Cluster
  expect(res.headers['origin-agent-cluster']).toBe('?1');

  // X-Powered-By must be absent (hidePoweredBy: true)
  expect(res.headers['x-powered-by']).toBeUndefined();
}

// ---------------------------------------------------------------------------
// Route tests — functional correctness
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const res = await req('get', '/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('liquifact-api');
    expect(res.body.version).toBe('0.1.0');
    expect(typeof res.body.timestamp).toBe('string');
  });
});

describe('GET /api', () => {
  test('returns 200 with API info', async () => {
    const res = await req('get', '/api');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('LiquiFact API');
    expect(res.body.endpoints).toBeDefined();
  });
});

describe('GET /api/invoices', () => {
  test('returns 200 with empty data array', async () => {
    const res = await req('get', '/api/invoices');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('POST /api/invoices', () => {
  test('returns 201 with placeholder invoice', async () => {
    const res = await request(app).post('/api/invoices').send({});
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe('placeholder');
    expect(res.body.data.status).toBe('pending_verification');
  });
});

describe('GET /api/escrow/:invoiceId', () => {
  test('returns 200 with escrow state for given invoiceId', async () => {
    const res = await req('get', '/api/escrow/inv-42');
    expect(res.status).toBe(200);
    expect(res.body.data.invoiceId).toBe('inv-42');
    expect(res.body.data.status).toBe('not_found');
    expect(res.body.data.fundedAmount).toBe(0);
  });
});

describe('404 handler', () => {
  test('returns 404 with error for unknown path', async () => {
    const res = await req('get', '/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
    expect(res.body.path).toBe('/does-not-exist');
  });

  test('returns 404 for unknown POST path', async () => {
    const res = await req('post', '/unknown-route');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});

// ---------------------------------------------------------------------------
// Security header tests — applied to every endpoint
// ---------------------------------------------------------------------------

describe('Security headers — all endpoints', () => {
  const endpoints = [
    { method: 'get', path: '/health' },
    { method: 'get', path: '/api' },
    { method: 'get', path: '/api/invoices' },
    { method: 'post', path: '/api/invoices' },
    { method: 'get', path: '/api/escrow/test-invoice-id' },
    { method: 'get', path: '/nonexistent-route' },
  ];

  for (const { method, path } of endpoints) {
    test(`${method.toUpperCase()} ${path} has all required security headers`, async () => {
      const res = await req(method, path);
      expectSecureHeaders(res);
    });
  }
});

// ---------------------------------------------------------------------------
// Security header detail tests
// ---------------------------------------------------------------------------

describe('Content-Security-Policy directives', () => {
  test('includes strict script-src', async () => {
    const res = await req('get', '/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("script-src 'self'");
  });

  test('includes strict style-src', async () => {
    const res = await req('get', '/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("style-src 'self'");
  });

  test('allows data: URIs for images', async () => {
    const res = await req('get', '/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("img-src 'self' data:");
  });

  test('blocks object sources', async () => {
    const res = await req('get', '/api');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("object-src 'none'");
  });

  test('blocks frame sources', async () => {
    const res = await req('get', '/api');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("frame-src 'none'");
  });

  test('restricts form-action to self', async () => {
    const res = await req('get', '/api');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("form-action 'self'");
  });

  test('restricts base-uri to self', async () => {
    const res = await req('get', '/api');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("base-uri 'self'");
  });
});

describe('HSTS header', () => {
  test('max-age is set to 1 year (31536000 seconds)', async () => {
    const res = await req('get', '/health');
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
  });

  test('includeSubDomains is set', async () => {
    const res = await req('get', '/health');
    expect(res.headers['strict-transport-security']).toContain('includeSubDomains');
  });

  test('preload directive is set', async () => {
    const res = await req('get', '/health');
    expect(res.headers['strict-transport-security']).toContain('preload');
  });
});

describe('X-Powered-By suppression', () => {
  test('is absent on /health', async () => {
    const res = await req('get', '/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('is absent on /api', async () => {
    const res = await req('get', '/api');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('is absent on 404 responses', async () => {
    const res = await req('get', '/totally-unknown');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('Cross-origin isolation headers', () => {
  test('COOP is same-origin', async () => {
    const res = await req('get', '/health');
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
  });

  test('CORP is same-origin', async () => {
    const res = await req('get', '/health');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  test('COEP requires CORP', async () => {
    const res = await req('get', '/health');
    expect(res.headers['cross-origin-embedder-policy']).toBe('require-corp');
  });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Error handler — unit tested with mocks since it sits after the 404 catch-all
// ---------------------------------------------------------------------------

describe('Error handler', () => {
  const { errorHandler } = require('./index');

  test('responds with 500 and generic message', () => {
    const err = new Error('Something broke');
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, req, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    consoleSpy.mockRestore();
  });

  test('logs the error to console', () => {
    const err = new Error('Logging test');
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, {}, res, () => {});

    expect(consoleSpy).toHaveBeenCalledWith(err);
    consoleSpy.mockRestore();
  });
});
