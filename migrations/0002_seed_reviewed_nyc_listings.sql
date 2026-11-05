INSERT OR IGNORE INTO taxonomy_terms (id, taxonomy, term, slug) VALUES
 ('technique-stella-adler','technique','Stella Adler','stella-adler'),
 ('specialty-dialect','specialty','Dialect Coaching','dialect-coaching');

INSERT INTO providers (id, slug, listing_type, name, description, teaching_approach, website_url, source_url, listing_status, origin)
VALUES
 ('provider-acting-studio-ny','the-acting-studio-new-york','studio','The Acting Studio – New York',
  'Acting training for theatre, film and television, including a structured Meisner program, scene study and private coaching.',
  'Meisner-based training and rehearsal technique.', 'https://www.actingstudio.com/', 'https://www.actingstudio.com/acting-classes/meisner/', 'published','seeded'),
 ('provider-stella-adler','stella-adler-studio-of-acting','school','Stella Adler Studio of Acting',
  'Acting technique, scene study, movement, improvisation, and voice and speech training in New York City.',
  'Training grounded in Stella Adler’s acting technique.', 'https://stellaadler.com/', 'https://classes.stellaadler.com/workshops/drop-in-class-tech-fundamentals/', 'published','seeded'),
 ('provider-ucb-nyc','upright-citizens-brigade-nyc','studio','Upright Citizens Brigade · New York',
  'A structured comedy and improv training program with in-person New York and online classes.',
  'Improv curriculum progressing from fundamentals through Harold structure and performance.', 'https://ucbcomedy.com/', 'https://ucbcomedy.com/training-center/improv-program/', 'published','seeded'),
 ('provider-acting-gym','the-acting-gym-nyc','studio','The Acting Gym NYC',
  'Professional acting classes, private lessons, audition coaching and on-camera training for theatre, film and television.',
  'Scene work focused on breaking down scripts and playing truthful, specific moments.', 'https://actinggym.nyc/', 'https://actinggym.nyc/classes/', 'published','seeded'),
 ('provider-sam-lilja','sam-lilja-dialect-coaching','coach','Sam Lilja · Dialect Coaching',
  'Dialect coaching for actors, offered by Juilliard-trained dialect coach and actor Sam Lilja.',
  NULL, NULL, 'https://actinggym.nyc/classes/', 'published','seeded'),
 ('provider-jason-bennett','jason-bennett-acting-coaching','coach','Jason Bennett · Acting & Audition Coaching',
  'Private work on auditions, self-tapes, scenes, monologues, voice and acting craft. Online sessions are available; inquire about in-person arrangements.',
  'Individualized work across body, voice, imagination and craft.', 'https://www.jbactors.nyc/services-code/private-coaching', 'https://www.jbactors.nyc/services-code/private-coaching', 'published','seeded');

INSERT INTO locations (id, label, city, region, borough, neighborhood, postal_address, is_online)
VALUES
 ('location-midtown-west','Midtown West, Manhattan','New York','NY','Manhattan','Midtown West','248 W 35th St, 14th Floor, New York, NY 10001',0),
 ('location-nomad','NoMad, Manhattan','New York','NY','Manhattan','NoMad','31 W 27th St, Floor 3, New York, NY 10001',0),
 ('location-east-14','East 14th Street, Manhattan','New York','NY','Manhattan','Union Square','239 E 14th St, New York, NY 10003',0),
 ('location-nyc-unspecified','New York City','New York','NY',NULL,NULL,NULL,0),
 ('location-online','Online','New York','NY',NULL,NULL,NULL,1);

INSERT INTO provider_locations (provider_id, location_id, is_primary) VALUES
 ('provider-acting-studio-ny','location-midtown-west',1),
 ('provider-stella-adler','location-nomad',1),
 ('provider-ucb-nyc','location-east-14',1),
 ('provider-acting-gym','location-nyc-unspecified',1),
 ('provider-sam-lilja','location-nyc-unspecified',1),
 ('provider-jason-bennett','location-online',1);

INSERT INTO instructors (id, name, description, website_url) VALUES
 ('instructor-james-price','James Price','Founder and instructor at The Acting Studio – New York.','https://www.actingstudio.com/'),
 ('instructor-ryan-chittaphong','Ryan Chittaphong','Director of Artistic & Student Engagement at Stella Adler Studio of Acting.','https://stellaadler.com/'),
 ('instructor-brian-carter','Brian J. Carter','Instructor of The Acting Gym NYC adult professional acting class.','https://actinggym.nyc/classes/'),
 ('instructor-sam-lilja','Sam Lilja','Juilliard-trained dialect coach and actor.','https://actinggym.nyc/classes/'),
 ('instructor-jason-bennett','Jason Bennett','Acting and audition coach.','https://www.jbactors.nyc/services-code/private-coaching');

INSERT INTO provider_instructors (provider_id, instructor_id) VALUES
 ('provider-acting-studio-ny','instructor-james-price'),
 ('provider-stella-adler','instructor-ryan-chittaphong'),
 ('provider-acting-gym','instructor-brian-carter'),
 ('provider-acting-gym','instructor-sam-lilja'),
 ('provider-jason-bennett','instructor-jason-bennett');

INSERT INTO offerings (id, slug, provider_id, name, description, registration_url, format, price_min, price_max, currency, price_basis, session_count, schedule_text, skill_level, audition_required, interview_required, instruction_mode, source_url, listing_status, origin)
VALUES
 ('offering-intro-meisner','intro-to-meisner-acting-technique','provider-acting-studio-ny','Intro to Meisner – Acting Technique',
  'A ten-week introduction to Meisner technique with twenty classes, progressing from repetition exercises to scene work. The school describes it as a starting point for beginners; its admissions process includes screening.',
  'https://www.actingstudio.com/acting-classes/beginners/acting-for-beginners-meisner-technique/','in_person',700,700,'USD','full_course',20,'10 weeks; schedule varies by session','beginner',NULL,1,'group','https://www.actingstudio.com/acting-classes/meisner/','published','seeded'),
 ('offering-acting-studio-private','private-acting-coaching-acting-studio','provider-acting-studio-ny','Private Acting Coaching',
  'Private coaching for auditions, monologues, scene study, voice and speech, and related performance work. The studio notes that it does not teach acting through ongoing private one-to-one sessions.',
  'https://www.actingstudio.com/acting-classes/actors/private-acting-coaching/','hybrid',95,95,'USD','hourly',NULL,'By arrangement','all levels',NULL,NULL,'private','https://www.actingstudio.com/acting-classes/actors/private-acting-coaching/','published','seeded'),
 ('offering-stella-dropin','stella-adler-technique-fundamentals-drop-in','provider-stella-adler','Stella Adler’s Acting Technique: The Fundamentals',
  'A two-hour drop-in seminar introducing the fundamentals of Stella Adler’s acting technique. One class commitment; the page states all experience levels are welcome and no application or interview is required.',
  'https://classes.stellaadler.com/workshops/drop-in-class-tech-fundamentals/','in_person',40,40,'USD','per_session',1,'Upcoming sessions vary; see provider page for current dates.','all levels',0,0,'group','https://classes.stellaadler.com/workshops/drop-in-class-tech-fundamentals/','published','seeded'),
 ('offering-ucb-improv101','ucb-improv-101-nyc','provider-ucb-nyc','Improv 101: Improv Basics',
  'Introductory improv class focused on UCB’s game-of-the-scene approach. NYC sections meet in person; the provider also offers online sections.',
  'https://ucbcomedy.com/training-center/improv-program/','in_person',475,525,'USD','full_course',NULL,'Published NYC sections vary by cohort; dates and availability change frequently.','beginner',NULL,NULL,'group','https://ucbcomedy.com/training-center/improv-program/','published','seeded'),
 ('offering-acting-gym-class','acting-gym-professional-acting-class-nyc','provider-acting-gym','Professional Acting Class for Adults',
  'Adult professional acting class with audition sides and scene work, focused on bringing an actor’s own identity and inner truth to a character.',
  'https://actinggym.nyc/classes/','in_person',450,450,'USD','full_course',NULL,'Published dates and weekly schedule vary by session.','professional',NULL,NULL,'group','https://actinggym.nyc/classes/','published','seeded'),
 ('offering-acting-gym-private','acting-gym-private-coaching','provider-acting-gym','Private Coaching for Advanced Skills',
  'Individual or small-group coaching tailored to a student’s skill goals.',
  'https://actinggym.nyc/classes/','in_person',100,100,'USD','hourly',NULL,'By arrangement','advanced',NULL,NULL,'both','https://actinggym.nyc/classes/','published','seeded'),
 ('offering-sam-dialect','sam-lilja-dialect-coaching','provider-sam-lilja','Dialect Coaching',
  'Dialect coaching with Sam Lilja, a Juilliard-trained dialect coach and actor.',
  'https://actinggym.nyc/classes/','hybrid',100,100,'USD','hourly',NULL,'By arrangement',NULL,NULL,NULL,'private','https://actinggym.nyc/classes/','published','seeded'),
 ('offering-jason-bennett-private','jason-bennett-private-acting-coaching','provider-jason-bennett','Private Acting & Audition Coaching',
  'One-to-one work on auditions, self-tapes, scenes, monologues, voice and acting craft. Online sessions are available; ask about in-person arrangements.',
  'https://www.jbactors.nyc/services-code/private-coaching','online',250,250,'USD','per_session',NULL,'75-minute minimum; four-session package also listed.','all levels',NULL,NULL,'private','https://www.jbactors.nyc/services-code/private-coaching','published','seeded');

INSERT INTO offering_locations (offering_id, location_id) VALUES
 ('offering-intro-meisner','location-midtown-west'),
 ('offering-acting-studio-private','location-midtown-west'),
 ('offering-acting-studio-private','location-online'),
 ('offering-stella-dropin','location-nomad'),
 ('offering-ucb-improv101','location-east-14'),
 ('offering-acting-gym-class','location-nyc-unspecified'),
 ('offering-acting-gym-private','location-nyc-unspecified'),
 ('offering-sam-dialect','location-nyc-unspecified'),
 ('offering-jason-bennett-private','location-online');

INSERT INTO offering_instructors (offering_id, instructor_id) VALUES
 ('offering-intro-meisner','instructor-james-price'),
 ('offering-stella-dropin','instructor-ryan-chittaphong'),
 ('offering-acting-gym-class','instructor-brian-carter'),
 ('offering-sam-dialect','instructor-sam-lilja'),
 ('offering-jason-bennett-private','instructor-jason-bennett');

INSERT INTO offering_terms (offering_id, term_id, verification_status, source_url, verified_at) VALUES
 ('offering-intro-meisner','technique-meisner','verified','https://www.actingstudio.com/acting-classes/meisner/','2026-11-05'),
 ('offering-intro-meisner','training-acting-classes','verified','https://www.actingstudio.com/acting-classes/beginners/acting-for-beginners-meisner-technique/','2026-11-05'),
 ('offering-acting-studio-private','training-audition','verified','https://www.actingstudio.com/acting-classes/actors/private-acting-coaching/','2026-11-05'),
 ('offering-acting-studio-private','training-scene-study','verified','https://www.actingstudio.com/acting-classes/actors/private-acting-coaching/','2026-11-05'),
 ('offering-stella-dropin','technique-stella-adler','verified','https://classes.stellaadler.com/workshops/drop-in-class-tech-fundamentals/','2026-11-05'),
 ('offering-stella-dropin','training-acting-classes','verified','https://classes.stellaadler.com/workshops/drop-in-class-tech-fundamentals/','2026-11-05'),
 ('offering-stella-dropin','training-workshops','verified','https://classes.stellaadler.com/workshops/drop-in-class-tech-fundamentals/','2026-11-05'),
 ('offering-ucb-improv101','training-improv','verified','https://ucbcomedy.com/training-center/improv-program/','2026-11-05'),
 ('offering-acting-gym-class','training-on-camera','verified','https://actinggym.nyc/classes/','2026-11-05'),
 ('offering-acting-gym-class','training-audition','verified','https://actinggym.nyc/classes/','2026-11-05'),
 ('offering-sam-dialect','specialty-dialect','verified','https://actinggym.nyc/classes/','2026-11-05');

INSERT INTO provider_terms (provider_id, term_id, verification_status, source_url, verified_at) VALUES
 ('provider-acting-studio-ny','technique-meisner','verified','https://www.actingstudio.com/acting-classes/meisner/','2026-11-05'),
 ('provider-acting-studio-ny','training-acting-classes','verified','https://www.actingstudio.com/acting-classes/actors/','2026-11-05'),
 ('provider-stella-adler','technique-stella-adler','verified','https://classes.stellaadler.com/workshops/drop-in-class-tech-fundamentals/','2026-11-05'),
 ('provider-stella-adler','training-acting-classes','verified','https://classes.stellaadler.com/workshops/eip/','2026-11-05'),
 ('provider-ucb-nyc','training-improv','verified','https://ucbcomedy.com/training-center/improv-program/','2026-11-05'),
 ('provider-acting-gym','training-scene-study','verified','https://actinggym.nyc/classes/','2026-11-05'),
 ('provider-acting-gym','training-on-camera','verified','https://actinggym.nyc/classes/','2026-11-05'),
 ('provider-sam-lilja','specialty-dialect','verified','https://actinggym.nyc/classes/','2026-11-05');

INSERT INTO field_evidence (entity_type, entity_id, field_name, verification_status, source_url, verified_at) VALUES
 ('provider','provider-acting-studio-ny','description','verified','https://www.actingstudio.com/acting-classes/meisner/','2026-11-05'),
 ('provider','provider-stella-adler','description','verified','https://classes.stellaadler.com/workshops/drop-in-class-tech-fundamentals/','2026-11-05'),
 ('provider','provider-ucb-nyc','description','verified','https://ucbcomedy.com/training-center/improv-program/','2026-11-05'),
 ('provider','provider-acting-gym','description','verified','https://actinggym.nyc/classes/','2026-11-05'),
 ('provider','provider-sam-lilja','description','verified','https://actinggym.nyc/classes/','2026-11-05'),
 ('provider','provider-jason-bennett','description','verified','https://www.jbactors.nyc/services-code/private-coaching','2026-11-05'),
 ('provider','provider-acting-studio-ny','location','verified','https://www.actingstudio.com/studio/location/','2026-11-05'),
 ('provider','provider-stella-adler','location','verified','https://stellaadler.com/venue/studio-1-at-stella-adler-studio/','2026-11-05'),
 ('provider','provider-ucb-nyc','location','verified','https://ucbcomedy.com/venues/','2026-11-05'),
 ('location','location-midtown-west','borough','verified','https://www.actingstudio.com/studio/location/','2026-11-05'),
 ('location','location-nomad','borough','verified','https://stellaadler.com/venue/studio-1-at-stella-adler-studio/','2026-11-05'),
 ('location','location-east-14','borough','verified','https://ucbcomedy.com/venues/','2026-11-05'),
 ('location','location-online','is_online','verified','https://www.actingstudio.com/acting-classes/actors/private-acting-coaching/','2026-11-05'),
 ('offering','offering-intro-meisner','price','verified','https://www.actingstudio.com/acting-classes/meisner/','2026-11-05'),
 ('offering','offering-intro-meisner','format','verified','https://www.actingstudio.com/acting-classes/meisner/','2026-11-05'),
 ('offering','offering-intro-meisner','description','verified','https://www.actingstudio.com/acting-classes/meisner/','2026-11-05'),
 ('offering','offering-stella-dropin','price','verified','https://classes.stellaadler.com/workshops/drop-in-class-tech-fundamentals/','2026-11-05'),
 ('offering','offering-stella-dropin','format','verified','https://classes.stellaadler.com/workshops/drop-in-class-tech-fundamentals/','2026-11-05'),
 ('offering','offering-stella-dropin','description','verified','https://classes.stellaadler.com/workshops/drop-in-class-tech-fundamentals/','2026-11-05'),
 ('offering','offering-ucb-improv101','price','verified','https://ucbcomedy.com/training-center/improv-program/','2026-11-05'),
 ('offering','offering-ucb-improv101','format','verified','https://ucbcomedy.com/training-center/improv-program/','2026-11-05'),
 ('offering','offering-ucb-improv101','description','verified','https://ucbcomedy.com/training-center/improv-program/','2026-11-05'),
 ('offering','offering-acting-gym-class','price','verified','https://actinggym.nyc/classes/','2026-11-05'),
 ('offering','offering-acting-gym-class','format','verified','https://actinggym.nyc/classes/','2026-11-05'),
 ('offering','offering-acting-gym-class','description','verified','https://actinggym.nyc/classes/','2026-11-05'),
 ('offering','offering-acting-studio-private','price','verified','https://www.actingstudio.com/acting-classes/actors/private-acting-coaching/','2026-11-05'),
 ('offering','offering-acting-gym-private','price','verified','https://actinggym.nyc/classes/','2026-11-05'),
 ('offering','offering-sam-dialect','price','verified','https://actinggym.nyc/classes/','2026-11-05'),
 ('offering','offering-acting-studio-private','format','verified','https://www.actingstudio.com/acting-classes/actors/private-acting-coaching/','2026-11-05'),
 ('offering','offering-jason-bennett-private','price','verified','https://www.jbactors.nyc/services-code/private-coaching','2026-11-05'),
 ('offering','offering-jason-bennett-private','format','verified','https://www.jbactors.nyc/services-code/private-coaching','2026-11-05');
