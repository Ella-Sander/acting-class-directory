export const TEACHER_TYPES = [['', 'All'], ['independent', 'Independent'], ['institutional', 'Institutional']];
export const LESSON_FORMATS = [['', 'All formats'], ['private', 'Private / One-on-One'], ['group', 'Group Classes'], ['workshop', 'Workshops']];
export const PROVIDER_TYPES = [['', 'All providers'], ['independent_teacher', 'Independent'], ['institution', 'Institution'], ['studio_business', 'Studio / Business'], ['unconfirmed', 'Unconfirmed']];
export function providerClassification(item) {
  const value = item?.kind === 'provider' && ['independent_teacher', 'studio_business', 'institution', 'unconfirmed'].includes(item.provider_classification)
    ? item.provider_classification : null;
  return { value, label: value ? PROVIDER_TYPES.find(([key]) => key === value)?.[1] : 'Provider type unconfirmed' };
}
export function providerTypes(item) {
  const value = providerClassification(item).value;
  return item?.kind === 'provider' ? [value || 'unconfirmed'] : [];
}
export function safeWebsite(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
const hasSource = evidence => evidence?.verification_status === 'verified' && safeWebsite(evidence.source_url) && Number.isFinite(Date.parse(evidence.verified_at));
const evidenceFor = (item, field) => (item.fact_evidence || []).find(evidence => evidence.field_name === field && hasSource(evidence));
const sameHost = (left, right) => {
  try { const a = new URL(left).hostname.replace(/^www\./, ''); const b = new URL(right).hostname.replace(/^www\./, ''); return a === b || a.endsWith('.' + b) || b.endsWith('.' + a); } catch { return false; }
};
export function verifiedAffiliations(item) {
  return (item.affiliations || []).flatMap(provider => {
    const evidence = (item.fact_evidence || []).find(fact => (fact.field_name.startsWith('affiliation') || (fact.field_name === 'profile' && fact.is_affiliation_roster)) && hasSource(fact) && sameHost(fact.source_url, provider.website_url || provider.source_url));
    return evidence ? [{ ...provider, evidence_url: evidence.source_url }] : [];
  });
}
export const verifiedInstitutionalEvidence = item => (item.fact_evidence || []).find(evidence => (evidence.field_name.startsWith('affiliation') || (evidence.field_name === 'profile' && evidence.is_affiliation_roster)) && hasSource(evidence) && verifiedAffiliations(item).some(provider => provider.evidence_url === evidence.source_url));
export function teacherTypes(item) {
  if (item.kind !== 'teacher') return [];
  const types = [];
  if (evidenceFor(item, 'teacher_type') && ['independent', 'institutional'].includes(item.teacher_type)) types.push(item.teacher_type);
  if (verifiedAffiliations(item).length) types.push('institutional');
  return [...new Set(types)];
}
export function teacherClassification(item) {
  const types = teacherTypes(item);
  return { value: types[0] || null, values: types, label: types.length ? types.map(type => type === 'independent' ? 'Independent' : 'Institutional').join(' + ') : 'Affiliation unconfirmed', source: evidenceFor(item, 'teacher_type')?.source_url || verifiedInstitutionalEvidence(item)?.source_url || '' };
}
export function teacherAvailability(item, now = Date.now()) {
  const evidence = evidenceFor(item, 'availability_status');
  const age = now - Date.parse(evidence?.verified_at);
  const labels = { accepting_students: 'Accepting new students', not_accepting_students: 'Not accepting new students', waitlist: 'Waitlist only' };
  return evidence && age >= 0 && age <= 30 * 86400000 && labels[item.availability_status] ? { value: item.availability_status, label: labels[item.availability_status], source: evidence.source_url } : { value: null, label: 'Availability unconfirmed', source: '' };
}
export function verifiedLessonFormats(item) {
  const modes = [];
  if (item.kind === 'teacher' && evidenceFor(item, 'instruction_mode')) modes.push(item.instruction_mode);
  if (item.kind === 'offering' && item.instructionModeVerified) modes.push(item.instruction_mode);
  for (const format of ['private', 'group', 'workshop']) if (evidenceFor(item, `lesson_format_${format}`)) modes.push(format);
  if (item.workshopVerified || (item.kind === 'offering' && (item.terms || []).some(term => term.slug === 'workshops-and-intensives' && hasSource(term)))) modes.push('workshop');
  if (item.kind !== 'offering') for (const offering of item.offerings || []) modes.push(...verifiedLessonFormats({ ...offering, kind: 'offering' }));
  return [...new Set(modes.flatMap(mode => mode === 'both' ? ['private', 'group'] : ['private', 'group', 'workshop'].includes(mode) ? [mode] : []))];
}
export const lessonFormatLabel = item => verifiedLessonFormats(item).map(format => LESSON_FORMATS.find(([key]) => key === format)[1]).join(' · ') || 'Format unconfirmed';
export function officialWebsite(item) {
  const url = [item.website_url, item.registration_url, item.source_url].map(safeWebsite).find(Boolean) || '';
  const institutional = verifiedInstitutionalEvidence(item);
  return { url, label: item.kind === 'teacher' && institutional && sameHost(url, institutional.source_url) && /\/(faculty|teachers?|coaches|staff|people|profiles?|instructors?)(?:[/-]|$)/i.test(new URL(url).pathname) ? 'View Faculty Profile' : item.kind === 'offering' ? 'Explore Classes' : 'Visit Website' };
}
export function verifiedBookingUrl(item) {
  return evidenceFor(item, 'booking_url') ? safeWebsite(item.booking_url) : '';
}
