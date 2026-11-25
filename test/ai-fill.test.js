import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiPrompt, matchOptions, parseAiAnswers } from '../public/js/ai-fill.js';
import { FOOD, MUSIC } from '../public/js/catalog.js';

test('the prompt names the short card questions and the json keys', () => {
  const prompt = aiPrompt();
  assert.match(prompt, /favourite walk, bar, or café/);
  assert.match(prompt, /most positive thing/);
  assert.match(prompt, /communitiesIn/);
  assert.match(prompt, /communitiesCurious/);
  assert.match(prompt, /Running clubs/);
  assert.match(prompt, /Encode Club/);
  assert.match(prompt, /Shibari/);
  assert.match(prompt, /Interview me/);
  assert.match(prompt, /Until I'm back/);
});

test('json in a fence, with prose around it, fills chips and free text', () => {
  const parsed = parseAiAnswers(`
    Here you go, I drafted this from what I know:
    \`\`\`json
    {
      "name": "Robin",
      "missing": "a quieter room and someone who will listen",
      "hiddenSide": "singing in front of people",
      "chapter": ["Between chapters", "not a real chip"],
      "needTags": "Clarity, a pony",
      "offerTags": ["A listening ear"],
      "interests": ["psychology", "night buses"],
      "music": "deep house music",
      "soundtrack": "Khruangbin",
      "area": "Hackney",
      "bringingKind": "Fruit",
      "bringingText": "clementines",
      "vibeKind": "Cards / tarot",
      "rsvp": "I'll be there",
      "instagram": "@robin",
      "nonsense": "ignore me"
    }
    \`\`\`
    Let me know if you want it warmer.
  `);
  assert.equal(parsed.name, 'Robin');
  assert.match(parsed.missing, /quieter room/);
  assert.match(parsed.hiddenSide, /singing/);
  assert.deepEqual(parsed.chapter, ['between']);
  assert.match(parsed.chapterNote, /not a real chip/);
  assert.deepEqual(parsed.needTags, ['clarity']);
  assert.match(parsed.need, /pony/);
  assert.deepEqual(parsed.offerTags, ['ear']);
  assert.deepEqual(parsed.interests, ['psychology', 'night buses']);
  assert.deepEqual(parsed.music, ['deep house']);
  assert.equal(parsed.soundtrack, 'Khruangbin');
  assert.equal(parsed.areaChip, 'hackney');
  assert.equal(parsed.bringingKind, 'fruit');
  assert.equal(parsed.bringingText, 'clementines');
  assert.equal(parsed.vibeKind, 'cards');
  assert.equal(parsed.rsvp, 'going');
  assert.equal(parsed.links.instagram, '@robin');
  assert.equal(parsed.nonsense, undefined);
});

test('new card fields parse, including in versus curious', () => {
  const parsed = parseAiAnswers(`{
    "spot": "Columbia Road",
    "bright": "a text from an old friend",
    "needTags": ["Rest", "a pony"],
    "communitiesIn": ["Running clubs", "Hackney choir"],
    "communitiesCurious": ["Shibari"]
  }`);
  assert.equal(parsed.spot, 'Columbia Road');
  assert.match(parsed.bright, /old friend/);
  assert.deepEqual(parsed.needTags, ['rest']);
  assert.match(parsed.need, /pony/);
  assert.equal(parsed.communities.running, 'in');
  assert.equal(parsed.communities.shibari, 'curious');
  assert.equal(parsed.communities['hackney choir'], 'in');
});

test('labelled lines work, and missing fields stay missing', () => {
  const parsed = parseAiAnswers(`
    Sure.
    Name: Sam
    What's missing: a Sunday that is actually quiet
    What side of you haven't you got to show: the drawings
    Offer: a long walk and no advice
    Bringing: Fruit — clementines
  `);
  assert.equal(parsed.name, 'Sam');
  assert.match(parsed.missing, /Sunday/);
  assert.match(parsed.hiddenSide, /drawings/);
  assert.equal(parsed.offerTags, undefined);
  assert.match(parsed.offer, /long walk/);
  assert.equal(parsed.bringingKind, 'fruit');
  assert.match(parsed.bringingText, /clementines/);
  assert.equal(parsed.question, undefined);
  assert.equal(parsed.chapter, undefined);
});

test('empty and junk replies parse to nothing', () => {
  assert.deepEqual(parseAiAnswers(''), {});
  assert.deepEqual(parseAiAnswers('just some friendly prose, no answers here'), {});
  assert.deepEqual(parseAiAnswers('```\nnot json\n```'), {});
});

test('deep house beats house, and a chip plus words keeps the words', () => {
  assert.deepEqual(matchOptions('deep house music', MUSIC).ids, ['deep house']);
  const food = matchOptions('Fruit — clementines', FOOD);
  assert.deepEqual(food.ids, ['fruit']);
  assert.match(food.leftover.join(' '), /clementines/);
});
