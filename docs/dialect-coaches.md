# Dialect coach expansion

Reviewed November 13, 2026. Migration `0011_verified_dialect_coaches.sql` adds **20 distinct dialect coaches**, bringing the public catalog to **228 listings: 206 instructors and 22 classes**. Every addition has an official professional coaching source and a contact/booking route. All 25 supporting URLs returned HTTP 200 during direct verification.

## Sources and scope

The reviewed catalog is `data/dialect-coaches.json`. Source URLs, location and format evidence, and faculty affiliations are recorded per person. `data/dialect-coach-verification.json` records response status, title, page checksum and bounded review excerpts. Run `node scripts/verify-dialect-coaches.mjs` to refresh HTTP checks; inspect current page content before changing verified facts. HTTP 200 alone is not a quality endorsement.

| Coach | Official service source |
| --- | --- |
| Mike Walsh | https://www.nycdialectcoach.com/ |
| Eliza Simpson | https://www.dialectsnow.com/ |
| Danny Bryck | https://www.dannybryckcoaching.com/dialect-coaching |
| Shane Ann Younts | https://shaneannyounts.com/dialect-coach-nyc/ |
| Amy Stoller | https://www.stollersystem.com/faq |
| Ricardo López-Montilla | https://www.ricardolopezmontilla.com/services-sales-page-4 |
| Julie Foh | https://www.juliefoh.com/ |
| Linda Jones | https://lindajonesnyc.com/coach/ |
| Deena Kaye | https://www.deenakaye.com/ |
| Cynthia Santos DeCure | https://www.cynthiadecure.com/ |
| Daryll Heysham | https://www.dialectsbydaryll.com/ |
| Melanie Fox | https://speechfox.com/dialect-coaching/ |
| Charley Layton | https://charleylayton.com/accents |
| Patricia Fletcher | https://patriciafletcher.com/dialect-coaching/ |
| Ben Furey | https://www.benfurey.com/actors |
| Erik Singer | https://www.eriksinger.com/ |
| Leigh Dillon | https://leighdillon.website/contact/ |
| Kristen Cerelli | https://www.kristencerelli.com/book-now |
| Joel Goldes | https://www.thedialectcoach.com/index.php/services/actors |
| Elizabeth Abbott | https://www.elizabethabbott.info/dialectcoach |

## Verification decisions

- Sixteen entries have explicit NYC professional or teaching connections; four are online options without a physical NYC claim. A professional base does not establish an in-person lesson format or exact studio address.
- Remote formats are recorded only when explicitly stated. NYC does not imply in-person availability. Amy Stoller's private practice is Zoom-only despite her NYC base. Kristen Cerelli's NYC private meetings are inquiry-only, not a verified in-person booking option.
- The direct version of Erik Singer's booking page states he is currently unavailable for private coaching. The listing preserves this restriction. Direct content also differs from indexed rate information; no stale numerical rate is copied.
- Prices are not added as separate lesson listings in this expansion. Official links remain the source for service-specific fees, packages and availability. No private contact data, medical services or independently audited credentials are inferred.
- Seven own-brand logos are downloaded from official header/branding images, with provenance and checksums in `data/listing-logos.json`. Charley Layton uses the Atlantic Acting School logo through the school's official current faculty page. Client, production and web-designer logos are excluded; remaining coaches retain the existing fallback rather than an invented brand or portrait permission.
- Existing coaches, offerings, archived acting records, submissions and claims remain untouched. Sam Lilja's archived profile is not duplicated or republished.

The existing **Dialect Coaching** specialty appears automatically in the lesson-focus selector. Every added coach has verified specialty, profile, location/format (when stated) and research-source records.

Generate migration with `node scripts/generate-dialect-coaches.mjs` before application only. Apply locally using `npm.cmd run db:migrate:local`. Production updates require the explicit configuration and export workflow in README.
