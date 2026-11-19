const blockedHost = /^(?:localhost|.*\.localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i;

export function safeMetadataImageUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return '';
    if (!hostname.includes('.') || blockedHost.test(hostname) || /^\d+(?:\.\d+){3}$/.test(hostname) || hostname.startsWith('[')) return '';
    url.hash = '';
    return url.href;
  } catch {
    return '';
  }
}
