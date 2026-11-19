# NYC voice directory: 100-listing catalog

Reviewed November 10, 2026. Migration `0007` adds 79 public listings to the original 21: **86 coaches and 14 classes in total**. The migration only inserts records; it preserves existing profiles, archived acting records, submissions, claims and review history.

## Source record

`data/nyc-catalog-expansion.js` holds the reviewed names, public source URLs, school affiliations, NYC locations, confirmed formats, course prices and prerequisites. Each imported entity also has database research-source and field-evidence records. The SQL was generated with `node scripts/generate-nyc-expansion.mjs` before application. Do not regenerate an applied migration to change live data; create a new migration for later corrections.

The 66 additional coaches comprise:

| Source | Added coaches |
| --- | ---: |
| [Brooklyn Conservatory voice faculty](https://bkcm.org/voice-lessons-at-bkcm/) and [Jazz Vocal Lab instructor](https://bkcm.org/class-ensemble/jazz-vocal-lab/) | 10 |
| [Lucy Moses School faculty](https://www.kaufmanmusiccenter.org/lms/faculty-list/) | 9 |
| [Third Street voice faculty](https://www.thirdstreet.nyc/faculty-staff-board-of-directors) | 4 |
| [Bloomingdale voice faculty](https://www.bsmny.org/about-us/faculty-and-staff/) | 5 |
| [Greenwich House voice faculty](https://greenwichhouse.org/music-school/staff-and-faculty/) | 4 |
| [NYSTA teacher directory](https://nyst.org/find-a-voice-teacher/) | 6 |
| [Matt Farnsworth Voice Studio](https://www.mattfarnsworthvoice.com/about) | 5 |
| [New York Jazz Academy voice faculty](https://www.nyjazzacademy.com/category/faculty/voice/) | 11 |
| [New York Jazz Workshop voice faculty](https://newyorkjazzworkshop.com/nyjw-music-teachers/voice-lessons/) | 4 |
| Liz Caplan, Fernanda Douglas, Rae Covey, David Sisco, Mary Setrakian, Deric Rosenblatt, Michael Forman and Sherry Boone | 8 |

The 13 additional classes comprise four BKCM vocal programs, three Lucy Moses School courses, one NYJA vocal jazz program, Everybody Can Sing at 92NY, and four Bloomingdale singing classes. Each class has its own official program or registration-page source in the catalog.

## Verification boundaries

- A school faculty listing establishes the professional teaching affiliation. It does not guarantee independent private lessons, open seats, an exact private-studio address or that every performance genre is a taught specialty.
- Only explicit teaching-format statements create verified format rows. Unstated formats remain unknown.
- Published course/semester tuition is recorded as `full_course`, never as a private-lesson or hourly rate. Discounts, additional registration/materials fees and placement requirements can change the payable amount.
- Classes in an ongoing term remain catalog listings, with current or future enrollment to be confirmed through the official source. Age and audition requirements are retained in the descriptions or structured fields when supplied.
- NYSTA entries are identified as association listings rather than personal websites. The NYJA official pages were readable through indexed source content; direct automated fetches encountered a Cloudflare challenge. This is not represented as a registration or availability check.
- A stale Bob Marks private-session page and an unavailable Lucy Moses beginner-class page were excluded during link checking. The final catalog uses a current studio associate and a currently listed Opera Workshop instead.
- Konstantina Siokis has two documented school affiliations but only one coach profile. Multiple lesson times are not separate listings. Course levels are separate entries only where the school publishes distinct curricula and course IDs.
- No portraits, logos, private contact details or image-use permissions were invented. Existing portrait and logo placeholders continue to work.

## Validation

The complete migration chain was executed in an isolated SQLite database with foreign keys enabled: 86 published coaches, 14 published group classes, no duplicate published coach names and no foreign-key violations. Catalog tests check unique IDs, slugs and names, source URLs, qualified prices and correspondence between the reviewed data and generated migration. Local and production D1 receive the same migration through their separate explicit configurations.
