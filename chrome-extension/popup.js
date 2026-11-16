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

/**
 * Browser actions are deliberately limited to navigation and search.
 * They never submit forms, post content, access accounts, or execute page code.
 */
function parseBrowserCommand(prompt) {
  const value = String(prompt || '').trim().replace(/[.!?]+$/, '');
  if (!value) return null;

  const search = value.match(/^(?:please\\s+)?(?:search(?:\\s+for)?|google|look\\s+up)\\s+(.+)$/i);
  if (search) {
    const query = search[1].trim();
    return query ? { kind: 'navigate', label: 'Search: ' + query, url: 'https://www.google.com/search?q=' + encodeURIComponent(query) } : null;
  }

  const open = value.match(/^(?:please\\s+)?(?:open|go\\s+to|visit|launch|navigate\\s+to)\\s+(.+)$/i);
  if (!open) return null;
  let target = open[1].trim().replace(/^["']|["']$/g, '');
  if (!target) return null;

  const aliases = {
    insta: 'https://www.instagram.com/',
    instagram: 'https://www.instagram.com/',
    youtube: 'https://www.youtube.com/',
    google: 'https://www.google.com/',
    gmail: 'https://mail.google.com/',
    roblox: 'https://www.roblox.com/',
    github: 'https://github.com/',
    wikipedia: 'https://www.wikipedia.org/',
    reddit: 'https://www.reddit.com/',
    discord: 'https://discord.com/app',
    tiktok: 'https://www.tiktok.com/',
    facebook: 'https://www.facebook.com/',
    x: 'https://x.com/',
    twitter: 'https://x.com/',
    chatgpt: 'https://chatgpt.com/',
    whatsapp: 'https://web.whatsapp.com/',
    maps: 'https://maps.google.com/',
    drive: 'https://drive.google.com/',
    docs: 'https://docs.google.com/',
    notion: 'https://www.notion.so/',
    canva: 'https://www.canva.com/',
    spotify: 'https://open.spotify.com/',
    twitch: 'https://www.twitch.tv/',
    pinterest: 'https://www.pinterest.com/',
    linkedin: 'https://www.linkedin.com/',
    amazon: 'https://www.amazon.com/'
  };
  const key = target.toLowerCase().replace(/^www\\./, '');
  if (aliases[key]) return { kind: 'navigate', label: target, url: aliases[key] };

  // Accept an explicit web URL or domain, but reject credentials and non-web protocols.
  let candidate = target;
  if (!/^[a-z][a-z0-9+.-]*:\\/\\//i.test(candidate) && /^[a-z0-9-]+(?:\\.[a-z0-9-]+)+(?:[/:?#].*)?$/i.test(candidate)) {
    candidate = 'https://' + candidate;
  }
  if (/^https?:\\/\\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (!url.hostname.includes('.') || url.username || url.password) return null;
      return { kind: 'navigate', label: url.hostname, url: url.href };
    } catch { return null; }
  }

  // A natural-language site name is searched rather than guessed as an unsafe domain.
  return {
    kind: 'navigate',
    label: 'Find official website: ' + target,
    url: 'https://www.google.com/search?q=' + encodeURIComponent(target + ' official website')
  };
}

async function runBrowserCommand(command) {
  if (!command || command.kind !== 'navigate') return false;
  await chrome.tabs.create({ url: command.url, active: true });
  lastAnswer = 'Opened ' + command.label + '.';
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
