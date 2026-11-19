# Voice & speech expansion

Reviewed November 13, 2026. Migration `0012` adds 17 listings: ten New York Speech Coaching instructors, HB Studio's Speech 1 and Speaking Voice 1–2, and Maggie Flanigan Studio's Voice 1–4. The whole directory now has 245 public listings (216 instructors, 29 classes). The Voice & speech category is checked against the full migration chain to contain at least 20 listings.

`data/voice-speech-expansion.js` records the reviewed curriculum and roster. `data/voice-speech-verification.json` records official source status, headings, excerpts and page checksums; all eight distinct sources returned HTTP 200. The ten instructor names were checked individually against the current official team headings. Existing instructors and classes remain unchanged.

NYSC entries describe organization-based speech coaching, without claiming independently bookable studios or physical NYC locations for every instructor. Online instruction is supported by the organization's explicit online-session statement; contact NYSC for instructor-specific availability and services. Lorene Chesley's roster describes a Los Angeles base, so she is not labeled as physically NYC-based. Team membership does not imply that a speech-language pathology license or medical service was independently verified.

HB winter 2027 sections list $555 full-course tuition and in-person delivery at 120 Bank Street. Level 2 requires placement. Maggie Flanigan courses each list 24 classes; upper levels require successful completion of earlier levels. Tuition, delivery and open seats are not inferred for those courses. Consult the source for admissions and scheduling.

NYSC and Maggie Flanigan logos were taken from official brand assets, with source URLs and SHA-256 checksums retained in `data/listing-logos.json`. HB courses inherit its existing verified logo. All 17 new listings resolve verified school logos; instructor logos identify affiliation.

Generate the migration with `node scripts/generate-voice-speech.mjs` before applying it. Apply locally using `npm.cmd run db:migrate:local`. Production remains a separate explicit deployment workflow.
