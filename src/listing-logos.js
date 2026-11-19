import catalog from '../data/listing-logos.json' with { type: 'json' };
import { safeMetadataImageUrl } from './metadata-image.js';

export function resolveListingLogo(item, kind = item.kind) {
  const verified = id => catalog.brands[id]?.status === 'verified' ? catalog.brands[id] : null;
  const own = verified(item.id);
  if (own) return { ...own, relationship: 'own' };
  if(kind==='provider')for(const alias of item.aliases || []){const brand=verified(alias.id);if(brand)return {...brand,relationship:'own'};}
  if (kind === 'teacher') {
    for (const affiliation of item.affiliations || []) {
      const brand = verified(affiliation.id);
      if (brand) return { ...brand, relationship: 'affiliation', affiliationName: affiliation.name };
    }
  }
  if (kind === 'offering') {
    const brand = verified(item.provider_id);
    if (brand) return { ...brand, relationship: 'provider', affiliationName: item.provider_name };
  }
  return null;
}

export function withListingLogo(item, kind) {
  return { ...item, logo: resolveListingLogo(item, kind) };
}

export function resolveListingImage(item, kind = item.kind) {
  const logo = item.logo?.status === 'verified' && item.logo.url ? item.logo : resolveListingLogo(item, kind);
  if (logo?.status === 'verified' && logo.url) {
    return { type: 'logo', url: logo.url, alt: `${logo.name} logo`, logo };
  }
  const imageUrl = safeMetadataImageUrl(item.metadata_image_url);
  return imageUrl ? { type: 'metadata', url: imageUrl, alt: `${item.name} website image`, logo: null } : null;
}
