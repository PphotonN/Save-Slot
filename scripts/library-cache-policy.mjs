const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

function normalizeHostname(hostname) {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
}

export function isAllowedLibraryOrigin(origin) {
  if (typeof origin !== 'string' || origin.length === 0) return false;

  try {
    const url = new URL(origin);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      LOOPBACK_HOSTNAMES.has(normalizeHostname(url.hostname))
    );
  } catch {
    return false;
  }
}

export function libraryCorsHeaders(origin) {
  const headers = { Vary: 'Origin' };
  if (!isAllowedLibraryOrigin(origin)) return headers;

  return {
    ...headers,
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
