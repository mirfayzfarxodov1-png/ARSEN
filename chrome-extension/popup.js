import { parseBrowserCommand } from './command-parser.js';

const $ = selector => document.querySelector(selector);
const API = 'http://localhost:3000';
let lastAnswer = '';
let conversation = [];

async function checkServer() {
  try {
    const response = await fetch(API + '/api/health');
    const data = await response.json();
    $('#status').textContent = data.localModelAvailable ? 'LOCAL MODEL READY' : data.localCoreReady ? 'LOCAL CORE READY' : 'CORE OFFLINE';
    $('#status').style.color = data.localCoreReady ? '#7ce0b0' : '#e9b86a';
    if (data.localCoreReady) $('#message').textContent = data.localModelAvailable ? 'On-device model is ready. No cloud AI is connected.' : 'Built-in knowledge is ready. A local model can be added for broader answers.';
  } catch {
    $('#status').textContent = 'OFFLINE';
    $('#message').textContent = 'Start ARSEN on this computer first: npm start';
    $('#message').classList.add('error');
  }
}

async function runBrowserCommand(command) {
  if (!command) return false;
  if (command.kind === 'needs_target') {
    $('#message').textContent = command.notice;
    $('#message').classList.add('error');
    return true;
  }
  if (command.kind !== 'navigate') return false;
  await chrome.tabs.create({ url: command.url, active: true });
  lastAnswer = command.notice || ('Opened ' + command.label + '.');
  $('#answer').textContent = lastAnswer;
  $('#answer-wrap').hidden = false;
  $('#message').textContent = 'Browser navigation completed.';
  return true;
}

$('#ask').addEventListener('click', async () => {
  const prompt = $('#prompt').value.trim();
  if (!prompt) return;
  $('#ask').disabled = true;
  $('#message').classList.remove('error');
  $('#answer-wrap').hidden = true;

  try {
    const browserCommand = parseBrowserCommand(prompt);
    if (browserCommand) {
      $('#message').textContent = 'Opening requested page…';
      await runBrowserCommand(browserCommand);
      return;
    }

    $('#message').textContent = 'ARGON is thinking…';
    conversation.push({ role: 'user', content: prompt });
    const response = await fetch(API + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversation.slice(-20), language: 'en' })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ARSEN request failed.');
    lastAnswer = data.answer;
    conversation.push({ role: 'assistant', content: lastAnswer });
    $('#answer').textContent = lastAnswer;
    $('#answer-wrap').hidden = false;
    $('#message').textContent = 'Response ready. Review it, then choose whether to insert it.';
  } catch (error) {
    if (conversation.at(-1)?.role === 'user') conversation.pop();
    $('#message').textContent = 'Could not complete the request: ' + error.message;
    $('#message').classList.add('error');
  } finally {
    $('#ask').disabled = false;
  }
});

$('#insert').addEventListener('click', async () => {
  if (!lastAnswer) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    $('#message').textContent = 'No active tab found.';
    return;
  }
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: text => {
        const el = document.activeElement;
        if (!el) return 'NO_FIELD';
        const isInput = el instanceof HTMLTextAreaElement ||
          (el instanceof HTMLInputElement && /^(text|search|email|url|tel)$/i.test(el.type));
        if (isInput) {
          const start = el.selectionStart ?? el.value.length;
          const end = el.selectionEnd ?? el.value.length;
          el.setRangeText(text, start, end, 'end');
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return 'INSERTED';
        }
        if (el.isContentEditable) {
          document.execCommand('insertText', false, text);
          return 'INSERTED';
        }
        return 'NO_FIELD';
      },
      args: [lastAnswer]
    });
    $('#message').textContent = results[0]?.result === 'INSERTED'
      ? 'Text inserted. Review it before submitting the page.'
      : 'Click inside a text field on the page first, then try again.';
  } catch {
    $('#message').textContent = 'This page does not allow text insertion. Try a normal website text field.';
  }
});

checkServer();
