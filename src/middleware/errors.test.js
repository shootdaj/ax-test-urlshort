const { describe, it, expect, vi } = require('vitest');
const { errorHandler } = require('./errors');

describe('errorHandler', () => {
  function createMockRes() {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    return res;
  }

  it('should return 409 for unique violation (code 23505)', () => {
    const err = new Error('duplicate key');
    err.code = '23505';
    err.stack = err.stack;
    const req = {};
    const res = createMockRes();
    const next = vi.fn();

    // Suppress console.error in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: 'Slug already exists' });

    console.error.mockRestore();
  });

  it('should return 500 for generic errors', () => {
    const err = new Error('something broke');
    err.stack = err.stack;
    const req = {};
    const res = createMockRes();
    const next = vi.fn();

    vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });

    console.error.mockRestore();
  });
});
