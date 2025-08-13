// Pro DnD interno: arrastrar tareas entre secciones y reordenar dentro de la misma sección (orden persistente)
import React, { useEffect, useRef, useState } from "react";

/* Fecha */
function todayKey(){ const d=new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-"); }
function formatHuman(s){ try{ const [y,m,d]=String(s).split("-").map(Number); const dt=new Date(y,m-1,d); return dt.toLocaleDateString(undefined,{weekday:"short",year:"numeric",month:"short",day:"numeric"});}catch{ return String(s);}}

/* Storage keys */
const DIARY_KEY="diary_entries_v1", TASKS_KEY="tasks_v3", SECTIONS_KEY="sections_v1", THEME_KEY="theme";

/* Utils */
function parseTags(text){ return String(text||"").split(/[#,]/g).map(s=>s.trim()).filter(Boolean).map(s=>s.replace(/^#/,"")).slice(0,20); }
function dedupeByDate(items){ const m=new Map(); for(const it of items) m.set(it.date,{...it}); return Array.from(m.values()); }
function loadDiary(){ try{ const a=JSON.parse(localStorage.getItem(DIARY_KEY)||"[]"); return Array.isArray(a)?a.map(e=>({...e,tags:Array.isArray(e.tags)?e.tags:[]})):[];}catch{return[];} }
function saveDiary(e){ localStorage.setItem(DIARY_KEY, JSON.stringify(dedupeByDate(e))); }
function saveDiaryEntry(entry) {
  const list = loadDiary();
  list.push(entry);
  saveDiary(list);
}
function mdDiary(entries){ const L=["# Diario Personal",""]; const s=[...dedupeByDate(entries)].sort((a,b)=>a.date<b.date?1:-1); for(const e of s){ L.push(`## ${formatHuman(e.date)}`); if((e.tags||[]).length) L.push(`**Tags:** ${e.tags.map(t=>`#${t}`).join(" ")}`); L.push("", String(e.content||""), ""); } return L.join("\n"); }
function parseMarkdownToBlocks(input){ const lines=String(input).replace(/\r\n?/g,"\n").split("\n"); const out=[]; let buf=[], list=null, inCode=false, code=[]; const P=()=>{const t=buf.join(" ").trim(); if(t) out.push({type:"p",text:t}); buf=[]}; const L=()=>{ if(list&&list.items.length) out.push({type:"ul",items:list.items}); list=null; }; const C=()=>{ if(code.length) out.push({type:"code",code:code.join("\n")}); code=[];}; for(const line of lines){ if(/^\s*```/.test(line)){ if(!inCode){inCode=true;P();L();code=[];} else {inCode=false;C();} continue;} if(inCode){ code.push(line); continue;} const h=line.match(/^\s*(#{1,3})\s+(.*)$/); if(h){P();L(); out.push({type:`h${h[1].length}`,text:h[2].trim()}); continue;} const li=line.match(/^\s*[-*+]\s+(.*)$/); if(li){P(); if(!list) list={items:[]}; list.items.push(li[1]); continue;} if(/^\s*$/.test(line)){P();L(); continue;} buf.push(line.trim()); } if(inCode) C(); P(); L(); return out; }
function inlineNodes(text){ const nodes=[]; let idx=0; const re=/(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_)/g; let m; while((m=re.exec(text))!==null){ const prev=text.slice(idx,m.index); if(prev) nodes.push(prev); if(m[2]&&m[3]) nodes.push(<a key={nodes.length} href={m[3]} target="_blank" rel="noopener noreferrer">{m[2]}</a>); else if(m[4]) nodes.push(<code key={nodes.length}>{m[4]}</code>); else if(m[5]) nodes.push(<strong key={nodes.length}>{m[5]}</strong>); else if(m[6]||m[7]) nodes.push(<em key={nodes.length}>{m[6]||m[7]}</em>); idx=m.index+m[0].length; } const rest=text.slice(idx); if(rest) nodes.push(rest); return nodes; }
function MarkdownViewer({source}){ const blocks=parseMarkdownToBlocks(String(source||"")); return <div className="prose prose-sm max-w-none dark:prose-invert">{blocks.map((b,i)=>{ switch(b.type){ case "h1": return <h1 key={i}>{inlineNodes(b.text)}</h1>; case "h2": return <h2 key={i}>{inlineNodes(b.text)}</h2>; case "h3": return <h3 key={i}>{inlineNodes(b.text)}</h3>; case "code": return <pre key={i} style={{overflowX:"auto"}}><code>{b.code}</code></pre>; case "ul": return <ul key={i} className="list-disc pl-5">{b.items.map((it,j)=><li key={j}>{inlineNodes(it)}</li>)}</ul>; default: return <p key={i}>{inlineNodes(b.text)}</p>; } })}</div>; }
function normalizePriority(p){ const v=String(p||"media").toLowerCase(); return v==="alta"||v==="baja"?v:"media"; }
function priorityLabel(p){ const v=normalizePriority(p); return v==="alta"?"Alta":v==="baja"?"Baja":"Media"; }
function priorityClass(p){ const v=normalizePriority(p); if(v==="alta") return "bg-red-100 text-red-800 border-red-200"; if(v==="baja") return "bg-emerald-100 text-emerald-800 border-emerald-200"; return "bg-amber-100 text-amber-900 border-amber-200"; }
function loadTasks(){
  try{
    const a=JSON.parse(localStorage.getItem(TASKS_KEY)||"[]");
    return Array.isArray(a)?a.map((t,i)=>({id:t.id||crypto.randomUUID(), text:String(t.text||""), section:t.section||"General", tags:Array.isArray(t.tags)?t.tags:[], done:!!t.done, priority:normalizePriority(t.priority), created_at:t.created_at||new Date().toISOString(), order: typeof t.order==='number' ? t.order : i })):[];
  }catch{return[];}
}
function saveTasks(arr){ localStorage.setItem(TASKS_KEY, JSON.stringify(arr)); }
function loadSections(){ try{ const a=JSON.parse(localStorage.getItem(SECTIONS_KEY)||"null"); const DEFAULT_SECTIONS=[{id:1,title:"General"},{id:2,title:"Personal"},{id:3,title:"Trabajo"},{id:4,title:"Estudio"}]; if (Array.isArray(a) && a.length > 0) { if (typeof a[0] === 'string') { return a.map((title, i) => ({ id: i + 1, title })); } return a; } return DEFAULT_SECTIONS; }catch{return [{id:1,title:"General"},{id:2,title:"Personal"},{id:3,title:"Trabajo"},{id:4,title:"Estudio"}];} }
function saveSections(list){ localStorage.setItem(SECTIONS_KEY, JSON.stringify(list)); }
function buildFilteredTasks(tasks,q){ const query=String(q||"").trim().toLowerCase(); if(!query)return tasks; if(query.startsWith("#")){ const tag=query.slice(1); return tasks.filter(t=>(t.tags||[]).some(g=>String(g).toLowerCase().includes(tag))); } return tasks.filter(t=>String(t.text).toLowerCase().includes(query)||(t.tags||[]).some(g=>String(g).toLowerCase().includes(query))); }
function groupTasksBySectionOrdered(sections,tasks){
  const m=new Map(); for(const s of sections) m.set(s.title,[]);
  for(const t of tasks){ const s=m.has(t.section)?t.section:(sections[0]?.title||"General"); m.get(s).push(t); }
  for(const [k,arr] of m){
    arr.sort((a,b)=>{
      const ao = (typeof a.order==='number') ? a.order : 0;
      const bo = (typeof b.order==='number') ? b.order : 0;
      if (ao!==bo) return ao-bo;
      // tiebreak by priority then created_at for legacy
      const pr = (a.priority===b.priority)?0: (a.priority==="alta"?-1:(b.priority==="alta"?1:(a.priority==="media"?-1:1)));
      if (pr!==0) return pr;
      return (a.created_at||"").localeCompare(b.created_at||"");
    });
    // normalize indexes to 0..n-1 for persistence consistency
    arr.forEach((t,i)=>{ t.order=i; });
  }
  return m;
}
function exportTasksMarkdown(sections,tasks){ const grouped=groupTasksBySectionOrdered(sections,tasks); const L=["# Tareas (globales)",""]; for(const [s,arr] of grouped){ L.push(`## ${s}`); if(arr.length===0) L.push("(sin tareas)"); for(const t of arr){ const chk=t.done?"[x]":"[ ]"; const tags=(t.tags||[]).map(z=>`#${z}`).join(" "); const pr=`P:${priorityLabel(t.priority)}`; L.push(`- ${chk} [${pr}] ${t.text} ${tags?` — ${tags}`:""}`.trim()); } L.push(""); } const blob=new Blob([L.join("\n")],{type:"text/markdown;charset=utf-8"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="tareas.md"; a.click(); URL.revokeObjectURL(url); }
function exportJSON(){ const dump={ diary:JSON.parse(localStorage.getItem(DIARY_KEY)||"[]"), tasks:JSON.parse(localStorage.getItem(TASKS_KEY)||"[]"), sections:JSON.parse(localStorage.getItem(SECTIONS_KEY)||"[]"), _meta:{exported_at:new Date().toISOString(), app:"diario-tareas-tabs-pro-dnd-tasks-internal"} }; const blob=new Blob([JSON.stringify(dump,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="backup-diario-tareas.json"; a.click(); URL.revokeObjectURL(url); }
function importJSONFromFile(file, onSuccess){ const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(String(r.result||"{}")); if(!data||typeof data!=="object") throw new Error("JSON inválido"); if(!Array.isArray(data.diary)||!Array.isArray(data.tasks)||!Array.isArray(data.sections)) throw new Error("Estructura esperada: { diary:[], tasks:[], sections:[] }"); localStorage.setItem(DIARY_KEY, JSON.stringify(data.diary)); localStorage.setItem(TASKS_KEY, JSON.stringify(data.tasks)); localStorage.setItem(SECTIONS_KEY, JSON.stringify(data.sections)); onSuccess&&onSuccess(); }catch(e){ alert("No se pudo importar: "+e.message);} }; r.readAsText(file); }
function getInitialTheme(){ try{ const t=localStorage.getItem("theme"); if(t==="dark"||t==="light") return t; }catch{} const prefersDark=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches; return prefersDark?"dark":"light"; }
function applyTheme(t){ const root=document.documentElement; if(t==="dark") root.classList.add("dark"); else root.classList.remove("dark"); try{ localStorage.setItem("theme", t);}catch{} }

export default function App(){
  const [view,setView]=useState("diario");
  const [editingSection, setEditingSection] = useState(null);
  const [newSectionName, setNewSectionName] = useState("");
  const [theme,setTheme]=useState(getInitialTheme());

  const [entries,setEntries]=useState(loadDiary());
  const [tasks,setTasks]=useState(loadTasks());
  const [sections,setSections]=useState(loadSections());

  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [editingDate, setEditingDate] = useState(null);
  const [query, setQuery] = useState("");
  const [openNote, setOpenNote] = useState(null);

  const handleSave = () => {
    if (content.trim() === "") return;
    const entry = {
      date: editingDate || todayKey(),
      content,
      tags: tags.split(',').map(t => t.trim()).filter(t => t !== "")
    };
    saveDiaryEntry(entry);
    setContent("");
    setTags("");
    setEditingDate(null);
    const list = loadDiary();
    setEntries(list);
  };

  const [taskText, setTaskText] = useState("");
  const [taskTags, setTaskTags] = useState("");
  const [taskSection, setTaskSection] = useState("General");
  const [taskPriority, setTaskPriority] = useState("media");
  const [showDone, setShowDone] = useState(false);
  const [taskFilter, setTaskFilter] = useState("");

  const handleAddTask = () => {
    if (taskText.trim() === "") return;
    const newTask = {
      id: Date.now(),
      text: taskText,
      tags: taskTags.split(',').map(t => t.trim()).filter(t => t !== ""),
      section: taskSection,
      priority: taskPriority,
      done: false
    };
    const newTasks = [...tasks, newTask];
    setTasks(newTasks);
    saveTasks(newTasks);
    setTaskText("");
    setTaskTags("");
  };

  // Undo/Redo
  const [undoStack,setUndoStack]=useState([]); const [redoStack,setRedoStack]=useState([]);
  function snapshot(){ return { entries: structuredClone(entries), tasks: structuredClone(tasks), sections: structuredClone(sections) }; }
  function pushHistory(){ setUndoStack(s=>[...s.slice(-49), snapshot()]); setRedoStack([]); }
  function undo(){ if(!undoStack.length) return; const prev=undoStack[undoStack.length-1]; setUndoStack(undoStack.slice(0,-1)); setRedoStack(r=>[...r, snapshot()]); setEntries(prev.entries); setTasks(prev.tasks); setSections(prev.sections); }
  function redo(){ if(!redoStack.length) return; const next=redoStack[redoStack.length-1]; setRedoStack(redoStack.slice(0,-1)); setUndoStack(u=>[...u, snapshot()]); setEntries(next.entries); setTasks(next.tasks); setSections(next.sections); }

  useEffect(()=>{ saveDiary(entries); },[entries]);
  useEffect(()=>{ saveTasks(tasks); },[tasks]);
  useEffect(()=>{ saveSections(sections); },[sections]);
  useEffect(()=>{ applyTheme(theme); },[theme]);

  const fileInputRef=useRef(null);

  /* Diario */
  function reloadDiary(){ const list=loadDiary(); setEntries(list); const today=list.find(e=>e.date===todayKey()); if(today){ setContent(today.content||""); setTagsText((today.tags||[]).join(", ")); setEditingDate(today.date);} else { setContent(""); setTagsText(""); setEditingDate(null);} }
  function saveToday(){ const date=editingDate||todayKey(); const entry={ id:crypto.randomUUID(), date, content:content.trim(), tags:parseTags(tagsText)}; if(!entry.content){ alert("Escribe algo antes de guardar."); return; } const exists=entries.some(e=>e.date===date); if(exists&&!editingDate){ const ok=confirm(`Ya existe una entrada para ${formatHuman(date)}. ¿Sobrescribir?`); if(!ok) return; } pushHistory(); const next=dedupeByDate([...entries.filter(e=>e.date!==date), entry]); setEntries(next); reloadDiary(); }
  function filteredEntries(){ const src=dedupeByDate(entries); const q=String(query||"").trim().toLowerCase(); if(!q) return src; if(q.startsWith("#")){ const tag=q.slice(1); return src.filter(e=>(e.tags||[]).some(t=>String(t).toLowerCase().includes(tag))); } return src.filter(e=>String(e.content||"").toLowerCase().includes(q)||(e.tags||[]).some(t=>String(t).toLowerCase().includes(q))); }

  /* Tareas */
  function addTask(){ const text=taskText.trim(); if(!text) return; pushHistory(); const t={ id:crypto.randomUUID(), text, section:sections.some(s => s.title === taskSection)?taskSection:(sections[0]?.title||"General"), tags:parseTags(taskTags), done:false, priority:normalizePriority(taskPriority), created_at:new Date().toISOString(), order: Number.MAX_SAFE_INTEGER }; setTasks(p=>[...p,t]); setTaskText(""); setTaskTags(""); setTaskPriority("media"); }
  function toggleDone(id){ pushHistory(); setTasks(p=>p.map(t=>t.id===id?{...t,done:!t.done}:t)); }
  function removeTask(id){ pushHistory(); setTasks(p=>p.filter(t=>t.id!==id)); }
  function addSection(name){ const s=String(name||"").trim(); if(!s||sections.some(x=>x.title===s)) return; pushHistory(); setSections(p=>[...p,{id:Date.now(),title:s}].slice(0,20)); }

  function visibleTasksMap(){ const filtered=buildFilteredTasks(tasks,taskFilter).filter(t=>showDone?true:!t.done); return groupTasksBySectionOrdered(sections, filtered); }

  /* Gestión de etiquetas */
  function collectAllTags(){ const m=new Map(); for(const e of entries){ for(const t of (e.tags||[])){ const k=String(t); m.set(k,(m.get(k)||0)+1); } } for(const t of tasks){ for(const g of (t.tags||[])){ const k=String(g); m.set(k,(m.get(k)||0)+1); } } return Array.from(m.entries()).sort((a,b)=>b[1]-a[1]); }
  const [tagFrom,setTagFrom]=useState(""), [tagTo,setTagTo]=useState("");
  function renameTag(src,dst){ const s=String(src||"").trim(), t=String(dst||"").trim(); if(!s||!t||s===t) return; pushHistory(); setEntries(p=>p.map(e=>({...e, tags:(e.tags||[]).map(x=>x===s?t:x)}))); setTasks(p=>p.map(tt=>({...tt, tags:(tt.tags||[]).map(x=>x===s?t:x)}))); setTagFrom(""); setTagTo(""); }
  function removeTag(tg){ const t=String(tg||"").trim(); if(!t) return; pushHistory(); setEntries(p=>p.map(e=>({...e, tags:(e.tags||[]).filter(x=>x!==t)}))); setTasks(p=>p.map(tt=>({...tt, tags:(tt.tags||[]).filter(x=>x!==t)}))); }

  /* DnD: secciones y tareas (interna y entre secciones) */
  const [dragSectionIndex,setDragSectionIndex]=useState(null);
  const [dragTaskId,setDragTaskId]=useState(null);
  const [dragOverTaskId,setDragOverTaskId]=useState(null);

  function onSectionDragStart(idx){ setDragSectionIndex(idx); }
  function onSectionDrop(idx){ if(dragSectionIndex===null || dragSectionIndex===idx) { setDragSectionIndex(null); return; } pushHistory(); const next=[...sections]; const [m]=next.splice(dragSectionIndex,1); next.splice(idx,0,m); setSections(next); setDragSectionIndex(null); }
  function onSectionDragOver(e){ e.preventDefault(); }

  function onTaskDragStart(taskId){ setDragTaskId(taskId); }
  function onTaskDragEnd(){ setDragTaskId(null); setDragOverTaskId(null); }

  function moveTask(taskId, targetSection, beforeTaskId=null){
    pushHistory();
    setTasks(prev => {
      const list = structuredClone(prev);
      const t = list.find(x=>x.id===taskId);
      if(!t) return prev;
      t.section = targetSection;
      // compute target section items (including current moved one in its new section)
      const sectionItems = list.filter(x=>x.section===targetSection && x.id!==taskId);
      if (beforeTaskId){
        // insert at index of beforeTaskId
        const idx = sectionItems.findIndex(x=>x.id===beforeTaskId);
        sectionItems.splice(idx<0?sectionItems.length:idx, 0, {...t});
      } else {
        sectionItems.push({...t});
      }
      // renormalize orders for that section
      let k = 0;
      for(const x of sectionItems){ const ref = list.find(y=>y.id===x.id); if(ref){ ref.order = k++; ref.section = targetSection; } }
      return list;
    });
  }

  function onTaskDrop(targetSection){
    if(!dragTaskId) return;
    moveTask(dragTaskId, targetSection, null);
    onTaskDragEnd();
  }

  function onTaskDropBefore(targetSection, beforeTaskId){
    if(!dragTaskId) return;
    moveTask(dragTaskId, targetSection, beforeTaskId);
    onTaskDragEnd();
  }

  return (
    <div className="min-h-screen w-full p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">📓 Diario & ✅ Tareas</h1>
          <div className="flex items-center gap-2">
            <nav className="flex gap-2 mr-2">
              <button className={`tab ${view==="diario"?"tab-active":""}`} onClick={()=>setView("diario")}>Diario</button>
              <button className={`tab ${view==="tareas"?"tab-active":""}`} onClick={()=>setView("tareas")}>Tareas</button>
              <button className={`tab ${view==="settings"?"tab-active":""}`} onClick={()=>setView("settings")}>Ajustes</button>
            </nav>
            <button className="btn" onClick={()=>setTheme(theme==="dark"?"light":"dark")} title="Cambiar tema">{theme==="dark"?"☀️ Claro":"🌙 Oscuro"}</button>
            <button className="btn" onClick={()=>exportJSON()} title="Exportar backup JSON">💾 Backup</button>
            <button className="btn" onClick={()=>fileInputRef.current?.click()} title="Restaurar desde JSON">📂 Restaurar</button>
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) importJSONFromFile(f,()=>location.reload()); }}/>
            <div className="ml-2 flex gap-1">
              <button className="icon-btn" onClick={undo} title="Deshacer (Undo)">↶</button>
              <button className="icon-btn" onClick={redo} title="Rehacer (Redo)">↷</button>
            </div>
          </div>
        </header>

        {view === "settings" ? (
          <div className="card p-4">
            <h2 className="text-xl font-bold mb-4">Gestionar Secciones</h2>
            <div className="mb-4">
              <input 
                className="input mr-2"
                placeholder="Nueva sección"
                value={newSectionName} 
                onChange={e => setNewSectionName(e.target.value)} 
              />
              <button className="btn" onClick={() => {
                if (newSectionName.trim() === "") return;
                const newSections = [...sections, { id: Date.now(), title: newSectionName }];
                setSections(newSections);
                saveSections(newSections);
                setNewSectionName("");
              }}>+ Añadir</button>
            </div>
            <ul>
              {sections.map(section => (
                <li key={section.id} className="flex items-center justify-between mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded">
                  {editingSection?.id === section.id ? (
                    <input 
                      className="input"
                      value={editingSection.title} 
                      onChange={e => setEditingSection({ ...editingSection, title: e.target.value })} 
                    />
                  ) : (
                    <span>{section.title}</span>
                  )}
                  <div className="flex gap-2">
                    {editingSection?.id === section.id ? (
                      <button className="btn" onClick={() => {
                        const newSections = sections.map(s => s.id === editingSection.id ? editingSection : s);
                        setSections(newSections);
                        saveSections(newSections);
                        setEditingSection(null);
                      }}>Guardar</button>
                    ) : (
                      <button className="btn" onClick={() => setEditingSection(section)}>Editar</button>
                    )}
                    <button className="btn-danger" onClick={() => {
                      const newTasks = tasks.map(t => t.section === section.title ? { ...t, section: "General" } : t);
                      setTasks(newTasks);
                      saveTasks(newTasks);
                      const newSections = sections.filter(s => s.id !== section.id);
                      setSections(newSections);
                      saveSections(newSections);
                    }}>Eliminar</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : view === "diario" ? (
          <>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
              <input className="input flex-1" placeholder="🔎 Buscar… (usa #tag)" value={query} onChange={(e)=>setQuery(e.target.value)} />
              <button className="btn" onClick={()=>{ const list=loadDiary(); setEntries(list); }}>↻ Recargar</button>
              <button className="btn" onClick={()=>{ const md=mdDiary(entries); const blob=new Blob([md],{type:"text/markdown;charset=utf-8"}); const u=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=u; a.download = 'diario_' + todayKey() + '.md'; a.click(); URL.revokeObjectURL(u); }} disabled={entries.length===0}>⤓ Exportar .md</button>
            </div>

            <section className="card mb-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold">{editingDate?`Editando: ${formatHuman(editingDate)}`:`Hoy: ${formatHuman(todayKey())}`}</h2>
              </div>
              <textarea className="input w-full min-h-[140px] resize-y" placeholder="Escribe lo que hiciste hoy… (Markdown básico)" value={content} onChange={(e)=>setContent(e.target.value)} maxLength={5000}/>
              <div className="flex flex-col sm:flex-row gap-3 mt-2">
                <input className="input flex-1" placeholder="Etiquetas (ej: #salud, #uni, #gym) o separa con comas" value={tags} onChange={(e)=>setTags(e.target.value)} />
                <div className="text-sm text-gray-500 self-center pr-2">{content.length}/5000</div>
                <button className="btn" onClick={handleSave}>{editingDate ? 'Guardar Cambios' : 'Guardar'}</button>
              </div>
            </section>

            <section>
              <h3 className="text-base font-semibold mb-3">Historial</h3>
              {filteredEntries().length===0 ? <div className="text-neutral-600 text-sm dark:text-neutral-400">No hay entradas aún.</div> : (
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredEntries().map(e=>(
                    <li key={e.date}>
                      <button onClick={()=>setOpenNote(e)} className="w-full aspect-square rounded-xl p-3 text-left shadow-sm border bg-[#fffbd1] hover:bg-[#fff7a8] transition-colors relative dark:text-neutral-900" title="Abrir">
                        <div className="absolute -top-2 right-3 rotate-12 select-none">📌</div>
                        <div className="text-xs text-neutral-700 mb-1 font-medium">{formatHuman(e.date)}</div>
                        <div className="flex flex-wrap gap-1 mb-1">{(e.tags||[]).slice(0,4).map((t,i)=><span key={i} className="text-[10px] px-1 py-0.5 rounded bg-black/10">#{t}</span>)}</div>
                        <div className="text-sm line-clamp-5 whitespace-pre-wrap">{e.content}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {openNote && (
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={()=>setOpenNote(null)}>
                <div className="max-w-lg w-full bg-white rounded-2xl border shadow-xl p-4 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100" onClick={(e)=>e.stopPropagation()}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-semibold">{formatHuman(openNote.date)}</h4>
                    <div className="flex gap-2">
                      <button className="btn" onClick={()=>{ setContent(openNote.content||""); setTagsText((openNote.tags||[]).join(", ")); setEditingDate(openNote.date); setOpenNote(null); window.scrollTo({top:0, behavior:"smooth"}); }}>Editar</button>
                      <button className="btn" onClick={()=>setOpenNote(null)}>Cerrar</button>
                    </div>
                  </div>
                  <MarkdownViewer source={openNote.content||""} />
                  {(openNote.tags||[]).length>0 && (
                    <div className="mt-3 flex flex-wrap gap-1 text-xs">
                      {(openNote.tags||[]).map((t,i)=><span key={i} className="px-1.5 py-0.5 rounded bg-neutral-100 border dark:bg-neutral-700 dark:border-neutral-600">#{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center mb-4">
              <input className="input flex-1" placeholder="🔎 Filtrar… (usa #tag)" value={taskFilter} onChange={(e)=>setTaskFilter(e.target.value)} />
              <label className="flex items-center gap-2"><input type="checkbox" checked={showDone} onChange={(e)=>setShowDone(e.target.checked)} /> Mostrar hechas</label>
              <button className="btn" onClick={()=>exportTasksMarkdown(sections,tasks)} title="Exportar tareas a Markdown">⤓ Exportar .md</button>
            </div>

            <div className="card mb-5 p-4">
              <h2 className="text-lg font-semibold mb-2">Nueva Tarea</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input className="input" placeholder="Descripción de la tarea" value={taskText} onChange={(e) => setTaskText(e.target.value)} />
                <input className="input" placeholder="Tags (ej: #casa, #trabajo)" value={taskTags} onChange={(e) => setTaskTags(e.target.value)} />
                <select className="input" value={taskSection} onChange={(e) => setTaskSection(e.target.value)}>
                  {sections.map(s => <option key={s.id} value={s.title}>{s.title}</option>)}
                </select>
                <select className="input" value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)}>
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
              <button className="btn mt-4 w-full sm:w-auto" onClick={handleAddTask}>+ Añadir Tarea</button>
            </div>

            {/* Secciones con dropzones y DnD interno */}
            <section>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...visibleTasksMap()].map(([section,arr])=> (
                  <div key={section}
                       className="card"
                       onDragOver={(e)=>{ e.preventDefault(); }}
                       onDrop={()=>onTaskDrop(section)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{section}</h3>
                    </div>
                    <ul className="space-y-2 min-h-[40px]">
                      {arr.length===0 && <li className="text-xs text-neutral-500 dark:text-neutral-400">(suelta tareas aquí)</li>}
                      {arr.map((t, idx)=>(
                        <li key={t.id}
                            className={`border rounded-2xl p-2 bg-neutral-50 dark:bg-neutral-700 dark:border-neutral-600 ${dragTaskId===t.id?'drag-ghost':''} ${dragOverTaskId===t.id?'over-target':''}`}
                            draggable
                            onDragStart={()=>onTaskDragStart(t.id)}
                            onDragEnd={onTaskDragEnd}
                            onDragOver={(e)=>{ e.preventDefault(); setDragOverTaskId(t.id);}}
                            onDrop={(e)=>{ e.stopPropagation(); onTaskDropBefore(section, t.id);}}
                        >
                          <div className="flex items-start gap-2">
                            <input type="checkbox" checked={t.done} onChange={()=>toggleDone(t.id)} />
                            <div className="flex-1">
                              <div className={`text-sm ${t.done ? "line-through text-neutral-500 dark:text-neutral-400" : ""}`}>{t.text}</div>
                              {(t.tags||[]).length>0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {t.tags.map((tg,i)=><span key={i} className="text-[10px] px-1 py-0.5 rounded bg-black/10 dark:bg-white/10">#{tg}</span>)}
                                </div>
                              )}
                              <div className="mt-2 flex gap-2 text-xs items-center">
                                <span className={`badge ${priorityClass(t.priority)}`}>P: {priorityLabel(t.priority)}</span>
                                <button className="underline" onClick={()=>removeTask(t.id)}>Eliminar</button>
                              </div>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <footer className="mt-8 text-xs text-neutral-500 dark:text-neutral-400">
          <p>LocalStorage, sin dependencias. React + Tailwind + Vite — Tema: {theme}. Undo: {undoStack.length} / Redo: {redoStack.length}</p>
        </footer>
      </div>
    </div>
  );
}
