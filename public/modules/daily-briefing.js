(() => {
  const $ = s => document.querySelector(s);
  const activityKey = 'arsen-activity-v1';
  const read = key => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value.slice(-300)));
  const todayKey = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-'); };
  function log(type, title) {
    const items = read(activityKey);
    items.push({ type, title: String(title || type).slice(0,180), at: new Date().toISOString() });
    write(activityKey, items);
  }
  function report() {
    const tasks = read('arsen-tasks-v1'), projects = read('arsen-projects-v1'), notes = read('arsen-notes-v1');
    const today = todayKey();
    const events = read(activityKey).filter(item => String(item.at || '').slice(0,10) === today);
    const completed = tasks.filter(item => item.done).length;
    const open = tasks.length - completed;
    const lines = [
      'Sana: ' + new Date().toLocaleDateString(),
      'Vazifalar: ' + open + ' ta ochiq, ' + completed + ' ta bajarilgan.',
      'Loyihalar: ' + projects.length + ' ta. Eslatmalar: ' + notes.length + ' ta.',
      'Bugungi qayd etilgan faoliyat: ' + events.length + ' ta.'
    ];
    if (events.length) lines.push('Oxirgi ishlar: ' + events.slice(-5).reverse().map(item => item.title).join(' · '));
    else lines.push('Bugun ARSEN hali faoliyat qayd etmadi.');
    if (open) lines.push('Tavsiya: avval eng muhim ochiq vazifani tanlang.');
    else lines.push('Hozircha ochiq vazifa yo‘q.');
    $('#dailyBriefing').textContent = lines.join('\n');
    return lines.join(' ');
  }
  document.addEventListener('arsen:activity', event => {
    const detail = event.detail || {};
    log(detail.type || 'activity', detail.title || detail.type || 'Faoliyat');
    report();
  });
  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.id === 'taskForm') log('task', 'Vazifa qo‘shildi: ' + ($('#taskTitle')?.value || ''));
    if (form.id === 'projectForm') log('project', 'Loyiha yaratildi: ' + ($('#projectName')?.value || ''));
    if (form.id === 'noteForm') log('note', 'Eslatma saqlandi: ' + ($('#noteTitle')?.value || ''));
    report();
  }, true);
  document.addEventListener('change', event => {
    if (event.target.matches('[data-toggle-task]')) log('task', 'Vazifa holati o‘zgartirildi');
    if (event.target.id === 'autoSpeak') localStorage.setItem('arsen-auto-speak', String(event.target.checked));
    report();
  });
  const toggle = $('#autoSpeak');
  if (toggle) toggle.checked = localStorage.getItem('arsen-auto-speak') === 'true';
  $('#briefingButton')?.addEventListener('click', () => { report(); });
  $('#briefingSpeak')?.addEventListener('click', () => { const text = report(); if (!('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); const lang = localStorage.getItem('arsen-language') || 'en'; utterance.lang = ({uz:'uz-UZ',en:'en-US',ru:'ru-RU',es:'es-ES',fr:'fr-FR',de:'de-DE'})[lang] || lang; const voices = window.speechSynthesis.getVoices(); const voice = voices.find(item => item.lang.toLowerCase() === utterance.lang.toLowerCase()) || voices.find(item => item.lang.toLowerCase().startsWith(lang)); if (voice) utterance.voice = voice; window.speechSynthesis.speak(utterance); });
  report();
  window.ARSENdailyBriefing = report;
})();
