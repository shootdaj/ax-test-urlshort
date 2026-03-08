const { validateUrl, validateSlug, validateDateParam, validateSlugParam, MAX_URL_LENGTH } = require('./validation');

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

  it('should reject javascript: URLs', () => {
    const result = validateUrl('javascript:alert(1)');
    expect(result.valid).toBe(false);
  });

  it('should reject data: URLs', () => {
    const result = validateUrl('data:text/html,<script>alert(1)</script>');
    expect(result.valid).toBe(false);
  });

  it('should reject file: URLs', () => {
    const result = validateUrl('file:///etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL must use http or https protocol');
  });

  it('should reject URLs exceeding max length', () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(MAX_URL_LENGTH);
    const result = validateUrl(longUrl);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('must not exceed');
  });

  it('should accept URLs at max length boundary', () => {
    const url = 'https://example.com/' + 'a'.repeat(MAX_URL_LENGTH - 'https://example.com/'.length);
    const result = validateUrl(url);
    expect(result.valid).toBe(true);
  });

  it('should reject URLs with credentials', () => {
    const result = validateUrl('https://user:pass@example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL must not contain credentials');
  });

  it('should reject URLs with username only', () => {
    const result = validateUrl('https://admin@example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL must not contain credentials');
  });

  it('should accept URLs with ports', () => {
    expect(validateUrl('https://example.com:8080/path')).toEqual({ valid: true });
  });

  it('should accept URLs with query params and fragments', () => {
    expect(validateUrl('https://example.com/path?key=value#section')).toEqual({ valid: true });
  });

  it('should accept URLs with unicode domain (punycode)', () => {
    expect(validateUrl('https://xn--nxasmq6b.com/path')).toEqual({ valid: true });
  });

  it('should reject null input', () => {
    const result = validateUrl(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL is required');
  });

  it('should reject array input', () => {
    const result = validateUrl(['https://example.com']);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL must be a string');
  });

  it('should reject object input', () => {
    const result = validateUrl({ url: 'https://example.com' });
    expect(result.valid).toBe(false);
    expect(result.error).toBe('URL must be a string');
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

  it('should reject slug with unicode characters', () => {
    const result = validateSlug('caf\u00e9-slug');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Slug may only contain letters, numbers, and hyphens');
  });

  it('should reject slug with emoji', () => {
    const result = validateSlug('my-slug-\ud83d\ude00');
    expect(result.valid).toBe(false);
  });

  it('should reject slug with null bytes', () => {
    const result = validateSlug('my-\x00-slug');
    expect(result.valid).toBe(false);
  });

  it('should reject slug with dots', () => {
    const result = validateSlug('my.slug');
    expect(result.valid).toBe(false);
  });

  it('should reject slug with slashes', () => {
    const result = validateSlug('my/slug');
    expect(result.valid).toBe(false);
  });

  it('should accept null slug (optional)', () => {
    expect(validateSlug(null)).toEqual({ valid: true });
  });
});

describe('validateDateParam', () => {
  it('should accept undefined (optional)', () => {
    expect(validateDateParam(undefined)).toEqual({ valid: true });
  });

  it('should accept null (optional)', () => {
    expect(validateDateParam(null)).toEqual({ valid: true });
  });

  it('should accept empty string (optional)', () => {
    expect(validateDateParam('')).toEqual({ valid: true });
  });

  it('should accept valid YYYY-MM-DD date', () => {
    const result = validateDateParam('2026-03-01');
    expect(result.valid).toBe(true);
    expect(result.date).toBeInstanceOf(Date);
  });

  it('should reject non-string input', () => {
    const result = validateDateParam(123);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Date must be a string');
  });

  it('should reject wrong format (slash-separated)', () => {
    const result = validateDateParam('2026/03/01');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Date must be in YYYY-MM-DD format');
  });

  it('should reject wrong format (DD-MM-YYYY)', () => {
    const result = validateDateParam('01-03-2026');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Date must be in YYYY-MM-DD format');
  });

  it('should reject text that is not a date', () => {
    const result = validateDateParam('not-a-date');
    expect(result.valid).toBe(false);
  });

  it('should accept leap year date', () => {
    const result = validateDateParam('2024-02-29');
    expect(result.valid).toBe(true);
  });
});

describe('validateSlugParam', () => {
  it('should accept valid alphanumeric slug', () => {
    expect(validateSlugParam('abc123')).toEqual({ valid: true });
  });

  it('should accept slug with hyphens', () => {
    expect(validateSlugParam('my-slug')).toEqual({ valid: true });
  });

  it('should accept slug with underscores', () => {
    expect(validateSlugParam('my_slug')).toEqual({ valid: true });
  });

  it('should accept single character slug', () => {
    expect(validateSlugParam('a')).toEqual({ valid: true });
  });

  it('should reject empty string', () => {
    const result = validateSlugParam('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Slug parameter is required');
  });

  it('should reject undefined', () => {
    const result = validateSlugParam(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Slug parameter is required');
  });

  it('should reject null', () => {
    const result = validateSlugParam(null);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Slug parameter is required');
  });

  it('should reject non-string input', () => {
    const result = validateSlugParam(123);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Slug parameter is required');
  });

  it('should reject slug longer than 32 chars', () => {
    const result = validateSlugParam('a'.repeat(33));
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Slug parameter is too long');
  });

  it('should accept slug at max 32 chars', () => {
    expect(validateSlugParam('a'.repeat(32))).toEqual({ valid: true });
  });

  it('should reject slug with dots', () => {
    const result = validateSlugParam('my.slug');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid slug parameter');
  });

  it('should reject slug with spaces', () => {
    const result = validateSlugParam('my slug');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid slug parameter');
  });

  it('should reject slug with special characters', () => {
    const result = validateSlugParam('my<script>slug');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid slug parameter');
  });

  it('should reject slug with path traversal', () => {
    const result = validateSlugParam('../etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid slug parameter');
  });

  it('should reject slug with null bytes', () => {
    const result = validateSlugParam('slug\x00injection');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid slug parameter');
  });

  it('should reject slug with URL encoding', () => {
    const result = validateSlugParam('my%20slug');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid slug parameter');
  });
});

describe('MAX_URL_LENGTH', () => {
  it('should be 2048', () => {
    expect(MAX_URL_LENGTH).toBe(2048);
  });
});
