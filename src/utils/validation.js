/**
 * Validate that a string is a valid HTTP or HTTPS URL.
 * @param {string} url
 * @returns {{ valid: boolean, error?: string }}
 */
const MAX_URL_LENGTH = 2048;

function validateUrl(url) {
  if (!url) {
    return { valid: false, error: 'URL is required' };
  }
  if (typeof url !== 'string') {
    return { valid: false, error: 'URL must be a string' };
  }
  if (url.length > MAX_URL_LENGTH) {
    return { valid: false, error: `URL must not exceed ${MAX_URL_LENGTH} characters` };
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
    }
    // Reject URLs with credentials (user:pass@host) to prevent phishing
    if (parsed.username || parsed.password) {
      return { valid: false, error: 'URL must not contain credentials' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate a custom slug.
 * Must be 3-32 characters, alphanumeric with hyphens allowed.
 * @param {string} slug
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSlug(slug) {
  if (!slug) {
    return { valid: true }; // slug is optional
  }
  if (typeof slug !== 'string') {
    return { valid: false, error: 'Slug must be a string' };
  }
  if (slug.length < 3 || slug.length > 32) {
    return { valid: false, error: 'Slug must be between 3 and 32 characters' };
  }
  if (!/^[a-zA-Z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug may only contain letters, numbers, and hyphens' };
  }
  return { valid: true };
}

/**
 * Validate a date string in YYYY-MM-DD format.
 * @param {string} dateStr
 * @returns {{ valid: boolean, error?: string, date?: Date }}
 */
function validateDateParam(dateStr) {
  if (!dateStr) {
    return { valid: true }; // date params are optional
  }
  if (typeof dateStr !== 'string') {
    return { valid: false, error: 'Date must be a string' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, error: 'Date must be in YYYY-MM-DD format' };
  }
  const date = new Date(dateStr + 'T00:00:00Z');
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date' };
  }
  return { valid: true, date };
}

/**
 * Validate a slug parameter from URL path (for read/delete routes).
 * Less strict than validateSlug — allows any alphanumeric/hyphen string 1-32 chars.
 * Rejects dangerous characters that could cause issues.
 * @param {string} slug
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSlugParam(slug) {
  if (!slug || typeof slug !== 'string') {
    return { valid: false, error: 'Slug parameter is required' };
  }
  if (slug.length > 32) {
    return { valid: false, error: 'Slug parameter is too long' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(slug)) {
    return { valid: false, error: 'Invalid slug parameter' };
  }
  return { valid: true };
}

module.exports = { validateUrl, validateSlug, validateDateParam, validateSlugParam, MAX_URL_LENGTH };
