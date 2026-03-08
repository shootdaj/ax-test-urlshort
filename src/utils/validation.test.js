const { validateUrl, validateSlug } = require('./validation');

describe('validateUrl', () => {
  it('should accept valid https URL', () => {
    expect(validateUrl('https://example.com')).toEqual({ valid: true });
  });

  it('should accept valid http URL', () => {
    expect(validateUrl('http://example.com/path?q=1')).toEqual({ valid: true });
  });

  it('should reject missing URL', () => {
    const result = validateUrl(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL is required');
  });

  it('should reject empty string', () => {
    const result = validateUrl('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL is required');
  });

  it('should reject non-string URL', () => {
    const result = validateUrl(123);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL must be a string');
  });

  it('should reject invalid URL format', () => {
    const result = validateUrl('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid URL format');
  });

  it('should reject non-http protocols', () => {
    const result = validateUrl('ftp://example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL must use http or https protocol');
  });
});

describe('validateSlug', () => {
  it('should accept valid slug', () => {
    expect(validateSlug('my-slug')).toEqual({ valid: true });
  });

  it('should accept alphanumeric slug', () => {
    expect(validateSlug('abc123')).toEqual({ valid: true });
  });

  it('should accept empty/undefined slug (optional)', () => {
    expect(validateSlug(undefined)).toEqual({ valid: true });
    expect(validateSlug('')).toEqual({ valid: true });
  });

  it('should reject non-string slug', () => {
    const result = validateSlug(123);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Slug must be a string');
  });

  it('should reject slug shorter than 3 characters', () => {
    const result = validateSlug('ab');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Slug must be between 3 and 32 characters');
  });

  it('should reject slug longer than 32 characters', () => {
    const result = validateSlug('a'.repeat(33));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Slug must be between 3 and 32 characters');
  });

  it('should reject slug with special characters', () => {
    const result = validateSlug('has spaces!');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Slug may only contain letters, numbers, and hyphens');
  });

  it('should accept slug at min length (3)', () => {
    expect(validateSlug('abc')).toEqual({ valid: true });
  });

  it('should accept slug at max length (32)', () => {
    expect(validateSlug('a'.repeat(32))).toEqual({ valid: true });
  });
});
