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

  it('should return 413 for entity too large errors', () => {
    const err = new Error('request entity too large');
    err.type = 'entity.too.large';
    err.stack = err.stack;
    const req = {};
    const res = createMockRes();
    const next = vi.fn();

    vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({ error: 'Request body too large' });

    console.error.mockRestore();
  });

  it('should return 400 for malformed JSON errors', () => {
    const err = new Error('Unexpected token');
    err.type = 'entity.parse.failed';
    err.stack = err.stack;
    const req = {};
    const res = createMockRes();
    const next = vi.fn();

    vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid JSON in request body' });

    console.error.mockRestore();
  });

  it('should log only message in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('secret error details');
    err.stack = 'Error: secret error details\n    at Object.<anonymous> (/app/src/routes/urls.js:15:11)';
    const req = {};
    const res = createMockRes();
    const next = vi.fn();

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, req, res, next);

    // Should log the message, not the full stack
    expect(consoleSpy).toHaveBeenCalledWith('Error:', 'secret error details');
    // Should NOT have logged the stack
    expect(consoleSpy).not.toHaveBeenCalledWith(err.stack);

    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  it('should log full stack in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = new Error('dev error');
    err.stack = 'Error: dev error\n    at Object.<anonymous>';
    const req = {};
    const res = createMockRes();
    const next = vi.fn();

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    errorHandler(err, req, res, next);

    expect(consoleSpy).toHaveBeenCalledWith(err.stack);

    consoleSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });
});
