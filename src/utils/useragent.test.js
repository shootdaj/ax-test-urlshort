const { parseUserAgent, detectBrowser, detectOS } = require('./useragent');

describe('parseUserAgent', () => {
  it('should return Unknown for null/undefined input', () => {
    expect(parseUserAgent(null)).toEqual({ browser: 'Unknown', os: 'Unknown' });
    expect(parseUserAgent(undefined)).toEqual({ browser: 'Unknown', os: 'Unknown' });
  });

  it('should return Unknown for empty string', () => {
    expect(parseUserAgent('')).toEqual({ browser: 'Unknown', os: 'Unknown' });
  });

  it('should return Unknown for non-string input', () => {
    expect(parseUserAgent(123)).toEqual({ browser: 'Unknown', os: 'Unknown' });
  });

  it('should parse a Chrome on Windows user-agent', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Chrome');
    expect(result.os).toBe('Windows');
  });

  it('should parse a Firefox on Linux user-agent', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Firefox');
    expect(result.os).toBe('Linux');
  });

  it('should parse Safari on macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Safari');
    expect(result.os).toBe('macOS');
  });

  it('should parse Edge on Windows', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Edge');
    expect(result.os).toBe('Windows');
  });
});

describe('detectBrowser', () => {
  it('should detect Chrome', () => {
    expect(detectBrowser('Mozilla/5.0 Chrome/120.0.0.0 Safari/537.36')).toBe('Chrome');
  });

  it('should detect Firefox', () => {
    expect(detectBrowser('Mozilla/5.0 Firefox/121.0')).toBe('Firefox');
  });

  it('should detect Safari (not Chrome)', () => {
    expect(detectBrowser('Mozilla/5.0 Version/17.2 Safari/605.1.15')).toBe('Safari');
  });

  it('should detect Edge before Chrome', () => {
    expect(detectBrowser('Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('Edge');
  });

  it('should detect Opera', () => {
    expect(detectBrowser('Chrome/120.0 Safari/537.36 OPR/106.0')).toBe('Opera');
  });

  it('should detect Samsung Internet', () => {
    expect(detectBrowser('Chrome/120.0 Safari/537.36 SamsungBrowser/23.0')).toBe('Samsung Internet');
  });

  it('should detect IE', () => {
    expect(detectBrowser('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1)')).toBe('IE');
  });

  it('should detect IE via Trident', () => {
    expect(detectBrowser('Mozilla/5.0 (Windows NT 6.3; Trident/7.0; rv:11.0)')).toBe('IE');
  });

  it('should detect bots', () => {
    expect(detectBrowser('Googlebot/2.1 (+http://www.google.com/bot.html)')).toBe('Bot');
  });

  it('should return Other for unrecognized UA', () => {
    expect(detectBrowser('some-custom-client/1.0')).toBe('Other');
  });
});

describe('detectOS', () => {
  it('should detect Windows', () => {
    expect(detectOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows');
  });

  it('should detect macOS', () => {
    expect(detectOS('Macintosh; Intel Mac OS X 10_15_7')).toBe('macOS');
  });

  it('should detect Linux', () => {
    expect(detectOS('X11; Linux x86_64')).toBe('Linux');
  });

  it('should detect Android', () => {
    expect(detectOS('Linux; Android 13; Pixel 7')).toBe('Android');
  });

  it('should detect iOS (iPhone)', () => {
    expect(detectOS('iPhone; CPU iPhone OS 17_2')).toBe('iOS');
  });

  it('should detect iOS (iPad)', () => {
    expect(detectOS('iPad; CPU OS 17_2')).toBe('iOS');
  });

  it('should detect ChromeOS', () => {
    expect(detectOS('X11; CrOS x86_64 14541.0.0')).toBe('ChromeOS');
  });

  it('should return Other for unknown OS', () => {
    expect(detectOS('some-custom-os')).toBe('Other');
  });
});
