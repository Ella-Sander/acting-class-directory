ALTER TABLE instructors ADD COLUMN source_url TEXT;

CREATE TABLE instructor_formats (
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('in_person', 'online', 'hybrid')),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('verified', 'unverified', 'not_provided')),
  source_url TEXT,
  verified_at TEXT,
  PRIMARY KEY (instructor_id, format)
);

CREATE INDEX idx_instructor_formats_verified
  ON instructor_formats(format, verification_status);

INSERT OR IGNORE INTO taxonomy_terms (id, taxonomy, term, slug) VALUES
  ('training-voice-lessons', 'training_type', 'Voice Lessons', 'voice-lessons'),
  ('training-vocal-coaching', 'training_type', 'Vocal Coaching', 'vocal-coaching'),
  ('training-audition-repertoire', 'training_type', 'Audition and Repertoire Coaching', 'audition-repertoire-coaching'),
  ('training-acting-coaching', 'training_type', 'Acting Coaching', 'acting-coaching'),
  ('training-group-singing', 'training_type', 'Group Singing Classes', 'group-singing-classes'),
  ('training-voice-teacher-training', 'training_type', 'Voice Teacher Training', 'voice-teacher-training'),
  ('technique-vocal', 'technique', 'Vocal Technique', 'vocal-technique'),
  ('technique-classical-vocal', 'technique', 'Classical Vocal Technique', 'classical-vocal-technique'),
  ('technique-contemporary-vocal', 'technique', 'Contemporary Voice Technique', 'contemporary-voice-technique'),
  ('technique-mix-belt', 'technique', 'Mix and Belt', 'mix-and-belt'),
  ('technique-repertoire', 'technique', 'Repertoire Coaching', 'repertoire-coaching'),
  ('technique-acting-song', 'technique', 'Acting Through Song', 'acting-through-song'),
  ('genre-musical-theatre', 'genre', 'Musical Theatre', 'musical-theatre'),
  ('genre-classical-opera', 'genre', 'Classical and Opera', 'classical-opera'),
  ('genre-pop', 'genre', 'Pop', 'pop'),
  ('genre-rock', 'genre', 'Rock', 'rock'),
  ('genre-rnb-soul', 'genre', 'R&B and Soul', 'r-and-b-soul'),
  ('genre-jazz-cabaret', 'genre', 'Jazz and Cabaret', 'jazz-cabaret'),
  ('genre-gospel', 'genre', 'Gospel', 'gospel'),
  ('genre-country-folk-world', 'genre', 'Country, Folk and World Music', 'country-folk-world'),
  ('genre-latin', 'genre', 'Latin', 'latin'),
  ('specialty-voice-therapy', 'specialty', 'Voice Therapy', 'voice-therapy'),
  ('specialty-music-theory', 'specialty', 'Music Notation and Theory', 'music-theory'),
  ('specialty-career-counseling', 'specialty', 'Career Counseling', 'career-counseling'),
  ('specialty-songwriting', 'specialty', 'Songwriting', 'songwriting'),
  ('specialty-speech-training', 'specialty', 'Speech Training', 'speech-training');

UPDATE providers SET listing_status = 'archived', updated_at = CURRENT_TIMESTAMP
  WHERE id IN (
    'provider-acting-studio-ny', 'provider-stella-adler', 'provider-ucb-nyc',
    'provider-acting-gym', 'provider-sam-lilja', 'provider-jason-bennett'
  );
UPDATE offerings SET listing_status = 'archived', updated_at = CURRENT_TIMESTAMP
  WHERE provider_id IN (
    'provider-acting-studio-ny', 'provider-stella-adler', 'provider-ucb-nyc',
    'provider-acting-gym', 'provider-sam-lilja', 'provider-jason-bennett'
  );
UPDATE instructors SET profile_status = 'archived', updated_at = CURRENT_TIMESTAMP
  WHERE id IN (
    'instructor-james-price', 'instructor-ryan-chittaphong', 'instructor-brian-carter',
    'instructor-sam-lilja', 'instructor-jason-bennett'
  );

INSERT INTO providers
  (id, slug, listing_type, name, description, website_url, source_url, listing_status, origin, last_verified_at)
VALUES
  ('provider-new-york-vocal-coaching', 'new-york-vocal-coaching', 'studio', 'New York Vocal Coaching',
   'New York City voice lessons, vocal coaching, online lessons and group singing classes.',
   'https://newyorkvocalcoaching.com/', 'https://newyorkvocalcoaching.com/services',
   'published', 'seeded', date('now'));

INSERT INTO locations (id, label, city, region, borough, neighborhood, postal_address, is_online)
VALUES
  ('location-vocal-midtown', 'Midtown West, Manhattan', 'New York', 'NY', 'Manhattan', 'Midtown West',
   '242 W 38th St, 11th Floor, New York, NY 10018', 0),
  ('location-vocal-bronx', 'Bronx', 'New York', 'NY', 'Bronx', 'Riverdale',
   '629 Kappock Street, #4D, Bronx, NY 10463', 0),
  ('location-vocal-upper-west-side', 'Upper West Side, Manhattan', 'New York', 'NY', 'Manhattan', 'Upper West Side', NULL, 0),
  ('location-vocal-nyc', 'New York City', 'New York', 'NY', NULL, NULL, NULL, 0),
  ('location-vocal-brooklyn', 'East Williamsburg, Brooklyn', 'New York', 'NY', 'Brooklyn', 'East Williamsburg', NULL, 0),
  ('location-vocal-washington-heights', 'Washington Heights, Manhattan', 'New York', 'NY', 'Manhattan', 'Washington Heights',
   '700 W 180th St, New York, NY 10033', 0),
  ('location-vocal-online', 'Online', 'New York', 'NY', NULL, NULL, NULL, 1);

INSERT INTO provider_locations (provider_id, location_id, is_primary)
VALUES ('provider-new-york-vocal-coaching', 'location-vocal-midtown', 1);

INSERT INTO instructors
  (id, slug, name, description, website_url, source_url, booking_url, professional_title, profile_status, last_verified_at)
VALUES
  ('vocal-justin-stoney', 'justin-stoney-voice-teacher', 'Justin Stoney',
   'Founder of New York Vocal Coaching and an internationally recognized voice teacher and vocal coach.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Vocal coach', 'published', date('now')),
  ('vocal-andy-king', 'andy-king-voice-teacher', 'Andy King',
   'New York Vocal Coaching voice teacher specializing in musical theatre, pop, rock, R&B and classical styles.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Voice teacher', 'published', date('now')),
  ('vocal-andrea-grody', 'andrea-grody-voice-teacher', 'Andrea Grody',
   'Broadway music director, arranger, composer and voice teacher focused on developing new work.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Voice teacher', 'published', date('now')),
  ('vocal-kacey-velazquez', 'kacey-velazquez-voice-teacher', 'Kacey Velazquez',
   'Voice teacher, vocal coach and recording artist specializing in pop, rock, indie, country, R&B and soul.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Vocal coach', 'published', date('now')),
  ('vocal-tim-rosser', 'tim-rosser-voice-teacher', 'Tim Rosser',
   'New York voice teacher and vocal coach specializing in pop and contemporary and classic musical theatre.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Vocal coach', 'published', date('now')),
  ('vocal-abby-payne', 'abby-payne-voice-teacher', 'Abby Payne',
   'New York voice teacher and performer with training in jazz studies and voice pedagogy.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Voice teacher', 'published', date('now')),
  ('vocal-nicolas-hormazabal', 'nicolas-hormazabal-voice-teacher', 'Nicolás Hormazábal',
   'Trilingual voice teacher and vocal researcher specializing in contemporary commercial music, pop and rock.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Voice teacher', 'published', date('now')),
  ('vocal-ameer-corro', 'ameer-corro-voice-teacher', 'Ameer Corro',
   'Voice teacher and vocal coach specializing in jazz, gospel, neo-soul, R&B, pop and hip-hop.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Vocal coach', 'published', date('now')),
  ('vocal-christina-wuenn', 'christina-wuenn-voice-teacher', 'Christina Wuenn',
   'Voice teacher working across musical theatre, pop, R&B, jazz and classical styles.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Voice teacher', 'published', date('now')),
  ('vocal-jamie-kaufman', 'jamie-kaufman-voice-teacher', 'Jamie Kaufman',
   'Professional singer and vocal coach specializing in jazz, musical theatre, classical, pop and R&B.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Vocal coach', 'published', date('now')),
  ('vocal-jess-maison', 'jess-maison-voice-teacher', 'Jess Maison',
   'Voice teacher, songwriter and recording artist specializing in pop, soul, R&B, musical theatre and Latin music.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Voice teacher', 'published', date('now')),
  ('vocal-roberto-crippa', 'roberto-crippa-voice-teacher', 'Roberto Crippa',
   'Voice teacher specializing in contemporary music and musical theatre; teaches in Italian and English.',
   'https://newyorkvocalcoaching.com/about/', 'https://newyorkvocalcoaching.com/about/',
   'https://schedule.newyorkvocalcoaching.com/?context=NYVC&s=voice-lessons', 'Voice teacher', 'published', date('now')),
  ('vocal-charlotte-surkin', 'charlotte-surkin-voice-teacher', 'Charlotte Surkin',
   'Bronx voice teacher offering vocal technique, repertoire and acting coaching, music theory and voice therapy.',
   NULL, 'https://nyst.org/find-a-voice-teacher/', NULL, 'Voice teacher', 'published', date('now')),
  ('vocal-elissa-weiss', 'elissa-weiss-voice-teacher', 'Elissa Weiss',
   'New York voice teacher offering vocal technique and music theory across classical, musical theatre and contemporary styles.',
   NULL, 'https://nyst.org/find-a-voice-teacher/', NULL, 'Voice teacher', 'published', date('now')),
  ('vocal-lisa-rochelle', 'lisa-rochelle-voice-teacher', 'Lisa Rochelle',
   'New York voice teacher specializing in vocal technique for contemporary musical theatre, rock and pop.',
   NULL, 'https://nyst.org/find-a-voice-teacher/', NULL, 'Voice teacher', 'published', date('now')),
  ('vocal-debra-wiley-hart', 'debra-wiley-hart-voice-teacher', 'Debra Wiley-Hart',
   'New York voice teacher offering vocal technique, repertoire and acting coaching, and voice therapy.',
   NULL, 'https://nyst.org/find-a-voice-teacher/', NULL, 'Voice teacher', 'published', date('now')),
  ('vocal-jan-horvath', 'jan-horvath-voice-teacher', 'Jan Horvath',
   'New York voice teacher offering vocal technique, repertoire and acting coaching across classical, musical theatre, jazz and popular styles.',
   NULL, 'https://nyst.org/find-a-voice-teacher/', NULL, 'Voice teacher', 'published', date('now')),
  ('vocal-paula-liscio', 'paula-liscio-voice-teacher', 'Paula Liscio',
   'Upper West Side voice teacher offering vocal technique, repertoire, acting and career coaching.',
   NULL, 'https://nyst.org/find-a-voice-teacher/', NULL, 'Voice teacher', 'published', date('now')),
  ('vocal-dawn-winiarz', 'dawn-winiarz-voice-teacher', 'Dawn Winiarz',
   'East Williamsburg voice teacher offering vocal technique across classical, musical theatre, jazz, pop, R&B, gospel and other styles.',
   NULL, 'https://nyst.org/find-a-voice-teacher/', NULL, 'Voice teacher', 'published', date('now')),
  ('vocal-david-sabella', 'david-sabella-voice-teacher', 'David Sabella',
   'Washington Heights voice teacher offering vocal technique, repertoire, acting and career coaching.',
   NULL, 'https://nyst.org/find-a-voice-teacher/', NULL, 'Voice teacher', 'published', date('now'));

INSERT INTO provider_instructors (provider_id, instructor_id)
SELECT 'provider-new-york-vocal-coaching', id FROM instructors
WHERE id IN (
  'vocal-justin-stoney', 'vocal-andy-king', 'vocal-andrea-grody', 'vocal-kacey-velazquez',
  'vocal-tim-rosser', 'vocal-abby-payne', 'vocal-nicolas-hormazabal', 'vocal-ameer-corro',
  'vocal-christina-wuenn', 'vocal-jamie-kaufman', 'vocal-jess-maison', 'vocal-roberto-crippa'
);

INSERT INTO instructor_locations (instructor_id, location_id)
SELECT id, 'location-vocal-midtown' FROM instructors WHERE id IN (
  'vocal-justin-stoney', 'vocal-andy-king', 'vocal-andrea-grody', 'vocal-kacey-velazquez',
  'vocal-tim-rosser', 'vocal-abby-payne', 'vocal-nicolas-hormazabal', 'vocal-ameer-corro',
  'vocal-christina-wuenn', 'vocal-jamie-kaufman', 'vocal-jess-maison', 'vocal-roberto-crippa'
);
INSERT INTO instructor_locations (instructor_id, location_id) VALUES
  ('vocal-charlotte-surkin', 'location-vocal-bronx'),
  ('vocal-elissa-weiss', 'location-vocal-upper-west-side'),
  ('vocal-lisa-rochelle', 'location-vocal-nyc'),
  ('vocal-debra-wiley-hart', 'location-vocal-nyc'),
  ('vocal-jan-horvath', 'location-vocal-midtown'),
  ('vocal-paula-liscio', 'location-vocal-upper-west-side'),
  ('vocal-dawn-winiarz', 'location-vocal-brooklyn'),
  ('vocal-david-sabella', 'location-vocal-washington-heights');

INSERT INTO instructor_locations (instructor_id, location_id)
SELECT id, 'location-vocal-online' FROM instructors WHERE profile_status = 'published';

INSERT INTO instructor_formats (instructor_id, format, verification_status, source_url, verified_at)
SELECT id, 'in_person', 'verified',
  CASE WHEN id LIKE 'vocal-%' AND id NOT IN (
    'vocal-charlotte-surkin', 'vocal-elissa-weiss', 'vocal-lisa-rochelle', 'vocal-debra-wiley-hart',
    'vocal-jan-horvath', 'vocal-paula-liscio', 'vocal-dawn-winiarz', 'vocal-david-sabella'
  ) THEN 'https://newyorkvocalcoaching.com/contact' ELSE 'https://nyst.org/find-a-voice-teacher/' END,
  date('now')
FROM instructors WHERE profile_status = 'published';
INSERT INTO instructor_formats (instructor_id, format, verification_status, source_url, verified_at)
SELECT id, 'online', 'verified',
  CASE WHEN id IN (
    'vocal-justin-stoney', 'vocal-andy-king', 'vocal-andrea-grody', 'vocal-kacey-velazquez',
    'vocal-tim-rosser', 'vocal-abby-payne', 'vocal-nicolas-hormazabal', 'vocal-ameer-corro',
    'vocal-christina-wuenn', 'vocal-jamie-kaufman', 'vocal-jess-maison', 'vocal-roberto-crippa'
  ) THEN 'https://newyorkvocalcoaching.com/services' ELSE 'https://nyst.org/find-a-voice-teacher/' END,
  date('now')
FROM instructors WHERE profile_status = 'published';

WITH instructor_term_rows (instructor_id, term_id, source_url) AS (VALUES
  ('vocal-justin-stoney','training-voice-lessons','https://newyorkvocalcoaching.com/services'),
  ('vocal-justin-stoney','training-vocal-coaching','https://newyorkvocalcoaching.com/services'),
  ('vocal-justin-stoney','technique-vocal','https://newyorkvocalcoaching.com/services'),
  ('vocal-andy-king','training-voice-lessons','https://newyorkvocalcoaching.com/about/'),
  ('vocal-andy-king','genre-musical-theatre','https://newyorkvocalcoaching.com/about/'),
  ('vocal-andy-king','genre-pop','https://newyorkvocalcoaching.com/about/'),
  ('vocal-andy-king','genre-rock','https://newyorkvocalcoaching.com/about/'),
  ('vocal-andy-king','genre-rnb-soul','https://newyorkvocalcoaching.com/about/'),
  ('vocal-andy-king','genre-classical-opera','https://newyorkvocalcoaching.com/about/'),
  ('vocal-andrea-grody','training-voice-lessons','https://newyorkvocalcoaching.com/about/'),
  ('vocal-andrea-grody','genre-musical-theatre','https://newyorkvocalcoaching.com/about/'),
  ('vocal-kacey-velazquez','training-voice-lessons','https://newyorkvocalcoaching.com/about/'),
  ('vocal-kacey-velazquez','training-vocal-coaching','https://newyorkvocalcoaching.com/about/'),
  ('vocal-kacey-velazquez','specialty-songwriting','https://newyorkvocalcoaching.com/about/'),
  ('vocal-kacey-velazquez','genre-pop','https://newyorkvocalcoaching.com/about/'),
  ('vocal-kacey-velazquez','genre-rock','https://newyorkvocalcoaching.com/about/'),
  ('vocal-kacey-velazquez','genre-rnb-soul','https://newyorkvocalcoaching.com/about/'),
  ('vocal-kacey-velazquez','genre-country-folk-world','https://newyorkvocalcoaching.com/about/'),
  ('vocal-tim-rosser','training-voice-lessons','https://newyorkvocalcoaching.com/about/'),
  ('vocal-tim-rosser','genre-musical-theatre','https://newyorkvocalcoaching.com/about/'),
  ('vocal-tim-rosser','genre-pop','https://newyorkvocalcoaching.com/about/'),
  ('vocal-abby-payne','training-voice-lessons','https://newyorkvocalcoaching.com/about/'),
  ('vocal-abby-payne','genre-jazz-cabaret','https://newyorkvocalcoaching.com/about/'),
  ('vocal-nicolas-hormazabal','training-voice-lessons','https://newyorkvocalcoaching.com/about/'),
  ('vocal-nicolas-hormazabal','technique-contemporary-vocal','https://newyorkvocalcoaching.com/about/'),
  ('vocal-nicolas-hormazabal','genre-pop','https://newyorkvocalcoaching.com/about/'),
  ('vocal-nicolas-hormazabal','genre-rock','https://newyorkvocalcoaching.com/about/'),
  ('vocal-ameer-corro','training-voice-lessons','https://newyorkvocalcoaching.com/about/'),
  ('vocal-ameer-corro','genre-jazz-cabaret','https://newyorkvocalcoaching.com/about/'),
  ('vocal-ameer-corro','genre-gospel','https://newyorkvocalcoaching.com/about/'),
  ('vocal-ameer-corro','genre-rnb-soul','https://newyorkvocalcoaching.com/about/'),
  ('vocal-ameer-corro','genre-pop','https://newyorkvocalcoaching.com/about/'),
  ('vocal-ameer-corro','genre-rock','https://newyorkvocalcoaching.com/about/'),
  ('vocal-christina-wuenn','training-voice-lessons','https://newyorkvocalcoaching.com/about/'),
  ('vocal-christina-wuenn','genre-musical-theatre','https://newyorkvocalcoaching.com/about/'),
  ('vocal-christina-wuenn','genre-pop','https://newyorkvocalcoaching.com/about/'),
  ('vocal-christina-wuenn','genre-rnb-soul','https://newyorkvocalcoaching.com/about/'),
  ('vocal-christina-wuenn','genre-jazz-cabaret','https://newyorkvocalcoaching.com/about/'),
  ('vocal-christina-wuenn','genre-classical-opera','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jamie-kaufman','training-voice-lessons','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jamie-kaufman','genre-jazz-cabaret','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jamie-kaufman','genre-musical-theatre','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jamie-kaufman','genre-classical-opera','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jamie-kaufman','genre-pop','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jamie-kaufman','genre-rnb-soul','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jess-maison','training-voice-lessons','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jess-maison','specialty-songwriting','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jess-maison','genre-pop','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jess-maison','genre-rnb-soul','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jess-maison','genre-musical-theatre','https://newyorkvocalcoaching.com/about/'),
  ('vocal-jess-maison','genre-latin','https://newyorkvocalcoaching.com/about/'),
  ('vocal-roberto-crippa','training-voice-lessons','https://newyorkvocalcoaching.com/about/'),
  ('vocal-roberto-crippa','genre-musical-theatre','https://newyorkvocalcoaching.com/about/'),
  ('vocal-roberto-crippa','genre-pop','https://newyorkvocalcoaching.com/about/'),
  ('vocal-charlotte-surkin','training-voice-lessons','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-charlotte-surkin','technique-vocal','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-charlotte-surkin','technique-repertoire','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-charlotte-surkin','specialty-voice-therapy','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-charlotte-surkin','genre-classical-opera','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-charlotte-surkin','genre-musical-theatre','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-charlotte-surkin','genre-pop','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-charlotte-surkin','genre-rnb-soul','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-charlotte-surkin','genre-country-folk-world','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-elissa-weiss','training-voice-lessons','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-elissa-weiss','technique-vocal','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-elissa-weiss','specialty-music-theory','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-elissa-weiss','genre-classical-opera','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-elissa-weiss','genre-musical-theatre','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-elissa-weiss','genre-rock','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-elissa-weiss','genre-pop','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-elissa-weiss','genre-country-folk-world','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-lisa-rochelle','training-voice-lessons','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-lisa-rochelle','technique-vocal','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-lisa-rochelle','genre-musical-theatre','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-lisa-rochelle','genre-rock','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-lisa-rochelle','genre-pop','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-debra-wiley-hart','training-voice-lessons','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-debra-wiley-hart','technique-vocal','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-debra-wiley-hart','technique-repertoire','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-debra-wiley-hart','training-acting-coaching','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-debra-wiley-hart','specialty-voice-therapy','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-debra-wiley-hart','genre-classical-opera','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-debra-wiley-hart','genre-musical-theatre','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-jan-horvath','training-voice-lessons','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-jan-horvath','technique-vocal','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-jan-horvath','technique-repertoire','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-jan-horvath','training-acting-coaching','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-jan-horvath','genre-classical-opera','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-jan-horvath','genre-musical-theatre','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-jan-horvath','genre-jazz-cabaret','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-jan-horvath','genre-rock','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-jan-horvath','genre-country-folk-world','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-paula-liscio','training-voice-lessons','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-paula-liscio','technique-vocal','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-paula-liscio','technique-repertoire','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-paula-liscio','training-acting-coaching','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-paula-liscio','specialty-career-counseling','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-paula-liscio','genre-classical-opera','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-paula-liscio','genre-musical-theatre','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-paula-liscio','genre-jazz-cabaret','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-dawn-winiarz','training-voice-lessons','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-dawn-winiarz','technique-vocal','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-dawn-winiarz','genre-classical-opera','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-dawn-winiarz','genre-musical-theatre','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-dawn-winiarz','genre-jazz-cabaret','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-dawn-winiarz','genre-rock','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-dawn-winiarz','genre-pop','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-dawn-winiarz','genre-rnb-soul','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-dawn-winiarz','genre-gospel','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-dawn-winiarz','genre-country-folk-world','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-david-sabella','training-voice-lessons','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-david-sabella','technique-vocal','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-david-sabella','technique-repertoire','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-david-sabella','training-acting-coaching','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-david-sabella','specialty-career-counseling','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-david-sabella','genre-classical-opera','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-david-sabella','genre-musical-theatre','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-david-sabella','genre-rock','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-david-sabella','genre-rnb-soul','https://nyst.org/find-a-voice-teacher/'),
  ('vocal-david-sabella','genre-country-folk-world','https://nyst.org/find-a-voice-teacher/')
)
INSERT INTO instructor_terms (instructor_id, term_id, verification_status, source_url, verified_at)
SELECT instructor_id, term_id, 'verified', source_url, date('now') FROM instructor_term_rows;

INSERT INTO field_evidence (entity_type, entity_id, field_name, verification_status, source_url, verified_at, note)
SELECT 'instructor', id, 'profile', 'verified', source_url, date('now'),
  CASE WHEN id IN (
    'vocal-justin-stoney', 'vocal-andy-king', 'vocal-andrea-grody', 'vocal-kacey-velazquez',
    'vocal-tim-rosser', 'vocal-abby-payne', 'vocal-nicolas-hormazabal', 'vocal-ameer-corro',
    'vocal-christina-wuenn', 'vocal-jamie-kaufman', 'vocal-jess-maison', 'vocal-roberto-crippa'
  ) THEN 'Identity and teaching specialties checked against the NYVC staff roster.'
  ELSE 'Teacher and service listing checked against the NYSTA voice-teacher directory.' END
FROM instructors WHERE id LIKE 'vocal-%';

INSERT INTO field_evidence (entity_type, entity_id, field_name, verification_status, source_url, verified_at, note)
SELECT 'location', id, 'location', 'verified',
  CASE WHEN id IN ('location-vocal-midtown', 'location-vocal-online')
    THEN 'https://newyorkvocalcoaching.com/contact'
    ELSE 'https://nyst.org/find-a-voice-teacher/' END,
  date('now'), 'NYC studio or online lesson availability listed by the source.'
FROM locations WHERE id LIKE 'location-vocal-%';

INSERT INTO research_sources (entity_type, entity_id, source_url, source_type, verification_status, checked_at, note)
SELECT 'instructor', id, source_url,
  CASE WHEN id IN (
    'vocal-justin-stoney', 'vocal-andy-king', 'vocal-andrea-grody', 'vocal-kacey-velazquez',
    'vocal-tim-rosser', 'vocal-abby-payne', 'vocal-nicolas-hormazabal', 'vocal-ameer-corro',
    'vocal-christina-wuenn', 'vocal-jamie-kaufman', 'vocal-jess-maison', 'vocal-roberto-crippa'
  ) THEN 'official_website' ELSE 'other' END,
  'verified', date('now'),
  CASE WHEN id IN (
    'vocal-justin-stoney', 'vocal-andy-king', 'vocal-andrea-grody', 'vocal-kacey-velazquez',
    'vocal-tim-rosser', 'vocal-abby-payne', 'vocal-nicolas-hormazabal', 'vocal-ameer-corro',
    'vocal-christina-wuenn', 'vocal-jamie-kaufman', 'vocal-jess-maison', 'vocal-roberto-crippa'
  ) THEN 'Official New York Vocal Coaching staff roster reviewed.'
  ELSE 'Professional association directory listing reviewed; personal website and booking details were not supplied.' END
FROM instructors WHERE id LIKE 'vocal-%';

INSERT INTO offerings
  (id, slug, provider_id, name, description, source_url, instruction_mode, listing_status, origin)
VALUES
  ('offering-nyvc-group-singing', 'new-york-vocal-coaching-group-singing-classes',
   'provider-new-york-vocal-coaching', 'Group Singing Classes',
   'New York Vocal Coaching lists group singing classes. Check the official service page for current dates, availability, format and pricing.',
   'https://newyorkvocalcoaching.com/services', 'group', 'published', 'seeded');

INSERT INTO offering_locations (offering_id, location_id)
VALUES ('offering-nyvc-group-singing', 'location-vocal-midtown');

INSERT INTO offering_terms (offering_id, term_id, verification_status, source_url, verified_at)
VALUES
  ('offering-nyvc-group-singing', 'training-group-singing', 'verified', 'https://newyorkvocalcoaching.com/services', date('now')),
  ('offering-nyvc-group-singing', 'training-voice-lessons', 'verified', 'https://newyorkvocalcoaching.com/services', date('now'));

INSERT INTO field_evidence (entity_type, entity_id, field_name, verification_status, source_url, verified_at, note)
VALUES
  ('provider', 'provider-new-york-vocal-coaching', 'profile', 'verified', 'https://newyorkvocalcoaching.com/', date('now'), 'Official studio website reviewed.'),
  ('provider', 'provider-new-york-vocal-coaching', 'location', 'verified', 'https://newyorkvocalcoaching.com/contact', date('now'), 'Official contact page lists the Midtown Manhattan studio address.'),
  ('offering', 'offering-nyvc-group-singing', 'description', 'verified', 'https://newyorkvocalcoaching.com/services', date('now'), 'Official service page lists group singing classes; schedule and price are not published here.');

INSERT INTO research_sources (entity_type, entity_id, source_url, source_type, verification_status, checked_at, note)
VALUES
  ('provider', 'provider-new-york-vocal-coaching', 'https://newyorkvocalcoaching.com/', 'official_website', 'verified', date('now'), 'Official New York Vocal Coaching website reviewed.'),
  ('offering', 'offering-nyvc-group-singing', 'https://newyorkvocalcoaching.com/services', 'official_website', 'verified', date('now'), 'Official service page lists group singing classes; no current price or schedule was represented.');
