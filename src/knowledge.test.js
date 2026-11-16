import test from 'node:test';
import assert from 'node:assert/strict';
import { answerFromKnowledge } from './knowledge.js';

test('answers simple arithmetic in Uzbek', () => {
  assert.equal(answerFromKnowledge('12 * 3', 'uz'), 'Javob: 36');
});
test('responds to greetings in English', () => {
  assert.match(answerFromKnowledge('hello', 'en'), /Hello!/);
});
test('finds Roblox Studio knowledge in Uzbek', () => {
  assert.match(answerFromKnowledge('Roblox Studio Luau', 'uz'), /Luau/);
});
test('does not invent answers outside its knowledge', () => {
  assert.match(answerFromKnowledge('what is the exact weather on Mars right now?', 'en'), /could not find a reliable answer/i);
});
