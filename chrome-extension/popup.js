const $ = selector => document.querySelector(selector);
const API = 'http://localhost:3000';
let lastAnswer = '';
let conversation = [];

async function checkServer() {
  try {
    const response = await fetch(API + '/api/health');
    const data = await response.json();
    $('#status').textContent = data.aiConfigured ? 'AI READY' : 'AI NOT SET';
    $('#status').style.color = data.aiConfigured ? '#7ce0b0' : '#e9b86a';
    if (!data.aiConfigured) $('#message').textContent = 'ARSEN server is online, but its AI provider is not configured yet.';
  } catch {
    $('#status').textContent = 'OFFLINE';
    $('#message').textContent = 'Start ARSEN on this computer first: npm start';
    $('#message').classList.add('error');
  }
}

$('#ask').addEventListener('click', async () => {
  const prompt = $('#prompt').value.trim();
  if (!prompt) return;
  $('#ask').disabled = true;
  $('#message').classList.remove('error');
  $('#message').textContent = 'ARGON is thinking…';
  $('#answer-wrap').hidden = true;
  conversation.push({ role: 'user', content: prompt });
  try {
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
    conversation.pop();
    $('#message').textContent = error.message;
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
