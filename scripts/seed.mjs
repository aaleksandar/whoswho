#!/usr/bin/env node
// Adds sample guests for demos/testing.  npm run seed [-- --clear] [-- --count N]
// Writes straight to the DB file (DB_PATH from the env or .env, else ./whoswho.sqlite). A running server
// picks the new guests up on its next request; refresh /home to see them.

import { openDb } from '../src/db.js';
import { loadEnvFile } from '../src/env.js';
import { randomAvatar } from '../public/js/avatar.js';

const args = process.argv.slice(2);
const clear = args.includes('--clear');
const countIdx = args.indexOf('--count');
const count = countIdx >= 0 ? Number(args[countIdx + 1]) : 20;

const SAMPLES = [
  ['Alex', ['techno', 'climbing', 'ai safety'], 'a climbing partner for Tuesday nights', 'E8 3PB', 'Infra engineer by day, boulderer by night. Usually found at a warehouse rave or worrying about AI alignment.'],
  ['Sam', ['art', 'ceramics', 'natural wine'], 'studio space to share in east London', 'E2', 'Ceramicist with a tiny studio in Bethnal Green. Pottery, orange wine and long lunches.'],
  ['Robin', ['ai safety', 'philosophy', 'chess', 'books'], 'someone to review my alignment paper draft', 'NW1', 'Research fellow working on interpretability. Will talk philosophy of mind until you beg me to stop.'],
  ['Jordan', ['basketball', 'hip hop', 'startups'], 'a technical co-founder who loves sport', 'SE15 4QF', 'Ex-college point guard building a sports-tech startup. Hip hop on loud, always.'],
  ['Charlie', ['scuba diving', 'travel', 'photography'], 'dive buddies for Egypt in March!', 'SW11', 'Freelance photographer chasing reefs and light. 200+ dives and counting.'],
  ['Kai', ['martial arts', 'meditation', 'yoga'], null, 'N16', 'Muay Thai coach and part-time meditation teacher.'],
  ['Riley', ['data science', 'open source', 'board games', 'ai safety'], 'help untangling a gnarly pandas pipeline', 'EC1V', 'Data scientist at a health charity, open source maintainer, board game hoarder.'],
  ['Morgan', ['live music', 'jazz', 'vinyl', 'techno'], 'a +1 for Ronnie Scott\'s on Friday', 'W11', 'Jazz pianist moonlighting in a record shop. Vinyl over everything.'],
  ['Jesse', ['cooking', 'baking', 'gardening'], 'sourdough starter (will trade for chilli plants)', 'SE22', 'Chef on a sabbatical, growing chillies on a south London balcony.'],
  ['Quinn', ['surfing', 'wild swimming', 'climate'], null, 'TW1', 'Climate policy wonk who surfs badly and swims in the Thames year round.'],
  ['Ash', ['film', 'theatre', 'poetry'], 'actors for a no-budget short film', 'N1', 'Writer-director making micro-budget films. Poetry nights on Thursdays.'],
  ['Rowan', ['robotics', 'open source', 'startups', 'data science'], 'beta testers for a plant-watering robot', 'E14', 'Robotics engineer building a plant-watering robot in my spare room.'],
  ['Sasha', ['dancing', 'house music', 'festivals', 'techno'], 'festival crew for Field Day', 'E9', 'Product designer who lives for Sunday afternoon house sets and festival season.'],
  ['Remy', ['football', 'running', 'podcasts'], 'a 5-a-side team that needs a keeper', 'SW9', 'Sports journalist and podcast host. Sunday league keeper, Saturday parkrunner.'],
  ['Nico', ['design', 'fashion', 'art', 'photography'], 'a photographer for a small lookbook shoot', 'W1D', 'Fashion designer and amateur photographer, launching my first small label.'],
  ['Skye', ['anime', 'video games', 'knitting'], null, null, 'Animator. Knits while watching anime, games while it dries.'],
  ['Avery', ['languages', 'travel', 'books', 'coffee'], 'Spanish conversation exchange, coffee on me', 'NW5', 'Translator (Spanish, Portuguese, Italian) who plans trips around coffee shops.'],
  ['Jamie', ['stand-up comedy', 'podcasts', 'film'], 'an audience for my first open mic 😅', 'SE1', 'Comedy writer about to try my first open mic. Film nerd, podcast addict.'],
  ['Frankie', ['volunteering', 'climate', 'gardening', 'cycling'], 'volunteers for a community garden build', 'CR0', 'Runs a community garden in Croydon. Cycles everywhere, volunteers a lot.'],
  ['Ari', ['skateboarding', 'hip hop', 'art', 'vinyl'], 'somewhere to skate indoors in winter', 'HA0', 'Illustrator and skater. Hip hop, spray paint and dusty vinyl.'],
  ['Eden', ['chess', 'board games', 'philosophy'], null, 'KT1', 'Maths teacher, chess club organiser, philosophy book club regular.'],
  ['Billie', ['techno', 'djing', 'live music'], 'a warm-up slot at a small night', 'E5', 'Bedroom DJ trying to get my first proper gig. Techno, live music, more techno.'],
];

loadEnvFile(); // honour DB_PATH from .env
const db = openDb();
if (clear) console.log(`cleared ${db.deleteAllGuests()} guests`);
for (let i = 0; i < count; i++) {
  const [name, vibes, need, postcode, about] = SAMPLES[i % SAMPLES.length];
  const suffix = i >= SAMPLES.length ? ` ${Math.floor(i / SAMPLES.length) + 1}` : '';
  db.createGuest({ name: name + suffix, avatar: randomAvatar(), about, vibes, need, postcode });
}
console.log(`added ${count} sample guests → ${db.listGuests().length} total`);
db.close();
