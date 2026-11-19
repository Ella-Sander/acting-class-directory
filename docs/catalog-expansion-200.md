# NYC vocal directory: 200 listings

Reviewed November 10, 2026. Migration `0008_expand_voice_directory_to_200.sql` adds **100 distinct vocal instructors** to the existing 100 listings. The resulting public catalog contains **186 instructors and 14 group classes**. All 100 additions have an official profile website and an identifiable, verified logo from their school or studio.

Applied locally and to the dedicated Cloudflare D1 database on November 10, 2026 after a verified production export. Live API and browser checks confirmed all 200 listings, preservation of the original 100, websites and logos on all additions, and 201 sitemap URLs. All 15 tests and the production build passed; desktop pagination and mobile WebKit were checked. Deployment version: `4e304a02-4fd8-4f2e-b09a-5fab4540daa4`.

| Official institution | New instructors | Source roster |
| --- | ---: | --- |
| NYU Steinhardt | 33 | https://steinhardt.nyu.edu/programs/vocal-performance/faculty-and-staff |
| Manhattan School of Music | 30 | https://www.msmnyc.edu/programs/vocal-arts/ and https://www.msmnyc.edu/programs/musical-theatre/ |
| Mannes School of Music | 15 | https://www.newschool.edu/mannes/voice-faculty/ |
| Brooklyn Music School | 6 | https://www.brooklynmusicschool.org/faculty-and-staff |
| Voice Academy NYC | 14 | https://voiceacademynyc.com/vocal-coaches/ |
| The Diller-Quaile School of Music | 2 | https://www.diller-quaile.org/faculty |

## Verification boundaries

Each instructor's individual official profile returned HTTP 200 during review. `data/catalog-200-verification.json` records those checks, profile titles, teaching roles, and current roster sources. `data/nyc-catalog-expansion-200.json` is the reviewed import. A source-backed institutional connection establishes NYC teaching; it does not establish an independent private studio address.

NYU, MSM and Mannes entries explicitly identify faculty roles. Their descriptions explain that study may require university or conservatory admission/enrollment and direct visitors to the institution for placement. No private availability, open seats, prices, credentials or portrait permissions are invented. Voice coaches, voice teachers, vocal pedagogy/performance instructors and vocal ensemble instructors retain their distinct professional titles. Dance, acting-only, administration and non-teaching artist-in-residence roles are excluded.

Mannes's primary website limited automated requests. Its official `ww3.newschool.edu` host served the individual profiles and original Mannes logo successfully; the main official voice-faculty roster was also reviewed through indexed official content. Profiles include current teaching courses where published. School and studio logos are labeled as affiliations, and their official image sources and checksums are recorded in `data/listing-logos.json`.

## Deduplication

David Sisco and Nicole Haslett already have profiles and receive additional NYU/Diller-Quaile affiliations. Derek Fawcett receives both NYU and Voice Academy affiliations. Harolyn Blackwell-Greer (also listed as Harolyn Blackwell at MSM) and Justin John Moniz each receive two school affiliations and only one new public profile. The official Voice Academy roster displays “Lina Maria”; its linked individual profile's title uses “Lina Marie.” These refer to one linked coach and produce one profile.

`data/catalog-100-baseline.json` records the original IDs, slugs and names. Migration tests verify that all remain intact, the new catalog has exactly 200 published listings, and foreign keys and unique identities remain valid. Migration `0007` is preserved byte-for-byte.

## Logos

The 100 additions use six new official logos, visually reviewed before publication. The complete catalog has **180 listings with verified branding**, using 27 distinct logo files. The original 20 unavailable logos remain clearly marked. `scripts/fetch-catalog-200-logos.mjs` reproduces the six new asset downloads without overwriting previously verified brands.

## Import workflow

Generate migration `0008` with `node scripts/generate-catalog-200.mjs` before first application. Run `npm test`, apply local migrations, and verify localhost. Before the remote migration, export the dedicated production D1 database. Deploy only `dist/client` assets through `wrangler.production.jsonc`; the generated local Worker directory contains development secrets and is not a public asset directory. Do not regenerate migrations after application; corrections belong in later migrations.
