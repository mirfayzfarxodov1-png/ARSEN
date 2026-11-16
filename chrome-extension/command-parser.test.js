import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrowserCommand } from './command-parser.js';

test('opens Instagram from Uzbek command', () => {
  assert.equal(parseBrowserCommand('Instagramni och').url, 'https://www.instagram.com/');
});

test('opens Instagram from Uzbek enter command', () => {
  assert.equal(parseBrowserCommand('Instagramga kir').url, 'https://www.instagram.com/');
});

test('opens a named Instagram profile', () => {
  assert.equal(parseBrowserCommand('Instagramda @mirfayz profilini och').url, 'https://www.instagram.com/mirfayz/');
});

test('follow request opens profile but never clicks Follow automatically', () => {
  const command = parseBrowserCommand('Instagramni och va @mirfayz ga patpiska tash');
  assert.equal(command.url, 'https://www.instagram.com/mirfayz/');
  assert.match(command.notice, /o‘zingiz tasdiqlang/);
});

test('asks for username when follow target is missing', () => {
  assert.equal(parseBrowserCommand('shu profilga patpiska tash').kind, 'needs_target');
});

test('opens known English site command', () => {
  assert.equal(parseBrowserCommand('open instagram').url, 'https://www.instagram.com/');
});

test('turns web search into a Google query', () => {
  assert.match(parseBrowserCommand('qidir Roblox Studio').url, /google\.com\/search/);
});
