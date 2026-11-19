export const BRAND = 'Vocal Catalog';
export const SUPPORT_EMAIL = 'headshotscout.support@gmail.com';
export const PUBLIC_ORIGIN = 'https://vocalcatalog.com';
export const LEGACY_HOST = 'acting-class-directory.ellasanderella.workers.dev';
export const HOME_H1 = 'Find Voice Training Providers in NYC';
export const HOME_SUBTITLE = 'Explore independent practices, studios, and institutions offering voice training.';
export const DIRECTORY_SCOPE = 'Browse each provider once, with its verified classes, workshops, and faculty grouped together.';
export const DISCOVERY_DISCLAIMER = 'Listings are provided for discovery purposes. Teaching formats and enrollment availability vary by provider. Please confirm details directly with the teacher or institution.';
export const HOME_TITLE = 'Voice Training Providers in NYC | Vocal Catalog';
export const HOME_DESCRIPTION = 'Find independent voice practices, studios, and institutions in NYC. Compare verified specialties, locations, lesson formats, classes, and prices.';
export function homeMetadata(page = 1) {
  return { title: page === 1 ? HOME_TITLE : `Voice Training Providers in NYC — Page ${page} | ${BRAND}`, description: page === 1 ? HOME_DESCRIPTION : `${HOME_DESCRIPTION} Page ${page}.` };
}

export function siteContext(url, env = {}) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const origin = local ? url.origin : (env.CANONICAL_ORIGIN || url.origin).replace(/\/$/, '');
  const canonicalHost = new URL(origin).hostname;
  const publicHosts = new Set([canonicalHost, `www.${canonicalHost}`, new URL(PUBLIC_ORIGIN).hostname, 'www.vocalcatalog.com', LEGACY_HOST]);
  const preview = !local && !publicHosts.has(url.hostname);
  const redirect = !local && !preview && url.origin !== origin ? `${origin}${url.pathname}${url.search}` : null;
  return { origin, local, preview, redirect };
}
