// Edit this file to change the party. One place for the words guests see.
// Friday 27 November 2026, 7:30pm, 8 Dereham Place, London EC2A 3HJ.

import { LEAD } from '../public/js/catalog.js';

export const EVENT = Object.freeze({
  title: 'Bring your own vibe',
  kicker: 'Friday night · Shoreditch',
  hook: 'A room you make together. Bring a little for the table and a piece of your own vibe, and meet each other as humans. Come as you are.',
  when: 'Friday 27 November 2026',
  time: '7:30pm onwards',
  place: '8 Dereham Place, London EC2A 3HJ',
  neighbourhood: 'Shoreditch',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=8+Dereham+Place%2C+London+EC2A+3HJ',
  // EC2A centroid from the bundled outcode table. Visiting guests are pinned near here.
  lat: 51.52369,
  lng: -0.08548,
  themes: [
    {
      q: LEAD.missing,
      text: 'Say it plain. People here are bringing what they can offer, and the two get introduced.',
    },
    {
      q: LEAD.hiddenSide,
      text: 'The part that has been quiet. Bring it into the room. It can become the conversation.',
    },
  ],
  intent: [
    'Two questions for the night: what is missing, and which side of you has not had a room in a while.',
    'No "what do you do?". Work stays at the door. Talk as humans.',
  ],
  bring: [
    { title: 'Something small for the table', text: 'A drink, a snack, some fruit. Enough to share, not a performance.' },
    { title: 'A piece of your vibe', text: 'A few songs or a short DJ set, tarot cards, a question, a game. Whatever you would love the room to have.' },
  ],
  footnote: 'Aleksandar is hosting, the weekend before he heads to Vietnam.',
  playlistLabel: "Tonight's playlist",
});

export function publicEvent({ playlistUrl = '' } = {}) {
  return {
    title: EVENT.title,
    kicker: EVENT.kicker,
    hook: EVENT.hook,
    when: EVENT.when,
    time: EVENT.time,
    place: EVENT.place,
    neighbourhood: EVENT.neighbourhood,
    mapsUrl: EVENT.mapsUrl,
    themes: EVENT.themes,
    intent: EVENT.intent,
    bring: EVENT.bring,
    footnote: EVENT.footnote,
    playlistUrl: playlistUrl || '',
    playlistLabel: EVENT.playlistLabel,
  };
}
