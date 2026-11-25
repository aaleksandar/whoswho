// Edit this file to change the party. One place for the words guests see.
// Friday 27 November 2026, 7:30pm, 8 Dereham Place, London EC2A 3HJ.

export const EVENT = Object.freeze({
  title: "Until I'm back",
  kicker: "Abu's friends",
  hook: 'A bye before his winter in Vietnam.',
  when: 'Friday 27 November 2026',
  time: '7:30pm+',
  place: '8 Dereham Place, London EC2A 3HJ',
  neighbourhood: 'Shoreditch',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=8+Dereham+Place%2C+London+EC2A+3HJ',
  // EC2A centroid from the bundled outcode table. Visiting guests are pinned near here.
  lat: 51.52369,
  lng: -0.08548,
  bringLine: 'A piece of your vibe, and something small to snack or drink.',
  examples: ['music', 'cards', 'questions', 'a drink', 'a snack'],
  noWork: 'No work talk.',
  playlistLabel: 'Playlist',
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
    bringLine: EVENT.bringLine,
    examples: EVENT.examples,
    noWork: EVENT.noWork,
    playlistUrl: playlistUrl || '',
    playlistLabel: EVENT.playlistLabel,
  };
}
