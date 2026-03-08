/**
 * Validate that a string is a valid HTTP or HTTPS URL.
 * @param {string} url
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUrl(url) {
  if (!url) {
    return { valid: false, error: 'URL is required' };
  }
  if (typeof url !== 'string') {
    return { valid: false, error: 'URL must be a string' };
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, error: 'URL must use http or https protocol' };
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

module.exports = { validateUrl, validateSlug };
