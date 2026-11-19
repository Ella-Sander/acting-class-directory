# Acting-school vocal offerings

Reviewed November 13, 2026. Migration `0010` adds six classes across four NYC acting schools, bringing the vocal catalog to 208 listings: 186 instructors and 22 classes. Course data is in `data/acting-school-voice.json`; regenerate the new migration with `node scripts/generate-acting-school-voice.mjs` only before it is applied.

| School | Offerings | Verification |
| --- | --- | --- |
| HB Studio | Singing Voice 1 and 2 | Official CourseStorm fall 2026 sections list $555 full-course tuition, ten two-hour sessions, Martha Bernard, and 120 Bank Street. Level 2 requires placement. These sections are already underway; future enrollment is not asserted. |
| The Barrow Group | Voice for the Actor, Levels 1 and 2 | Official curriculum and school address; tuition and section delivery remain unknown. Spoken-voice instruction is labeled separately from singing. |
| Stella Adler | Sound into Action: Voice & Monologue | Official 2027 workshop lists $600 full-course tuition, eight three-hour sessions, NYC delivery and an entrance interview for new applicants. The page's calendar range and weekly count do not align, so calendar dates are not copied. Current contact page establishes 65 Broadway; the old archived provider and its unrelated acting course remain untouched. |
| Atlantic Acting School | Conservatory Voice | Official conservatory curriculum and NYC school address. Requires program admission; not represented as a separately bookable voice lesson. No standalone tuition or section delivery is inferred. |

Each course has official research-source and field-evidence records. Local logos come from the schools' official page assets; HB's original header SVG is extracted unchanged. Sources, asset URLs, review dates, surface colors and SHA-256 checksums are retained in `data/listing-logos.json`. This records logo identity and provenance, not a new license or endorsement. The earlier 200-listing logo audit is a historical snapshot.

The new `Voice & speech for actors` lesson-focus filter distinguishes spoken-voice study from group singing. Existing courses, profiles, archived acting records, submissions and claims are preserved.

Apply locally with `npm.cmd run db:migrate:local`. This does not update production; remote database changes and Worker deployment use the explicit production configuration described in README.
