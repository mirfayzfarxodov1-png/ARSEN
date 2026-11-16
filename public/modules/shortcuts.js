(() => {
  const input=document.querySelector('#prompt');
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='j'){e.preventDefault();document.querySelector('[data-view="chat"]')?.click();input?.focus();}
    if(e.key==='Escape')document.querySelector('#sidebar')?.classList.remove('open');
  });
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
})();