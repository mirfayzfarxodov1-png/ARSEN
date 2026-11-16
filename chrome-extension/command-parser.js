const SITE_ALIASES = {
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

const clean = value => String(value || '').trim().replace(/[.!?]+$/, '').trim();

function safeWebUrl(value) {
  let candidate = clean(value).replace(/^["']|["']$/g, '');
  if (!candidate) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate) &&
      /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/:?#].*)?$/i.test(candidate)) {
    candidate = 'https://' + candidate;
  }
  if (!/^https?:\/\//i.test(candidate)) return null;
  try {
    const url = new URL(candidate);
    if (!url.hostname.includes('.') || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

function instagramHandle(text) {
  const match = String(text).match(/@([a-zA-Z0-9._]{1,30})/);
  if (match) return match[1];
  const profile = String(text).match(/instagram\.com\/([a-zA-Z0-9._]{1,30})/i);
  return profile && !['p', 'reel', 'reels', 'stories', 'explore'].includes(profile[1].toLowerCase())
    ? profile[1] : null;
}

/**
 * Parse a deliberately small, testable set of browser intents.
 * Account-changing actions are never performed here; follow requests only open
 * the requested profile and tell the user to confirm the action on Instagram.
 */
export function parseBrowserCommand(prompt) {
  const value = clean(prompt);
  if (!value) return null;

  const search = value.match(/^(?:please\s+)?(?:search(?:\s+for)?|google|look\s+up|qidir(?:ib ber)?|internetdan qidir)\s+(.+)$/i);
  if (search) {
    const query = clean(search[1]);
    return query ? {
      kind: 'navigate',
      label: 'Search: ' + query,
      url: 'https://www.google.com/search?q=' + encodeURIComponent(query)
    } : null;
  }

  const handle = instagramHandle(value);
  const wantsFollow = /\b(follow|subscribe|patpiska|подпис|obuna)\b/i.test(value) ||
    /(?:obuna bo‘l|obuna bol|patpiska tash)/i.test(value);
  const mentionsInstagram = /instagram|\binsta\b|инстаграм/i.test(value);

  if ((mentionsInstagram || wantsFollow) && handle) {
    return {
      kind: 'navigate',
      label: 'Instagram profile @' + handle,
      url: 'https://www.instagram.com/' + encodeURIComponent(handle) + '/',
      notice: wantsFollow
        ? 'Profil ochildi. Follow / Obuna tugmasini Instagram ichida o‘zingiz tasdiqlang.'
        : 'Instagram profili ochildi.'
    };
  }

  if (wantsFollow && !handle) {
    return {
      kind: 'needs_target',
      label: 'Instagram username kerak',
      notice: 'Qaysi profil? Buyruqqa Instagram username qo‘shing, masalan: Instagramda @username profilini och.'
    };
  }

  const uzbekOpen = value.match(/^(?:iltimos\s+)?(.+?)(?:ni|ga|da)?\s+(?:och|ochib ber|ishga tushir|kir|kirsin|oching)$/i);
  const englishOpen = value.match(/^(?:please\s+)?(?:open|go\s+to|visit|launch|navigate\s+to)\s+(.+)$/i);
  const target = clean((uzbekOpen && uzbekOpen[1]) || (englishOpen && englishOpen[1]) || '');
  if (!target) return null;

  const key = target.toLowerCase().replace(/^www\./, '').replace(/\s+/g, '');
  if (SITE_ALIASES[key]) {
    return { kind: 'navigate', label: target, url: SITE_ALIASES[key] };
  }

  const url = safeWebUrl(target);
  if (url) return { kind: 'navigate', label: new URL(url).hostname, url };

  return {
    kind: 'navigate',
    label: 'Find official website: ' + target,
    url: 'https://www.google.com/search?q=' + encodeURIComponent(target + ' official website')
  };
}
