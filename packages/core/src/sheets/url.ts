/** True when `value` parses as an absolute URL with the http: or https: scheme. It does not trim. */
export function isHttpUrl(value: string): boolean {
  return parseHttpUrl(value) !== null
}

/**
 * The URL_Normalizer comparison key for `value`, or null when it is not an absolute http(s) URL.
 *
 * The key has a lowercase scheme and host (the URL parser does this), the host without one leading
 * `www.`, no fragment, no query parameters named `ref` or starting with `utm_`, and no trailing
 * slashes in the path. The other query parameters keep their order and their original encoding.
 */
export function normalizeUrl(value: string): string | null {
  const url = parseHttpUrl(value)
  if (url === null) return null

  const { hostname } = url
  if (hostname.startsWith('www.') && hostname.length > 'www.'.length) {
    url.hostname = hostname.slice('www.'.length)
  }

  url.hash = ''

  // Filter the raw query text instead of going through URLSearchParams, which would re-encode the
  // kept parameters only when something was removed and so give two keys for one URL.
  const kept = url.search
    .slice(1)
    .split('&')
    .filter((param) => param !== '' && !isTrackingParam(param))
  url.search = kept.length === 0 ? '' : `?${kept.join('&')}`

  // An empty path serializes as '/' for http(s), so the root path stays '/'.
  url.pathname = url.pathname.replace(/\/+$/, '')

  return url.href
}

function parseHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function isTrackingParam(param: string): boolean {
  const separator = param.indexOf('=')
  const name = decodeParamName(separator === -1 ? param : param.slice(0, separator))
  return name === 'ref' || name.startsWith('utm_')
}

function decodeParamName(raw: string): string {
  const spaced = raw.replaceAll('+', ' ')
  try {
    return decodeURIComponent(spaced)
  } catch {
    return spaced
  }
}
