(() => {
  const $ = (s) => document.querySelector(s);
  const keys = {projects:'arsen-projects-v1',tasks:'arsen-tasks-v1',notes:'arsen-notes-v1'};
  const read = (key) => { try { const v=JSON.parse(localStorage.getItem(key)||'[]'); return Array.isArray(v)?v:[]; } catch { return []; } };
  const write = (key,value) => localStorage.setItem(key,JSON.stringify(value));
  const escapeHTML = (s) => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const stamp = () => new Date().toLocaleString();
  let projects=read(keys.projects), tasks=read(keys.tasks), notes=read(keys.notes);
  const save=()=>{write(keys.projects,projects);write(keys.tasks,tasks);write(keys.notes,notes);render();};
  function renderProjects(){
    const q=($('#projectSearch')?.value||'').toLowerCase();
    const list=projects.filter(p=>(p.name+' '+p.description+' '+p.category).toLowerCase().includes(q));
    $('#projectCount').textContent=list.length+' projects';
    $('#projectGrid').innerHTML=list.length?list.map(p=>`<article class="project-card"><small>${escapeHTML(p.category.toUpperCase())}</small><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description||'No description yet.')}</p><div class="card-footer"><small>${escapeHTML(p.created)}</small><button class="mini-action" data-delete-project="${p.id}" aria-label="Delete project">Delete ×</button></div></article>`).join(''):'<p class="empty-state">No projects yet. Create your first one above.</p>';
  }
  function renderTasks(){
    const todo=tasks.filter(t=>!t.done),done=tasks.filter(t=>t.done);
    $('#todoCount').textContent=todo.length;$('#doneCount').textContent=done.length;
    const card=t=>`<label class="task-item ${t.done?'completed':''}"><input type="checkbox" data-toggle-task="${t.id}" ${t.done?'checked':''}><span>${escapeHTML(t.title)}</span><small class="priority ${t.priority}">${escapeHTML(t.priority.toUpperCase())}</small><button type="button" class="mini-action" data-delete-task="${t.id}" aria-label="Delete task">×</button></label>`;
    $('#todoList').innerHTML=todo.map(card).join('')||'<p class="empty-state">Nothing here. Add a task to get started.</p>';
    $('#doneList').innerHTML=done.map(card).join('')||'<p class="empty-state">Completed tasks will appear here.</p>';
  }
  function renderNotes(){
    const q=($('#noteSearch')?.value||'').toLowerCase();
    const list=notes.filter(n=>(n.title+' '+n.body).toLowerCase().includes(q));
    $('#noteCount').textContent=list.length+' notes';
    $('#noteGrid').innerHTML=list.length?list.map(n=>`<article class="note-card"><small>${escapeHTML(n.created)}</small><h3>${escapeHTML(n.title)}</h3><p>${escapeHTML(n.body)}</p><div class="card-footer"><span></span><button class="mini-action" data-delete-note="${n.id}">Delete ×</button></div></article>`).join(''):'<p class="empty-state">Your vault is empty. Save an idea above.</p>';
  }
  function renderDashboard(){
    $('#statProjects').textContent=projects.length;$('#statTasks').textContent=tasks.filter(t=>!t.done).length;$('#statNotes').textContent=notes.length;
    const recent=[...projects.map(x=>({kind:'Project',title:x.name,date:x.created,icon:'▤'})),...notes.map(x=>({kind:'Note',title:x.title,date:x.created,icon:'◇'})),...tasks.map(x=>({kind:'Task',title:x.title,date:x.created,icon:'☷'}))].slice(-5).reverse();
    $('#recentActivity').innerHTML=recent.length?recent.map(x=>`<div class="activity-item"><span class="activity-icon">${x.icon}</span><div><strong>${escapeHTML(x.title)}</strong><small>${x.kind} · ${escapeHTML(x.date)}</small></div></div>`).join(''):'<p class="empty-state">Your activity will appear here as you work.</p>';
  }
  function render(){renderProjects();renderTasks();renderNotes();renderDashboard();}
  $('#projectForm').addEventListener('submit',e=>{e.preventDefault();const name=$('#projectName').value.trim();if(!name)return;projects.unshift({id:crypto.randomUUID(),name,category:$('#projectCategory').value,description:$('#projectDescription').value.trim(),created:stamp()});e.target.reset();save();});
  $('#taskForm').addEventListener('submit',e=>{e.preventDefault();const title=$('#taskTitle').value.trim();if(!title)return;tasks.unshift({id:crypto.randomUUID(),title,priority:$('#taskPriority').value,done:false,created:stamp()});e.target.reset();save();});
  $('#noteForm').addEventListener('submit',e=>{e.preventDefault();const title=$('#noteTitle').value.trim(),body=$('#noteBody').value.trim();if(!title||!body)return;notes.unshift({id:crypto.randomUUID(),title,body,created:stamp()});e.target.reset();save();});
  $('#projectSearch').addEventListener('input',renderProjects);$('#noteSearch').addEventListener('input',renderNotes);
  document.addEventListener('click',e=>{
    const p=e.target.closest('[data-delete-project]');if(p){projects=projects.filter(x=>x.id!==p.dataset.deleteProject);save();}
    const t=e.target.closest('[data-delete-task]');if(t){tasks=tasks.filter(x=>x.id!==t.dataset.deleteTask);save();}
    const n=e.target.closest('[data-delete-note]');if(n){notes=notes.filter(x=>x.id!==n.dataset.deleteNote);save();}
  });
  document.addEventListener('change',e=>{const id=e.target.dataset.toggleTask;if(id){const task=tasks.find(x=>x.id===id);if(task)task.done=e.target.checked;save();}});
  $('#refreshHealth').addEventListener('click',()=>window.ARSENcheckHealth?.());
  $('#exportData').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({version:1,projects,tasks,notes},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='arsen-workspace-backup.json';a.click();URL.revokeObjectURL(url);});
  $('#importData').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!data||!Array.isArray(data.projects)||!Array.isArray(data.tasks)||!Array.isArray(data.notes))throw new Error();if(!confirm('Import backup and replace current workspace data?'))return;projects=data.projects;tasks=data.tasks;notes=data.notes;save();alert('Workspace backup imported.');}catch{alert('This backup file is invalid.');}finally{e.target.value='';}});
  $('#clearData').addEventListener('click',()=>{if(!confirm('Permanently clear all projects, tasks and notes saved in this browser?'))return;projects=[];tasks=[];notes=[];save();});
  function clock(){const el=$('#liveClock');if(el)el.textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
  clock();setInterval(clock,30000);render();
  window.ARSENworkspace={render};
})();