/**
 * Lightweight user-agent parser.
 * Extracts browser name and OS from a user-agent string.
 * No external dependencies — uses regex matching.
 */

/**
 * Parse a user-agent string to extract browser and OS info.
 * @param {string} ua - The user-agent string
 * @returns {{ browser: string, os: string }}
 */
function parseUserAgent(ua) {
  if (!ua || typeof ua !== 'string') {
    return { browser: 'Unknown', os: 'Unknown' };
  }

  return {
    browser: detectBrowser(ua),
    os: detectOS(ua),
  };
}

/**
 * Detect browser from user-agent string.
 * Order matters — check more specific browsers first.
 * @param {string} ua
 * @returns {string}
 */
function detectBrowser(ua) {
  // Edge (Chromium-based) — must check before Chrome
  if (/Edg\//.test(ua)) return 'Edge';
  // Opera / OPR — must check before Chrome
  if (/OPR\/|Opera\//.test(ua)) return 'Opera';
  // Samsung Internet — must check before Chrome
  if (/SamsungBrowser\//.test(ua)) return 'Samsung Internet';
  // Chrome — must check before Safari (Chrome includes Safari in UA)
  if (/Chrome\//.test(ua)) return 'Chrome';
  // Firefox
  if (/Firefox\//.test(ua)) return 'Firefox';
  // Safari — check after Chrome (Chrome UA contains Safari)
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
  // IE
  if (/MSIE|Trident\//.test(ua)) return 'IE';
  // Bot detection
  if (/bot|crawl|spider|slurp/i.test(ua)) return 'Bot';

  return 'Other';
}

/**
 * Detect OS from user-agent string.
 * @param {string} ua
 * @returns {string}
 */
function detectOS(ua) {
  if (/Windows NT/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  if (/CrOS/.test(ua)) return 'ChromeOS';

  return 'Other';
}

module.exports = { parseUserAgent, detectBrowser, detectOS };
