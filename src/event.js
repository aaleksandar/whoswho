// Edit this file to change the party. One place for the words guests see.
// Friday 27 November 2026, 7:30pm, 8 Dereham Place, London EC2A 3HJ.

export const EVENT = Object.freeze({
  title: "Aleksandar's send-off",
  kicker: 'Before Vietnam',
  hook: 'A Friday night in Shoreditch, the send-off before Aleksandar leaves for Vietnam. For the people he loves and the ones he has only met once. Come as you are. Leave having actually met someone.',
  when: 'Friday 27 November 2026',
  time: '7:30pm onwards',
  place: '8 Dereham Place, London EC2A 3HJ',
  neighbourhood: 'Shoreditch',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=8+Dereham+Place%2C+London+EC2A+3HJ',
  // EC2A centroid from the bundled outcode table. Visiting guests are pinned near here.
  lat: 51.52369,
  lng: -0.08548,
  intent: [
    'This is a send-off before Aleksandar leaves for Vietnam. Close friends, plus people he has met only once, in a room together on purpose.',
    'The point is to meet each other as humans. No "what do you do?". Work stays at the door. Talk about the chapter you are in, what you need, what you can offer, and the question you are carrying.',
  ],
  bring: [
    { title: 'Something small for the table', text: 'A drink, a snack, some fruit. Enough to share, not a performance.' },
    { title: 'A piece of your vibe', text: 'A few songs or a short DJ set, tarot cards, a question, a game. Whatever you would love the room to have.' },
  ],
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
    intent: EVENT.intent,
    bring: EVENT.bring,
    playlistUrl: playlistUrl || '',
    playlistLabel: EVENT.playlistLabel,
  };
}
