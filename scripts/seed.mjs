#!/usr/bin/env node
// Adds sample guests (with secrets and wishes) for demos/testing.
//   npm run seed [-- --clear] [-- --count N] [-- --db FILE]
// Writes to ./demo.sqlite by default, never the party database, so the real
// board starts empty. `npm run demo` seeds it and serves it on port 3001.
// Pass --db whoswho.sqlite only if you really want samples on the real board.

import { openDb } from '../src/db.js';
import { ANIMALS } from '../public/js/animals.js';

const args = process.argv.slice(2);
const clear = args.includes('--clear');
const countIdx = args.indexOf('--count');
const dbIdx = args.indexOf('--db');
const DEMO_DB = 'demo.sqlite';
const file = dbIdx >= 0 ? args[dbIdx + 1] : DEMO_DB;

// [name, postcode district, pin colour, secrets [text, 'self'|'friend'], wish]
// LIVES: "my life as my animal" in their words; STORIES: ready-made stories so
// the demo shows them without an API key (the rest show their own words).
const SAMPLES = [
  ['Maya', 'E8', 'pink', [['lived on a canal boat for three winters', 'friend'], ["can't whistle, at all", 'self']], 'a flat with an actual bath'],
  ['Tom', 'N16', 'yellow', [['has been to 100 countries and is counting', 'friend']], 'someone to start a band with'],
  ['Priya', 'SE15', 'blue', [['plays piano by ear and never learned to read music', 'friend'], ['ran a supper club out of a launderette', 'self']], 'eight hours of sleep, just once'],
  ['Jonas', 'E2', 'mint', [['grew up on a goat farm in the Alps', 'self']], 'a reason to go back to Lisbon'],
  ['Leila', 'SW9', 'orange', [['speaks five languages and swears in seven', 'friend']], 'a dog (the landlord says no)'],
  ['Sam', 'NW5', 'pink', [['hitchhiked from Lisbon to Istanbul', 'friend'], ['built a sauna in a back garden', 'friend']], 'more sauna, less email'],
  ['Ines', 'W11', 'blue', [['was an extra in a spy film', 'self']], "a tennis partner who won't go easy"],
  ['Kofi', 'SE22', 'yellow', [['once cooked for 300 people at a festival', 'friend']], 'good sourdough within walking distance'],
  ['Hana', 'N1', 'mint', [['keeps bees on a rooftop', 'friend'], ['has a twin nobody here has met', 'self']], 'to finally learn Spanish'],
  ['Felix', 'E17', 'orange', [['learned to surf at forty', 'self']], 'fewer meetings'],
  ['Zara', 'SW11', 'pink', [['DJed a wedding in a cave', 'friend']], 'a co-founder who loves maps'],
  ['Oli', 'NW1', 'blue', [['worked on a cruise ship as a magician', 'friend']], 'a long walk with no phone'],
  ['Noor', 'E14', 'yellow', [['swam across a lake at dawn on her birthday', 'friend']], 'somebody to cook for'],
  ['Ben', 'SE10', 'mint', [['moved to London with one suitcase and a ukulele', 'self']], 'a garden, even a tiny one'],
  ['Ana', 'N7', 'orange', [["collects old maps of cities she's never been to", 'friend']], 'a sabbatical'],
  ['Marek', 'W6', 'pink', [["can solve a Rubik's cube in under a minute", 'friend']], 'one more summer like 2019'],
  ['Chloe', 'SE1', 'blue', [['knows how to milk a camel', 'friend'], ['was a ballroom champion at twelve', 'friend']], 'a trip somewhere with no wifi'],
  ['Dev', 'E5', 'yellow', [['wrote a whole novel, burned it, and is starting again', 'self']], 'an editor, or a deadline'],
  ['Rosa', 'SW4', 'mint', [['has a tattoo of a tram', 'friend']], "a bike that doesn't get stolen"],
  ['Luca', 'N4', 'orange', [['got stuck in a lift with a pop star', 'friend']], 'a proper Italian espresso in London'],
  ['Yuki', 'W2', 'pink', [['ran a marathon dressed as a teapot', 'friend']], 'a quiet Sunday'],
  ['Ade', 'SE5', 'blue', [['sleeps with socks on, even in August', 'friend']], 'people to play five-a-side with'],
];
const LIVES = {
  "Maya": "I'd live under a houseboat on the Regent's Canal, raid bins in Broadway Market and nap all day on warm car bonnets.",
  "Tom": "Sleep sixteen hours, knock one glass off one table per day, and judge everyone from the top of the bookshelf.",
  "Priya": "Hibernate from November to March, wake up for pancakes, and play piano for the other bears.",
  "Jonas": "Big family burrow in Bethnal Green, a strict carrot budget and very fast exits from parties.",
  "Leila": "I'd sit on a lily pad in Brockwell Lido and give unsolicited advice to swimmers in five languages.",
  "Sam": "Eat bamboo in a sauna, roll down Parliament Hill, avoid every email forever.",
  "Ines": "Up all night in Holland Park, sleeping through the day, secretly watching tennis from a tree.",
  "Kofi": "Running a truffle-hunting supper club in Peckham, nose first, no reservations.",
  "Hana": "Lounging on a rooftop in Islington with my bees, roaring only on Sundays.",
  "Felix": "Learning to surf on the Walthamstow reservoirs and growling at anyone who books a meeting."
};
const STORIES = {
  "Maya": "Maya the fox lives under a houseboat called The Wordsworth, which she believes is named after her. Every night she raids the bins of Broadway Market with the precision of a jewel thief, but only takes the good sourdough crusts. By day she naps on warm car bonnets in a strict rotation that local drivers have begun to plan their parking around.\n\nThen someone leaves a jar of marmalade on her favourite bonnet, with a note: For the landlady. Maya has never been called a landlady before. She buys a tiny clipboard. The houseboat now has rules, a bath rota, and a waiting list.",
  "Tom": "Tom the cat sleeps sixteen hours a day and spends the other eight deciding which glass to push off which table. It is, he insists, a curated practice. Stoke Newington's cafés have started leaving out decoy glasses, labelled with the date, like a gallery.\n\nOne morning a pigeon with a business plan offers to manage him. There are tours now. Tourists gather in silence as Tom approaches the edge, paw raised. He looks at them. He looks at the glass. He goes back to sleep. They give him a standing ovation, which wakes him up, which is the only thing he has ever regretted.",
  "Ines": "Ines the owl is awake all night in Holland Park, which means she has watched every tennis match on the public courts for eleven years, mostly from a sycamore. She knows everyone's backhand. She has opinions about all of them.\n\nThe trouble starts when she begins leaving notes on the benches. Bend your knees, signed, a friend. By spring the whole park plays like a coached team, and the council wants to know who the mysterious trainer is. Ines will not come down from the tree. But on Thursdays, if you serve well at midnight, something in the branches says, very quietly, hoo.",
  "Kofi": "Kofi the pig runs a truffle-hunting supper club out of a Peckham railway arch, nose first and with no reservations, which is both a policy and a personality. Guests sit at one long table while Kofi snuffles through the potted plants for the evening's main ingredient.\n\nThe truffles are not always truffles. Once it was a lost tooth, which he served with great confidence. Once it was a fridge magnet from Lisbon. Nobody complains, because the bread is excellent and Kofi gives a little speech before every course about how close he came. The waiting list is two years long."
};
const count = countIdx >= 0 ? Number(args[countIdx + 1]) : SAMPLES.length;

const db = openDb(file);
if (clear) console.log(`cleared ${db.deleteAllGuests()} guests`);
const made = [];
for (let i = 0; i < count; i++) {
  const [name, postcode, color, , need] = SAMPLES[i % SAMPLES.length];
  const suffix = i >= SAMPLES.length ? ` ${Math.floor(i / SAMPLES.length) + 1}` : '';
  const { guest } = db.createGuest({ name: name + suffix, avatar: { animal: ANIMALS[i % ANIMALS.length], color }, need, postcode, life: suffix ? null : LIVES[name] });
  made.push(!suffix && STORIES[name] ? db.setStory(guest.id, STORIES[name]) : guest);
}
// A few guests send more than one lantern.
const MORE_WISHES = { Maya: ['someone to share a canal walk with'], Tom: ['a drummer, specifically'], Hana: ['a Spanish conversation partner', 'more honey jars'], Sam: ['a reason to switch my phone off'] };
for (const g of made) {
  for (const text of MORE_WISHES[g.name] || []) db.addWish(db.raw.prepare('SELECT token FROM guests WHERE id = ?').get(g.id).token, text);
}
let secrets = 0;
made.forEach((g, i) => {
  for (const [text, by] of SAMPLES[i % SAMPLES.length][3]) {
    // "friend" secrets get a random other guest as the (hidden) author
    const author = by === 'self' ? g : made[(i + 1 + secrets) % made.length];
    db.addSecret({ text, aboutId: g.id, by, authorId: author.id });
    secrets++;
  }
});
console.log(`added ${count} sample guests and ${secrets} secrets → ${db.listGuests().length} guests total in ${file}`);
db.close();
