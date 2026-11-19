# Listing map

The map groups published listings by verified physical location. Nineteen recorded public address strings were geocoded with the US Census Geocoder (`Public_AR_Current`); results and source URLs are in `data/map-geocodes.json`. Some strings refer to the same building, and their pins are grouped. A geocode is an address-derived position, not a claim about a private studio entrance or present appointment availability.

Locations without geocoded street addresses use explicitly approximate neighborhood, borough, or NYC area centers, with a precision label in the popup. All pins share the same burgundy fill and cream outline. Online and unverified locations are excluded. School-based faculty may share their documented institution's pin; this does not promise independent lessons at that address. Each popup links every matching listing at that location.

The initial view focuses on Manhattan while retaining all mapped pins for exploration. Choosing another location fits that location's pins. Search and the other directory refinements update the visible pins. Reset map clears the location refinement and returns to Manhattan. No browser geolocation or runtime geocoding API is used.

`scripts/geocode-directory.mjs` refreshes address geocodes from `data/map-location-input.json`, which was extracted from verified location records in the migration chain. New locations require a reviewed geocode to gain an address pin; unknown addresses fall back to a labeled area rather than invented precision.

The hero counters use the loaded directory totals, animate once after loading, and immediately show the final value when reduced motion is requested. Screen readers receive the final count without the animation frames being announced.

Production database export was saved to ignored `.wrangler/pre-deploy-2026-11-13.sql` before applying migrations 0010–0012 on November 13, 2026.
