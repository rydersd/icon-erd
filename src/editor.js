import { formsIn, findSharedForms, linkSharedForms, publishSharedForms, remapSharedForms, collectComponents, projectComponents, makeComponent } from './shared-forms.js';
import { mountControlTooltips } from './control-tooltips.js';
import { createGlyphCore } from './glyph-core.js';
import { LIBRARY } from './starter-library.js';
import { uiSVG } from './ui-icons.js';
import { parseLibraryArchive, mergeLibrary, libraryDocument, normalizeGlyph } from './library-io.js';
import { suggestedGroup, iconGroup } from './icon-organization.js';
import { libraryZIP, readLibraryZIP } from './library-zip.js';
import { mountAppearance } from './appearance.js';
import { createStorage } from './storage.js';

import paper from 'paper/dist/paper-core.js';
import { downloadBlob, svgToPNG } from './downloads.js';
import { TEMPLATES, DEFAULT_SHAPES, PRIMARY_TOOLS, MORE_TOOLS } from './templates.js';
import { ID, mul, ap, apv, inv } from './affine.js';
import { regularEllipse } from './regular-shape.js';
import { mergeNearbyAnchors } from './anchor-merge.js';
import { cleanupAnchors } from './anchor-cleanup.js';
import { mergeAnchorCorners } from './anchor-corner.js';
import { anchorMarker } from './anchor-marker.js';
import { pathEnclosedBy } from './selection-region.js';
import { DEFAULT_SHORTCUTS, SHORTCUT_ACTIONS, setShortcut, shortcutFromEvent } from './shortcuts.js';
import { inspectGeometry } from './geometry-inspection.js';
import { ensureLayerNames, canMoveTreeItem, moveTreeItem, useAsCutter } from './layer-tree.js';
export function mountEditor(root) {
const project = new paper.Project();
const abort = new AbortController();
let disposed = false;
const listen = (target, event, handler, options = {}) => target.addEventListener(event, handler, { ...options, signal: abort.signal });
const core = createGlyphCore(paper);
mountControlTooltips(root, listen);
const $ = id => root.querySelector(`#${id}`);
const SVGNS = 'http://www.w3.org/2000/svg';
const clone = o => JSON.parse(JSON.stringify(o));
const r4 = v => Math.round(v * 10000) / 10000;

// ---------- independent editor chrome (not part of the user's icon library) ----------
const uiName = name => name;
function uiIcon(name) { const full = uiName(name); return `<span class="ui-icon" data-ui="${full}" aria-hidden="true">${uiSVG(full)}</span>`; }
/** repaint chrome icons — all, or only those drawn from one glyph (live while that glyph is being edited) */
function paintUI(full) { root.querySelectorAll(full ? `.ui-icon[data-ui="${full}"]` : '.ui-icon[data-ui]').forEach(e => { e.innerHTML = uiSVG(e.dataset.ui); }); }
function decorate() {
  root.querySelectorAll('[data-icon-ui]').forEach(b => {
    if (b.querySelector(':scope > .ui-icon')) return;
    const label = b.textContent.trim(); b.textContent = '';
    b.insertAdjacentHTML('beforeend', uiIcon(b.dataset.iconUi));
    if (label) { const sp = document.createElement('span'); sp.textContent = label; b.appendChild(sp); }
  });
}

// ---------- state ----------
const S = {
  // S.lib slots are replaced, never mutated in place, so the library originals in LIBRARY stay pristine (Revert)
  lib: LIBRARY.slice(), cur: 0, glyph: null,
  sel: [], // [{l, p:null|[...]}]
  snap: 0.1, view: { x: -1, y: -1, s: 26 },
  components: new Map(), proximityMerge: false,
  gridStep: null,
  show: { grid: true, safe: true, artboard: true, guides: true, keylines: true, forms: false, original: false, cutters: false, points: true },
  iso: null, // isolated object {l, p:null|[...]}; everything else dims and stops taking clicks
  sourceAnchor: null,
  selectedAnchors: [],
  anchor: null, // index of the selected anchor on the selected pen path
  tool: 'select', hmode: 'shape', lockAspect: true,
  areaMode: 'marquee', areaScope: 'objects',
  rt: { weight: 1.2, cap: 'round', join: 'round', hint: false, rtl: false },
  undo: [], redo: [], resolved: [],
};
let penDraft = null; // { s } while the pen is placing anchors
let areaPolygon = null;
try { const mode=localStorage.getItem('gw-area-mode');if(['marquee','lasso','polygon'].includes(mode))S.areaMode=mode; }catch{}
function idx(name) { return S.lib.findIndex(g => g.name === name); }

// ---------- node addressing ----------
const layerOf = s => S.glyph.layers[s.l];
function getNode(s) { if (!s || s.p === null) return null; let n = layerOf(s).node; for (const i of s.p) { if (!n || !n.children) return null; n = n.children[i]; } return n; }
function getParent(s) { if (!s || s.p === null || !s.p.length) return null; return getNode({ l: s.l, p: s.p.slice(0, -1) }); }
function ancestorsOf(s) { const out = []; for (let k = 0; k < s.p.length; k++) out.push(getNode({ l: s.l, p: s.p.slice(0, k) })); return out; }
const same = (a, b) => a.l === b.l && JSON.stringify(a.p) === JSON.stringify(b.p);
const isSel = s => S.sel.some(x => same(x, s));
const primarySel = () => S.sel[S.sel.length - 1] || null;
const prefixOf = (a, b) => a.length <= b.length && a.every((v, i) => v === b[i]);
/** is node (l, p) inside the isolated object (or is nothing isolated) */
const inIso = (l, p) => !S.iso || (l === S.iso.l && (S.iso.p === null || prefixOf(S.iso.p, p || [])));
/** is node (l, p) the selection or inside it */
const selCovers = (l, p) => S.sel.some(s => s.l === l && (s.p === null || prefixOf(s.p, p)));

// ---------- 2D affine helpers ([a,b,c,d,tx,ty]: x' = a x + c y + tx, y' = b x + d y + ty) ----------
function parentMatrix(s) { let M = ID; for (const a of ancestorsOf(s)) M = mul(M, core.nodeMatrix(a)); return M; }
function fullMatrix(s) { return mul(parentMatrix(s), core.nodeMatrix(getNode(s))); }

// ---------- saving: every committed glyph is autosaved to IndexedDB (only glyphs that differ from the library) ----------
const ORIG = new Map(LIBRARY.map(g => [g.name, clone(g)])); // Shipped and imported baselines; edits never mutate them.
const SHIPPED = new Map(LIBRARY.map(g => [g.name, g]));
const EDITS = new Map(); // name -> { name, glyph, thumb, savedAt } as stored
const DB = createStorage();
const pendingSave = new Set();
const deletedIcons = new Set();
const librarySelection = new Set();
let librarySelectionAnchor = null;
let libraryTrash = [];
let libraryDeleteBusy = false;
let libraryResetBackup = null;
let organizationBackup = null;
const collapsedGroups = new Set();
try { for (const group of JSON.parse(localStorage.getItem('gw-collapsed-groups') || '[]')) collapsedGroups.add(group); } catch {}
let saveTimer = null;
function isEdited(g) { const o = ORIG.get(g.name); return !o || JSON.stringify(o) !== JSON.stringify(g); }
function setSaveState(state, detail) {
  const el = $('saveState'); el.dataset.state = state;
  const n = S.lib.filter(isEdited).length, edited = n ? ` · ${n} edited` : '';
  el.textContent = state === 'saved' ? 'Saved' + edited : state === 'saving' ? 'Saving…' : state === 'unsaved' ? 'Unsaved changes'
    : state === 'nostore' ? 'Not saving: browser storage unavailable — use Export' : 'Save failed — use Export';
  el.title = state === 'saved' ? 'Every edit is kept in this browser (IndexedDB) and survives a reload. Export to move them elsewhere.' : (detail ? String(detail.message || detail) : '');
}
function thumbFor(g) {
  try { return core.toSVG(g, g === S.glyph && S.resolved.length ? { size: 24, resolved: S.resolved } : { size: 24 }); } catch (e) { return ''; }
}
function queueSave(name) {
  if (!name) return;
  const alreadyPending = pendingSave.size > 0;
  pendingSave.add(name); if (!alreadyPending) setSaveState('unsaved');
  clearTimeout(saveTimer); saveTimer = setTimeout(flushSaves, 300);
}
async function flushSaves() {
  clearTimeout(saveTimer);
  if (!pendingSave.size) return;
  if (!DB.db) { setSaveState('nostore', DB.failed); return; }
  const names = [...pendingSave]; pendingSave.clear();
  setSaveState('saving');
  const recs = names.map(n => { const g = S.lib[idx(n)]; return g && (!SHIPPED.has(n) || JSON.stringify(ORIG.get(n)) !== JSON.stringify(SHIPPED.get(n)) || isEdited(g)) ? { name: n, glyph: clone(g), original: ORIG.has(n) ? clone(ORIG.get(n)) : null, thumb: thumbFor(g), savedAt: Date.now() } : deletedIcons.has(n) ? { name:n, deleted:true, savedAt:Date.now() } : { name: n, del: true }; });
  try {
    await DB.run('readwrite', st => { let last; for (const r of recs) last = r.del ? st.delete(r.name) : st.put(r); return last; });
    if (disposed) { DB.db?.close(); return; }
  for (const r of recs) { if (r.del) EDITS.delete(r.name); else EDITS.set(r.name, r); }
    if (!pendingSave.size) { try { localStorage.removeItem('gw-open-pending-glyph'); localStorage.removeItem('gw-open-pending-components'); localStorage.removeItem('gw-open-pending-set-style'); } catch {} }
    setSaveState(pendingSave.size ? 'unsaved' : 'saved');
  } catch (e) { names.forEach(n => pendingSave.add(n)); setSaveState('error', e); }
  names.forEach(updateLibItem); updateGlyphTags();
}
async function loadSaved() {
  DB.db = await Promise.race([DB.open(), new Promise(r => setTimeout(() => r(null), 3000))]);
  if (!DB.db) { setSaveState('nostore', DB.failed); return; }
  if (disposed) { DB.db?.close(); return; }
  let recs = [];
  try { recs = await DB.run('readonly', st => st.getAll()) || []; } catch (e) { setSaveState('error', e); return; }
  if (disposed) { DB.db?.close(); return; }
  for (const r of recs) {
    if (r?.deleted) { deletedIcons.add(r.name); const at = idx(r.name); if(at >= 0)S.lib.splice(at,1); EDITS.set(r.name,r); continue; }
    if (!r || !r.glyph || !Array.isArray(r.glyph.layers)) continue;
    if (r.original) { try { ORIG.set(r.name, normalizeGlyph(r.original)); } catch {} }
    const i = idx(r.name); if (i >= 0) S.lib[i] = r.glyph; else S.lib.push(r.glyph);
    EDITS.set(r.name, r);
  }

  try { const definitions = await DB.run('readonly', store=>store.get('component-definitions'), 'snapshots'); if (definitions?.components) { S.components = new Map(definitions.components.map(c=>[c.id,c])); projectComponents(S.lib,S.components,core); } } catch {}
  try { const saved = await DB.run('readonly', store=>store.get('edit-history'), 'snapshots'); if (saved) { S.undo = saved.undo || []; S.redo = saved.redo || []; } } catch {}
  try { libraryTrash = (await DB.run('readonly', store=>store.get('library-trash'), 'snapshots'))?.entries || []; syncLibrarySelection(); } catch {}
  try { organizationBackup = await DB.run('readonly', store=>store.get('library-organization'), 'snapshots'); $('undoOrganizationBtn').disabled = !organizationBackup; } catch {}
  try { libraryResetBackup = await DB.run('readonly', store => store.get('library-reset'), 'snapshots'); $('undoLibraryResetBtn').disabled = !libraryResetBackup; } catch {}
  if (!disposed) setSaveState('saved');
}
listen(window, 'pagehide', () => { if (pendingSave.size) flushSaves(); });
listen(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden' && pendingSave.size) flushSaves(); });

// ---------- history ----------
let lastSnap = null;
function saveHistory() {
  if (!DB.db) return;
  S.components = collectComponents(S.lib,core); renderComponents();
  const snapshot = { id: 'edit-history', undo: clone(S.undo), redo: clone(S.redo) };
  DB.run('readwrite', (store)=>{ store.put({id:'component-definitions',components:[...S.components.values()].map(clone)}); return store.put(snapshot); }, 'snapshots').catch(error=>status(`Undo history could not be saved: ${error.message}`,true));
}
function commit(peerHistory = []) {
  ensureLayerNames(S.glyph);
  if (JSON.stringify(S.glyph) === lastSnap && !peerHistory.length) return;
  const before = lastSnap ? JSON.parse(lastSnap) : clone(S.glyph);
  // Peers are immutable library slots outside this publication boundary.
  const peers = publishSharedForms(S.glyph, before, S.lib.filter((_,i)=>i!==S.cur), core);
  const history = new Map([...peers,...peerHistory].map(g=>[g.name,g]));
  if (lastSnap) { S.undo.push({name:S.glyph.name,glyph:lastSnap, peers:[...history.values()]}); if (S.undo.length > 300) S.undo.shift(); }
  S.redo = []; lastSnap = JSON.stringify(S.glyph); storeCurrent();
  for(const name of history.keys()){queueSave(name);updateLibItem(name);}
  journalSharedChanges([...history.keys()]);
  saveHistory(); updateHistoryBtns();
}
function journalSharedChanges(names) {
  if(!names.length)return;
  try {
    const old=JSON.parse(localStorage.getItem('gw-open-pending-components') || '[]');
    const journal=new Map(old.map(g=>[g.name,g]));
    for(const name of [...names,S.glyph.name]){const g=S.lib[idx(name)];if(g)journal.set(name,g);}
    localStorage.setItem('gw-open-pending-components',JSON.stringify([...journal.values()]));
  } catch {}
}
/** write the working glyph back into its library slot and autosave it (a rename also clears the old name's record) */
function storeCurrent() {
  const prev = S.lib[S.cur] && S.lib[S.cur].name;
  S.lib[S.cur] = clone(S.glyph);
  // A synchronous single-glyph journal protects the last edit if reload beats the IDB debounce.
  try { localStorage.setItem('gw-open-pending-glyph', JSON.stringify(S.glyph)); } catch {}
  if (prev && prev !== S.glyph.name) {
    if (ORIG.has(prev)) { ORIG.set(S.glyph.name, { ...clone(ORIG.get(prev)), name: S.glyph.name }); ORIG.delete(prev); }
    queueSave(prev); renderLibrary(); }
  if (!prev) renderLibrary();
  queueSave(S.glyph.name);
}
function restoreHistory(from,to) {
  if(!from.length)return;
  penDraft=null;
  const entry=from[from.length-1];
  const target = idx(entry.name || JSON.parse(entry.glyph).name);
  if (target < 0) { status('This edit belongs to an icon outside the current library. Restore its checkpoint first.',true); return; }
  from.pop();
  if (S.cur !== target) loadGlyph(target);
  to.push({name:JSON.parse(entry.glyph).name,glyph:lastSnap,peers:entry.peers.map(g=>S.lib[idx(g.name)]).filter(Boolean).map(clone)});
  for(const peer of entry.peers){const at=idx(peer.name);if(at>=0){S.lib[at]=clone(peer);queueSave(peer.name);updateLibItem(peer.name);}}
  const oldWeight=S.glyph.setStyle?.thickness ?? S.glyph.weight ?? 1.2;
  lastSnap=entry.glyph;S.glyph=JSON.parse(lastSnap);storeCurrent();
  const restoredWeight=S.glyph.setStyle?.thickness ?? S.glyph.weight ?? 1.2;
  if(oldWeight!==restoredWeight)S.rt.weight=restoredWeight;
  journalSharedChanges(entry.peers.map(g=>g.name));
  pruneSel();renderAll();markCurrent();saveHistory();updateHistoryBtns();
}
function undo() {restoreHistory(S.undo,S.redo);}
function redo() {restoreHistory(S.redo,S.undo);}
function revert() {
  const o = ORIG.get(S.glyph.name);
  if (!o || !isEdited(S.glyph)) return;
  penDraft = null; S.glyph = clone(o); S.sel = []; S.iso = null; S.anchor = null; S.selectedAnchors = []; S.sourceAnchor = null;
  commit(); renderAll(); status('Reset to the imported original. Undo brings your edit back.');
}
function currentLibraryVersion(name) {
  return { id: `version-${crypto.randomUUID()}`, name, createdAt: Date.now(), current: S.glyph.name,
    document: libraryDocument(S.lib,'all',ORIG,collectComponents(S.lib,core)) };
}
async function saveLibraryVersion(name) {
  if (!DB.db) throw new Error('Browser storage is unavailable; export a ZIP instead.');
  if (penDraft) finishPen();
  const version = currentLibraryVersion(name);
  await DB.run('readwrite', store=>store.put(version),'snapshots');
  return version;
}
async function showLibraryVersions() {
  const list = $('libraryVersionsList'); list.replaceChildren();
  const versions = await DB.run('readonly', store=>store.getAll(),'snapshots');
  for (const version of versions.filter(v=>v.id.startsWith('version-')).sort((a,b)=>b.createdAt-a.createdAt)) {
    const row = document.createElement('div'); row.className = 'version-row';
    const label = document.createElement('span'); label.textContent = `${version.name} · ${new Date(version.createdAt).toLocaleString()} · ${version.document.glyphs.length} icons`;row.appendChild(label);
    row.appendChild(smallBtn('Restore',async()=>{
      try { await restoreLibraryVersion(version); await showLibraryVersions(); } catch(error) { status(`Restore failed: ${error.message}`,true); }
    },`Restore ${version.name}`));
    row.appendChild(smallBtn('Download ZIP',async()=>{
      try { const bytes = await libraryZIP(version.document,g=>core.toSVG(g,{mode:'baked'}));downloadBlob(`iconerd-${version.name.replace(/[^a-z0-9-]/gi,'-')}.zip`,new Blob([bytes],{type:'application/zip'})); }
      catch(error) { status(`Version export failed: ${error.message}`,true); }
    },`Download ${version.name}`));
    list.appendChild(row);
  }
}
async function restoreLibraryVersion(version) {
  if (penDraft) finishPen();
  await flushSaves();
  const archive = version.document.glyphs.length ? parseLibraryArchive(JSON.stringify(version.document)) : {glyphs:[],originals:new Map(),components:new Map()};
  projectComponents(archive.glyphs,archive.components,core);
  for (const glyph of archive.glyphs) if (core.resolve(glyph).some(layer=>layer.error)) throw new Error(`Invalid geometry in ${glyph.name}`);
  const safety = currentLibraryVersion(`Before restoring ${version.name}`);
  const names = new Set(archive.glyphs.map(g=>g.name));
  const records = archive.glyphs.map(g=>({name:g.name,glyph:clone(g),original:archive.originals.get(g.name) || clone(g),savedAt:Date.now()}));
  for (const name of SHIPPED.keys()) if (!names.has(name)) records.push({name,deleted:true,savedAt:Date.now()});
  await DB.run('readwrite',(store,tx)=>{
    store.clear();records.forEach(record=>store.put(record));
    const snapshots=tx.objectStore('snapshots');snapshots.put(safety);
    snapshots.put({id:'edit-history',undo:[],redo:[]});snapshots.put({id:'component-definitions',components:[...archive.components.values()]});
    snapshots.put({id:'library-trash',entries:[]}); snapshots.delete('library-reset'); snapshots.delete('library-organization');
  },'edits',['snapshots']);
  S.lib = archive.glyphs; ORIG.clear();for(const record of records)if(record.original)ORIG.set(record.name,clone(record.original));
  EDITS.clear();records.forEach(record=>EDITS.set(record.name,record));deletedIcons.clear();records.filter(r=>r.deleted).forEach(r=>deletedIcons.add(r.name));
  S.undo=[];S.redo=[];libraryTrash=[];libraryResetBackup=null;organizationBackup=null;librarySelection.clear();
  $('undoLibraryResetBtn').disabled=true;$('undoOrganizationBtn').disabled=true;
  try { localStorage.removeItem('gw-open-pending-glyph');localStorage.removeItem('gw-open-pending-components'); } catch {}
  renderLibrary();loadGlyph(Math.max(0,idx(version.current)));setSaveState('saved');
  status(`Restored ${version.name}. The previous library is retained as a safety checkpoint.`);
}
$('libraryVersionsBtn').onclick = async()=>{try { await showLibraryVersions();$('libraryVersionsDialog').showModal(); }catch(error){status(error.message,true);} };
$('saveLibraryVersionBtn').onclick = async()=>{
  const name=$('versionName').value.trim();if(!name){$('versionName').focus();return;}
  try { await saveLibraryVersion(name);$('versionName').value='';await showLibraryVersions();status(`Saved checkpoint: ${name}.`); }catch(error){status(error.message,true);}
};
$('closeLibraryVersionsBtn').onclick = ()=>$('libraryVersionsDialog').close();
async function resetLibrary() {
  if (penDraft) finishPen();
  if (!DB.db) { status('Reset needs browser storage so your edits can be restored.', true); return; }
  try { await saveLibraryVersion('Before resetting library'); } catch(error) { status(error.message,true);return; }
  const current = S.glyph.name;
  const snapshot = { id: 'library-reset', glyphs: clone(S.lib), originals: [...ORIG.values()].map(clone), current };
  try { await DB.run('readwrite', store => store.put(snapshot), 'snapshots'); }
  catch (error) { status(`Could not save reset backup: ${error.message}`, true); return; }
  libraryResetBackup = snapshot;
  S.lib = S.lib.map(glyph => clone(ORIG.get(glyph.name) || glyph));
  for (const glyph of S.lib) queueSave(glyph.name);
  await flushSaves(); renderLibrary(); loadGlyph(Math.max(0, idx(current))); $('undoLibraryResetBtn').disabled = false;
  status('Library restored to imported originals. Undo library reset restores your edits.');
}
async function undoLibraryReset() {
  if (!libraryResetBackup) return;
  const snapshot = libraryResetBackup;
  S.lib = mergeLibrary(S.lib, snapshot.glyphs, 'overwrite').library;
  for (const original of snapshot.originals) ORIG.set(original.name, clone(original));
  for (const glyph of S.lib) queueSave(glyph.name);
  await flushSaves(); renderLibrary(); loadGlyph(Math.max(0, idx(snapshot.current))); status('Edits restored from the library reset backup.');
}
$('resetLibraryBtn').onclick = resetLibrary;
$('undoLibraryResetBtn').onclick = undoLibraryReset;
$('organizeLibraryBtn').onclick = () => {
  const counts = new Map();
  for (const glyph of S.lib.filter(glyph=>!glyph.group?.trim())) { const group=suggestedGroup(glyph.name); counts.set(group,(counts.get(group)||0)+1); }
  const summary=$('organizeSummary'); summary.textContent='';
  for(const [group,count] of [...counts].sort(([a],[b])=>a.localeCompare(b))){const row=document.createElement('p');row.textContent=`${group}: ${count}`;summary.appendChild(row);}
  $('applyOrganizeBtn').disabled=!counts.size;$('organizeDialog').showModal();
};
$('cancelOrganizeBtn').onclick=()=>$('organizeDialog').close();
$('applyOrganizeBtn').onclick=async()=>{
  if(!DB.db){status('Grouping needs storage for an undo backup.',true);return;}
  const snapshot={id:'library-organization',groups:S.lib.map(glyph=>({name:glyph.name,group:glyph.group,groupSource:glyph.groupSource}))};
  try{await DB.run('readwrite',store=>store.put(snapshot),'snapshots');}catch(error){status(`Could not save grouping backup: ${error.message}`,true);return;}
  organizationBackup=snapshot;const current=S.glyph.name;
  S.lib=S.lib.map(glyph=>glyph.group?.trim()?glyph:{...glyph,group:suggestedGroup(glyph.name),groupSource:'name-based-suggestion'});
  for(const glyph of S.lib)queueSave(glyph.name);await flushSaves();$('organizeDialog').close();renderLibrary();loadGlyph(Math.max(0,idx(current)));$('undoOrganizationBtn').disabled=false;
  status('Name-based groups applied. These are suggestions, not verified usage categories.');
};
$('undoOrganizationBtn').onclick=async()=>{
  if(!organizationBackup)return;const previous=new Map(organizationBackup.groups.map(item=>[item.name,item]));const current=S.glyph.name;
  S.lib=S.lib.map(glyph=>{const before=previous.get(glyph.name);if(!before)return glyph;const copy={...glyph};for(const key of ['group','groupSource']){if(before[key]==null)delete copy[key];else copy[key]=before[key];}return copy;});
  for(const glyph of S.lib)queueSave(glyph.name);await flushSaves();renderLibrary();loadGlyph(Math.max(0,idx(current)));status('Previous grouping restored; artwork edits retained.');
};
function updateHistoryBtns() {
  $('undoBtn').disabled = !S.undo.length; $('redoBtn').disabled = !S.redo.length;
  const total = S.undo.length + S.redo.length, position = S.undo.length;
  const slider = $('historyScrubber');
  slider.max = total; slider.value = position; slider.disabled = !total;
  const description = `${position} of ${total} · ${S.glyph?.name || ''}${position === total ? ' · latest' : ''}`;
  slider.setAttribute('aria-valuetext', description); $('historyPosition').textContent = description;
}
function pruneSel() {
  S.sel = S.sel.filter(s => { try { return s.l < S.glyph.layers.length && (s.p === null || getNode(s)); } catch (e) { return false; } });
  if (S.iso && !(S.iso.l < S.glyph.layers.length && (S.iso.p === null || getNode(S.iso)))) S.iso = null;
  S.anchor = null; S.selectedAnchors = [];
}
function status(msg, err) { const el = $('status'); el.textContent = msg || ''; el.className = 'status' + (err ? ' err' : ''); }

// ---------- load ----------
function loadGlyph(i) {
  areaPolygon=null;if(drag?.kind==='area-selection')drag=null;$('anchorMarquee')?.remove();
  closeGroupReview();
  S.cur = i; S.glyph = clone(S.lib[i] || TEMPLATES.blank()); S.sel = []; lastSnap = JSON.stringify(S.glyph); penDraft = null; S.iso = null; S.anchor = null; S.selectedAnchors = []; S.sourceAnchor = null;
  ensureLayerNames(S.glyph); lastSnap = JSON.stringify(S.glyph);
  S.components = collectComponents(S.lib,core); renderComponents();
  S.rt.weight = S.glyph.setStyle?.thickness ?? S.glyph.weight ?? 1.2;
  renderAll(); markCurrent(); updateHistoryBtns(); updateGlyphTags(); status('');
  try { localStorage.setItem('gw-current', S.glyph.name); } catch (e) {}
}

// ---------- geometry helpers ----------
const snapV = v => S.snap ? r4(Math.round(v / S.snap) * S.snap) : r4(Math.round(v * 1000) / 1000);
/** grid snap, then pull onto a guide within 6px */
function snapPt(p) {
  const out = { x: snapV(p.x), y: snapV(p.y) };
  if (S.show.guides) {
    const tol = 6 / pxPerUnit();
    for (const g of S.glyph.guides || []) {
      if (g.axis === 'x' && Math.abs(p.x - g.pos) <= tol) out.x = g.pos;
      if (g.axis === 'y' && Math.abs(p.y - g.pos) <= tol) out.y = g.pos;
    }
  }
  return out;
}
function translateNode(n, dx, dy) {
  if(n?.component) n.component.origin = [r4(n.component.origin[0]+dx),r4(n.component.origin[1]+dy)];
  if (!n) return;
  if (n.transform && Array.isArray(n.transform.origin)) n.transform.origin = [r4(n.transform.origin[0] + dx), r4(n.transform.origin[1] + dy)];
  if (symOn(n.symmetry)) { const a = core.axisOf(n.symmetry); n.symmetry.axis = { x: r4(a.x + dx), y: r4(a.y + dy), angle: a.angle }; }
  if (n.children) { n.children.forEach(c => translateNode(c, dx, dy)); return; }
  switch (n.shape) {
    case 'rect': case 'triangle': n.x = r4(n.x + dx); n.y = r4(n.y + dy); break;
    case 'ellipse': case 'circle': case 'polygon': case 'arc': n.cx = r4(n.cx + dx); n.cy = r4(n.cy + dy); break;
    case 'line': n.x1 = r4(n.x1 + dx); n.y1 = r4(n.y1 + dy); n.x2 = r4(n.x2 + dx); n.y2 = r4(n.y2 + dy); break;
    case 'polyline': n.pts = n.pts.map(p => [r4(p[0] + dx), r4(p[1] + dy)].concat(p.length > 2 ? [p[2]] : [])); break;
    case 'pen': n.pts.forEach(q => { q.x = r4(q.x + dx); q.y = r4(q.y + dy); }); break;
    case 'path': try { n.d = core.translateD(n.d, dx, dy); } catch (e) {} break;
  }
}
/** move a node by a display-space delta, accounting for transformed ancestors */
function translateSel(s, dx, dy) { const v = apv(inv(parentMatrix(s)), { x: dx, y: dy }); translateNode(getNode(s), r4(v.x), r4(v.y)); }
const deg = (x, y, cx, cy) => { const a = Math.atan2(y - cy, x - cx) * 180 / Math.PI + 90; return r4(Math.round(a * 10) / 10); };
const norm = (x, y) => { const l = Math.hypot(x, y); return l > 1e-9 ? { x: x / l, y: y / l, l } : { x: 0, y: 0, l: 0 }; };
const atDeg = (cx, cy, r, d) => { const a = (d - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
function getTaper(n) { return (n.deform || []).find(d => d.type === 'taper'); }
function ensureTaper(n) { let t = getTaper(n); if (!t) { n.deform = n.deform || []; t = { type: 'taper' }; n.deform.push(t); } return t; }

// ---------- transforms ----------
function ensureT(n) {
  if (!n.transform) n.transform = {};
  const t = n.transform;
  if (!Array.isArray(t.origin)) { const b = core.rawBounds(n); t.origin = b ? [r4(b[0] + b[2] / 2), r4(b[1] + b[3] / 2)] : [12, 12]; }
  if (t.rotate == null) t.rotate = 0; if (t.scaleX == null) t.scaleX = 1; if (t.scaleY == null) t.scaleY = 1;
  if (t.flipX == null) t.flipX = false; if (t.flipY == null) t.flipY = false;
  return t;
}
/** move the anchor point to q (node's parent space) without moving the drawn result */
function setOrigin(n, q) {
  const t = ensureT(n);
  const M = core.nodeMatrix(n);
  const o = { x: t.origin[0], y: t.origin[1] };
  const A = [M[0], M[1], M[2], M[3], 0, 0];
  // d = A^-1 (I - A)(o - q)
  const w = { x: o.x - q.x, y: o.y - q.y };
  const Aw = apv(A, w);
  const d = apv(inv(A), { x: w.x - Aw.x, y: w.y - Aw.y });
  if (Math.abs(d.x) > 1e-6 || Math.abs(d.y) > 1e-6) translateNode(n, d.x, d.y);
  t.origin = [r4(q.x), r4(q.y)];
}

// handle descriptors in the node's RAW space: {x, y, kind, set(node, start, pos, ev)}
function handlesFor(n, px) {
  const H = [];
  if (!n || !n.shape) return H;
  const off = 14 * px;
  const pt = (x, y, set, kind = 'pt') => H.push({ x, y, kind, set });
  switch (n.shape) {
    case 'rect': case 'triangle': {
      const { x, y, w, h } = n;
      pt(x, y, (m, s, p) => { m.x = p.x; m.y = p.y; m.w = r4(s.x + s.w - p.x); m.h = r4(s.y + s.h - p.y); });
      pt(x + w, y, (m, s, p) => { m.y = p.y; m.w = r4(p.x - s.x); m.h = r4(s.y + s.h - p.y); });
      pt(x + w, y + h, (m, s, p) => { m.w = r4(p.x - s.x); m.h = r4(p.y - s.y); });
      pt(x, y + h, (m, s, p) => { m.x = p.x; m.w = r4(s.x + s.w - p.x); m.h = r4(p.y - s.y); });
      pt(x + w / 2, y, (m, s, p) => { m.y = p.y; m.h = r4(s.y + s.h - p.y); });
      pt(x + w / 2, y + h, (m, s, p) => { m.h = r4(p.y - s.y); });
      pt(x, y + h / 2, (m, s, p) => { m.x = p.x; m.w = r4(s.x + s.w - p.x); });
      pt(x + w, y + h / 2, (m, s, p) => { m.w = r4(p.x - s.x); });
      if (n.shape === 'triangle') {
        const d = Math.max(n.r || 0, 10 * px);
        pt(x + w / 2, y + d * 1.6, (m, s, p) => { m.r = Math.max(0, snapV((p.y - s.y) / 1.6)); }, 'radius');
        break;
      }
      const rr = Array.isArray(n.r) ? n.r : [n.r || 0, n.r || 0, n.r || 0, n.r || 0];
      [[x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1]].forEach(([cx, cy, sx, sy], i) => {
        const d = Math.max(rr[i] || 0, 10 * px);
        pt(cx + sx * d, cy + sy * d, (m, s, p, ev) => {
          const v = Math.max(0, Math.min(Math.min(Math.abs(s.w), Math.abs(s.h)), snapV(((p.x - cx) * sx + (p.y - cy) * sy) / 2)));
          const cur = Array.isArray(m.r) ? m.r.slice() : [m.r || 0, m.r || 0, m.r || 0, m.r || 0];
          if (ev.shiftKey) m.r = [v, v, v, v]; else { cur[i] = v; m.r = cur; }
        }, 'radius');
      });
      const t = getTaper(n) || {};
      pt(x + w - (t.top || 0), y - off, (m, s, p) => { ensureTaper(m).top = r4(Math.max(-s.w / 2, Math.min(s.w / 2, s.x + s.w - p.x))); }, 'taper');
      pt(x + w - (t.bottom || 0), y + h + off, (m, s, p) => { ensureTaper(m).bottom = r4(Math.max(-s.w / 2, Math.min(s.w / 2, s.x + s.w - p.x))); }, 'taper');
      break;
    }
    case 'circle':
      pt(n.cx + n.r, n.cy, (m, s, p) => { m.r = r4(Math.max(0.1, Math.hypot(p.x - s.cx, p.y - s.cy))); });
      pt(n.cx, n.cy + n.r, (m, s, p) => { m.r = r4(Math.max(0.1, Math.hypot(p.x - s.cx, p.y - s.cy))); });
      break;
    case 'ellipse':
      pt(n.cx + n.rx, n.cy, (m, s, p, ev) => { m.rx = r4(Math.abs(p.x - s.cx)); if (ev.shiftKey) m.ry = m.rx; });
      pt(n.cx, n.cy + n.ry, (m, s, p, ev) => { m.ry = r4(Math.abs(p.y - s.cy)); if (ev.shiftKey) m.rx = m.ry; });
      pt(n.cx + n.rx, n.cy + n.ry, (m, s, p, ev) => { m.rx = r4(Math.abs(p.x - s.cx)); m.ry = ev.shiftKey ? m.rx : r4(Math.abs(p.y - s.cy)); });
      break;
    case 'line':
      pt(n.x1, n.y1, (m, s, p) => { m.x1 = p.x; m.y1 = p.y; });
      pt(n.x2, n.y2, (m, s, p) => { m.x2 = p.x; m.y2 = p.y; });
      break;
    case 'polyline':
      n.pts.forEach((q, i) => pt(q[0], q[1], (m, s, p) => { m.pts[i] = [p.x, p.y].concat(q.length > 2 ? [q[2]] : []); }));
      break;
    case 'pen':
      n.pts.forEach((q, i) => {
        H.push({ x: q.x, y: q.y, kind: 'pt', ai: i, set: (m, s, p) => { m.pts[i].x = p.x; m.pts[i].y = p.y; } });
        // the selected corner anchor gets a radius dot on its bisector (that vertex's own corner radius)
        if (i === S.anchor && !q.in && !q.out) {
          const N = n.pts.length, pv = n.pts[(i - 1 + N) % N], nx = n.pts[(i + 1) % N];
          const ends = n.closed || (i > 0 && i < N - 1);
          if (ends) {
            const u1 = norm(pv.x - q.x, pv.y - q.y), u2 = norm(nx.x - q.x, nx.y - q.y), b = norm(u1.x + u2.x, u1.y + u2.y);
            if (b.l > 1e-6) {
              const half = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y))) / 2; // half the interior angle
              const k = 1 / Math.sin(half || 1e-3); // centre of an r-fillet sits r/sin(half) along the bisector
              const d = Math.max((q.r || 0) * k, 10 * px);
              H.push({ x: q.x + b.x * d, y: q.y + b.y * d, kind: 'radius', set: (m, st, p) => {
                const r = Math.max(0, snapV(((p.x - q.x) * b.x + (p.y - q.y) * b.y) / k));
                if (r > 0) m.pts[i].r = r; else delete m.pts[i].r;
              } });
            }
          }
        }
        for (const side of ['in', 'out']) {
          if (!Array.isArray(q[side])) continue;
          const other = side === 'in' ? 'out' : 'in';
          H.push({ x: q.x + q[side][0], y: q.y + q[side][1], kind: 'ctrl', anchor: [q.x, q.y], set: (m, s, p, ev) => {
            const a = m.pts[i]; const v = [r4(p.x - a.x), r4(p.y - a.y)]; a[side] = v;
            // smooth by default: the opposite handle keeps its length and turns to stay collinear (⌥ breaks it)
            const so = s.pts[i][other];
            if (!ev.altKey && Array.isArray(so)) { const L = Math.hypot(so[0], so[1]), l = Math.hypot(v[0], v[1]) || 1; a[other] = [r4(-v[0] / l * L), r4(-v[1] / l * L)]; }
          } });
        }
      });
      break;
    case 'polygon': {
      const v0 = atDeg(n.cx, n.cy, n.r, n.rotation || 0);
      pt(v0[0], v0[1], (m, s, p, ev) => { m.r = r4(Math.hypot(p.x - s.cx, p.y - s.cy)); if (!ev.shiftKey) m.rotation = deg(p.x, p.y, s.cx, s.cy); });
      if (n.star) { const cnt = n.sides * 2; const v1 = atDeg(n.cx, n.cy, n.star.inner, (n.rotation || 0) + 360 / cnt); pt(v1[0], v1[1], (m, s, p) => { m.star = { inner: r4(Math.hypot(p.x - s.cx, p.y - s.cy)) }; }, 'radius'); }
      break;
    }
    case 'arc': {
      const a = atDeg(n.cx, n.cy, n.r, n.start), b = atDeg(n.cx, n.cy, n.r, n.end);
      pt(a[0], a[1], (m, s, p) => { m.start = deg(p.x, p.y, s.cx, s.cy); });
      pt(b[0], b[1], (m, s, p) => { m.end = deg(p.x, p.y, s.cx, s.cy); });
      let e = n.end; if (e < n.start) e += 360; const mid = atDeg(n.cx, n.cy, n.r, (n.start + e) / 2);
      pt(mid[0], mid[1], (m, s, p) => { m.r = snapV(Math.hypot(p.x - s.cx, p.y - s.cy)); }, 'radius');
      break;
    }
  }
  return H;
}

// ---------- canvas ----------
const cv = $('canvas');
function pxPerUnit() { const r = cv.getBoundingClientRect(); return (r.width || 600) / S.view.s; }
function applyView() { cv.setAttribute('viewBox', `${S.view.x} ${S.view.y} ${S.view.s} ${S.view.s}`); $('zoomLbl').textContent = Math.round(26 / S.view.s * 100) + '%'; renderRulers(); }
function el(tag, attrs, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
function gridPath(step, from = 0, to = 24, skip) {
  let d = '';
  for (let k = 0; ; k++) { const v = r4(from + k * step); if (v > to + 1e-6) break; if (skip && skip(v)) continue; d += `M${v} ${from}V${to}M${from} ${v}H${to}`; }
  return d;
}
const NS = { 'vector-effect': 'non-scaling-stroke' };
function renderGrid() {
  const g = $('gGrid'); g.innerHTML = ''; const k = $('gKey'); k.innerHTML = '';
  if (S.show.grid) {
    const ppu = pxPerUnit();
    const mk = (d, c, w) => el('path', Object.assign({ d, fill: 'none', stroke: c, 'stroke-width': w * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--grid-line-scale')) || 1), 'shape-rendering': 'crispEdges' }, NS), g);
    if (S.gridStep === null) {
      if (ppu * 0.1 >= 6) mk(gridPath(0.1, 0, 24, v => Math.abs(v / 0.3 - Math.round(v / 0.3)) < 1e-6), 'var(--grid-minor)', 1);
      if (ppu * 0.3 >= 5) mk(gridPath(0.3), 'var(--grid-lattice)', 1);
      if (ppu * 0.5 >= 6) mk(gridPath(0.5, 0, 24, v => Number.isInteger(v)), 'var(--grid-major)', 0.6);
      mk(gridPath(1, 0, 24, v => v % 2 === 0), 'var(--grid-major)', 1);
      mk(gridPath(2), 'var(--grid-unit2)', 1);
    } else mk(gridPath(S.gridStep), 'var(--grid-major)', 1);
  }
  const kl = Object.assign({ fill: 'none', stroke: 'var(--keyline)', 'stroke-width': 1 }, NS);
  if (S.show.keylines) {
    el('rect', Object.assign({ x: 3, y: 3, width: 18, height: 18, 'stroke-dasharray': '3 3' }, kl), k);
    el('circle', Object.assign({ cx: 12, cy: 12, r: 9.6 }, kl), k);
    el('rect', Object.assign({ x: 3.3, y: 3.3, width: 17.4, height: 17.4, rx: 1.2 }, kl), k);
    el('rect', Object.assign({ x: 4.2, y: 2.4, width: 15.6, height: 19.2, rx: 1.2, 'stroke-opacity': .5 }, kl), k);
    el('rect', Object.assign({ x: 2.4, y: 4.2, width: 19.2, height: 15.6, rx: 1.2, 'stroke-opacity': .5 }, kl), k);
    el('path', Object.assign({ d: 'M12 0V24M0 12H24M0 0L24 24M24 0L0 24', 'stroke-opacity': .45 }, kl), k);
  }
  if (S.show.safe) el('rect', Object.assign({ x: 2.4, y: 2.4, width: 19.2, height: 19.2, fill: 'none', stroke: 'var(--safe)', 'stroke-width': 1.5, 'stroke-dasharray': '6 3' }, NS), k);
  if (S.show.artboard) el('rect', Object.assign({ x: 0, y: 0, width: 24, height: 24, fill: 'none', stroke: 'var(--text-3)', 'stroke-width': 1.5 }, NS), k);
}
// ---------- symmetry scopes: the glyph's own, plus any group with symmetry {mirror, rotate, axis, half} ----------
const symOn = sym => !!(sym && (sym.mirror || (sym.rotate || 1) > 1));
function symScopes() {
  const out = [];
  if (symOn(S.glyph.symmetry)) out.push({ key: 'glyph', sym: S.glyph.symmetry, M: ID, covers: (l) => S.glyph.layers[l].symmetry !== false });
  S.glyph.layers.forEach((L, l) => {
    const walk = (n, p) => {
      if (!n || !n.children) return;
      if (symOn(n.symmetry)) out.push({ key: l + ':' + p.join('.'), s: { l, p }, sym: n.symmetry, M: fullMatrix({ l, p }), covers: (ll, pp) => ll === l && pp.length > p.length && prefixOf(p, pp) });
      n.children.forEach((c, i) => walk(c, p.concat(i)));
    };
    walk(L.node, []);
  });
  return out;
}
const symObj = sc => (sc.key === 'glyph' ? S.glyph.symmetry : getNode(sc.s).symmetry);
/** every symmetry image of leaf (l, p) other than itself, as glyph-space matrices (inner scopes first) */
function ghostMatrices(scopes, l, p) {
  let imgs = [ID];
  const mine = scopes.filter(sc => sc.covers(l, p)).sort((a, b) => (b.s ? b.s.p.length : -1) - (a.s ? a.s.p.length : -1));
  for (const sc of mine) {
    const Mi = inv(sc.M);
    const Ts = core.symmetryMatrices(sc.sym).map(T => mul(sc.M, mul(T, Mi)));
    imgs = Ts.flatMap(T => imgs.map(I => mul(T, I)));
  }
  return imgs.slice(1);
}
function tfD(d, m) { const cp = new paper.CompoundPath(d); cp.transform(new paper.Matrix(m[0], m[1], m[2], m[3], m[4], m[5])); return core.itemD(cp); }
/** which scope axes are drawn: the glyph's always; a group's while it, something in it, or its isolation is selected */
function scopeShown(sc) {
  if (sc.key === 'glyph') return !S.iso || S.glyph.layers[S.iso.l].symmetry !== false;
  const { l, p } = sc.s;
  if (S.iso && S.iso.l === l && S.iso.p && (prefixOf(S.iso.p, p) || prefixOf(p, S.iso.p))) return true;
  return S.sel.some(s => s.l === l && s.p !== null && (prefixOf(p, s.p) || prefixOf(s.p, p)));
}
let axisHandles = [];
const AXIS_LEN = 10.5;
function renderAxes(scopes) {
  const g = $('gSym'); g.innerHTML = ''; axisHandles = [];
  const px = 1 / pxPerUnit(), sz = 4.5 * px;
  for (const sc of scopes) {
    if (!scopeShown(sc)) continue;
    const a = core.axisOf(sc.sym), rad = a.angle * Math.PI / 180, m = sc.sym.mirror;
    const dx = { x: -Math.sin(rad), y: Math.cos(rad) }, dy = { x: Math.cos(rad), y: Math.sin(rad) };
    const P = (x, y) => ap(sc.M, { x, y });
    const c = P(a.x, a.y);
    const st = Object.assign({ stroke: 'var(--accent)', 'stroke-width': 1, 'stroke-dasharray': '6 4', opacity: .8, 'data-axis': sc.key }, NS);
    const line = dir => { const p0 = P(a.x - dir.x * AXIS_LEN, a.y - dir.y * AXIS_LEN), p1 = P(a.x + dir.x * AXIS_LEN, a.y + dir.y * AXIS_LEN); el('path', Object.assign({ d: `M${p0.x} ${p0.y}L${p1.x} ${p1.y}` }, st), g); };
    if (m === 'x' || m === 'xy') line(dx);
    if (m === 'y' || m === 'xy') line(dy);
    el('circle', Object.assign({ cx: c.x, cy: c.y, r: sz * .6, fill: 'var(--accent)', 'data-axis-centre': sc.key }, NS), g);
    if (!m) { axisHandles.push({ x: c.x, y: c.y, kind: 'axis-move', sc }); continue; }
    const prim = m === 'y' ? dy : dx;
    const rot = P(a.x - prim.x * AXIS_LEN, a.y - prim.y * AXIS_LEN), mov = P(a.x + prim.x * AXIS_LEN, a.y + prim.y * AXIS_LEN);
    axisHandles.push({ x: rot.x, y: rot.y, kind: 'axis-rot', sc }, { x: mov.x, y: mov.y, kind: 'axis-move', sc });
    el('circle', Object.assign({ cx: rot.x, cy: rot.y, r: sz, fill: 'var(--canvas-bg)', stroke: 'var(--accent)', 'stroke-width': 1.5, 'data-axis-handle': 'rot', 'data-scope': sc.key }, NS), g);
    el('rect', Object.assign({ x: mov.x - sz, y: mov.y - sz, width: sz * 2, height: sz * 2, fill: 'var(--accent)', stroke: 'var(--accent)', 'stroke-width': 1, 'data-axis-handle': 'move', 'data-scope': sc.key }, NS), g);
  }
}
/** an axis angle from a pointer vector (scope-local), snapped to 0 / 45 / 90 within 8 degrees (shift: 15 degree steps) */
function axisAngle(v, mirror, ev) {
  let a = Math.atan2(v.x, -v.y) * 180 / Math.PI + (mirror === 'y' ? 90 : 0);
  a = ((a + 90) % 180 + 180) % 180 - 90; // the axis is a line: keep it in [-90, 90)
  if (ev && ev.shiftKey) a = Math.round(a / 15) * 15;
  else { const k = Math.round(a / 45) * 45; a = Math.abs(a - k) <= 8 ? k : Math.round(a); }
  return a === -90 ? 90 : a;
}
// ---------- isolation ----------
function isoLabel(t) {
  const L = S.glyph.layers[t.l]; const parts = [L.name || L.id];
  if (t.p) for (let k = 0; k <= t.p.length; k++) parts.push(nodeLabel(getNode({ l: t.l, p: t.p.slice(0, k) })));
  return parts;
}
function isoEnter(t) {
  S.iso = t; S.anchor = null;
  S.sel = S.sel.filter(s => s.l === t.l && (t.p === null || (s.p !== null && prefixOf(t.p, s.p))));
  refresh(true); status('Isolated ' + isoLabel(t).join(' › ') + ' — everything else is dimmed and locked. Esc clears selection; Esc again or Exit returns.');
}
function isoExit() { if (!S.iso) return false; S.iso = null; refresh(true); status('Isolation ended.'); return true; }
function renderIsoBar() {
  const bar = $('isoBar'); bar.hidden = !S.iso;
  if (!S.iso) return;
  const parts = isoLabel(S.iso);
  $('isoCrumbs').innerHTML = parts.map((t, i) => (i === parts.length - 1 ? '<b></b>' : '<span></span>')).join(' › ');
  $('isoCrumbs').querySelectorAll('b, span').forEach((e, i) => { e.textContent = parts[i]; });
}
/** double-click target: a selected group holding the hit, else the outermost group below the current scope */
function isoTargetFor(f) {
  const grp = S.sel.find(s => s.p !== null && s.l === f.l && f.p.length > s.p.length && prefixOf(s.p, f.p) && getNode(s).children);
  if (grp && !(S.iso && same(grp, S.iso))) return grp;
  const base = S.iso && S.iso.l === f.l && S.iso.p ? S.iso.p.length + 1 : 0;
  for (let k = base; k < f.p.length; k++) { const q = f.p.slice(0, k); const n = getNode({ l: f.l, p: q }); if (n && n.children) return { l: f.l, p: q }; }
  return null;
}
const ROLE_CANVAS = { primary: 'var(--text)', secondary: 'var(--icon-color-secondary)', accent: 'var(--icon-color-accent)' };
let formCache = [];
function leafList() {
  const out = [];
  S.glyph.layers.forEach((L, l) => {
    // cut = path of the nearest enclosing cutter (a child after the first of a subtract group), if any
    const walk = (n, p, anc, cut) => { if (!n || n.hidden) return; if (n.shape) out.push({ l, p, n, anc, cut }); else (n.children || []).forEach((c, i) => walk(c, p.concat(i), anc.concat([n]), n.op === 'subtract' && i > 0 ? p.concat(i) : cut)); };
    walk(L.node, [], [], null);
  });
  return out;
}
function renderCanvas() {
  applyView();
  const gL = $('gLayers'); gL.innerHTML = '';
  gL.setAttribute('opacity', S.show.original && ORIG.has(S.glyph.name) ? 0.45 : 1);
  const W = S.rt.weight;
  S.resolved.forEach((L, li) => {
    if (!L.visible) return;
    const col = L.color || ROLE_CANVAS[L.role] || 'var(--text)';
    const dim = S.iso && !(S.iso.l === li && S.iso.p === null) ? 0.15 : 1;
    for (const part of L.parts) {
      const a = { d: part.d, fill: 'none', 'fill-rule': 'nonzero', opacity: L.opacity * dim };
      if (L.paint !== 'stroke') a.fill = col;
      const style = core.strokeStyle(S.glyph, S.rt, part.cap);
      if (L.paint !== 'fill') Object.assign(a, { stroke: col, 'stroke-width': W, 'stroke-linecap': style.cap, 'stroke-linejoin': style.join });
      el('path', a, gL);
      if (L.paint !== 'fill') gL.insertAdjacentHTML('beforeend', core.strokeTipsSVG(S.glyph, part.d, { mode: 'baked', weight: W, color: col, opacity: L.opacity * dim, layerIndex: li }));
    }
  });
  // isolated object: drawn on its own at full strength over the dimmed glyph
  const gI = $('gIso'); gI.innerHTML = '';
  if (S.iso && S.iso.p !== null) {
    const L = S.glyph.layers[S.iso.l], n = getNode(S.iso); let fm = null;
    try { fm = core.form(n, ancestorsOf(S.iso), S.glyph.setStyle?.rounding || 0); } catch (e) {}
    if (fm) {
      const col = L.color || ROLE_CANVAS[L.role || 'primary'] || 'var(--text)', paint = L.paint || 'stroke';
      const items = [].concat(fm.closed ? [{ d: core.itemD(fm.closed) }] : [], fm.open.map(o => ({ d: core.itemD(o), cap: o.data && o.data.cap })));
      for (const it of items) {
        const a = { d: it.d, fill: paint !== 'stroke' ? col : 'none', 'data-iso': '1' };
        const style = core.strokeStyle(S.glyph, S.rt, it.cap);
        if (paint !== 'fill') Object.assign(a, { stroke: col, 'stroke-width': W, 'stroke-linecap': style.cap, 'stroke-linejoin': style.join });
        el('path', a, gI);
        if (paint !== 'fill') gI.insertAdjacentHTML('beforeend', core.strokeTipsSVG(S.glyph, it.d, { mode: 'baked', weight: W, color: col, layerIndex: S.iso.l }));
      }
    }
  }
  const gO = $('gOrig'); gO.innerHTML = '';
  const original = ORIG.get(S.glyph.name);
  if (S.show.original && original) {
    for (const layer of core.resolve(original)) {
      for (const path of layer.parts || []) el('path', { d: path.d, fill: layer.paint === 'fill' ? 'var(--orig)' : 'none', stroke: 'var(--orig)', 'stroke-width': original.weight || 1.2 }, gO);
    }
  }
  $('origBtn').disabled = !original;
  $('origBtn').title = original ? 'Show the starter icon before edits' : 'No starter reference for this icon';
  const gF = $('gForms'); gF.innerHTML = '';
  formCache = leafList().map(f => { let fm = null; try { fm = core.form(f.n, f.anc); } catch (e) {} return Object.assign(f, { fm }); });
  renderGuides();
  renderSelection();
}
// ---------- cutters: the later children of a subtract group, drawn dashed when their group or they are selected ----------
function cutterActive(l, opPath) {
  return S.sel.some(s => s.l === l && (s.p === null || prefixOf(s.p, opPath) || prefixOf(opPath, s.p)));
}
function cutterVisible(l, cutPath) { return S.iso ? inIso(l, cutPath) : (S.show.cutters || cutterActive(l, cutPath.slice(0, -1))); }
function renderCutters() {
  const g = $('gCut'); g.innerHTML = '';
  S.glyph.layers.forEach((L, l) => {
    if (L.visible === false) return;
    const walk = (n, p, anc) => {
      if (!n || n.hidden || !n.children) return;
      if (n.op === 'subtract') {
        const active = cutterActive(l, p);
        n.children.forEach((c, i) => {
          if (i === 0 || c.hidden || !cutterVisible(l, p.concat(i))) return;
          let fm = null; try { fm = core.form(c, anc.concat([n])); } catch (e) {}
          if (!fm || !fm.d) return;
          el('path', Object.assign({ d: fm.d, fill: active && c.edge !== 'open' ? 'var(--cutter-fill)' : 'none', stroke: 'var(--cutter)', 'stroke-width': active ? 1.6 : 1, 'stroke-dasharray': c.edge === 'open' ? '2 3' : '6 3', opacity: active ? 1 : 0.6, 'data-cutter': l + ':' + p.concat(i).join('.'), 'data-edge': c.edge || 'drawn' }, NS), g);
        });
      }
      n.children.forEach((c, i) => walk(c, p.concat(i), anc.concat([n])));
    };
    walk(L.node, [], []);
  });
}
function renderGuides() {
  const g = $('gGuides'); g.innerHTML = '';
  if (!S.show.guides) return;
  const v = S.view;
  for (const gd of S.glyph.guides || []) {
    const d = gd.axis === 'x' ? `M${gd.pos} ${v.y - 1}V${v.y + v.s + 1}` : `M${v.x - 1} ${gd.pos}H${v.x + v.s + 1}`;
    el('path', Object.assign({ d, stroke: 'var(--guide)', 'stroke-width': 1 }, NS), g);
  }
}
let activeHandles = [];
let handlePointer = null;
function handleAt(pos) {
  const tolerance = 8 / pxPerUnit();
  return activeHandles.find(h => Math.hypot(h.x-pos.x, h.y-pos.y) <= tolerance)
    || axisHandles.find(h => Math.hypot(h.x-pos.x, h.y-pos.y) <= tolerance);
}
function renderHandleHover() {
  let overlay = $('gHandleHover');
  if (!overlay) overlay = el('g', { id: 'gHandleHover', 'pointer-events': 'none', 'aria-hidden': 'true' }, cv);
  overlay.replaceChildren();
  const hit = handlePointer && !drag && !penDraft ? handleAt(handlePointer) : null;
  cv.removeAttribute('data-handle-hover');
  if (!hit) return;
  cv.setAttribute('data-handle-hover', hit.kind);
  const attrs = { cx: hit.x, cy: hit.y, r: 9 / pxPerUnit(), fill: 'none', ...NS };
  el('circle', { ...attrs, stroke: 'var(--canvas-bg)', 'stroke-width': 5 }, overlay);
  el('circle', { ...attrs, stroke: 'var(--sel)', 'stroke-width': 2 }, overlay);
}
let penHover = null;
let insertHover = null; // pen tool over an outline: where a click would add an anchor
/** selection-dependent overlays: forms, symmetry ghosts, axes, isolation bar */
function renderOverlays() {
  const gF = $('gForms'); gF.innerHTML = '';
  for(const f of formsIn(S.glyph)) {
    if(!f.node.component || f.node.hidden || f.ancestors.some(n=>n.hidden) || S.glyph.layers[f.l].visible===false || S.iso && !inIso(f.l,f.p))continue;
    const selection={l:f.l,p:f.p};
    try {const fm=core.form(f.node,ancestorsOf(selection));if(fm.d)el('path',Object.assign({d:fm.d,fill:'none',stroke:'var(--component)','stroke-width':1.5,'stroke-dasharray':'10 4','data-component':f.node.component.id},NS),gF);}catch {}
  }
  // noise control: outside isolation only the selected object's forms are outlined (Forms toggle = show all);
  // inside isolation, every form of the isolated object and nothing else
  const gG = $('gGhost'); gG.innerHTML = '';
  const scopes = symScopes();
  for (const f of formCache) {
    if (!f.fm || !f.fm.d || f.n.hidden || S.glyph.layers[f.l].visible === false) continue;
    if (!(S.iso ? inIso(f.l, f.p) : (S.show.forms || selCovers(f.l, f.p)))) continue;
    if(!f.n.component) el('path', Object.assign({ d: f.fm.d, fill: 'none', stroke: 'var(--form)', 'stroke-width': 1, 'stroke-dasharray': '4 3', 'data-form': f.l + ':' + f.p.join('.') }, NS), gF);
    // the mirrored / rotated images: live, dashed, never hit-tested (pointer-events: none on the group)
    for (const m of ghostMatrices(scopes, f.l, f.p)) el('path', Object.assign({ d: tfD(f.fm.d, m), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1, 'stroke-dasharray': '1.5 2.5', opacity: .65, 'data-ghost': f.l + ':' + f.p.join('.') }, NS), gG);
  }
  renderAxes(scopes);
  renderGeometryInspection();
  renderIsoBar();
}
function renderGeometryInspection() {
  const forms = formCache.filter(f => f.fm && !f.n.hidden && S.glyph.layers[f.l].visible !== false);
  const report = inspectGeometry(forms);
  const selected = forms.filter(f => selCovers(f.l, f.p));
  const shown = (S.iso ? forms.filter(f => inIso(f.l, f.p)) : selected.length ? selected : forms);
  const keys = new Set(shown.map(f => `${f.l}:${f.p.join('.')}`));
  const points = report.points.filter(point => keys.has(point.key));
  const rows = $('pointRows'); rows.replaceChildren();
  for (const point of points) {
    const row = rows.insertRow();
    const active = anchorSelected(point.selection, point.index) || S.sourceAnchor?.key === point.key && S.sourceAnchor.index === point.index && S.sel.some(s => s.l === point.selection.l && s.p?.join('.') === point.selection.p.join('.'));
    row.dataset.sourcePoint = `${point.key}:${point.index}`;
    row.classList.toggle('selected', active); row.setAttribute('aria-selected', String(active));
    row.tabIndex = 0;
    const selectPoint = (event = {}) => {
      if (!event.shiftKey) S.selectedAnchors = [];
      S.sel = [point.selection]; S.sourceAnchor = { key: point.key, index: point.index }; S.anchor = null; S.hmode = 'shape';
      const node = getNode(point.selection);
      if (node?.shape === 'pen') {
        const index = node.pts.findIndex(q => { const world = ap(fullMatrix(point.selection), q); return Math.hypot(world.x - point.x, world.y - point.y) < 1e-4; });
        if (index >= 0) { selectAnchor(point.selection, index, event.shiftKey); S.tool = 'direct'; syncToggles(); }
      }
      renderTree(); renderInspector(); renderSelection();
    };
    row.onclick = selectPoint;
    row.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectPoint(event); } };
    for (const value of [`${point.name} [${point.key}]`, point.index + 1, r4(point.x), r4(point.y)]) row.insertCell().textContent = String(value);
    const tag = document.createElement('input'); tag.type = 'checkbox';
    const node = getNode(point.selection);
    tag.checked = !Array.isArray(node.roundingAnchors) || node.roundingAnchors.includes(point.index);
    tag.setAttribute('aria-label', `Round ${point.name} anchor ${point.index + 1}`);
    tag.onclick = event => event.stopPropagation();
    tag.onkeydown = event => event.stopPropagation();
    tag.onchange = () => {
      if (!Array.isArray(node.roundingAnchors)) node.roundingAnchors = report.points.filter(p => p.key === point.key).map(p => p.index);
      node.roundingAnchors = tag.checked ? [...new Set([...node.roundingAnchors, point.index])] : node.roundingAnchors.filter(i => i !== point.index);
      commit(); refresh(true);
    };
    row.insertCell().appendChild(tag);
  }
  const overlay = $('gPoints'); overlay.replaceChildren();
  if (S.show.points || S.sourceAnchor) {
    const px = 1 / pxPerUnit();
    const unique = new Map(points.map(point => [`${r4(point.x)},${r4(point.y)}`, point]));
    for (const point of unique.values()) {
      const active = anchorSelected(point.selection, point.index) || S.sourceAnchor?.key === point.key && S.sourceAnchor.index === point.index && S.sel.some(s => s.l === point.selection.l && s.p?.join('.') === point.selection.p.join('.'));
      if (!S.show.points && !active) continue;
      if (active) el('circle', { cx: point.x, cy: point.y, r: 7 * px, fill: 'none', stroke: 'var(--sel)', 'stroke-width': 2 * px, 'data-selected-source-point': 'true' }, overlay);
      pointMarker(point, 2.5*px, anchorMarker(getNode(point.selection), point.index, S.glyph.setStyle), active, overlay);
      const label = el('text', { x: point.x + 5 * px, y: point.y - 5 * px, class: 'point-coordinate', 'font-size': 10 * px }, overlay);
      label.textContent = `${r4(point.x)}, ${r4(point.y)}`;
    }
  }
  $('geometrySummary').textContent = `${report.points.length} source points · ${report.overlaps.length ? `${report.overlaps.length} coincident segment(s) to inspect` : 'No coincident source segments detected'}. ${selected.length ? 'Showing selected objects.' : 'Showing all objects.'}`;
  const list = $('overlapList'); list.replaceChildren();
  for (const overlap of report.overlaps) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'overlap-item';
    button.textContent = `${overlap.a.name} / ${overlap.b.name}: ${overlap.partial ? 'partially overlapping line' : 'coincident segment'}`;
    button.onclick = () => { S.sel = [overlap.a.selection, overlap.b.selection]; renderTree(); renderInspector(); renderSelection(); };
    list.appendChild(button);
  }
}
function anchorSelected(selection, index) { return S.selectedAnchors.some(anchor => same(anchor.selection, selection) && anchor.index === index); }
function selectAnchor(selection, index, extend = false) {
  if (!extend) S.selectedAnchors = [];
  const existing = S.selectedAnchors.findIndex(anchor => same(anchor.selection, selection) && anchor.index === index);
  if (extend && existing >= 0) S.selectedAnchors.splice(existing, 1);
  else if (existing < 0) S.selectedAnchors.push({ selection: clone(selection), index });
  S.sel = S.selectedAnchors.length ? S.selectedAnchors.map(anchor => anchor.selection).filter((selection, i, all) => all.findIndex(other => same(other, selection)) === i) : [selection];
  S.anchor = S.selectedAnchors.find(anchor => same(anchor.selection, primarySel()))?.index ?? null;
}
const areaLabels={marquee:'Marquee',lasso:'Lasso',polygon:'Polygon lasso'};
function areaBase(event, scope) { return {scope,combine:event.altKey?'subtract':event.shiftKey?'add':'replace',base:clone(scope==='anchors'?S.selectedAnchors:S.sel)}; }
function renderArea(points) {
  $('anchorMarquee')?.remove();if(!points.length)return;
  el('path',{id:'anchorMarquee',d:points.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join('')+(points.length>2?'Z':''),fill:'var(--sel)','fill-opacity':0.12,stroke:'var(--sel)','stroke-width':1/pxPerUnit(),'stroke-dasharray':`${4/pxPerUnit()} ${3/pxPerUnit()}`,'pointer-events':'none'},cv);
}
function applyAreaSelection(points, state) {
  $('anchorMarquee')?.remove();if(points.length<3)return;
  const region=new paper.Path({insert:false,closed:true,segments:points.map(p=>[p.x,p.y])}), hits=[];
  if(state.scope==='anchors') {
    for(const form of leafList()) {
      if(form.n.shape!=='pen' || form.n.hidden || S.glyph.layers[form.l].visible===false || !inIso(form.l,form.p))continue;
      const selection={l:form.l,p:form.p}, matrix=fullMatrix(selection);
      form.n.pts.forEach((point,index)=>{const p=ap(matrix,point);if(region.contains([p.x,p.y]))hits.push({selection,index});});
    }
  } else {
    const candidates = new Map();
    for(const form of formCache) {
      if(form.n.hidden || S.glyph.layers[form.l].visible===false || !inIso(form.l,form.p) || !form.fm)continue;
      const paths=[...(form.fm.closed?[form.fm.closed]:[]),...form.fm.open];
      const selection=isoTargetFor(form)||{l:form.l,p:form.p};
      if(state.mode==='polygon') {
        const key=treeKey(selection);
        if(!candidates.has(key))candidates.set(key,{selection,paths:[]});
        candidates.get(key).paths.push(...paths);
      } else if(paths.some(path=>region.getIntersections(path).length || path.contains(region.firstSegment.point) || region.contains(path.firstSegment?.point || path.bounds.center)))hits.push(selection);
    }
    for(const candidate of candidates.values()) {
      if(candidate.paths.length && candidate.paths.every(path=>pathEnclosedBy(region,path)))hits.push(candidate.selection);
    }
  }
  region.remove();
  const equal=state.scope==='anchors'?(a,b)=>same(a.selection,b.selection)&&a.index===b.index:same;
  const values=(state.combine==='subtract'?state.base.filter(a=>!hits.some(b=>equal(a,b))):state.combine==='add'?[...state.base,...hits]:hits).filter((a,i,all)=>all.findIndex(b=>equal(a,b))===i);
  if(state.scope==='anchors'){S.selectedAnchors=values;S.sel=values.map(a=>a.selection).filter((s,i,all)=>all.findIndex(other=>same(other,s))===i);S.hmode='shape';}
  else {S.sel=values;S.selectedAnchors=[];}
  S.anchor=S.selectedAnchors.find(a=>same(a.selection,primarySel()))?.index ?? null;S.sourceAnchor=null;refresh(true);
  status(`Selected ${values.length} ${state.scope}. Shift adds; Option/Alt subtracts.`);
}
function finishAreaPolygon() { if(!areaPolygon)return;const pending=areaPolygon;areaPolygon=null;applyAreaSelection(pending.points,{...pending,mode:'polygon'}); }
function pointMarker(point, size, kind, selected, parent, attrs = {}) {
  const common = { fill: selected ? 'var(--sel)' : 'var(--canvas-bg)', stroke: selected ? 'var(--sel)' : 'var(--anchor-idle)', 'stroke-width': 1.5 / pxPerUnit(), 'data-point-kind': kind, 'data-selected': String(selected), ...attrs };
  if (kind === 'circle') return el('circle', { ...common, cx: point.x, cy: point.y, r: size }, parent);
  if (kind === 'diamond') return el('path', { ...common, d: `M${point.x} ${point.y-size*1.3}L${point.x+size*1.3} ${point.y}L${point.x} ${point.y+size*1.3}L${point.x-size*1.3} ${point.y}Z` }, parent);
  return el('rect', { ...common, x: point.x-size, y: point.y-size, width: size*2, height: size*2 }, parent);
}
function startAnchorDrag(position, pointerId) {
  drag = { kind: 'anchors', from: position, starts: S.selectedAnchors.map(anchor => ({ ...clone(anchor), point: clone(getNode(anchor.selection).pts[anchor.index]), Mi: inv(fullMatrix(anchor.selection)) })), moved: false };
  cv.setPointerCapture(pointerId);
}
function renderSelection() {
  renderCutters(); // cutter visibility follows the selection
  renderOverlays();
  const gS = $('gSel'); gS.innerHTML = '';
  const px = 1 / pxPerUnit();
  activeHandles = [];
  for (const s of S.sel) {
    if (s.p === null) continue;
    const n = getNode(s); if (!n) continue;
    let fm = null; try { fm = core.form(n, ancestorsOf(s)); } catch (e) {}
    if (fm && fm.d) el('path', Object.assign({ d: fm.d, fill: 'none', stroke: n.component ? 'var(--component)' : 'var(--sel)', 'stroke-width': 1.5, ...(n.component ? {'stroke-dasharray':'10 4','data-component':n.component.id} : {}) }, NS), gS);
  }
  const ps = primarySel(); const n = ps && ps.p !== null && getNode(ps);
  const sz = 4.5 * px;
  const square = h => el('rect', Object.assign({ x: h.x - sz, y: h.y - sz, width: sz * 2, height: sz * 2, fill: 'var(--canvas-bg)', stroke: 'var(--sel)', 'stroke-width': 1.5 }, NS), gS);
  const anchorMode=S.tool==='direct' || S.tool==='area' && S.areaScope==='anchors';
  const shapeSelections = anchorMode ? S.sel : S.sel.length === 1 && (S.tool === 'select' || (S.tool === 'pen' && !penDraft)) && S.hmode === 'shape' ? [ps] : [];
  for (const selection of shapeSelections) {
    if (selection.p === null) continue;
    const node = getNode(selection); if (!node?.shape || S.tool === 'direct' && node.shape !== 'pen') continue;
    const M = fullMatrix(selection), Mi = inv(M);
    const raw = handlesFor(node, px / Math.max(1e-3, Math.sqrt(Math.abs(M[0]*M[3]-M[1]*M[2]))));
    for (const h of raw) {
      const d = ap(M, h), H = { ...h, x: d.x, y: d.y, M, Mi, s: selection };
      activeHandles.push(H);
      if (h.kind === 'ctrl') { const a = ap(M, { x: h.anchor[0], y: h.anchor[1] }); el('path', Object.assign({ d: `M${a.x} ${a.y}L${d.x} ${d.y}`, stroke: 'var(--sel)', 'stroke-width': 1 }, NS), gS); }
      if (H.kind === 'pt') pointMarker(H, sz, H.ai != null ? anchorMarker(node, H.ai, S.glyph.setStyle) : 'square', H.ai != null && (anchorSelected(selection, H.ai) || (!S.selectedAnchors.length && same(selection, ps) && H.ai === S.anchor)), gS, { 'data-anchor': H.ai ?? '', 'data-anchor-object': treeKey(selection) });
      else if (H.kind === 'radius' || H.kind === 'ctrl') el('circle', Object.assign({ cx: H.x, cy: H.y, r: sz*.85, fill: H.kind === 'ctrl' ? 'var(--canvas-bg)' : 'var(--sel)', stroke: 'var(--sel)', 'stroke-width': 1.2 }, NS), gS);
      else el('path', Object.assign({ d: `M${H.x} ${H.y-sz*1.2}L${H.x+sz*1.2} ${H.y}L${H.x} ${H.y+sz*1.2}L${H.x-sz*1.2} ${H.y}Z`, fill: 'var(--sel)', stroke: 'var(--sel)', 'stroke-width': 1 }, NS), gS);
    }
  }
  if (n && S.sel.length === 1 && !anchorMode) {
    if (S.hmode === 'transform') {
      const b = core.rawBounds(n);
      if (b) {
        const M = fullMatrix(ps), Mp = parentMatrix(ps);
        const corners = [[b[0], b[1]], [b[0] + b[2], b[1]], [b[0] + b[2], b[1] + b[3]], [b[0], b[1] + b[3]]].map(c => ap(M, { x: c[0], y: c[1] }));
        el('path', Object.assign({ d: 'M' + corners.map(c => c.x + ' ' + c.y).join('L') + 'Z', fill: 'none', stroke: 'var(--sel)', 'stroke-width': 1, 'stroke-dasharray': '3 2' }, NS), gS);
        corners.forEach(c => activeHandles.push({ x: c.x, y: c.y, kind: 'tscale' }));
        const top = ap(M, { x: b[0] + b[2] / 2, y: b[1] }), ctr = ap(M, { x: b[0] + b[2] / 2, y: b[1] + b[3] / 2 });
        const dv = { x: top.x - ctr.x, y: top.y - ctr.y }, dl = Math.hypot(dv.x, dv.y) || 1;
        const knob = { x: top.x + dv.x / dl * 22 * px, y: top.y + dv.y / dl * 22 * px, kind: 'trotate' };
        el('path', Object.assign({ d: `M${top.x} ${top.y}L${knob.x} ${knob.y}`, stroke: 'var(--sel)', 'stroke-width': 1 }, NS), gS);
        activeHandles.push(knob);
        const t = n.transform && Array.isArray(n.transform.origin) ? n.transform.origin : [b[0] + b[2] / 2, b[1] + b[3] / 2];
        const o = ap(Mp, { x: t[0], y: t[1] });
        activeHandles.push({ x: o.x, y: o.y, kind: 'torigin' });
        for (const H of activeHandles) {
          if (H.kind === 'tscale') square(H);
          if (H.kind === 'trotate') el('circle', Object.assign({ cx: H.x, cy: H.y, r: sz, fill: 'var(--canvas-bg)', stroke: 'var(--sel)', 'stroke-width': 1.5 }, NS), gS);
          if (H.kind === 'torigin') { el('circle', Object.assign({ cx: H.x, cy: H.y, r: sz * 1.1, fill: 'none', stroke: 'var(--guide)', 'stroke-width': 1.5 }, NS), gS); el('path', Object.assign({ d: `M${H.x - sz * 1.8} ${H.y}H${H.x + sz * 1.8}M${H.x} ${H.y - sz * 1.8}V${H.y + sz * 1.8}`, stroke: 'var(--guide)', 'stroke-width': 1.2 }, NS), gS); }
        }
      }
    }
  }
  if (insertHover && S.tool === 'pen' && !penDraft) {
    el('circle', Object.assign({ cx: insertHover.x, cy: insertHover.y, r: sz * 1.1, fill: 'var(--canvas-bg)', stroke: 'var(--sel)', 'stroke-width': 1.5, 'data-insert': '1' }, NS), gS);
    el('path', Object.assign({ d: `M${insertHover.x - sz * .6} ${insertHover.y}H${insertHover.x + sz * .6}M${insertHover.x} ${insertHover.y - sz * .6}V${insertHover.y + sz * .6}`, stroke: 'var(--sel)', 'stroke-width': 1.2 }, NS), gS);
  }
  // pen draft feedback
  if (penDraft && S.tool === 'pen') {
    const pn = getNode(penDraft.s);
    if (pn && pn.pts && pn.pts.length) {
      const M = fullMatrix(penDraft.s);
      pn.pts.forEach((q, i) => { const d = ap(M, q); el('rect', Object.assign({ x: d.x - sz, y: d.y - sz, width: sz * 2, height: sz * 2, fill: i === 0 ? 'var(--sel)' : 'var(--canvas-bg)', stroke: 'var(--sel)', 'stroke-width': 1.5 }, NS), gS); });
      if (penHover) { const last = ap(M, pn.pts[pn.pts.length - 1]); el('path', Object.assign({ d: `M${last.x} ${last.y}L${penHover.x} ${penHover.y}`, stroke: 'var(--sel)', 'stroke-width': 1, 'stroke-dasharray': '3 3' }, NS), gS); }
    }
  }
  renderHandleHover();
}
function toUnits(ev) { const pt = cv.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; const q = pt.matrixTransform(cv.getScreenCTM().inverse()); return { x: q.x, y: q.y }; }
function hitForm(pos) {
  const tol = 6 / pxPerUnit();
  const pt = new paper.Point(pos.x, pos.y);
  let best = null;
  let bestCut = null;
  for (let i = formCache.length - 1; i >= 0; i--) {
    const f = formCache[i]; if (!f.fm || f.n.hidden || S.glyph.layers[f.l].visible === false) continue;
    if (!inIso(f.l, f.p)) continue; // isolation: the rest of the glyph does not take clicks
    // a cutter is only grabbable while it is drawn (show-cutters on, or its group selected)
    if (f.cut && !cutterVisible(f.l, f.cut)) continue;
    for (const it of [].concat(f.fm.closed ? [f.fm.closed] : [], f.fm.open)) {
      const near = it.getNearestPoint(pt); const dist = near ? near.getDistance(pt) : Infinity;
      if (dist <= tol) return f;
      if (it.closed !== false && it.contains && it.contains(pt)) { if (f.cut) { if (!bestCut && cutterActive(f.l, f.cut.slice(0, -1))) bestCut = f; } else if (!best) best = f; }
    }
  }
  return best || bestCut;
}
/** pen tool: the outline under the pointer (selected form first), with the nearest point on it */
function hitOutline(pos) {
  const tol = 6 / pxPerUnit(), pt = new paper.Point(pos.x, pos.y);
  const ps = primarySel();
  const order = formCache.slice().reverse().sort((a, b) => (ps && same(b, ps) ? 1 : 0) - (ps && same(a, ps) ? 1 : 0));
  for (const f of order) {
    if (!f.fm || f.n.hidden || S.glyph.layers[f.l].visible === false || !inIso(f.l, f.p)) continue;
    if (f.cut && !cutterVisible(f.l, f.cut)) continue;
    for (const it of [].concat(f.fm.closed ? [f.fm.closed] : [], f.fm.open)) {
      const near = it.getNearestPoint(pt);
      if (near && near.getDistance(pt) <= tol) return { f, x: near.x, y: near.y };
    }
  }
  return null;
}
/** add an anchor where (pos) meets the form's outline; a primitive first becomes a pen path in place */
function insertAnchor(hit, ev) {
  let s = { l: hit.f.l, p: hit.f.p };
  let n = getNode(s);
  const originalMatrix = fullMatrix(s);
  const q = ap(inv(originalMatrix), { x: hit.x, y: hit.y });
  let converted = false;
  if (n.shape !== 'pen' || n.deform?.length || (n.pts || []).some(point => point.r > 0)) {
    const vector = core.toPen(n); if (!vector) return false;
    if (s.p.length) getParent(s).children[s.p.at(-1)] = vector; else layerOf(s).node = vector;
    n = vector; converted = true;
    if (n.children) {
      let nearest = [], distance = Infinity;
      const visit = (child, pathIndices) => {
        if (child.children) { child.children.forEach((nested, index) => visit(nested, pathIndices.concat(index))); return; }
        for (const path of core.shapeItems(child)) {
          const value = path.getNearestPoint(new paper.Point(q.x, q.y)).getDistance(new paper.Point(q.x, q.y));
          if (value < distance) { distance = value; nearest = pathIndices; }
        }
      };
      n.children.forEach((child, index) => visit(child, [index]));
      s = { l: s.l, p: s.p.concat(nearest) }; n = getNode(s);
    }
  }
  const Mi = inv(fullMatrix(s)), local = ap(Mi, { x: hit.x, y: hit.y });
  const nearAnchor = n.pts.findIndex(point => {
    const world = ap(fullMatrix(s), point);
    return Math.hypot(world.x - hit.x, world.y - hit.y) <= 6 / pxPerUnit();
  });
  if (ev.altKey || nearAnchor >= 0) {
    S.sel = [s]; S.anchor = nearAnchor >= 0 ? nearAnchor : null;
    if (converted) commit();
    if (ev.altKey && S.anchor != null) deleteAnchor();
    refresh(true); return true;
  }
  const result = core.insertPoint(n, local.x, local.y);
  if (!result) { if (converted) { commit(); refresh(true); } return false; }
  n.pts = result.node.pts;
  if (result.node.roundingAnchors) n.roundingAnchors = result.node.roundingAnchors;
  S.sel = [s]; S.anchor = result.index; insertHover = null;
  drag = { kind: 'anchor', s, i: result.index, Mi, from: { x: hit.x, y: hit.y }, moved: false };
  cv.setPointerCapture(ev.pointerId);
  refresh(true);
  status(`${converted ? 'Converted to editable vectors · ' : ''}Point ${result.index + 1} added. Alt-click a point or press Delete to remove it.`);
  return true;
}
function toggleSmooth(s, i) {
  const n = getNode(s); if (!n || n.shape !== 'pen') return;
  const q = n.pts[i], N = n.pts.length;
  if (q.in || q.out) { delete q.in; delete q.out; status(`Anchor ${i + 1}: corner.`); }
  else {
    const pv = n.pts[(i - 1 + N) % N], nx = n.pts[(i + 1) % N];
    const first = !n.closed && i === 0, last = !n.closed && i === N - 1;
    const a = first ? q : pv, b = last ? q : nx;
    const t = norm(b.x - a.x, b.y - a.y); if (!t.l) return;
    const li = Math.hypot(q.x - pv.x, q.y - pv.y) / 3, lo = Math.hypot(nx.x - q.x, nx.y - q.y) / 3;
    if (!first) q.in = [r4(-t.x * li), r4(-t.y * li)];
    if (!last) q.out = [r4(t.x * lo), r4(t.y * lo)];
    delete q.r; status(`Anchor ${i + 1}: smooth.`);
  }
  S.anchor = i; commit(); refresh(true);
}
function deleteSelectedAnchors() {
  if (!(S.tool==='direct' || S.tool==='area' && S.areaScope==='anchors') || S.selectedAnchors.length < 2) return false;
  const groups = new Map();
  for (const anchor of S.selectedAnchors) { const key = treeKey(anchor.selection); if (!groups.has(key)) groups.set(key, { selection: anchor.selection, indices: [] }); groups.get(key).indices.push(anchor.index); }
  for (const { selection, indices } of groups.values()) { const node = getNode(selection); if (node.pts.length-indices.length < (node.closed ? 3 : 2)) { status('Keep at least three points on a closed path or two on an open path.', true); return true; } }
  for (const { selection, indices } of groups.values()) {
    const node = getNode(selection), removed = new Set(indices);
    node.pts = node.pts.filter((point,index) => !removed.has(index));
    if (Array.isArray(node.roundingAnchors)) node.roundingAnchors = node.roundingAnchors.filter(index => !removed.has(index)).map(index => index-indices.filter(other=>other<index).length);
  }
  S.selectedAnchors=[]; S.anchor=null; commit(); refresh(true); status('Selected anchors deleted.'); return true;
}
function deleteAnchor() {
  if (deleteSelectedAnchors()) return true;
  const s = primarySel(); const n = s && s.p !== null && getNode(s);
  if (!n || n.shape !== 'pen' || S.anchor == null || !n.pts[S.anchor]) return false;
  if (n.pts.length <= (n.closed ? 3 : 2)) { status('A path keeps at least ' + (n.closed ? 3 : 2) + ' anchors.', true); return true; }
  n.pts.splice(S.anchor, 1);
  if (Array.isArray(n.roundingAnchors)) n.roundingAnchors = n.roundingAnchors.filter(index => index !== S.anchor).map(index => index > S.anchor ? index - 1 : index);
  S.anchor = null; commit(); refresh(true); status('Anchor deleted.');
  return true;
}
function hitGuide(pos) {
  if (!S.show.guides) return -1;
  const tol = 5 / pxPerUnit();
  return (S.glyph.guides || []).findIndex(g => Math.abs((g.axis === 'x' ? pos.x : pos.y) - g.pos) <= tol);
}
function overRuler(ev, axis) { const r = cv.getBoundingClientRect(); return axis === 'x' ? ev.clientX < r.left + 2 : ev.clientY < r.top + 2; }

// ---------- pointer interaction ----------
let drag = null;
function restore(n, snap) { Object.keys(n).forEach(k => delete n[k]); Object.assign(n, clone(snap)); }
listen(cv, 'pointerdown', ev => {
  if(ev.button === 2)return;
  handlePointer = null; renderHandleHover();
  if (ev.button === 1 || ev.altKey && S.tool === 'select' && !activeHandles.length) { drag = { pan: true, x: ev.clientX, y: ev.clientY, v: Object.assign({}, S.view) }; cv.classList.add('panning'); cv.setPointerCapture(ev.pointerId); return; }
  const pos = toUnits(ev); const px = 1 / pxPerUnit();
  cv.focus({ preventScroll: true });
  if(S.tool==='area') {
    if(S.areaMode==='polygon') {
      if(areaPolygon?.points.length>=3 && Math.hypot(pos.x-areaPolygon.points[0].x,pos.y-areaPolygon.points[0].y)<8/pxPerUnit()){finishAreaPolygon();return;}
      if(!areaPolygon)areaPolygon={...areaBase(ev,S.areaScope),points:[]};
      areaPolygon.points.push(pos);renderArea(areaPolygon.points);return;
    }
    drag={kind:'area-selection',mode:S.areaMode,...areaBase(ev,S.areaScope),from:pos,to:pos,points:[pos]};cv.setPointerCapture(ev.pointerId);return;
  }
  const now = performance.now();
  if (S.tool === 'select' && ev.button === 0 && !ev.altKey && lastDown && now - lastDown.t < 400 && Math.hypot(ev.clientX - lastDown.x, ev.clientY - lastDown.y) < 5) { lastDown = null; drag = null; onDoubleClick(ev); return; }
  lastDown = { t: now, x: ev.clientX, y: ev.clientY };
  const candidate = handleAt(pos);
  const hit = candidate && activeHandles.includes(candidate) ? candidate : null;
  const axh = !hit && candidate;
  if (axh) {
    const sym = symObj(axh.sc); const a = core.axisOf(sym);
    drag = { kind: axh.kind, sc: axh.sc, sym, start: a, Mi: inv(axh.sc.M), from: pos, moved: false };
    cv.setPointerCapture(ev.pointerId); return;
  }
  if (S.tool === 'pen' && (penDraft || !hit)) {
    if (!penDraft) { const o = hitOutline(pos); if (o) { insertAnchor(o, ev); return; } }
    penDown(pos, ev); return;
  }
  if (hit && S.tool === 'pen' && ev.altKey && hit.ai != null) { S.anchor = hit.ai; deleteAnchor(); return; }
  if (hit) {
    const s = hit.s || primarySel(); const n = getNode(s);
    if (S.tool === 'direct' && hit.ai != null && hit.kind === 'pt') {
      if(ev.altKey) { S.selectedAnchors=S.selectedAnchors.filter(a=>!same(a.selection,s)||a.index!==hit.ai);S.anchor=null;refresh(true);return; }
      if (ev.shiftKey || !anchorSelected(s, hit.ai)) selectAnchor(s, hit.ai, ev.shiftKey);
      renderTree(); renderInspector(); renderSelection();
      if (anchorSelected(s, hit.ai)) startAnchorDrag(pos, ev.pointerId);
      return;
    }
    if (hit.ai != null && S.anchor !== hit.ai) { S.anchor = hit.ai; renderInspector(); renderSelection(); }
    if (hit.kind === 'tscale' || hit.kind === 'trotate' || hit.kind === 'torigin') ensureT(n);
    drag = { kind: hit.kind.startsWith('t') ? hit.kind : 'handle', h: hit, s, start: clone(n), from: pos, Mp: parentMatrix(s), moved: false };
    cv.setPointerCapture(ev.pointerId); return;
  }
  const gi = hitGuide(pos);
  if (gi >= 0) { drag = { kind: 'guide', i: gi, moved: false }; cv.setPointerCapture(ev.pointerId); return; }
  const f = hitForm(pos);
  if (!f) {
    if(S.tool==='direct') { drag={kind:'area-selection',mode:'marquee',...areaBase(ev,'anchors'),from:pos,to:pos,points:[pos]};cv.setPointerCapture(ev.pointerId);return; }
    if (!ev.shiftKey) { S.sel = []; S.anchor = null; S.selectedAnchors = []; S.sourceAnchor = null; renderTree(); renderSelection(); renderInspector(); } return;
  }
  S.anchor = null;
  if (S.tool === 'direct') {
    let target = { l: f.l, p: f.p }, node = getNode(target);
    if (node.shape !== 'pen') {
      const converted = core.toPen(node);
      if (!converted) return;
      if (target.p.length) getParent(target).children[target.p.at(-1)] = converted; else layerOf(target).node = converted;
      node = converted; commit(); refresh(true);
      if (node.children) {
        const candidates = leafList().filter(leaf => leaf.l === target.l && prefixOf(target.p, leaf.p));
        let best = null;
        for (const candidate of candidates) {
          const fm = core.form(candidate.n, candidate.anc), paths = [...(fm.closed ? fm.closed.children || [fm.closed] : []), ...fm.open];
          const distance = Math.min(...paths.map(path => path.getNearestPoint([pos.x, pos.y])?.getDistance([pos.x, pos.y]) ?? Infinity));
          if (!best || distance < best.distance) best = { candidate, distance };
        }
        if (!best) return; target = { l: best.candidate.l, p: best.candidate.p }; node = getNode(target);
      }
    }
    if (!ev.shiftKey && !ev.altKey) S.selectedAnchors = [];
    S.sel = [target]; S.hmode = 'shape';
    const index = node.pts.findIndex(q => { const world = ap(fullMatrix(target), q); return Math.hypot(world.x - pos.x, world.y - pos.y) <= 8 * px; });
    if (index >= 0) { if(ev.altKey)S.selectedAnchors=S.selectedAnchors.filter(a=>!same(a.selection,target)||a.index!==index);else selectAnchor(target, index, ev.shiftKey); } else S.anchor = null;
    renderTree(); renderInspector(); renderSelection();
    if (index >= 0) {
      const handle = activeHandles.find(handle => handle.ai === index && handle.kind === 'pt');
      if (handle && anchorSelected(target, index)) startAnchorDrag(pos, ev.pointerId);
    }
    return;
  }
  S.selectedAnchors = [];
  let target = isoTargetFor(f) || { l: f.l, p: f.p };
  const grp = S.sel.find(s => s.p !== null && s.l === f.l && f.p.length > s.p.length && JSON.stringify(f.p.slice(0, s.p.length)) === JSON.stringify(s.p));
  if (grp && !ev.shiftKey && !ev.metaKey) target = grp;
  // a cutter inside the selected group is picked directly, so it can be dragged and resized on its own
  if (grp && f.cut && f.cut.length > grp.p.length && prefixOf(grp.p, f.cut)) target = { l: f.l, p: f.cut };
  if (ev.shiftKey || ev.metaKey) { if (isSel(target)) S.sel = S.sel.filter(s => !same(s, target)); else S.sel.push(target); }
  else if (!isSel(target)) S.sel = [target];
  renderTree(); renderInspector(); renderSelection();
  drag = { kind: 'move', from: pos, starts: S.sel.filter(s => s.p !== null).map(s => ({ s, n: clone(getNode(s)) })), moved: false };
  cv.setPointerCapture(ev.pointerId);
});
listen(cv, 'pointermove', ev => {
  const pos = toUnits(ev);
  handlePointer = pos; renderHandleHover();
  if (!drag) {
    if(areaPolygon){renderArea([...areaPolygon.points,pos]);return;}
    if (S.tool === 'pen' && penDraft) { penHover = snapPt(pos); renderSelection(); }
    else if (S.tool === 'pen') { const o = hitOutline(pos); const had = !!insertHover; insertHover = o ? { x: o.x, y: o.y } : null; cv.classList.toggle('insert', !!o); if (o || had) renderSelection(); }
    return;
  }
  if(drag.kind==='area-selection') {
    drag.to=pos;if(drag.mode==='lasso')drag.points.push(pos);
    renderArea(drag.mode==='lasso'?drag.points:[drag.from,{x:pos.x,y:drag.from.y},pos,{x:drag.from.x,y:pos.y}]);return;
  }
  if (drag.kind === 'anchors') {
    const dx = snapV(pos.x-drag.from.x), dy = snapV(pos.y-drag.from.y);
    if (!dx && !dy && !drag.moved) return;
    for (const anchor of drag.starts) {
      const point = getNode(anchor.selection)?.pts?.[anchor.index]; if (!point) continue;
      const delta = apv(anchor.Mi, { x: dx, y: dy }); point.x = r4(anchor.point.x+delta.x); point.y = r4(anchor.point.y+delta.y);
    }
    drag.moved = true; refresh(false); return;
  }
  if (drag.kind === 'axis-move' || drag.kind === 'axis-rot') {
    const q = ap(drag.Mi, pos), a = drag.start;
    if (drag.kind === 'axis-move') { const q0 = ap(drag.Mi, drag.from); drag.sym.axis = { x: snapV(a.x + q.x - q0.x), y: snapV(a.y + q.y - q0.y), angle: a.angle }; }
    else drag.sym.axis = { x: a.x, y: a.y, angle: axisAngle({ x: q.x - a.x, y: q.y - a.y }, drag.sym.mirror, ev) };
    drag.moved = true; refresh(false); renderInspectorAxisOnly(); return;
  }
  if (drag.kind === 'anchor') {
    const n = getNode(drag.s); const q = ap(drag.Mi, snapPt(pos));
    n.pts[drag.i].x = r4(q.x); n.pts[drag.i].y = r4(q.y);
    drag.moved = true; refresh(false); return;
  }
  if (drag.pan) { const k = S.view.s / cv.getBoundingClientRect().width; S.view.x = drag.v.x - (ev.clientX - drag.x) * k; S.view.y = drag.v.y - (ev.clientY - drag.y) * k; applyView(); renderGuides(); return; }
  if (drag.kind === 'pen') { penDrag(pos, ev); return; }
  if (drag.kind === 'guide' || drag.kind === 'newGuide') { const g = S.glyph.guides[drag.i]; g.pos = snapV(g.axis === 'x' ? pos.x : pos.y); drag.moved = true; drag.ev = ev; renderGuides(); renderRulers(); return; }
  const n = drag.s ? getNode(drag.s) : null;
  if (drag.kind === 'handle') {
    restore(n, drag.start);
    const sp = snapPt(pos); const raw = ap(drag.h.Mi, sp);
    drag.h.set(n, drag.start, { x: r4(raw.x), y: r4(raw.y) }, ev);
    drag.moved = true; refresh(false);
  } else if (drag.kind === 'tscale' || drag.kind === 'trotate' || drag.kind === 'torigin') {
    restore(n, drag.start);
    const t = n.transform; const Mpi = inv(drag.Mp);
    const P = ap(Mpi, pos), P0 = ap(Mpi, drag.from), o = { x: t.origin[0], y: t.origin[1] };
    if (drag.kind === 'torigin') { setOrigin(n, ap(Mpi, snapPt(pos))); }
    else if (drag.kind === 'trotate') {
      let a = (Math.atan2(P.y - o.y, P.x - o.x) - Math.atan2(P0.y - o.y, P0.x - o.x)) * 180 / Math.PI + (t.rotate || 0);
      a = ev.shiftKey ? Math.round(a / 15) * 15 : Math.round(a * 10) / 10;
      t.rotate = r4(((a + 540) % 360) - 180);
    } else {
      const rad = -(t.rotate || 0) * Math.PI / 180, cs = Math.cos(rad), sn = Math.sin(rad);
      const loc = q => ({ x: cs * (q.x - o.x) - sn * (q.y - o.y), y: sn * (q.x - o.x) + cs * (q.y - o.y) });
      const v = loc(P), v0 = loc(P0);
      let fx = Math.abs(v0.x) > 1e-3 ? v.x / v0.x : 1, fy = Math.abs(v0.y) > 1e-3 ? v.y / v0.y : 1;
      if (S.lockAspect !== ev.shiftKey) { const f = (v.x * v0.x + v.y * v0.y) / ((v0.x * v0.x + v0.y * v0.y) || 1); fx = fy = f; }
      const q = x => Math.max(0.01, Math.round(Math.abs(x) * 100) / 100);
      t.scaleX = q((drag.start.transform.scaleX || 1) * fx); t.scaleY = q((drag.start.transform.scaleY || 1) * fy);
    }
    drag.moved = true; refresh(false); renderInspectorTransformOnly();
  } else if (drag.kind === 'move') {
    const dx = snapV(pos.x - drag.from.x), dy = snapV(pos.y - drag.from.y);
    if (!dx && !dy && !drag.moved) return;
    for (const st of drag.starts) { const m = getNode(st.s); restore(m, st.n); translateSel(st.s, dx, dy); }
    drag.moved = true; refresh(false);
  }
});
function mergeDraggedAnchors() {
  if (!S.proximityMerge || !drag.moved) return 0;
  const anchors = drag.kind === 'anchors' ? drag.starts.map(a => ({ selection: a.selection, index: a.index }))
    : drag.kind === 'handle' && drag.h.kind === 'pt' && drag.h.ai != null ? [{ selection: drag.s, index: drag.h.ai }] : [];
  let merged = 0;
  const selections = anchors.map(a => a.selection).filter((s,i,all) => all.findIndex(other => same(s,other)) === i);
  for (const selection of selections) {
    const node = getNode(selection);
    const result = mergeNearbyAnchors(node, anchors.filter(a => same(a.selection,selection)).map(a => a.index), fullMatrix(selection), 8/pxPerUnit());
    if (!result.merged) continue;
    merged += result.merged;
    S.selectedAnchors = S.selectedAnchors.map(a => same(a.selection,selection) ? { ...a, index: result.indexMap[a.index] } : a)
      .filter((a,i,all) => all.findIndex(other => same(a.selection,other.selection) && a.index === other.index) === i);
    if (same(primarySel(),selection) && S.anchor != null) S.anchor = result.indexMap[S.anchor];
    S.sourceAnchor = null;
  }
  return merged;
}
function endDrag(ev) {
  if (!drag) return; cv.classList.remove('panning');
  if(drag.kind==='area-selection') {
    $('anchorMarquee')?.remove();
    if(ev?.type!=='pointercancel') {
      const {from,to}=drag;
      applyAreaSelection(drag.mode==='lasso'?drag.points:[from,{x:to.x,y:from.y},to,{x:from.x,y:to.y}],drag);
    }
    drag=null;refresh(true);return;
  }
  if (drag.kind === 'pen') { penUp(); drag = null; return; }
  if (drag.kind === 'anchor' || drag.kind === 'axis-move' || drag.kind === 'axis-rot') { commit(); refresh(true); drag = null; return; }
  if (drag.kind === 'guide' || drag.kind === 'newGuide') {
    const g = S.glyph.guides[drag.i];
    if (ev && overRuler(ev, g.axis) || !drag.moved && drag.kind === 'newGuide') { S.glyph.guides.splice(drag.i, 1); status('Guide removed.'); }
    if (!S.glyph.guides.length) delete S.glyph.guides;
    commit(); renderGuides(); renderRulers(); drag = null; return;
  }
  if (drag.moved) { const merged = mergeDraggedAnchors(); commit(); refresh(true); if (merged) status(`Merged ${merged} neighboring anchor pair${merged === 1 ? '' : 's'} at their average position.`); }
  drag = null;
}
listen(cv, 'pointerup', ev => { endDrag(ev); handlePointer = toUnits(ev); renderHandleHover(); });
listen(cv, 'pointercancel', ev => { endDrag(ev); handlePointer = null; renderHandleHover(); });
listen(cv, 'pointerleave', () => { handlePointer = null; renderHandleHover(); if (penHover || insertHover) { penHover = null; insertHover = null; renderSelection(); } });
listen(cv,'dblclick',()=>{if(S.tool==='area' && S.areaMode==='polygon')finishAreaPolygon();});
// double-click is detected from pointerdowns: the canvas re-renders between the two clicks, so the native
// dblclick (which needs both clicks on the same element) is unreliable here
let lastDown = null;
function onDoubleClick(ev) {
  if (S.tool !== 'select') return;
  const pos = toUnits(ev), px = 1 / pxPerUnit();
  const ah = activeHandles.find(h => h.ai != null && Math.hypot(h.x - pos.x, h.y - pos.y) <= 8 * px);
  if (ah) { toggleSmooth(primarySel(), ah.ai); return; }
  const f = hitForm(pos);
  if (!f) { isoExit(); return; }
  const t = isoTargetFor(f);
  if (t) isoEnter(t);
}
listen(cv, 'wheel', ev => {
  ev.preventDefault();
  const r = cv.getBoundingClientRect(); const k = S.view.s / r.width;
  if (ev.ctrlKey || ev.metaKey) zoomAt(toUnits(ev), Math.exp(ev.deltaY * 0.01));
  else { S.view.x += ev.deltaX * k; S.view.y += ev.deltaY * k; applyView(); renderGuides(); }
}, { passive: false });
function zoomAt(pos, f) {
  const ns = Math.max(1.2, Math.min(40, S.view.s * f)); const k = ns / S.view.s;
  S.view.x = pos.x - (pos.x - S.view.x) * k; S.view.y = pos.y - (pos.y - S.view.y) * k; S.view.s = ns; renderGrid(); renderCanvas();
}
$('zoomIn').onclick = () => zoomAt({ x: S.view.x + S.view.s / 2, y: S.view.y + S.view.s / 2 }, 1 / 1.5);
$('zoomOut').onclick = () => zoomAt({ x: S.view.x + S.view.s / 2, y: S.view.y + S.view.s / 2 }, 1.5);
$('zoomFit').onclick = () => { S.view = { x: -1, y: -1, s: 26 }; renderGrid(); renderCanvas(); };

// ---------- pen tool ----------
function penDown(pos, ev) {
  const p = snapPt(pos);
  if (penDraft) {
    const n = getNode(penDraft.s);
    if (!n) { penDraft = null; return penDown(pos, ev); }
    const M = fullMatrix(penDraft.s);
    const first = ap(M, n.pts[0]);
    if (n.pts.length >= 2 && Math.hypot(first.x - pos.x, first.y - pos.y) <= 8 / pxPerUnit()) {
      n.closed = true; commit(); finishPen('Path closed.'); return;
    }
    const raw = ap(inv(M), p); n.pts.push({ x: r4(raw.x), y: r4(raw.y) });
  } else {
    const n = { shape: 'pen', pts: [], closed: false };
    insertNode(n);
    penDraft = { s: primarySel() };
    const raw = ap(inv(fullMatrix(penDraft.s)), p); n.pts.push({ x: r4(raw.x), y: r4(raw.y) });
    status('Pen: click to add anchors, drag to pull curve handles, click the first anchor to close, Enter or Esc to finish.');
  }
  drag = { kind: 'pen', from: p, moved: false };
  cv.setPointerCapture(ev.pointerId);
  refresh(true);
}
function penDrag(pos) {
  const n = getNode(penDraft.s); if (!n) return;
  const M = fullMatrix(penDraft.s), Mi = inv(M);
  const a = n.pts[n.pts.length - 1];
  const raw = ap(Mi, snapPt(pos));
  const v = [r4(raw.x - a.x), r4(raw.y - a.y)];
  if (Math.hypot(v[0], v[1]) < 0.15) { delete a.out; delete a.in; } else { a.out = v; a.in = [-v[0], -v[1]]; }
  drag.moved = true; refresh(false);
}
function penUp() {
  const node = penDraft && getNode(penDraft.s);
  if (S.proximityMerge && node) mergeNearbyAnchors(node, [node.pts.length-1], fullMatrix(penDraft.s), 8/pxPerUnit(), 1);
  commit(); refresh(true);
}
function finishPen(msg) {
  if (!penDraft) return;
  const n = getNode(penDraft.s);
  if (n && n.pts.length < 2) { del(); status('Pen path needs two anchors — removed.'); }
  else status(msg || 'Path finished — switch to Select to edit anchors and handles.');
  penDraft = null; penHover = null; refresh(true);
}

// ---------- rulers & guides ----------
function renderRulers() {
  const top = $('rulerTop'), left = $('rulerLeft');
  const W = cv.getBoundingClientRect().width || 600;
  const k = W / S.view.s; // px per unit
  const step = k >= 60 ? 1 : k >= 24 ? 2 : 4;
  const minor = k >= 30 ? 0.5 : step / 2;
  let dt = '', dl = '', tt = '', tl = '';
  const start = Math.floor(S.view.x / minor) * minor, startY = Math.floor(S.view.y / minor) * minor;
  for (let u = start; u <= S.view.x + S.view.s; u = r4(u + minor)) { const x = (u - S.view.x) * k; const major = Math.abs(u / step - Math.round(u / step)) < 1e-6; dt += `M${x.toFixed(1)} 20V${major ? 8 : 14}`; if (major) tt += `<text x="${(x + 2).toFixed(1)}" y="9">${u}</text>`; }
  for (let u = startY; u <= S.view.y + S.view.s; u = r4(u + minor)) { const y = (u - S.view.y) * k; const major = Math.abs(u / step - Math.round(u / step)) < 1e-6; dl += `M20 ${y.toFixed(1)}H${major ? 8 : 14}`; if (major) tl += `<text x="9" y="${(y - 2).toFixed(1)}" transform="rotate(-90 9 ${(y - 2).toFixed(1)})">${u}</text>`; }
  // guide markers
  let gt = '', gl = '';
  for (const g of (S.glyph && S.glyph.guides) || []) {
    if (g.axis === 'x') gt += `<path d="M${((g.pos - S.view.x) * k).toFixed(1)} 20V0" stroke="var(--guide)"/>`;
    else gl += `<path d="M20 ${((g.pos - S.view.y) * k).toFixed(1)}H0" stroke="var(--guide)"/>`;
  }
  top.setAttribute('viewBox', `0 0 ${W} 20`); left.setAttribute('viewBox', `0 0 20 ${W}`);
  top.innerHTML = `<path d="${dt}" stroke="var(--ruler-tick)" stroke-width="var(--ruler-tick-width)" shape-rendering="crispEdges"/>${tt}${gt}`;
  left.innerHTML = `<path d="${dl}" stroke="var(--ruler-tick)" stroke-width="var(--ruler-tick-width)" shape-rendering="crispEdges"/>${tl}${gl}`;
}
function rulerDown(axis) {
  return ev => {
    ev.preventDefault();
    S.glyph.guides = S.glyph.guides || [];
    const pos = toUnits(ev);
    S.glyph.guides.push({ axis, pos: snapV(axis === 'x' ? pos.x : pos.y) });
    S.show.guides = true; syncToggles();
    drag = { kind: 'newGuide', i: S.glyph.guides.length - 1, moved: false };
    ev.currentTarget.setPointerCapture(ev.pointerId);
    renderGuides(); renderRulers();
  };
}
for (const [id, axis] of [['rulerTop', 'y'], ['rulerLeft', 'x']]) {
  const r = $(id);
  listen(r, 'pointerdown', rulerDown(axis));
  listen(r, 'pointermove', ev => { if (drag && drag.kind === 'newGuide') { const g = S.glyph.guides[drag.i]; const pos = toUnits(ev); g.pos = snapV(axis === 'x' ? pos.x : pos.y); drag.moved = true; renderGuides(); renderRulers(); } });
  listen(r, 'pointerup', endDrag);
}

// ---------- floating view palette and item menus ----------
let popup = null;
const itemMenu = document.createElement('div');
itemMenu.id = 'itemMenu'; itemMenu.className = 'floating-panel item-menu';
itemMenu.setAttribute('role', 'menu'); itemMenu.hidden = true; root.appendChild(itemMenu);
cv.setAttribute('aria-haspopup','menu');cv.setAttribute('aria-controls','itemMenu');cv.setAttribute('aria-expanded','false');
function closePopup(restoreFocus = false) {
  if (!popup) return;
  const current = popup; popup = null; current.panel.hidden = true;
  current.trigger?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) current.focus?.()?.focus();
}
function openPopup(panel, trigger, x, y, focus) {
  closePopup(); panel.hidden = false; trigger?.setAttribute('aria-expanded', 'true');
  const bounds = panel.getBoundingClientRect();
  panel.style.left = Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8)) + 'px';
  panel.style.top = Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8)) + 'px';
  popup = { panel, trigger, focus };
  panel.querySelector('button:not(:disabled), input:not(:disabled), select')?.focus();
}
$('hdrEdited').onclick = () => {
  if (popup?.panel === $('historyPalette')) { closePopup(true); return; }
  if (penDraft) finishPen();
  updateHistoryBtns();
  const button = $('hdrEdited'), bounds = button.getBoundingClientRect();
  openPopup($('historyPalette'), button, bounds.left, bounds.bottom + 6, () => button);
};
listen($('historyScrubber'), 'input', event => {
  const target = Number(event.target.value);
  while (S.undo.length !== target) {
    const before = S.undo.length;
    if (before > target) undo(); else redo();
    if (S.undo.length === before) break; // unavailable/deleted icons cannot be restored
  }
  updateHistoryBtns();
});
listen(document, 'pointerdown', event => {
  if (popup && !popup.panel.contains(event.target) && !popup.trigger?.contains(event.target)) closePopup();
}, { capture: true });
listen(window, 'resize', () => closePopup());
listen(document, 'wheel', event => { if (popup && !popup.panel.contains(event.target)) closePopup(); }, { passive: true });
listen(document, 'keydown', event => {
  if (!popup) return;
  if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); closePopup(true); return; }
  if (event.key === 'Tab') {
    const controls = [...popup.panel.querySelectorAll('button:not(:disabled), select, input:not(:disabled)')];
    const index = controls.indexOf(document.activeElement);
    if (popup.panel.getAttribute('role') === 'dialog' && (event.shiftKey ? index > 0 : index < controls.length - 1)) return;
    closePopup(true); return;
  }
  if (!popup.panel.contains(event.target)) return;
  if (event.target.matches('select, input')) return;
  const buttons = [...popup.panel.querySelectorAll('button:not(:disabled), select, input:not(:disabled)')];
  const index = buttons.indexOf(document.activeElement);
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
  if (step || event.key === 'Home' || event.key === 'End') {
    event.preventDefault(); event.stopImmediatePropagation();
    buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + step + buttons.length) % buttons.length]?.focus();
  } else if (!(event.metaKey || event.ctrlKey)) event.stopImmediatePropagation();
}, { capture: true });
$('showToggle').onclick = () => {
  if (popup?.panel === $('showPalette')) { closePopup(true); return; }
  const button = $('showToggle'), bounds = button.getBoundingClientRect();
  openPopup($('showPalette'), button, bounds.left, bounds.bottom + 6, () => button);
};
const gridSteps = ['auto', '0.1', '0.3', '0.5', '1', '2'];
try {
  const saved = localStorage.getItem('gw-grid-spacing');
  if (gridSteps.includes(saved)) { $('gridDensity').value = saved; S.gridStep = saved === 'auto' ? null : +saved; }
} catch {}
$('gridDensity').onchange = () => {
  const value = $('gridDensity').value;
  if (!gridSteps.includes(value)) return;
  S.gridStep = value === 'auto' ? null : +value;
  try { localStorage.setItem('gw-grid-spacing', value); } catch {}
  renderGrid();
};
function menuHeading(text) {
  const heading = document.createElement('div'); heading.className = 'item-menu-heading'; heading.textContent = text; itemMenu.appendChild(heading);
}
function menuAction(label, icon, action, checked = null, disabled = false) {
  const button = document.createElement('button'); button.type = 'button'; button.disabled = disabled;
  button.setAttribute('aria-label', label);
  button.setAttribute('role', checked === null ? 'menuitem' : 'menuitemcheckbox');
  if (checked !== null) button.setAttribute('aria-checked', String(checked));
  button.innerHTML = uiIcon(icon); const text = document.createElement('span'); text.textContent = label; button.appendChild(text);
  button.onclick = () => { const focus = popup?.focus; closePopup(); action(); focus?.()?.focus(); };
  itemMenu.appendChild(button);
}
const treeKey = selection => `${selection.l}:${selection.p === null ? 'layer' : selection.p.join('.')}`;
const treeRow = selection => root.querySelector(`[data-tree-key="${treeKey(selection)}"]`);
function cutterAction() {
  const current = primarySel();
  const wasCutter = current?.p?.length && getParent(current)?.op === 'subtract' && current.p.at(-1) > 0;
  const selection = useAsCutter(S.glyph, current);
  if (!selection) { status('A cutter needs another object in the same group to cut.', true); return; }
  S.sel = [selection]; S.iso = null; S.anchor = null; commit(); refresh(true);
  status(wasCutter ? 'Object is now normal geometry.' : 'Object is now an editable cutter.');
}
function groupMenu(selection, node) {
  menuHeading('Group type');
  for (const type of ['union', 'subtract', 'intersect', 'exclude', 'compound']) {
    menuAction(type.charAt(0).toUpperCase() + type.slice(1), type === 'compound' ? 'path' : type, () => {
      node.op = type; commit(); refresh(true);
    }, (node.op || 'union') === type);
  }
  menuHeading('Group symmetry');
  menuAction(symOn(node.symmetry) ? 'Turn symmetry off' : 'Turn symmetry on', 'flip-h', () => {
    node.symmetry = symOn(node.symmetry) ? { ...node.symmetry, mirror: null, rotate: 1 } : { ...node.symmetry, mirror: 'x', rotate: 1 };
    $('symScope').value = 'group'; S.sel = [selection]; commit(); refresh(true);
  }, symOn(node.symmetry));
  for (const axis of ['x', 'y', 'xy']) menuAction(`Mirror ${axis.toUpperCase()}`, axis === 'y' ? 'flip-v' : 'flip-h', () => {
    node.symmetry = { ...node.symmetry, mirror: axis, rotate: node.symmetry?.rotate || 1 };
    $('symScope').value = 'group'; S.sel = [selection]; commit(); refresh(true);
  }, node.symmetry?.mirror === axis);
  menuAction('Six radial copies', 'rotate', () => {
    node.symmetry = { ...node.symmetry, mirror: null, rotate: 6 };
    $('symScope').value = 'group'; S.sel = [selection]; commit(); refresh(true);
  }, node.symmetry?.rotate === 6 && !node.symmetry?.mirror);
}
function regularizeSelections(selections = S.sel) {
  const replacements = selections.filter(s=>s.p!==null).map(selection=>({selection,node:regularEllipse(getNode(selection),core)})).filter(item=>item.node);
  if (!replacements.length) return;
  for (const {selection,node} of replacements) {
    if(selection.p.length)getParent(selection).children[selection.p.at(-1)]=node;else layerOf(selection).node=node;
  }
  S.anchor=null;S.selectedAnchors=[];S.sourceAnchor=null;
  commit();refresh(true);status(`Converted ${replacements.length} object${replacements.length===1?'':'s'} to regular circle/ellipse shapes with four anchors. Undo restores the original contours.`);
}
function snapSelectedAnchors() {
  if(!S.snap)return;
  const selected=S.selectedAnchors.length ? S.selectedAnchors : S.anchor!=null && primarySel()?.p!==null ? [{selection:primarySel(),index:S.anchor}] : [];
  for(const anchor of selected) {
    const point=getNode(anchor.selection)?.pts?.[anchor.index];if(!point)continue;
    const matrix=fullMatrix(anchor.selection), world=ap(matrix,point);
    const local=ap(inv(matrix),{x:snapV(world.x),y:snapV(world.y)});
    point.x=r4(local.x);point.y=r4(local.y);
  }
  commit();refresh(true);status(`Snapped ${selected.length} anchor${selected.length===1?'':'s'} to the nearest ${S.snap}-unit grid intersection.`);
}
function cleanupSelectedAnchors() {
  const anchors=S.selectedAnchors.length ? S.selectedAnchors : S.anchor!=null && primarySel()?.p!==null ? [{selection:primarySel(),index:S.anchor}] : [];
  const groups=new Map();let removed=0;
  for(const anchor of anchors) { const key=treeKey(anchor.selection);if(!groups.has(key))groups.set(key,{selection:anchor.selection,indices:[]});groups.get(key).indices.push(anchor.index); }
  for(const {selection,indices} of groups.values()) {
    const node=getNode(selection);if(!node || node.deform?.length)continue;
    const result=cleanupAnchors(node,indices,fullMatrix(selection));removed+=result.removed;
    S.selectedAnchors=S.selectedAnchors.map(anchor=>same(anchor.selection,selection)?{...anchor,index:result.indexMap[anchor.index]}:anchor).filter(anchor=>anchor.index>=0);
  }
  S.anchor=S.selectedAnchors.find(anchor=>same(anchor.selection,primarySel()))?.index ?? null;S.sourceAnchor=null;
  if(removed){commit();refresh(true);}
  status(removed ? `Cleanup removed ${removed} redundant anchor${removed===1?'':'s'} (0.03-unit outline tolerance). Sharp corners and unselected anchors retained. Undo restores the original.` : 'Cleanup found no redundant selected anchors within 0.03 units. Sharp corners and unselected anchors retained.');
}
function selectAllAnchors() {
  const forms=leafList().filter(form=>form.n.shape==='pen' && !form.n.hidden && S.glyph.layers[form.l].visible!==false && inIso(form.l,form.p) && (!S.sel.length || selCovers(form.l,form.p)));
  S.selectedAnchors=forms.flatMap(form=>form.n.pts.map((_,index)=>({selection:{l:form.l,p:form.p},index})));
  S.sel=forms.map(form=>({l:form.l,p:form.p}));S.anchor=S.selectedAnchors.find(anchor=>same(anchor.selection,primarySel()))?.index ?? null;
  S.hmode='shape';refresh(true);status(`Selected ${S.selectedAnchors.length} anchors. Right-click for Cleanup.`);
}
function mergeSelectedCorners() {
  const groups=new Map();let merged=0;
  for(const anchor of S.selectedAnchors) { const key=treeKey(anchor.selection);if(!groups.has(key))groups.set(key,{selection:anchor.selection,indices:[]});groups.get(key).indices.push(anchor.index); }
  for(const {selection,indices} of groups.values()) {
    const node=getNode(selection);if(!node || node.deform?.length)continue;
    const result=mergeAnchorCorners(node,indices);merged+=result.merged;
    S.selectedAnchors=S.selectedAnchors.map(anchor=>same(anchor.selection,selection)?{...anchor,index:result.indexMap[anchor.index]}:anchor);
  }
  S.selectedAnchors=S.selectedAnchors.filter((anchor,i,all)=>all.findIndex(other=>same(anchor.selection,other.selection) && anchor.index===other.index)===i);
  S.anchor=S.selectedAnchors.find(anchor=>same(anchor.selection,primarySel()))?.index ?? null;S.sourceAnchor=null;
  if(merged){commit();refresh(true);}
  status(merged ? `Merged ${merged} redundant anchors into sharp corners. Exterior controls retained; apply procedural rounding to the new corners. Undo restores the original.` : 'Select two or more consecutive anchors at each corner. Whole paths, open endpoints and distant tangent intersections are retained.');
}
function openCanvasMenu(event) {
  event.preventDefault();drag=null;lastDown=null;areaPolygon=null;$('anchorMarquee')?.remove();
  const keyboard=event.type==='keydown';
  if(!keyboard) {
    const pos=toUnits(event), tolerance=8/pxPerUnit();
    let anchorHit=null;
    for(const form of formCache) {
      if(form.n.shape!=='pen' || form.n.hidden || S.glyph.layers[form.l].visible===false || !inIso(form.l,form.p))continue;
      const selection={l:form.l,p:form.p}, matrix=fullMatrix(selection);
      form.n.pts.forEach((point,index)=>{const world=ap(matrix,point),distance=Math.hypot(world.x-pos.x,world.y-pos.y);if(distance<=tolerance && (!anchorHit || distance<anchorHit.distance))anchorHit={selection,index,distance};});
    }
    if(anchorHit){if(!anchorSelected(anchorHit.selection,anchorHit.index))selectAnchor(anchorHit.selection,anchorHit.index);S.hmode='shape';}
    else {
      const form=hitForm(pos);
      if(form && !selCovers(form.l,form.p)){S.sel=[isoTargetFor(form)||{l:form.l,p:form.p}];S.anchor=null;S.selectedAnchors=[];}
    }
    refresh(true);
  }
  itemMenu.replaceChildren();
  const selection=primarySel(), node=selection?.p!==null && selection ? getNode(selection) : null;
  const anchors=S.selectedAnchors.length || (node?.shape==='pen' && S.anchor!=null ? 1 : 0);
  itemMenu.setAttribute('aria-label', anchors ? 'Anchor options' : S.sel.length ? 'Selection options' : 'Canvas options');
  menuHeading(anchors ? `${anchors} selected anchor${anchors===1?'':'s'}` : S.sel.length ? `${S.sel.length} selected object${S.sel.length===1?'':'s'}` : 'Canvas');
  menuAction('Undo','undo',undo,null,!S.undo.length);menuAction('Redo','redo',redo,null,!S.redo.length);
  if(anchors) {
    menuHeading(S.snap ? `Snap spacing: ${S.snap}` : 'Snap is off');
    menuAction('Snap to nearest','grid',snapSelectedAnchors,null,!S.snap);
    menuAction('Cleanup','anchor',cleanupSelectedAnchors);
    menuAction('Merge to corner','anchor',mergeSelectedCorners,null,anchors<2);
    menuAction('Select all anchors','select',selectAllAnchors);
    if(anchors===1 && node?.shape==='pen')menuAction('Toggle corner / smooth','anchor',()=>toggleSmooth(selection,S.anchor));
    menuAction('Delete selected anchors','delete',()=>{if(!deleteSelectedAnchors())deleteAnchor();});
  } else if(S.sel.length) {
    menuAction('Duplicate','duplicate',duplicate);menuAction('Delete selected objects','delete',del);
    if(node?.children)groupMenu(selection,node);
    else if(node && node.shape!=='pen')menuAction('Convert to editable path','pen',()=>{const converted=core.toPen(node);if(!converted)return;if(selection.p.length)getParent(selection).children[selection.p.at(-1)]=converted;else layerOf(selection).node=converted;commit();refresh(true);});
    if(node)menuAction('Use as cutter','cutter',cutterAction,!!selection.p.length && getParent(selection)?.op==='subtract' && selection.p.at(-1)>0,!selection.p.length || getParent(selection)?.children.length<2);
    if(S.sel.length>1)for(const op of ['union','subtract','intersect','exclude'])menuAction(op[0].toUpperCase()+op.slice(1),op,()=>group(op));
    if(node?.component)menuAction('Detach shared instance','ungroup',()=>{delete node.component;commit();refresh(true);});
  } else menuAction('Select all objects','select',()=>{S.sel=S.glyph.layers.map((_,l)=>({l,p:[]}));refresh(true);});
  if(S.sel.some(s=>s.p!==null && regularEllipse(getNode(s),core)))menuAction('Convert to circle/ellipse (4 anchors)','circle',()=>regularizeSelections());
  const bounds=cv.getBoundingClientRect();
  openPopup(itemMenu,cv,keyboard?bounds.left+bounds.width/2:event.clientX,keyboard?bounds.top+bounds.height/2:event.clientY,()=>cv);
}
listen(cv,'contextmenu',openCanvasMenu);
listen(cv,'keydown',event=>{if(event.key==='ContextMenu' || event.key==='F10' && event.shiftKey){event.stopPropagation();openCanvasMenu(event);}});
function openTreeMenu(selection, event) {
  event.preventDefault(); selectRow(selection);
  itemMenu.replaceChildren();
  const layer = layerOf(selection), node = selection.p === null ? null : getNode(selection);
  menuHeading(node ? nodeLabel(node) : layer.name);
  if (node?.children) groupMenu(selection, node);
  else if (node) menuAction('Convert to editable path', 'pen', () => {
    const converted = core.toPen(node); converted.name = node.name;
    if (selection.p.length) getParent(selection).children[selection.p.at(-1)] = converted;
    else layer.node = converted;
    commit(); refresh(true);
  });
  else {
    menuHeading('Layer paint');
    for (const paint of ['stroke', 'fill', 'both']) menuAction(paint.charAt(0).toUpperCase() + paint.slice(1), 'layers', () => {
      layer.paint = paint; commit(); refresh(true);
    }, (layer.paint || 'stroke') === paint);
  }
  if (node && regularEllipse(node,core)) menuAction('Convert to circle/ellipse (4 anchors)','circle',()=>regularizeSelections([selection]));
  if (node) menuAction('Use as cutter', 'cutter', cutterAction, !!selection.p.length && getParent(selection).op === 'subtract' && selection.p.at(-1) > 0, !selection.p.length || getParent(selection).children.length < 2);
  const row = treeRow(selection), bounds = row.getBoundingClientRect();
  openPopup(itemMenu, row, event.type === 'contextmenu' ? event.clientX : bounds.left, event.type === 'contextmenu' ? event.clientY : bounds.bottom, () => treeRow(selection));
}
function wireTreeMenu(row, selection) {
  row.setAttribute('aria-haspopup', 'menu'); row.dataset.treeKey = treeKey(selection);
  row.oncontextmenu = event => openTreeMenu(selection, event);
  const keydown = row.onkeydown;
  row.onkeydown = event => {
    if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) { event.stopPropagation(); openTreeMenu(selection, event); }
    else keydown?.(event);
  };
}
function wireLibraryMenu(button, name) {
  const open = event => {
    event.preventDefault(); event.stopPropagation();
    const index = idx(name); if (index < 0) return;
    if(!librarySelection.has(name)){librarySelection.clear();librarySelection.add(name);librarySelectionAnchor=name;}syncLibrarySelection();
    if (S.cur !== index) loadGlyph(index);
    itemMenu.replaceChildren(); menuHeading(name); menuHeading('Icon type');
    for (const [kind, label] of [['interface', 'Interface icon'], ['app-icon', 'App icon']]) menuAction(label, kind === 'app-icon' ? 'rect' : 'layers', () => {
      S.glyph.kind = kind; S.glyph.exportSize = kind === 'app-icon' ? 1024 : 24; commit(); refresh(true);
    }, (S.glyph.kind || 'interface') === kind);
    if (S.glyph.layers.length === 1 && S.glyph.layers[0].node.children) {
      const selection = { l: 0, p: [] }; S.sel = [selection];
      renderTree(); renderInspector(); renderSelection();
      groupMenu(selection, S.glyph.layers[0].node);
    }
    menuAction(`Delete ${librarySelection.size === 1 ? 'icon' : librarySelection.size+' selected icons'}`, 'delete', deleteLibraryIcons);
    const bounds = button.getBoundingClientRect();
    openPopup(itemMenu, button, event.type === 'contextmenu' ? event.clientX : bounds.left, event.type === 'contextmenu' ? event.clientY : bounds.bottom, () => LIBEL.get(name));
  };
  button.setAttribute('aria-haspopup', 'menu'); button.oncontextmenu = open;
  button.onkeydown = event => { if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) open(event); };
}
let treeDrag = null;
function clearTreeDrop() { root.querySelectorAll('[data-drop]').forEach(row => delete row.dataset.drop); }
function wireTreeDrag(row, selection) {
  row.draggable = true;
  row.ondragstart = event => {
    if (event.target.closest('button, input')) { event.preventDefault(); return; }
    closePopup(); treeDrag = { selection, glyph: S.glyph };
    event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-glyph-workbench-object', treeKey(selection));
    S.sel = [selection]; S.anchor = null;
    root.querySelectorAll('[data-tree-key]').forEach(item => item.setAttribute('aria-selected', String(item === row)));
    renderInspector(); renderSelection();
  };
  const destination = event => {
    if (!treeDrag || treeDrag.glyph !== S.glyph) return null;
    const bounds = row.getBoundingClientRect(), fraction = (event.clientY - bounds.top) / bounds.height;
    const group = selection.p === null || !!getNode(selection)?.children;
    const position = treeDrag.selection.p === null ? (fraction < 0.5 ? 'before' : 'after')
      : selection.p === null ? 'inside' : group && fraction >= 0.25 && fraction <= 0.75 ? 'inside' : fraction < 0.5 ? 'before' : 'after';
    return canMoveTreeItem(S.glyph, treeDrag.selection, selection, position) ? position : null;
  };
  row.ondragover = event => {
    clearTreeDrop(); const position = destination(event);
    if (!position) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move'; row.dataset.drop = position;
  };
  row.ondragleave = () => { delete row.dataset.drop; };
  row.ondrop = event => {
    const position = destination(event); clearTreeDrop();
    if (!position) return;
    event.preventDefault();
    const moved = moveTreeItem(S.glyph, treeDrag.selection, selection, position); treeDrag = null;
    if (!moved) return;
    S.sel = [moved]; S.iso = null; S.anchor = null; commit(); refresh(true);
    status('Object moved. Destination group effects apply to its contents.');
  };
  row.ondragend = () => { treeDrag = null; clearTreeDrop(); };
}

// ---------- tree ----------
const kindIcon = n => uiIcon(n.shape ? (n.shape === 'polygon' && n.star ? 'star' : n.shape) : n.op === 'compound' ? 'exclude' : (n.op || 'union'));
function nodeLabel(n) { if(n.component)return '◇ ' + (n.name || n.component.name); if (n.shape) return (n.name || (n.shape === 'polygon' && n.star ? 'star' : n.shape)); return n.name || n.op || 'union'; }
function nodeMeta(n) {
  let m = '';
  if (n.shape === 'rect' || n.shape === 'triangle') m = `${n.w}×${n.h}`; else if (n.shape === 'ellipse') m = `r ${n.rx}${n.ry !== n.rx ? '/' + n.ry : ''}`;
  else if (n.shape === 'circle') m = `r ${n.r}`; else if (n.shape === 'polyline' || n.shape === 'pen') m = `${(n.pts || []).length} pts`; else if (n.children) m = `${n.children.length}`;
  if (n.transform && core.hasTransform(n.transform)) m = uiIcon('rotate') + ' ' + m;
  return m;
}
function renderTree() {
  const t = $('tree'); t.innerHTML = '';
  S.glyph.layers.forEach((L, l) => {
    const sL = { l, p: null };
    const row = document.createElement('div'); row.className = 'tree-row'; row.setAttribute('role', 'treeitem'); row.tabIndex = 0;
    row.setAttribute('aria-selected', isSel(sL)); row.style.paddingLeft = '6px';
    const dotCol = { primary: 'var(--text)', secondary: 'var(--icon-color-secondary)', accent: 'var(--icon-color-accent)' }[L.role || 'primary'];
    row.innerHTML = `<button class="eye" aria-pressed="${L.visible !== false}" aria-label="Toggle layer visibility" title="Visibility">${uiIcon(L.visible !== false ? 'eye' : 'eye-off')}</button><span class="kind">${uiIcon('layers')}</span><span class="role-dot" style="background:${dotCol}"></span><span class="name layer"></span><span class="meta">${L.paint || 'stroke'}</span>${isoBtnHTML(sL)}`;
    if (S.iso && S.iso.l !== l) row.classList.add('dim');
    wireIso(row, sL);
    row.querySelector('.name').textContent = L.name || L.id;
    row.querySelector('.eye').onclick = e => { e.stopPropagation(); L.visible = L.visible === false; commit(); refresh(true); };
    row.onclick = e => selectRow(sL, e); row.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRow(sL, e); } };
    row.ondblclick = () => renameInline(row.querySelector('.name'), L.name || L.id, v => { L.name = v; commit(); refresh(true); });
    wireTreeMenu(row, sL); wireTreeDrag(row, sL);
    t.appendChild(row);
    const walk = (n, p, depth, isCutter) => {
      if (!n) return;
      const s = { l, p };
      const r = document.createElement('div'); r.className = 'tree-row' + (isCutter ? ' cutter' : ''); r.setAttribute('role', 'treeitem'); r.tabIndex = 0;
      r.setAttribute('aria-selected', isSel(s)); r.style.paddingLeft = (6 + depth * 14) + 'px';
      const cutTag = isCutter && n.edge === 'open' ? 'clear · ' : '';
      r.innerHTML = `<button class="eye" aria-pressed="${!n.hidden}" aria-label="Toggle node visibility" title="Visibility">${uiIcon(n.hidden ? 'eye-off' : 'eye')}</button><span class="kind" title="${isCutter ? 'cutter' : n.shape || n.op || 'union'}">${isCutter ? uiIcon('cutter') : kindIcon(n)}</span><span class="name"></span><span class="meta mono">${cutTag + (symOn(n.symmetry) ? 'mirror · ' : '') + (n.from ? 'converted · ' : '') + (n.deform && n.deform.length ? '~' + n.deform.length + ' ' : '') + nodeMeta(n)}</span>${n.children ? isoBtnHTML(s) : ''}`;
      if (!inIso(l, p)) r.classList.add('dim');
      if (n.children) wireIso(r, s);
      r.querySelector('.name').textContent = nodeLabel(n);
      r.querySelector('.eye').onclick = e => { e.stopPropagation(); if (n.hidden) delete n.hidden; else n.hidden = true; commit(); refresh(true); };
      r.onclick = e => selectRow(s, e); r.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectRow(s, e); } };
      r.ondblclick = () => renameInline(r.querySelector('.name'), nodeLabel(n), v => { n.name = v; commit(); refresh(true); });
      wireTreeMenu(r, s); wireTreeDrag(r, s);
      t.appendChild(r);
      if (n.children) n.children.forEach((c, i) => walk(c, p.concat(i), depth + 1, n.op === 'subtract' && i > 0));
    };
    walk(L.node, [], 1, false);
  });
}
function isoBtnHTML(s) { const on = !!(S.iso && same(S.iso, s)); return `<button class="iso" aria-pressed="${on}" aria-label="${on ? 'Exit isolation' : 'Isolate'}" title="${on ? 'Exit isolation (Esc)' : 'Isolate: dim everything else'}" data-isolate="${s.l}:${s.p === null ? 'layer' : s.p.join('.')}">${uiIcon('fit')}</button>`; }
function wireIso(row, s) { const b = row.querySelector('.iso'); if (b) b.onclick = e => { e.stopPropagation(); if (S.iso && same(S.iso, s)) isoExit(); else isoEnter(s); }; }
function selectRow(s, e) {
  if (S.iso && !(s.p === null ? (S.iso.l === s.l && S.iso.p === null) : inIso(s.l, s.p))) S.iso = null; // picking outside the isolated object leaves isolation
  S.anchor = null; S.selectedAnchors = []; S.sourceAnchor = null;
  if (e && (e.shiftKey || e.metaKey || e.ctrlKey)) { if (isSel(s)) S.sel = S.sel.filter(x => !same(x, s)); else S.sel.push(s); }
  else S.sel = [s];
  renderTree(); renderInspector(); renderSelection();
}
function renameInline(span, value, done) {
  const inp = document.createElement('input'); inp.type = 'text'; inp.value = value; inp.style.width = '100%'; inp.setAttribute('aria-label', 'Name');
  span.replaceWith(inp); inp.focus(); inp.select();
  let fin = false; const finish = ok => { if (fin) return; fin = true; if (ok && inp.value.trim()) done(inp.value.trim()); else renderTree(); };
  inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); };
  inp.onblur = () => finish(true);
}

// ---------- structural edits ----------
function insertNode(n) {
  const ps = primarySel();
  let target;
  if (!S.glyph.layers.length) addLayer(false);
  if (ps && ps.p !== null && getNode(ps)) {
    const sel = getNode(ps);
    if (sel.children) { sel.children.push(n); target = { l: ps.l, p: ps.p.concat(sel.children.length - 1) }; }
    else if (ps.p.length) { const par = getParent(ps); const i = ps.p[ps.p.length - 1] + 1; par.children.splice(i, 0, n); target = { l: ps.l, p: ps.p.slice(0, -1).concat(i) }; }
    else { layerOf(ps).node = { op: 'union', children: [sel, n] }; target = { l: ps.l, p: [1] }; }
  } else {
    const l = ps ? ps.l : S.glyph.layers.length - 1; const L = S.glyph.layers[l];
    if (!L.node) { L.node = n; target = { l, p: [] }; }
    else if (L.node.children) { L.node.children.push(n); target = { l, p: [L.node.children.length - 1] }; }
    else { L.node = { op: 'union', children: [L.node, n] }; target = { l, p: [1] }; }
  }
  S.sel = [target];
}
function addShape(type) {
  if (type === 'pen') { setTool('pen'); return; }
  insertNode(DEFAULT_SHAPES[type]());
  commit(); refresh(true); status(`Added ${type}. Drag it, or type exact values in the inspector.`);
}
function addLayer(doCommit = true) {
  const id = 'l' + Math.random().toString(36).slice(2, 6);
  S.glyph.layers.push({ id, name: 'Layer ' + (S.glyph.layers.length + 1), role: 'primary', paint: 'stroke', node: { op: 'union', children: [] } });
  S.sel = [{ l: S.glyph.layers.length - 1, p: null }];
  if (doCommit) { commit(); refresh(true); }
}
function group(op) {
  const nodes = S.sel.filter(s => s.p !== null);
  if (!nodes.length) { status('Select one or more forms first (⇧-click to add to the selection).', true); return; }
  if (nodes.length === 1 && getNode(nodes[0]).children) { getNode(nodes[0]).op = op; commit(); refresh(true); status(`Group set to ${op}.`); return; }
  const l = nodes[0].l, parentKey = JSON.stringify(nodes[0].p.slice(0, -1));
  if (nodes.some(s => s.l !== l || JSON.stringify(s.p.slice(0, -1)) !== parentKey || (s.p.length === 0 && nodes.length > 1))) { status('Booleans need siblings in the same layer and group.', true); return; }
  if (nodes.length === 1 && nodes[0].p.length === 0) {
    const L = S.glyph.layers[l]; L.node = { op, children: [L.node] }; S.sel = [{ l, p: [] }];
  } else {
    const par = getParent(nodes[0]); const idxs = nodes.map(s => s.p[s.p.length - 1]).sort((a, b) => a - b);
    const kids = idxs.map(i => par.children[i]);
    for (let k = idxs.length - 1; k >= 0; k--) par.children.splice(idxs[k], 1);
    par.children.splice(idxs[0], 0, { op, children: kids });
    S.sel = [{ l, p: nodes[0].p.slice(0, -1).concat(idxs[0]) }];
  }
  commit(); refresh(true); status(`Grouped into ${op}.`);
}
function ungroup() {
  const s = primarySel(); const n = s && getNode(s);
  if (!n || !n.children) { status('Select a boolean group to ungroup.', true); return; }
  if (!s.p.length) {
    if (n.children.length === 1) { layerOf(s).node = n.children[0]; commit(); refresh(true); return; }
    if ((n.op || 'union') === 'union') { status('This is already the layer root union.', true); return; }
    n.op = 'union'; commit(); refresh(true); status('Root changed to union (a layer keeps one root).'); return;
  }
  const par = getParent(s); const i = s.p[s.p.length - 1];
  par.children.splice(i, 1, ...n.children);
  S.sel = n.children.map((c, k) => ({ l: s.l, p: s.p.slice(0, -1).concat(i + k) }));
  commit(); refresh(true);
}
function move(dir) {
  const s = primarySel(); if (!s) return;
  if (s.p === null || s.p.length === 0) {
    const j = s.l + dir; if (j < 0 || j >= S.glyph.layers.length) return;
    const L = S.glyph.layers; [L[s.l], L[j]] = [L[j], L[s.l]]; S.sel = [{ l: j, p: s.p }];
  } else {
    const par = getParent(s); const i = s.p[s.p.length - 1], j = i + dir; if (j < 0 || j >= par.children.length) return;
    [par.children[i], par.children[j]] = [par.children[j], par.children[i]]; S.sel = [{ l: s.l, p: s.p.slice(0, -1).concat(j) }];
  }
  commit(); refresh(true);
}
function duplicate() {
  const s = primarySel(); if (!s) return;
  const node = s.p === null ? layerOf(s).node : getNode(s);
  const enclosing = formsIn(S.glyph).some(f=>f.node.component && f.l===s.l && f.p.length < (s.p?.length || 0) && prefixOf(f.p,s.p));
  if (!enclosing && !formsIn({layers:[{node}]}).some(f=>f.p.length && f.node.component)) makeComponent(node,node.name || node.shape || 'Component',core,crypto.randomUUID());
  if (s.p === null || s.p.length === 0) { const L = clone(layerOf(s)); L.id = L.id + '-copy'; L.name = (L.name || L.id) + ' copy'; S.glyph.layers.splice(s.l + 1, 0, L); S.sel = [{ l: s.l + 1, p: s.p }]; }
  else { const par = getParent(s); const i = s.p[s.p.length - 1]; par.children.splice(i + 1, 0, clone(par.children[i])); S.sel = [{ l: s.l, p: s.p.slice(0, -1).concat(i + 1) }]; }
  commit(); refresh(true); status('Duplicated in place as an instance. Geometry edits update linked instances; movement and transforms stay local.');
}
function del() {
  if (!S.sel.length) return;
  const list = S.sel.slice().sort((a, b) => (b.l - a.l) || ((b.p || []).length - (a.p || []).length) || (JSON.stringify(b.p) > JSON.stringify(a.p) ? 1 : -1));
  for (const s of list) {
    if (s.p === null || s.p.length === 0) S.glyph.layers.splice(s.l, 1);
    else { const par = getParent(s); if (par) par.children.splice(s.p[s.p.length - 1], 1); }
  }
  S.sel = []; commit(); refresh(true);
}
function nudge(dx, dy) {
  const selected = primarySel(), node = selected?.p !== null && selected && getNode(selected);
  if ((S.tool === 'direct' || S.tool==='area' && S.areaScope==='anchors') && S.selectedAnchors.length) {
    for (const anchor of S.selectedAnchors) { const point = getNode(anchor.selection)?.pts?.[anchor.index]; if (!point) continue; const delta = apv(inv(fullMatrix(anchor.selection)), { x: dx, y: dy }); point.x = r4(point.x+delta.x); point.y = r4(point.y+delta.y); }
    commit(); refresh(true); return true;
  }
  const nodes = S.sel.filter(s => s.p !== null); if (!nodes.length) return false;
  nodes.forEach(s => translateSel(s, dx, dy)); commit(); refresh(true); return true;
}
function setTool(t) {
  if(t==='area' && S.tool!=='area')S.areaScope=S.tool==='direct'?'anchors':'objects';
  areaPolygon=null;$('anchorMarquee')?.remove();
  if (S.tool === 'pen' && t !== 'pen') finishPen();
  S.tool = t; if (t === 'direct') S.hmode = 'shape'; else if (t === 'select') { S.anchor = null; S.selectedAnchors = []; S.hmode = 'transform'; }
  cv.classList.toggle('direct', t === 'direct'); cv.classList.toggle('pen', t === 'pen');cv.classList.toggle('area',t==='area'); syncToggles(); renderSelection();
  if (t === 'pen') status('Pen: click to place anchors, drag for curves, click the first anchor to close, Enter or Esc to finish.');
  if(t==='area')status(`${areaLabels[S.areaMode]} selection: ${S.areaScope}. Shift adds; Option/Alt subtracts. ${S.areaMode==='polygon'?'Click vertices; Return, double-click or click first vertex to finish; Escape cancels. Objects must be fully enclosed.':'Drag to select.'}`);
  const area=$('areaSelectBtn');area.classList.toggle('active',t==='area');area.setAttribute('aria-pressed',String(t==='area'));
}

// Keyboard preferences are editor chrome, kept outside exported artwork.
let shortcuts = { ...DEFAULT_SHORTCUTS };
try {
  const stored = JSON.parse(localStorage.getItem('gw-shortcuts') || '{}');
  const candidate = { ...DEFAULT_SHORTCUTS, ...stored };
  for (const [action, key] of Object.entries(candidate)) setShortcut(candidate, action, key);
  shortcuts = candidate;
} catch {}
function renderShortcuts() {
  const list = $('shortcutFields'); list.replaceChildren();
  for (const [action, item] of Object.entries(SHORTCUT_ACTIONS)) {
    const label = document.createElement('label'); label.textContent = item.label;
    const input = document.createElement('input'); input.type = 'text'; input.value = shortcuts[action]; input.setAttribute('aria-label', `${item.label} shortcut`);
    const apply = value => { try { shortcuts = setShortcut(shortcuts, action, value); localStorage.setItem('gw-shortcuts', JSON.stringify(shortcuts)); renderShortcuts(); status('Shortcut saved.'); } catch (error) { input.value = shortcuts[action]; status(error.message, true); } };
    input.onchange = () => apply(input.value);
    input.onkeydown = event => {
      event.stopPropagation();
      if (event.key === 'Tab') return;
      event.preventDefault();
      if (event.key === 'Escape') { input.blur(); return; }
      if (['Meta', 'Control', 'Shift', 'Alt'].includes(event.key)) return;
      apply(shortcutFromEvent(event));
    };
    label.appendChild(input); list.appendChild(label);
  }
  root.querySelectorAll('[data-tool]').forEach(button => {
    const action=button.dataset.tool;button.dataset.controlTooltip=`${SHORTCUT_ACTIONS[action].label} (${shortcuts[action]})`;button.removeAttribute('title');
    button.setAttribute('aria-keyshortcuts',shortcuts[action].includes('Mod') ? `${shortcuts[action].replace('Mod','Meta')} ${shortcuts[action].replace('Mod','Control')}` : shortcuts[action]);
  });
}
$('resetShortcuts').onclick = () => { shortcuts = { ...DEFAULT_SHORTCUTS }; try { localStorage.removeItem('gw-shortcuts'); } catch {} renderShortcuts(); status('Default shortcuts restored.'); };
renderShortcuts();

// ---------- inspector ----------
function field(parent, label, value, onInput, opts = {}) {
  const w = document.createElement('label'); w.className = 'f' + (opts.wide ? ' wide' : '');
  const sp = document.createElement('span'); sp.textContent = label; w.appendChild(sp);
  let inp;
  if (opts.options) { inp = document.createElement('select'); for (const o of opts.options) { const op = document.createElement('option'); op.value = o; op.textContent = o === '' ? '(layer)' : o; inp.appendChild(op); } inp.value = value == null ? '' : value; inp.onchange = () => { onInput(inp.value); commit(); refresh(true); }; }
  else if (opts.check) { inp = document.createElement('input'); inp.type = 'checkbox'; inp.checked = !!value; inp.onchange = () => { onInput(inp.checked); commit(); refresh(true); }; w.style.flexDirection = 'row'; w.style.alignItems = 'center'; w.style.gap = '6px'; }
  else if (opts.area) { inp = document.createElement('textarea'); inp.rows = opts.rows || 3; inp.value = value; inp.oninput = () => { onInput(inp.value); refresh(false); }; inp.onchange = () => { commit(); refresh(true); }; }
  else if (opts.text) { inp = document.createElement('input'); inp.type = 'text'; inp.value = value == null ? '' : value; inp.oninput = () => { onInput(inp.value); refresh(false); }; inp.onchange = () => { commit(); refresh(true); }; if (opts.mono) inp.className = 'mono'; }
  else {
    inp = document.createElement('input'); inp.type = 'number'; inp.step = opts.step || (S.snap || 0.1); inp.value = value == null ? '' : value;
    inp.oninput = () => { const v = parseFloat(inp.value); if (isFinite(v)) { onInput(v); refresh(false); } };
    inp.onchange = () => { commit(); refresh(false); renderTree(); };
  }
  if (opts.min != null) inp.min = opts.min;
  if (opts.max != null) inp.max = opts.max;
  if (opts.key) inp.dataset.key = opts.key;
  w.appendChild(inp); parent.appendChild(w); return inp;
}
function sub(parent, text, btns) { const d = document.createElement('div'); d.className = 'sub'; d.textContent = text; if (btns) btns.forEach(b => d.appendChild(b)); parent.appendChild(d); return d; }
function smallBtn(text, fn, title, icon) {
  const b = document.createElement('button'); b.className = 'btn sm' + (icon && !text ? ' icon' : ''); if (title) b.title = title; b.onclick = fn;
  if (icon) { b.innerHTML = uiIcon(icon); if (!text) b.setAttribute('aria-label', title || icon); }
  if (text) { const sp = document.createElement('span'); sp.textContent = text; b.appendChild(sp); }
  return b;
}
const DEF_FIELDS = { taper: ['top', 'bottom', 'left', 'right'], skew: ['x', 'y'], round: ['r'], offset: ['d'] };
function transformSection(g, n) {
  const t = n.transform || {};
  const b = core.rawBounds(n);
  sub(g, 'Transform (about the anchor point)', [smallBtn('Reset', () => { delete n.transform; commit(); refresh(true); }, 'Remove rotate / scale / flip', 'rotate')]);
  // 9-point anchor picker
  const wrap = document.createElement('div'); wrap.className = 'f';
  const lab = document.createElement('span'); lab.textContent = 'anchor point'; wrap.appendChild(lab);
  const pick = document.createElement('div'); pick.className = 'anchor-pick'; pick.setAttribute('role', 'group'); pick.setAttribute('aria-label', 'Anchor point');
  const o = Array.isArray(t.origin) ? t.origin : b ? [b[0] + b[2] / 2, b[1] + b[3] / 2] : [12, 12];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const btn = document.createElement('button'); btn.type = 'button';
    const ax = b ? b[0] + b[2] * i / 2 : 12, ay = b ? b[1] + b[3] * j / 2 : 12;
    btn.title = ['top', 'middle', 'bottom'][j] + ' ' + ['left', 'centre', 'right'][i];
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('aria-pressed', String(!!b && Math.abs(o[0] - ax) < 1e-3 && Math.abs(o[1] - ay) < 1e-3));
    // the picked point is the displayed (transformed) bounds point, so the result does not jump
    btn.onclick = () => { const M = core.nodeMatrix(n); setOrigin(n, ap(M, { x: ax, y: ay })); commit(); refresh(true); };
    pick.appendChild(btn);
  }
  wrap.appendChild(pick); g.appendChild(wrap);
  const T = () => ensureT(n);
  field(g, 'anchor x', r4(o[0]), v => setOrigin(n, { x: v, y: T().origin[1] }), { key: 'ox' });
  field(g, 'anchor y', r4(o[1]), v => setOrigin(n, { x: T().origin[0], y: v }), { key: 'oy' });
  field(g, 'rotate°', t.rotate || 0, v => { T().rotate = v; }, { step: 1, key: 'rot' });
  field(g, 'scale x %', r4((t.scaleX == null ? 1 : t.scaleX) * 100), v => { const tt = T(); const old = tt.scaleX || 1; tt.scaleX = Math.max(0.01, v / 100); if (S.lockAspect) tt.scaleY = r4((tt.scaleY || 1) * tt.scaleX / old); }, { step: 1, key: 'sx' });
  field(g, 'scale y %', r4((t.scaleY == null ? 1 : t.scaleY) * 100), v => { const tt = T(); const old = tt.scaleY || 1; tt.scaleY = Math.max(0.01, v / 100); if (S.lockAspect) tt.scaleX = r4((tt.scaleX || 1) * tt.scaleY / old); }, { step: 1, key: 'sy' });
  const lock = field(g, 'lock aspect', S.lockAspect, v => { S.lockAspect = v; }, { check: true });
  lock.onchange = () => { S.lockAspect = lock.checked; };
  const fl = document.createElement('div'); fl.className = 'f'; fl.innerHTML = '<span>flip</span>';
  const row = document.createElement('div'); row.className = 'seg';
  const fh = smallBtn('H', () => { const tt = T(); tt.flipX = !tt.flipX; commit(); refresh(true); }, 'Flip horizontally about the anchor', 'flip-h'); fh.setAttribute('aria-pressed', String(!!t.flipX)); fh.setAttribute('aria-label', 'Flip horizontally');
  const fv = smallBtn('V', () => { const tt = T(); tt.flipY = !tt.flipY; commit(); refresh(true); }, 'Flip vertically about the anchor', 'flip-v'); fv.setAttribute('aria-pressed', String(!!t.flipY)); fv.setAttribute('aria-label', 'Flip vertically');
  row.appendChild(fh); row.appendChild(fv); fl.appendChild(row); g.appendChild(fl);
}
function cutterSection(g, s, n) {
  const par = getParent(s);
  if (par && par.children.length > 1) {
    const toggle = smallBtn('Use as cutter', cutterAction, 'Toggle cutter or normal geometry', 'cutter');
    toggle.setAttribute('aria-pressed', String(par.op === 'subtract' && s.p.at(-1) > 0)); g.appendChild(toggle);
  }
  if (!par || par.op !== 'subtract' || s.p[s.p.length - 1] === 0) return;
  sub(g, 'Cutter');
  field(g, 'edge', n.edge === 'open' ? 'open (clearance)' : 'drawn', v => { if (v.startsWith('open')) n.edge = 'open'; else delete n.edge; }, { options: ['drawn', 'open (clearance)'] });
  const fi = field(g, 'group fillet r', par.fillet || 0, v => { if (v > 0) par.fillet = r4(v); else delete par.fillet; }, { step: 0.05, key: 'fillet' });
  fi.title = 'Rounds the corners this group\'s cutters leave';
}
function symSection(g, obj, set) {
  const sym = obj.symmetry && obj.symmetry !== false ? obj.symmetry : {};
  const ensure = () => { if (!obj.symmetry || obj.symmetry === false) obj.symmetry = { mirror: null, rotate: 1 }; return obj.symmetry; };
  field(g, 'mirror', sym.mirror || 'none', v => { ensure().mirror = v === 'none' ? null : v; }, { options: ['none', 'x', 'y', 'xy'] });
  field(g, 'radial copies', sym.rotate || 1, v => { ensure().rotate = Math.max(1, Math.min(32, Math.round(+v || 1))); }, { step: 1, min: 1, max: 32 });
  if (!symOn(sym)) return;
  const a = core.axisOf(sym);
  const setAx = (k, v) => { const sy = ensure(); sy.axis = Object.assign(core.axisOf(sy), { [k]: k === 'angle' ? ((((v + 90) % 180) + 180) % 180 - 90 === -90 ? 90 : (((v + 90) % 180) + 180) % 180 - 90) : v }); };
  field(g, 'axis x', a.x, v => setAx('x', v), { key: 'axx' });
  field(g, 'axis y', a.y, v => setAx('y', v), { key: 'axy' });
  field(g, 'axis angle°', a.angle, v => setAx('angle', v), { key: 'axa', step: 1 });
  if (sym.mirror) field(g, 'draw half (clip at the axis)', !!sym.half, v => { if (v) ensure().half = true; else delete ensure().half; }, { check: true });
}
function renderInspectorAxisOnly() {
  if (!drag || !drag.sym) return;
  const a = core.axisOf(drag.sym), box = $('insp');
  const set = (k, v) => { const i = box.querySelector(`[data-key="${k}"]`); if (i && document.activeElement !== i) i.value = v; };
  set('axx', a.x); set('axy', a.y); set('axa', a.angle);
}
function renderInspectorTransformOnly() {
  const s = primarySel(); const n = s && getNode(s); if (!n || !n.transform) return;
  const t = n.transform, box = $('insp');
  const set = (k, v) => { const i = box.querySelector(`[data-key="${k}"]`); if (i && document.activeElement !== i) i.value = v; };
  set('ox', r4(t.origin[0])); set('oy', r4(t.origin[1])); set('rot', t.rotate || 0); set('sx', r4((t.scaleX || 1) * 100)); set('sy', r4((t.scaleY || 1) * 100));
}
function renderComponents() {
  const list = $('componentList'); list.replaceChildren();
  for (const component of S.components.values()) {
    const instances = S.lib.flatMap(formsIn).filter(f=>f.node.component?.id === component.id);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'btn sm';
    button.textContent = `${component.name} · ${instances.length}`;
    button.setAttribute('aria-label', `Edit component ${component.name}, ${instances.length} instances`);
    button.onclick = () => {
      const first = instances[0]; if (!first) return;
      loadGlyph(idx(first.glyph.name)); S.sel = [{l:first.l,p:first.p}]; refresh(true);
    };
    list.appendChild(button);
  }
  if (!list.children.length) list.textContent = 'Duplicate a shape to create its component.';
}
let sharedCandidates = [];
function linkFormGroup(candidate,name) {
  if(!candidate?.members.length)return;
  // Resolve fresh nodes: a scan is only a proposal, never authority over stale geometry.
  const current=S.glyph.name;
  const library=S.lib.map((g,i)=>i===S.cur?S.glyph:g);
  const fresh=findSharedForms(library,core).find(group=>group.members.some(f=>f.glyph.name===candidate.members[0].glyph.name && f.l===candidate.members[0].l && JSON.stringify(f.p)===JSON.stringify(candidate.members[0].p)));
  if(!fresh){status('These forms changed. Scan again before linking.',true);return;}
  const source=fresh.members.find(f=>f.glyph.name===current && S.sel.some(s=>s.l===f.l && JSON.stringify(s.p)===JSON.stringify(f.p)));
  if(source)fresh.members=[source,...fresh.members.filter(f=>f!==source)];
  const peers=[...new Set(fresh.members.map(f=>f.glyph))].filter(g=>g.name!==current).map(clone);
  linkSharedForms(fresh,name || fresh.name,core,crypto.randomUUID());
  commit(peers);refresh(true);
  status(`Linked ${fresh.members.length} instances of ${name || fresh.name}. Geometry edits update all; placement and layer styling stay local. Undo reverses the whole link.`);
}
function sharedFormInspector(g,s,n) {
  sub(g,'Shared form');
  const p=document.createElement('div');p.className='wide lbl';g.appendChild(p);
  const enclosing=formsIn(S.glyph).find(f=>f.node.component && f.l===s.l && prefixOf(f.p,s.p));
  if(enclosing) {
    const component=enclosing.node.component;
    const uses=S.lib.flatMap(formsIn).filter(f=>f.node.component?.id===component.id);
    p.textContent=`◇ ${component.name} · ${uses.length} instances in ${new Set(uses.map(f=>f.glyph.name)).size} icons. Geometry edits update all instances. Long purple dashes mark shared forms.`;
    const detach=smallBtn('Detach instance',()=>{delete enclosing.node.component;commit();refresh(true);status('Detached. This instance now edits independently.');});g.appendChild(detach);
  } else {
    p.textContent='Find repeated geometry across the library and link it as a reusable form.';
    g.appendChild(smallBtn('Find matching forms',()=>openSharedForms({glyph:S.glyph.name,l:s.l,p:s.p})));
  }
}
function openSharedForms(selection) {
  sharedCandidates=findSharedForms(S.lib.map((g,i)=>i===S.cur?S.glyph:g),core);
  if(selection)sharedCandidates=sharedCandidates.filter(group=>group.members.some(f=>f.glyph.name===selection.glyph && f.l===selection.l && JSON.stringify(f.p)===JSON.stringify(selection.p)));
  $('sharedFormsSearch').value='';renderSharedCandidates();$('sharedFormsDialog').showModal();
}
function renderSharedCandidates() {
  const list=$('sharedFormsList');list.replaceChildren();const query=$('sharedFormsSearch').value.toLowerCase();
  const groups=sharedCandidates.filter(group=>[group.name,...group.members.map(f=>f.glyph.name)].join(' ').toLowerCase().includes(query));
  $('sharedFormsSummary').textContent=`${groups.length} repeated forms${groups.length>50 ? " (showing first 50; filter to narrow)" : ""}. Exact matches retain geometry. Near matches adopt the first instance’s geometry (within 0.6% of form size; each instance retains its own scale). Links are saved and included in ZIP exports.`;
  for(const group of groups.slice(0,50)) {
    const card=document.createElement('section');card.className='shared-form-card';
    const heading=document.createElement('strong');heading.textContent=`${group.approximate?'Near match':'Exact repeat'} · ${group.members.length} instances`;card.appendChild(heading);
    const preview=document.createElement('div');preview.className='shared-form-preview';
    for(const member of group.members.slice(0,6)) {
      const item=document.createElement('div');
      const fm=core.form(member.node,member.ancestors);
      const svg=core.toSVG(member.glyph,{size:48});
      item.innerHTML=svg.replace('</svg>',`<path d="${fm.d}" fill="none" stroke="var(--component)" stroke-width="0.35" stroke-dasharray="1.5 0.5" /></svg>`);
      const label=document.createElement('span');label.textContent=member.glyph.name;item.appendChild(label);preview.appendChild(item);
    }
    card.appendChild(preview);
    const uses=document.createElement('p');uses.textContent=group.members.map(f=>`${f.glyph.name} / ${f.node.name || f.node.shape || 'group'}`).join(', ');card.appendChild(uses);
    const input=document.createElement('input');input.value=group.name;input.setAttribute('aria-label','Shared form name');card.appendChild(input);
    card.appendChild(smallBtn(group.approximate?'Adopt shared shape and link':'Link repeated form',()=>{linkFormGroup(group,input.value.trim());$('sharedFormsDialog').close();}));
    list.appendChild(card);
  }
}
$('findSharedFormsBtn').onclick=()=>openSharedForms();
$('sharedFormsSearch').oninput=renderSharedCandidates;
$('closeSharedFormsBtn').onclick=()=>$('sharedFormsDialog').close();
function renderInspector() {
  const box = $('insp'); box.innerHTML = '';
  const g = document.createElement('div'); g.className = 'insp'; box.appendChild(g);
  const s = primarySel();
  $('inspPath').textContent = s ? (layerOf(s).name || layerOf(s).id) + (s.p ? ' / ' + (s.p.length ? s.p.join('.') : 'root') : '') : 'glyph';
  if (!s) {
    const G = S.glyph;
    field(g, 'name', G.name, v => { G.name = v; }, { text: true, mono: true, wide: true });
    field(g, 'weight (standard)', G.weight, v => { G.weight = v; S.rt.weight = v; }, { step: 0.1 });
    field(g, 'grid', G.grid, v => { G.grid = v; }, { step: 0.1 });
    sub(g, 'Symmetry (glyph)');
    symSection(g, G);
    const st = core.stats(G);
    const p = document.createElement('div'); p.className = 'wide lbl'; p.textContent = `${st.layers} layers · ${st.shapes} forms · ${st.ops} booleans · ${st.deformers} deformers · ${st.paths} path escape-hatches · ${(G.guides || []).length} guides. Select a form on the canvas or in the layer tree to edit it.`; g.appendChild(p);
    if ((G.guides || []).length) g.appendChild(smallBtn('Clear guides', () => { delete G.guides; commit(); refresh(true); renderRulers(); }));
    return;
  }
  if (S.sel.length > 1) { const p = document.createElement('div'); p.className = 'wide lbl'; p.textContent = `${S.sel.length} items selected — combine them with the Boolean buttons (union, subtract, intersect, exclude), nudge with arrows, or delete.`; g.appendChild(p); return; }
  const L = layerOf(s);
  if (s.p === null) {
    field(g, 'layer name', L.name, v => { L.name = v; }, { text: true });
    field(g, 'id', L.id, v => { L.id = v; }, { text: true, mono: true });
    field(g, 'role', L.role || 'primary', v => { L.role = v; }, { options: ['primary', 'secondary', 'accent'] });
    field(g, 'custom color (#hex)', L.color || '', value => { if (/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(value)) L.color = value; else if (!value.trim()) delete L.color; }, { text: true });
    field(g, 'paint', L.paint || 'stroke', v => { L.paint = v; }, { options: ['stroke', 'fill', 'both'] });
    field(g, 'opacity', L.opacity == null ? 1 : L.opacity, v => { L.opacity = Math.max(0, Math.min(1, v)); }, { step: 0.05 });
    field(g, 'visible', L.visible !== false, v => { L.visible = v; }, { check: true });
    field(g, 'uses glyph symmetry', L.symmetry !== false, v => { if (v) delete L.symmetry; else L.symmetry = false; }, { check: true });
    return;
  }
  const n = getNode(s); if (!n) return;
  sharedFormInspector(g,s,n);
  field(g, 'name', n.name || '', v => { if (v) n.name = v; else delete n.name; }, { text: true });
  if (n.children) {
    field(g, 'boolean', n.op || 'union', v => { n.op = v; }, { options: ['union', 'subtract', 'intersect', 'exclude', 'compound'] });
    if (n.op === 'compound') field(g, 'fill rule', n.fillRule || 'nonzero', v => { if (v === 'evenodd') n.fillRule = v; else delete n.fillRule; }, { options: ['nonzero', 'evenodd'] });
    const p = document.createElement('div'); p.className = 'wide lbl';
    p.textContent = n.op === 'compound' ? 'One filled outline made of every child path, like an SVG path with several subpaths: counters come from each path\'s drawn direction (nonzero) or from nesting (evenodd). Imported fill glyphs use this, one pen per subpath.'
      : (n.op === 'subtract' ? 'First child minus every later child. ' : n.op === 'intersect' ? 'Overlap of all children. ' : n.op === 'exclude' ? 'Even-odd of all children. ' : 'All children merged. ') + 'Open forms (lines, arcs, open pen paths) pass through unions and are clipped by subtract / intersect.';
    g.appendChild(p);
    if (n.op === 'subtract') {
      sub(g, 'Clean-up (on the result)');
      field(g, 'fillet r', n.fillet || 0, v => { if (v > 0) n.fillet = r4(v); else delete n.fillet; }, { step: 0.05, key: 'fillet' });
      field(g, 'cap (cleared ends)', n.cap || '', v => { if (v) n.cap = v; else delete n.cap; }, { options: ['', 'round', 'butt', 'square'] });
      const c = document.createElement('div'); c.className = 'wide lbl';
      c.textContent = `${n.children.length - 1} cutter(s). Fillet rounds every sharp corner the cutters leave (arc meets arc too). A cutter set to edge "open" is a clearance cutter: it removes outline without drawing its own edge.`;
      g.appendChild(c);
    }
    field(g, 'hidden', !!n.hidden, v => { if (v) n.hidden = true; else delete n.hidden; }, { check: true });
    sub(g, 'Symmetry (this group: draw one side, the rest follows)');
    symSection(g, n);
    cutterSection(g, s, n);
    transformSection(g, n);
    return;
  }
  const nf = (k, label, step) => field(g, label || k, n[k], v => { n[k] = v; }, { step });
  const capField = () => field(g, 'cap', n.cap || '', v => { if (v) n.cap = v; else delete n.cap; }, { options: ['', 'round', 'butt', 'square'] });
  switch (n.shape) {
    case 'rect': {
      nf('x'); nf('y'); nf('w'); nf('h');
      const rr = Array.isArray(n.r) ? n.r : [n.r || 0, n.r || 0, n.r || 0, n.r || 0];
      ['r tl', 'r tr', 'r br', 'r bl'].forEach((lab, i) => field(g, lab, rr[i], v => { const c = Array.isArray(n.r) ? n.r.slice() : rr.slice(); c[i] = v; n.r = c; }));
      break;
    }
    case 'triangle': nf('x'); nf('y'); nf('w'); nf('h'); nf('r', 'corner r'); break;
    case 'circle': nf('cx'); nf('cy'); nf('r'); break;
    case 'ellipse': nf('cx'); nf('cy'); nf('rx'); nf('ry'); break;
    case 'line': nf('x1'); nf('y1'); nf('x2'); nf('y2'); capField(); break;
    case 'polyline': {
      field(g, 'points (x,y[,r] …)', n.pts.map(p => p.join(',')).join(' '), v => { const pts = v.trim().split(/\s+/).map(t => t.split(',').map(Number)).filter(p => (p.length === 2 || p.length === 3) && p.every(isFinite)); if (pts.length >= 2) n.pts = pts; }, { text: true, mono: true, wide: true });
      field(g, 'closed', !!n.closed, v => { n.closed = v; }, { check: true });
      capField();
      g.appendChild(smallBtn('+ point', () => { const a = n.pts[n.pts.length - 1], b = n.pts[n.pts.length - 2] || [a[0] - 2, a[1]]; n.pts.push([r4(a[0] + (a[0] - b[0]) / 2), r4(a[1] + (a[1] - b[1]) / 2)]); commit(); refresh(true); }));
      g.appendChild(smallBtn('− point', () => { if (n.pts.length > 2) { n.pts.pop(); commit(); refresh(true); } }));
      break;
    }
    case 'pen': {
      field(g, 'anchors (JSON: x, y, in/out handle offsets)', JSON.stringify(n.pts), v => { try { const p = JSON.parse(v); if (Array.isArray(p) && p.length >= 2) n.pts = p; } catch (e) {} }, { area: true, wide: true, rows: 4 });
      field(g, 'closed', !!n.closed, v => { n.closed = v; }, { check: true });
      capField();
      if (S.anchor != null && n.pts[S.anchor]) {
        const i = S.anchor, q = n.pts[i];
        sub(g, `Anchor ${i + 1} of ${n.pts.length}` + (n.from ? ` (path from ${n.from})` : ''));
        field(g, 'anchor x', q.x, v => { q.x = v; }, { key: 'ax' });
        field(g, 'anchor y', q.y, v => { q.y = v; }, { key: 'ay' });
        field(g, 'anchor type', q.in || q.out ? 'smooth' : 'corner', v => { if ((v === 'smooth') !== !!(q.in || q.out)) toggleSmooth(s, i); }, { options: ['corner', 'smooth'] });
        if (!q.in && !q.out) field(g, 'anchor corner r', q.r || 0, v => { if (v > 0) q.r = r4(v); else delete q.r; }, { key: 'ar', step: 0.05 });
        g.appendChild(smallBtn('Delete anchor', () => deleteAnchor(), 'Remove this anchor (⌫)', 'delete'));
      }
      g.appendChild(smallBtn('Corners only', () => { n.pts.forEach(q => { delete q.in; delete q.out; }); commit(); refresh(true); }, 'Remove all bezier handles'));
      g.appendChild(smallBtn('Continue path', () => { penDraft = { s }; setTool('pen'); }, 'Add anchors to the end with the pen'));
      break;
    }
    case 'polygon':
      nf('cx'); nf('cy'); nf('r'); nf('sides', 'sides', 1); nf('rotation', 'rotation°', 1);
      field(g, 'star', !!n.star, v => { if (v) n.star = { inner: r4(n.r / 2) }; else delete n.star; }, { check: true });
      if (n.star) field(g, 'inner radius', n.star.inner, v => { n.star.inner = v; });
      break;
    case 'arc': nf('cx'); nf('cy'); nf('r'); nf('start', 'start° (0 = top)', 1); nf('end', 'end°', 1); capField(); break;
    case 'path': field(g, 'd (escape hatch)', n.d, v => { n.d = v; }, { area: true, wide: true }); break;
  }
  field(g, 'hidden', !!n.hidden, v => { if (v) n.hidden = true; else delete n.hidden; }, { check: true });
  if (n.shape !== 'pen' && n.shape !== 'path') g.appendChild(smallBtn('Edit points', () => {
    const pn = core.toPen(n); if (!pn) return;
    if (s.p.length) getParent(s).children[s.p[s.p.length - 1]] = pn; else layerOf(s).node = pn;
    commit(); refresh(true); status(`${pn.from} is now a path (same place, transform and role). Pen tool: click its outline to add anchors.`);
  }, 'Convert to an editable path in place; or use the Pen on its outline to add an anchor', 'anchor'));
  cutterSection(g, s, n);
  transformSection(g, n);
  const add = document.createElement('select'); add.setAttribute('aria-label', 'Add deformer');
  add.innerHTML = '<option value="">+ deformer…</option><option>taper</option><option>skew</option><option>round</option><option>offset</option>';
  add.onchange = () => { if (!add.value) return; n.deform = n.deform || []; const d = { type: add.value }; if (add.value === 'round') d.r = 0.6; if (add.value === 'taper') d.top = 1.2; if (add.value === 'offset') d.d = 0.3; if (add.value === 'skew') { d.x = 10; d.y = 0; } n.deform.push(d); commit(); refresh(true); };
  sub(g, 'Deformers (applied in order, before the transform)', [add]);
  (n.deform || []).forEach((d, i) => {
    const card = document.createElement('div'); card.className = 'def-card'; g.appendChild(card);
    const head = document.createElement('div'); head.className = 'def-head'; head.textContent = (i + 1) + '. ' + d.type; card.appendChild(head);
    if (i > 0) head.appendChild(smallBtn('', () => { [n.deform[i - 1], n.deform[i]] = [n.deform[i], n.deform[i - 1]]; commit(); refresh(true); }, 'Apply earlier', 'up'));
    head.appendChild(smallBtn('Remove', () => { n.deform.splice(i, 1); if (!n.deform.length) delete n.deform; commit(); refresh(true); }, 'Remove deformer', 'delete'));
    for (const k of DEF_FIELDS[d.type] || []) field(card, k + (d.type === 'skew' ? '°' : ''), d[k] == null ? 0 : d[k], v => { if (v === 0 && d.type === 'taper') delete d[k]; else d[k] = v; }, { step: d.type === 'skew' ? 1 : (S.snap || 0.1) });
  });
}

// ---------- previews ----------
const SIZES = [12, 16, 20, 24, 32, 48];
function previewSVG(size, extraClass) {
  const W = S.rt.weight;
  const parts = [];
  for (const [layerIndex, L] of S.resolved.entries()) {
    if (!L.visible || !L.d) continue;
    const col = L.color || core.ROLE_VARS[L.role] || 'currentColor';
    for (const part of L.parts) {
      let d = part.d, w = W;
      if (S.rt.hint && size <= 20) { const h = core.hintD(d, size, W, L.paint); d = h.d; w = h.weight; }
      const stroke = L.paint !== 'fill', fill = L.paint !== 'stroke';
      const style = core.strokeStyle(S.glyph, S.rt, part.cap);
      parts.push(`<path d="${d}" fill="${fill ? col : 'none'}"${stroke ? ` stroke="${col}" style="stroke-width:${S.rt.hint && size <= 20 ? w : 'var(--icon-stroke-width)'};stroke-linecap:${style.runtimeCap};stroke-linejoin:${style.runtimeJoin}"` : ''}${L.opacity !== 1 ? ` opacity="${L.opacity}"` : ''}/>`);
      if (stroke) parts.push(core.strokeTipsSVG(S.glyph, d, { mode: S.rt.hint && size <= 20 ? 'baked' : 'runtime', weight: w, color: col, opacity: L.opacity, layerIndex }));
    }
  }
  return `<svg class="icon ${extraClass || ''}" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${parts.join('')}</svg>`;
}
function renderPreviews() {
  const root = document.documentElement.style;
  root.setProperty('--icon-stroke-width', S.rt.weight);
  root.setProperty('--icon-stroke-linecap', S.rt.cap);
  root.setProperty('--icon-stroke-linejoin', S.rt.join);
  const tiles = SIZES.map(sz => `<div class="pv">${previewSVG(sz)}<span>${sz}</span></div>`).join('');
  $('pvLight').innerHTML = tiles; $('pvDark').innerHTML = tiles;
  $('pvGrid').classList.toggle('rtl', S.rt.rtl);
  const ic = previewSVG(16), ic20 = previewSVG(20);
  const label = (S.glyph.name || 'icon').replace(/-outline$/, '').replace(/-/g, ' ');
  $('ctx').innerHTML = `<button class="cbtn" type="button" tabindex="-1">${ic}<span></span></button>
    <div class="nav" aria-hidden="true"><div>${ic20}Home</div><div class="on">${ic20}<span></span></div><div>${ic20}Settings</div></div>
    <span class="badge">${previewSVG(14)}<span>3 new</span></span>`;
  $('ctx').querySelector('.cbtn span').textContent = label.charAt(0).toUpperCase() + label.slice(1);
  $('ctx').querySelector('.nav .on span').textContent = label;
  $('ctx').classList.toggle('rtl', S.rt.rtl);
  $('wVal').textContent = S.rt.weight.toFixed(1); $('wRange').value = S.rt.weight;
  $('wWarn').hidden = S.rt.weight < 2.0;
}

// ---------- library ----------
// The browser: one button per glyph, built once; search and the provenance filter only toggle `hidden`.
// Thumbnails are generated lazily from each glyph's geometry.
const LIBEL = new Map();
const thumbCache = new WeakMap();
let thumbObserver = null;
const PROV_LABEL = { 'hand-built': 'hand-built', 'converted-stroke': 'converted stroke', 'imported-fill': 'imported fill', 'imported-stroke': 'imported stroke' };
function thumbOf(g) {
  if (!thumbCache.has(g)) thumbCache.set(g, thumbFor(g));
  return thumbCache.get(g);
}
function paintThumb(b) {
  const g = S.lib[idx(b.dataset.name)]; if (!g) return;
  b.querySelector('.thumb').innerHTML = thumbOf(g); b.dataset.painted = '1';
}
function libMatches(g, q, f) {
  if (q && ![g.name, g.description || '', g.group || '', ...(g.tags || []), ...(g.aliases || [])].join(' ').toLowerCase().includes(q)) return false;
  switch (f) {
    case 'all': return true;
    case 'edited': return isEdited(g);
    default: return g.provenance === f;
  }
}
function applyLibFilter() {
  const q = $('libSearch').value.trim().toLowerCase(), f = $('libFilter').value;
  let shown = 0, total = 0;
  for (const g of S.lib) {
    const b = LIBEL.get(g.name); if (!b) continue;
    const pool = libMatches(g, '', f), on = pool && libMatches(g, q, f);
    if (pool) total++; if (on) shown++;
    b.hidden = !on;
  }
  for (const section of $('lib').querySelectorAll('.lib-group')) {
    const count = [...section.querySelectorAll('.lib-item')].filter(item=>!item.hidden).length;
    section.hidden = !count; section.querySelector('.lib-group-count').textContent = count;
    section.open = !!q || !collapsedGroups.has(section.dataset.group);
  }
  $('libCount').textContent = q ? `${shown} of ${total} match` : `${total} glyph${total === 1 ? '' : 's'}`;
  let empty = $('lib').querySelector('.lib-empty');
  if (!shown) { if (!empty) { empty = document.createElement('div'); empty.className = 'lib-empty'; $('lib').appendChild(empty); } empty.textContent = q ? `No icon metadata matches “${q}”.` : 'Nothing here yet.'; }
  else if (empty) empty.remove();
}
function syncLibrarySelection() {
  for (const name of librarySelection) if (idx(name) < 0) librarySelection.delete(name);
  for (const [name, button] of LIBEL) {
    const selected = librarySelection.has(name);
    button.classList.toggle('library-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
    button.querySelector('.library-pick')?.setAttribute('aria-checked',String(selected));
    button.querySelector('.library-pick')?.setAttribute('aria-label', `${selected ? 'Deselect' : 'Select'} ${name}`);
  }
  $('librarySelectionCount').textContent = `${librarySelection.size} selected`;
  $('deleteIconsBtn').disabled = !librarySelection.size || libraryDeleteBusy;
  $('clearIconSelectionBtn').disabled = !librarySelection.size;
  $('restoreIconsBtn').disabled = !libraryTrash.length || libraryDeleteBusy;
  $('restoreIconsBtn').textContent = libraryTrash.length ? `Restore deleted (${libraryTrash.length})` : 'Restore deleted';
}
function shownLibraryIcons() {
  return [...$('lib').querySelectorAll('.lib-item')].filter(button=>!button.hidden && button.closest('.lib-group').open).map(button=>button.dataset.name);
}
function selectLibraryIcon(name, event, toggle = false) {
  if (event.shiftKey && librarySelectionAnchor) {
    const shown = shownLibraryIcons(), start = shown.indexOf(librarySelectionAnchor), end = shown.indexOf(name);
    if (start >= 0 && end >= 0) { if (!(event.metaKey || event.ctrlKey)) librarySelection.clear(); for(const value of shown.slice(Math.min(start,end),Math.max(start,end)+1))librarySelection.add(value); }
    else librarySelection.add(name);
  } else if (toggle || event.metaKey || event.ctrlKey) {
    if(librarySelection.has(name))librarySelection.delete(name);else librarySelection.add(name);
    librarySelectionAnchor = name;
  } else {
    librarySelection.clear();librarySelection.add(name);librarySelectionAnchor = name;
    const at = idx(name);if(at >= 0)loadGlyph(at);
  }
  syncLibrarySelection();
}
async function deleteLibraryIcons() {
  if(libraryDeleteBusy || !librarySelection.size)return;
  if(!DB.db){status('Deletion needs browser storage so removed icons can be restored.',true);return;}
  libraryDeleteBusy=true;syncLibrarySelection();
  try {
    if(penDraft)finishPen();await flushSaves();
    if(pendingSave.size)throw new Error('Save your current edits before deleting icons.');
    const names=new Set(librarySelection), current=S.glyph.name;
    const entries=S.lib.filter(glyph=>names.has(glyph.name)).map(glyph=>({glyph:clone(glyph),original:ORIG.has(glyph.name)?clone(ORIG.get(glyph.name)):null}));
    const trash=[...libraryTrash,...entries];
    await DB.run('readwrite',(store,tx)=>{
      tx.objectStore('snapshots').put({id:'library-trash',entries:trash});
      for(const {glyph} of entries)store.put({name:glyph.name,deleted:true,savedAt:Date.now()});
    },'edits',['snapshots']);
    for(const {glyph} of entries){deletedIcons.add(glyph.name);EDITS.set(glyph.name,{name:glyph.name,deleted:true});pendingSave.delete(glyph.name);}
    closeGroupReview();libraryTrash=trash;S.lib=S.lib.filter(glyph=>!names.has(glyph.name));librarySelection.clear();librarySelectionAnchor=null;
    renderLibrary();if(names.has(current))loadGlyph(Math.min(S.cur,Math.max(0,S.lib.length-1)));else S.cur=idx(current);
    setSaveState('saved');status(`Deleted ${entries.length} icon${entries.length===1?'':'s'}. Restore deleted brings them back, even after reload.`);
  } catch(error){status(`Delete: ${error.message}`,true);}
  finally{libraryDeleteBusy=false;syncLibrarySelection();}
}
async function restoreDeletedIcons() {
  if(libraryDeleteBusy || !libraryTrash.length || !DB.db)return;
  libraryDeleteBusy=true;syncLibrarySelection();
  try {
    await flushSaves();if(pendingSave.size)throw new Error('Save your current edits before restoring icons.');
    const result=mergeLibrary(S.lib,libraryTrash.map(entry=>entry.glyph),'add');
    const records=result.names.map((name,index)=>({name,glyph:result.library.find(glyph=>glyph.name===name),original:libraryTrash[index].original?{...clone(libraryTrash[index].original),name}:null,savedAt:Date.now()}));
    await DB.run('readwrite',(store,tx)=>{tx.objectStore('snapshots').put({id:'library-trash',entries:[]});for(const record of records)store.put(record);},'edits',['snapshots']);
    S.lib=result.library;libraryTrash=[];librarySelection.clear();
    for(const record of records){deletedIcons.delete(record.name);EDITS.set(record.name,record);if(record.original)ORIG.set(record.name,record.original);librarySelection.add(record.name);}
    renderLibrary();loadGlyph(idx(result.names[0]));setSaveState('saved');status(`Restored ${records.length} icons${result.renamed?' (renamed to preserve newer icons with matching names)':''}.`);
  }catch(error){status(`Restore: ${error.message}`,true);}
  finally{libraryDeleteBusy=false;syncLibrarySelection();}
}
$('selectShownIconsBtn').onclick=()=>{for(const name of shownLibraryIcons())librarySelection.add(name);syncLibrarySelection();};
$('clearIconSelectionBtn').onclick=()=>{librarySelection.clear();librarySelectionAnchor=null;syncLibrarySelection();};
$('deleteIconsBtn').onclick=deleteLibraryIcons;
$('restoreIconsBtn').onclick=restoreDeletedIcons;
let reviewingGroup = null;
const groupReview = document.createElement('section');groupReview.id='groupReview';groupReview.className='group-review';groupReview.hidden=true;groupReview.setAttribute('aria-label','Group drawing review');
root.querySelector('.canvas-wrap').appendChild(groupReview);
function closeGroupReview() { groupReview.hidden=true;root.querySelector('.stage').hidden=false;reviewingGroup=null; }
function openGroupReview(group) {
  reviewingGroup=group;root.querySelector('.stage').hidden=true;groupReview.hidden=false;groupReview.replaceChildren();
  const glyphs=S.lib.filter(glyph=>iconGroup(glyph)===group), header=document.createElement('div');header.className='group-review-header';
  const heading=document.createElement('h2');heading.textContent=`${group} · ${glyphs.length} icons`;header.appendChild(heading);
  const back=smallBtn('Back to drawing',closeGroupReview,'Return to the drawing plane','undo');header.appendChild(back);
  const flagged=document.createElement('label'), only=document.createElement('input');only.type='checkbox';flagged.append(only,document.createTextNode('Needs reconstruction review'));header.appendChild(flagged);groupReview.appendChild(header);
  const grid=document.createElement('div');grid.className='group-review-grid';groupReview.appendChild(grid);
  for(const glyph of glyphs){
    const card=document.createElement('article');card.className='group-review-card';card.dataset.needsReview=String(glyph.reconstruction?.status==='needs-review');
    const title=document.createElement('h3');title.textContent=glyph.name;card.appendChild(title);
    const state=document.createElement('p');state.className='reconstruction-status';state.dataset.status=glyph.reconstruction?.status || 'not-run';state.textContent=glyph.reconstruction?.status==='existing'?'Existing editable centerlines':glyph.reconstruction?.status==='candidate'?'Centerline candidate':glyph.reconstruction?.status==='applied'?'Centerlines applied':glyph.reconstruction?.status==='needs-review'?'⚠ Needs review':'Reconstruction not run';state.title=glyph.reconstruction?.reason || '';card.appendChild(state);
    const drawings=document.createElement('div');drawings.className='review-drawings';
    const source=document.createElement('button');source.type='button';source.className='review-drawing';source.setAttribute('aria-label',`Edit ${glyph.name}`);source.innerHTML=core.toSVG(glyph,{mode:'baked',mono:true,size:160});source.onclick=()=>{closeGroupReview();const at=idx(glyph.name);if(S.cur!==at)loadGlyph(at);else refresh(true);};drawings.appendChild(source);
    if(glyph.reconstruction?.candidate){
      const candidate=document.createElement('div');candidate.className='review-drawing candidate-drawing';candidate.innerHTML=core.toSVG(glyph.reconstruction.candidate,{mode:'baked',mono:true,size:160});candidate.setAttribute('aria-label',`${glyph.name} centerline approximation`);drawings.appendChild(candidate);
      const apply=smallBtn('Use centerlines',()=>{
        const at=idx(glyph.name);if(at<0)return;loadGlyph(at);
        const candidate=glyph.reconstruction.candidate;
        S.glyph.layers=clone(candidate.layers);S.glyph.weight=candidate.weight;S.glyph.provenance='converted-stroke';
        S.glyph.setStyle={...S.glyph.setStyle,thickness:candidate.weight,rounding:0,endRounding:0};
        S.glyph.reconstruction={...S.glyph.reconstruction,status:'applied'};commit();refresh(true);openGroupReview(group);
      },'Apply this approximate centerline reconstruction; icon Undo restores the outline','pen');
      if(glyph.reconstruction.status==='needs-review')apply.title='Approximation has a mismatch; inspect before applying. Icon Undo restores the outline.';
      card.appendChild(apply);
    }
    card.appendChild(drawings);const caption=document.createElement('p');caption.textContent=glyph.reconstruction?.candidate?'Current drawing / centerline approximation':'Click the drawing to edit';card.appendChild(caption);
    if(glyph.reconstruction?.reason){const reason=document.createElement('p');reason.className='review-reason';reason.textContent=glyph.reconstruction.reason;card.appendChild(reason);}
    grid.appendChild(card);
  }
  only.onchange=()=>{for(const card of grid.children)card.hidden=only.checked&&card.dataset.needsReview!=='true';};
}
async function attachReconstructionReport(report) {
  const current=S.glyph.name;let attached=0, changed=0;const attachedNames=new Set();
  const entries=new Map(report.entries.map(entry=>[entry.name,entry]));
  S.lib=S.lib.map(glyph=>{
    if(report.sourceProject==='eds-icons'&&!glyph.eds){if(glyph.reconstruction?.reason==='Drawing has changed since the reconstruction source; candidate was not attached.'){const copy={...glyph};delete copy.reconstruction;attachedNames.add(glyph.name);return copy;}return glyph;}
    const entry=entries.get(glyph.name)||(report.sourceProject==='eds-icons'?entries.get(glyph.name.replace(/-\d+$/,'')):null);if(!entry)return glyph;
    const signature=JSON.stringify(core.resolve(glyph).map(layer=>({id:layer.id,paint:layer.paint,d:layer.d})));
    attached++;attachedNames.add(glyph.name);
    if(signature!==entry.sourceSignature){changed++;return {...glyph,reconstruction:{status:'needs-review',reason:'Drawing has changed since the reconstruction source; candidate was not attached.'}};}
    return {...glyph,reconstruction:clone(entry)};
  });
  for(const name of attachedNames)queueSave(name);
  await flushSaves();renderLibrary();loadGlyph(Math.max(0,idx(current)));status(`Attached ${attached} reconstruction results${changed?`; ${changed} changed drawings flagged`:''}. Original drawings retained; review a group to compare candidates.`);
}
function tileTitle(g) {
  return [g.name, PROV_LABEL[g.provenance] || 'new', isEdited(g) ? 'edited (saved in this browser)' : '', g.reconstruction?.status==='needs-review' ? 'Needs centerline review: '+g.reconstruction.reason : ''].filter(Boolean).join(' · ');
}
function renderLibrary() {
  const box = $('lib'); box.innerHTML = ''; LIBEL.clear();
  if (thumbObserver) thumbObserver.disconnect();
  thumbObserver = 'IntersectionObserver' in window ? new IntersectionObserver(ents => {
    for (const en of ents) if (en.isIntersecting) { paintThumb(en.target); thumbObserver.unobserve(en.target); }
  }, { root: box, rootMargin: '160px 0px' }) : null;
  const frag = document.createDocumentFragment(), groups = new Map();
  for(const name of [...new Set(S.lib.map(iconGroup))].sort((a,b)=>a==='Ungrouped'?1:b==='Ungrouped'?-1:a.localeCompare(b))){
    const section=document.createElement('details');section.className='lib-group';section.dataset.group=name;section.open=!collapsedGroups.has(name);
    const summary=document.createElement('summary'), title=document.createElement('span'), count=document.createElement('span');title.textContent=name;count.className='lib-group-count';summary.append(title,count);const review=document.createElement('button');review.className='btn sm icon group-review-arrow';review.type='button';review.textContent='→';review.setAttribute('aria-label',`Review ${name}`);review.title='Review this group on the drawing plane';review.onclick=event=>{event.preventDefault();event.stopPropagation();openGroupReview(name);};summary.appendChild(review);section.appendChild(summary);
    const grid=document.createElement('div');grid.className='lib-group-grid';section.appendChild(grid);groups.set(name,grid);frag.appendChild(section);
    summary.onclick=()=>{if($('libSearch').value.trim())return; if(section.open)collapsedGroups.add(name);else collapsedGroups.delete(name);try{localStorage.setItem('gw-collapsed-groups',JSON.stringify([...collapsedGroups]));}catch{}};
  }
  for (const g of S.lib) {
    if (LIBEL.has(g.name)) continue;
    const b = document.createElement('button'); b.className = 'lib-item'; b.type = 'button'; b.dataset.name = g.name;
    b.setAttribute('aria-current', String(S.glyph ? g.name === S.glyph.name : false));
    b.innerHTML = `<i class="prov-dot" data-p="${g.provenance || ''}"></i><span class="edited" hidden>●</span><span class="thumb"></span><span class="lbl-name"></span><span class="library-pick" role="checkbox" aria-checked="false" tabindex="-1"></span>`;
    b.querySelector('.lbl-name').textContent = g.name.replace(/^ui-/, '');
    if(g.reconstruction?.status==='needs-review')b.classList.add('needs-reconstruction-review');
    b.title = tileTitle(g); b.querySelector('.edited').hidden = !isEdited(g);
    b.onclick = event => selectLibraryIcon(g.name,event,event.target.closest('.library-pick') != null);
    wireLibraryMenu(b, g.name);
    LIBEL.set(g.name, b); groups.get(iconGroup(g)).appendChild(b);
    if (thumbObserver) thumbObserver.observe(b); else paintThumb(b);
  }
  box.appendChild(frag);
  applyLibFilter();syncLibrarySelection();
}
function updateLibItem(name) {
  const b = LIBEL.get(name); if (!b) return;
  const g = S.lib[idx(name)]; if (!g) return;
  thumbCache.delete(g); // Shared forms publish into existing peer objects; cached thumbnails must follow.
  b.querySelector('.edited').hidden = !isEdited(g); b.title = tileTitle(g);
  if (b.dataset.painted) paintThumb(b);
}
function markCurrent() {
  for (const b of $('lib').querySelectorAll('.lib-item[aria-current="true"]')) b.setAttribute('aria-current', 'false');
  const b = LIBEL.get(S.glyph.name); if (!b) return;
  b.setAttribute('aria-current', 'true');
  if (!b.hidden) { const box = $('lib'), r = b.getBoundingClientRect(), br = box.getBoundingClientRect(); if (r.top < br.top || r.bottom > br.bottom) box.scrollTop += r.top - br.top - br.height / 2 + r.height / 2; }
}
function updateGlyphTags() {
  if (!S.glyph) return;
  const g = S.glyph, p = PROV_LABEL[g.provenance] || g.provenance || 'new glyph';
  $('hdrProv').textContent = p;
  const edited = ORIG.has(g.name) && isEdited(g);
  $('hdrEdited').hidden = !edited && !S.undo.length && !S.redo.length;
  $('hdrEdited').textContent = edited ? 'edited' : 'history';
  $('revertBtn').disabled = !edited;
  $('revertBtn').title = ORIG.has(g.name) ? 'Put this glyph back to its library original (undo brings your edit back)' : 'Not in the library: nothing to revert to';
}

// ---------- refresh ----------
function refresh(full) {
  S.resolved = core.resolve(S.glyph);
  const errs = S.resolved.filter(r => r.error);
  if (errs.length) status('Geometry error in ' + errs.map(e => e.id).join(', ') + ': ' + errs[0].error, true);
  renderCanvas(); renderPreviews();
  if (full) { renderTree(); renderInspector(); }
  $('hdrName').textContent = S.glyph.name;
  const style = S.glyph.setStyle || {};
  $('setThicknessEnabled').checked = style.thickness != null; $('setRoundingEnabled').checked = !!style.rounding;
  $('setEndRoundingEnabled').checked = !!(style.endRounding ?? style.rounding);
  if (document.activeElement !== $('setEndRounding')) $('setEndRounding').value = (style.endRounding ?? style.rounding) || 0.5;
  if (document.activeElement !== $('setThickness')) $('setThickness').value = style.thickness ?? 1.6;
  if (document.activeElement !== $('setRounding')) $('setRounding').value = style.rounding || 0.5;
  $('drawingMode').value = S.glyph.kind === 'app-icon' ? 'app-icon' : 'interface';
  $('exportSize').value = S.glyph.exportSize || (S.glyph.kind === 'app-icon' ? 1024 : 24);
  $('modeHint').textContent = S.glyph.kind === 'app-icon' ? 'App icon · 24-unit canvas · scalable export' : 'Interface icon · 24-unit canvas';
  if (document.activeElement !== $('iconDescription')) $('iconDescription').value = S.glyph.description || '';
  if (document.activeElement !== $('iconGroup')) $('iconGroup').value = S.glyph.group || '';
  if (document.activeElement !== $('iconTags')) $('iconTags').value = (S.glyph.tags || []).join(', ');
  if (document.activeElement !== $('iconAliases')) $('iconAliases').value = (S.glyph.aliases || []).join(', ');
  const st = core.stats(S.glyph);
  $('statsLine').textContent = `${st.nodes} nodes · ${st.shapes} forms · ${st.ops} booleans · ${st.deformers} deformers · ${st.paths} path`;
  syncToggles();
  if (full) renderLibraryThumb();
}
function renderLibraryThumb() { const b = LIBEL.get(S.glyph.name); if (b) { b.querySelector('.thumb').innerHTML = core.toSVG(S.glyph, { size: 24, resolved: S.resolved }); b.dataset.painted = '1'; } updateGlyphTags(); }
function renderAll() { renderGrid(); refresh(true); }
function symmetryTarget() {
  if ($('symScope').value === 'glyph') return S.glyph;
  const selected = primarySel();
  const node = selected && selected.p !== null && getNode(selected);
  return node?.children ? node : null;
}
function syncToggles() {
  $('proximityMergeBtn').setAttribute('aria-pressed', String(!!S.proximityMerge));
  const selection = primarySel();
  const cutter = !!selection?.p?.length && getParent(selection)?.op === 'subtract' && selection.p.at(-1) > 0;
  $('makeCutterBtn').setAttribute('aria-pressed', String(cutter));
  root.querySelectorAll('[data-snap]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.snap === S.snap)));
  const target = symmetryTarget();
  const sym = target?.symmetry || {};
  root.querySelectorAll('[data-mirror]').forEach(b => b.setAttribute('aria-pressed', String((sym.mirror || '').includes(b.dataset.mirror))));
  root.querySelectorAll('[data-rot]').forEach(b => b.setAttribute('aria-pressed', String((sym.rotate || 1) === +b.dataset.rot)));
  root.querySelectorAll('[data-show]').forEach(b => b.setAttribute('aria-pressed', String(!!S.show[b.dataset.show])));
  root.querySelectorAll('[data-cap]').forEach(b => b.setAttribute('aria-pressed', String(S.rt.cap === b.dataset.cap)));
  root.querySelectorAll('[data-join]').forEach(b => b.setAttribute('aria-pressed', String(S.rt.join === b.dataset.join)));
  root.querySelectorAll('[data-tool]').forEach(b => b.setAttribute('aria-pressed', String(S.tool === b.dataset.tool)));
  root.querySelectorAll('[data-hmode]').forEach(b => b.setAttribute('aria-pressed', String(S.hmode === b.dataset.hmode)));
  root.querySelectorAll('[data-palette="pen"]').forEach(b => b.setAttribute('aria-pressed', String(S.tool === 'pen')));
  $('hintBtn').setAttribute('aria-pressed', String(S.rt.hint)); $('rtlBtn').setAttribute('aria-pressed', String(S.rt.rtl));
}

// ---------- wiring ----------
decorate();
const pal = $('palette');
const palBtn = (k, parent) => { const b = document.createElement('button'); b.className = 'btn'; b.title = k === 'pen' ? 'Pen tool (P)' : 'Add ' + k; b.dataset.palette = k; b.innerHTML = `${uiIcon(k)}<span>${k}</span>`; b.onclick = () => addShape(k); parent.appendChild(b); };
PRIMARY_TOOLS.forEach(k => palBtn(k, pal));
const moreLbl = document.createElement('div'); moreLbl.className = 'lbl'; moreLbl.textContent = 'More forms'; pal.appendChild(moreLbl);
const more = document.createElement('div'); more.className = 'more'; pal.appendChild(more);
MORE_TOOLS.forEach(k => palBtn(k, more));
root.querySelectorAll('[data-group]').forEach(b => b.onclick = () => group(b.dataset.group));
root.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
root.querySelectorAll('[data-hmode]').forEach(b => b.onclick = () => { S.hmode = b.dataset.hmode; syncToggles(); renderSelection(); });
function updateAreaTool() {
  const button=$('areaSelectBtn'),name=areaLabels[S.areaMode];button.innerHTML=uiSVG(S.areaMode==='polygon'?'polygon-lasso':S.areaMode);button.setAttribute('aria-label',`${name} selection`);button.dataset.controlTooltip=`${name} selection. Shift adds; Option/Alt subtracts.`;
  root.querySelectorAll('[data-area-choice]').forEach(choice=>choice.setAttribute('aria-checked',String(choice.dataset.areaChoice===S.areaMode)));
}
$('areaSelectBtn').onclick=()=>setTool('area');
$('areaSelectToggle').onclick=()=>{if(popup?.panel===$('areaSelectionMenu')){closePopup(true);return;}const button=$('areaSelectToggle'),bounds=button.getBoundingClientRect();openPopup($('areaSelectionMenu'),button,bounds.left,bounds.bottom+6,()=>button);};
root.querySelectorAll('[data-area-choice]').forEach(choice=>choice.onclick=()=>{S.areaMode=choice.dataset.areaChoice;try{localStorage.setItem('gw-area-mode',S.areaMode);}catch{}updateAreaTool();closePopup(true);setTool('area');});
updateAreaTool();
$('ungroupBtn').onclick = ungroup; $('upBtn').onclick = () => move(-1); $('downBtn').onclick = () => move(1);
$('dupBtn').onclick = duplicate; $('delBtn').onclick = del; $('addLayerBtn').onclick = () => addLayer(true);
$('undoBtn').onclick = undo; $('redoBtn').onclick = redo;
$('isoExit').onclick = () => isoExit();
const snapButtons = [...root.querySelectorAll('[data-snap]')];
try {
  const saved = JSON.parse(localStorage.getItem('gw-snap-preferences') || 'null');
  if (saved && Array.isArray(saved.slots) && saved.slots.length === snapButtons.length && saved.slots.every(value => Number.isFinite(value) && value >= 0 && value <= 24) && Number.isFinite(saved.active)) {
    saved.slots.forEach((value, index) => { snapButtons[index].dataset.snap = value; snapButtons[index].textContent = value ? String(value) : 'off'; }); S.snap = saved.active;
  }
} catch {}
try { S.proximityMerge = localStorage.getItem('gw-proximity-merge') === 'true'; } catch {}
$('proximityMergeBtn').onclick = () => {
  S.proximityMerge = !S.proximityMerge;
  try { localStorage.setItem('gw-proximity-merge', String(S.proximityMerge)); } catch {}
  syncToggles();
};
const saveSnap = () => { try { localStorage.setItem('gw-snap-preferences', JSON.stringify({ slots: snapButtons.map(button => +button.dataset.snap), active: S.snap })); } catch {} };
snapButtons.forEach(button => button.onclick = event => {
  if (!event.altKey) { S.snap = +button.dataset.snap; saveSnap(); syncToggles(); renderInspector(); return; }
  itemMenu.replaceChildren(); menuHeading('Define snap spacing');
  const label = document.createElement('label'); label.textContent = 'Snap spacing (units)';
  const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.max = '24'; input.step = 'any'; input.value = button.dataset.snap; input.setAttribute('aria-label', 'Custom snap spacing'); label.appendChild(input); itemMenu.appendChild(label);
  menuAction('Save snap spacing', 'anchor', () => {
    const value = +input.value;
    if (!Number.isFinite(value) || value < 0 || value > 24) { status('Snap spacing must be between 0 and 24 units.', true); return; }
    button.dataset.snap = value; button.textContent = value ? String(value) : 'off'; S.snap = value; saveSnap(); syncToggles(); renderInspector(); status('Snap preference saved.');
  });
  const bounds = button.getBoundingClientRect(); openPopup(itemMenu, button, bounds.left, bounds.bottom, () => button); input.focus(); input.select();
});
root.querySelectorAll('[data-mirror]').forEach(b => b.onclick = () => {
  const target = symmetryTarget(); if (!target) { status('Select a group in the Layers tree first.', true); return; }
  const sym = target.symmetry = target.symmetry || { mirror: null, rotate: 1 };
  const set = new Set((sym.mirror || '').split('').filter(Boolean)); const k = b.dataset.mirror;
  if (set.has(k)) set.delete(k); else set.add(k);
  sym.mirror = set.size === 2 ? 'xy' : set.size ? [...set][0] : null; commit(); refresh(true);
});
root.querySelectorAll('[data-rot]').forEach(b => b.onclick = () => { const target = symmetryTarget(); if (!target) { status('Select a group in the Layers tree first.', true); return; } target.symmetry ||= { mirror: null }; target.symmetry.rotate = +b.dataset.rot; commit(); refresh(true); });
$('symScope').onchange = syncToggles;
root.querySelectorAll('[data-show]').forEach(b => b.onclick = () => { S.show[b.dataset.show] = !S.show[b.dataset.show]; renderGrid(); renderCanvas(); syncToggles(); });
$('wRange').oninput = () => { S.rt.weight = +$('wRange').value; renderCanvas(); renderPreviews(); };
root.querySelectorAll('[data-cap]').forEach(b => b.onclick = () => { S.rt.cap = b.dataset.cap; refresh(false); });
root.querySelectorAll('[data-join]').forEach(b => b.onclick = () => { S.rt.join = b.dataset.join; refresh(false); });
$('hintBtn').onclick = () => { S.rt.hint = !S.rt.hint; refresh(false); };
$('rtlBtn').onclick = () => { S.rt.rtl = !S.rt.rtl; refresh(false); };
const sw = () => { const st = $('pvGrid').style; st.setProperty('--sw-secondary-light', $('swSecL').value); st.setProperty('--sw-secondary-dark', $('swSecD').value); st.setProperty('--sw-accent-light', $('swAccL').value); st.setProperty('--sw-accent-dark', $('swAccD').value); };
['swSecL', 'swSecD', 'swAccL', 'swAccD'].forEach(id => $(id).oninput = sw);
mountAppearance({ root, listen, openPopup, closePopup, getPopup: () => popup, renderGrid, renderRulers });
$('drawingMode').onchange = () => { S.glyph.kind = $('drawingMode').value === 'app-icon' ? 'app-icon' : 'interface'; S.glyph.exportSize = S.glyph.kind === 'app-icon' ? 1024 : 24; commit(); refresh(true); };
$('exportSize').onchange = () => { S.glyph.exportSize = Math.max(16, Math.min(4096, Math.round(+$('exportSize').value || 24))); commit(); refresh(true); };
$('newBtn').onclick = () => {
  const g = TEMPLATES[$('tplSel').value](); let name = $('tplSel').value === 'blank' ? 'untitled' : g.name + '-copy'; let k = 1;
  while (idx(name) >= 0) name = name.replace(/-\d+$/, '') + '-' + (++k);
  g.name = name; g.provenance = 'hand-built'; ensureLayerNames(g); ORIG.set(name, clone(g)); S.lib.push(g); renderLibrary(); loadGlyph(S.lib.length - 1); queueSave(name); status(`New glyph from ${$('tplSel').value} template.`);
};
function applySetSettings() {
  if (penDraft) finishPen();
  const style = {
    thickness: $('setThicknessEnabled').checked ? Math.max(0.1, Math.min(8, +$('setThickness').value || 1.6)) : null,
    rounding: $('setRoundingEnabled').checked ? Math.max(0, Math.min(6, +$('setRounding').value || 0)) : 0,
    endRounding: $('setEndRoundingEnabled').checked ? Math.max(0, Math.min(6, +$('setEndRounding').value || 0)) : 0,
  };
  const peers=S.lib.filter((glyph,i)=>i!==S.cur && JSON.stringify(glyph.setStyle)!==JSON.stringify(style)).map(clone);
  S.glyph.setStyle = clone(style);
  S.lib = S.lib.map((glyph,i) => i===S.cur ? glyph : ({ ...glyph, setStyle: clone(style) }));
  commit(peers);
  for (const glyph of S.lib) queueSave(glyph.name);
  S.rt.weight = style.thickness ?? S.glyph.weight ?? 1.2;
  refresh(true); renderLibrary(); status(`Set settings applied to ${S.lib.length} icons.`);
}
for (const id of ['setThicknessEnabled', 'setRoundingEnabled', 'setThickness', 'setRounding', 'setEndRoundingEnabled', 'setEndRounding']) $(id).onchange = applySetSettings;
$('iconDescription').onchange = () => { S.glyph.description = $('iconDescription').value.trim(); commit(); applyLibFilter(); };
$('iconAliases').onchange = () => { S.glyph.aliases = [...new Set($('iconAliases').value.split(',').map(term => term.trim()).filter(Boolean))]; commit(); applyLibFilter(); };
$('iconGroup').onchange = () => { S.glyph.group = $('iconGroup').value.split('/').map(part=>part.trim()).filter(Boolean).join('/'); S.glyph.groupSource='manual'; commit(); renderLibrary(); };
$('iconTags').onchange = () => { S.glyph.tags = [...new Set($('iconTags').value.split(',').map(term=>term.trim()).filter(Boolean))]; commit(); applyLibFilter(); };
for (const id of ['exportStructure','exportRoot','exportSVGs']) {
  try { const saved=localStorage.getItem(`gw-${id}`); if(saved!=null) { if(id==='exportSVGs')$(id).checked=saved==='true';else $(id).value=saved; } } catch {}
  $(id).onchange=()=>{try{localStorage.setItem(`gw-${id}`,id==='exportSVGs'?String($(id).checked):$(id).value);}catch{}};
}
const io = $('ioText');
$('expJson').onclick = () => { if (penDraft) finishPen(); io.value = JSON.stringify(libraryDocument([S.glyph], 'one', ORIG, S.components), null, 2); status('Editable JSON and reset original in the box — Copy, or edit and Import.'); };
$('expSvg').onclick = () => { io.value = core.toSVG(S.glyph); status('Runtime SVG: weight, caps, joins and role colours come from CSS vars.'); };
$('expBaked').onclick = () => { io.value = core.toSVG(S.glyph, { mode: 'baked', weight: S.rt.weight, cap: S.rt.cap, join: S.rt.join }); status('Baked SVG at the current runtime settings.'); };
$('copyBtn').onclick = async () => {
  if (!io.value) $('expJson').onclick();
  try { await navigator.clipboard.writeText(io.value); status('Copied to clipboard.'); }
  catch (e) { io.focus(); io.select(); status('Clipboard blocked here — text is selected, press ⌘C.'); }
};
$('importBtn').onclick = () => requestLibraryImport(io.value, 'pasted JSON');
const bakedSVG = () => core.toSVG(S.glyph, { mode: 'baked', weight: S.rt.weight, cap: S.rt.cap, join: S.rt.join });
const outputName = () => S.glyph.name.replace(/[^a-z0-9_-]+/gi, '-');
$('downloadSvg').onclick = () => { if (penDraft) finishPen(); downloadBlob(`${outputName()}.svg`, new Blob([bakedSVG()], { type: 'image/svg+xml' })); status('Downloaded SVG.'); };
$('downloadPng').onclick = async () => {
  if (penDraft) finishPen();
  try { const size = S.glyph.exportSize || 24; downloadBlob(`${outputName()}-${size}.png`, await svgToPNG(bakedSVG(), size)); status(`Downloaded ${size} × ${size} PNG.`); }
  catch (error) { status(error.message, true); }
};
async function exportLibrary(scope) {
  if (penDraft) finishPen();
  const glyphs = scope === 'one' ? [S.glyph] : scope === 'edited' ? S.lib.filter(isEdited) : S.lib;
  if (!glyphs.length) { status('No glyphs to export.', true); return; }
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  try {
    const data = await libraryZIP(libraryDocument(glyphs, scope, ORIG, S.components), glyph => core.toSVG(glyph, { mode: 'baked', weight: glyph.setStyle?.thickness ?? glyph.weight ?? 1.2 }), { structure: $('exportStructure').value, root: $('exportRoot').value, includeSVG: $('exportSVGs').checked });
    downloadBlob(`glyph-library-${scope}-${stamp}.zip`, new Blob([data], { type: 'application/zip' }));
  } catch (error) { status(`Export: ${error.message}`, true); return; }
  status(`Exported ${glyphs.length} glyph${glyphs.length === 1 ? '' : 's'}.`);
}
let pendingImport = null;
function requestLibraryImport(text, fileName) {
  try {
    const data=JSON.parse(text);
    if(data?.format==='glyph-workbench-reconstruction'){
      if(data.version!==1 || !Array.isArray(data.entries) || data.entries.length>10000)throw new Error('Invalid reconstruction report');
      const names=new Set();
      for(const entry of data.entries){if(typeof entry.name!=='string' || names.has(entry.name) || !['candidate','needs-review','existing'].includes(entry.status) || typeof entry.sourceSignature!=='string')throw new Error('Invalid or duplicate reconstruction entry');names.add(entry.name);if(entry.candidate){entry.candidate=normalizeGlyph(entry.candidate);if(core.resolve(entry.candidate).some(layer=>layer.error))throw new Error('Invalid reconstruction geometry');}}
      pendingImport={report:data};$('importSummary').textContent=`${fileName}: ${data.entries.length} reconstruction results. Attach review flags and candidates; current drawings stay intact.`;$('importReplace').closest('label').hidden=true;$('confirmImportBtn').textContent='Attach review results';$('importDialog').showModal();return;
    }
    $('importReplace').closest('label').hidden=false;
    const archive = parseLibraryArchive(text);
    for (const glyph of [...archive.glyphs, ...archive.originals.values()]) {
      const errors = core.resolve(glyph).filter(layer => layer.error);
      if (errors.length) throw new Error(`${glyph.name}: ${errors[0].error}`);
    }
    const matches = archive.glyphs.filter(glyph => idx(glyph.name) >= 0).length;
    pendingImport = { text, fileName };
    $('importSummary').textContent = `${fileName}: ${archive.glyphs.length} icon${archive.glyphs.length === 1 ? '' : 's'}, ${matches} matching existing name${matches === 1 ? '' : 's'}.`;
    $('importReplace').checked = false;
    $('confirmImportBtn').textContent = 'Add icons';
    $('importDialog').showModal();
    $('importReplace').focus();
  } catch (error) { status(`Import: ${error.message}`, true); }
}
$('importReplace').onchange = () => { $('confirmImportBtn').textContent = $('importReplace').checked ? 'Replace matching icons' : 'Add icons'; };
$('cancelImportBtn').onclick = () => $('importDialog').close();
listen($('importDialog'), 'close', () => { pendingImport = null; });
$('confirmImportBtn').onclick = async () => {
  if (!pendingImport) return;
  const { text, fileName, report } = pendingImport, mode = $('importReplace').checked ? 'overwrite' : 'add';
  pendingImport = null;
  $('importDialog').close();
  if(report)await attachReconstructionReport(report);else await importLibraryText(text, fileName, mode);
};
async function importLibraryText(text, fileName, mode = 'add') {
  let result, archive;
  try {
    archive = parseLibraryArchive(text);
    const { glyphs } = archive;
    // Evaluate before touching the current library: bad geometry cannot leave a partial import.
    for (const glyph of [...glyphs, ...archive.originals.values()]) {
      const errors = core.resolve(glyph).filter(layer => layer.error);
      if (errors.length) throw new Error(`${glyph.name}: ${errors[0].error}`);
    }
    if (penDraft) finishPen();
    if (archive.components.size) projectComponents(glyphs,archive.components,core);
    const ids=remapSharedForms(glyphs,()=>crypto.randomUUID());
    for(const original of archive.originals.values())for(const {node} of formsIn(original))if(node.component && ids.has(node.component.id))node.component.id=ids.get(node.component.id);
    result = mergeLibrary(S.lib, glyphs, mode);
  } catch (error) { status(`Import: ${error.message}`, true); return null; }
  if (penDraft) finishPen();
  const current = S.glyph.name;
  try { await saveLibraryVersion(`Before importing ${fileName || 'icons'}`); } catch(error) { status(error.message,true); return null; }
  S.lib = result.library;
  S.undo=[];S.redo=[];saveHistory();
  result.names.forEach((name, index) => { const source = archive.glyphs[index]; ORIG.set(name, { ...clone(archive.originals.get(source.name) || source), name }); });
  for (const name of result.names) queueSave(name);
  await flushSaves();
  renderLibrary();
  loadGlyph(Math.max(0, idx(result.names.length === 1 ? result.names[0] : current)));
  status(`Imported ${fileName || 'JSON'}: ${result.added} added, ${result.replaced} overwritten${result.renamed ? ` (${result.renamed} renamed to keep existing icons)` : ''}.`);
  return { added: result.added, replaced: result.replaced, renamed: result.renamed, names: result.names };
}
$('expOne').onclick = () => exportLibrary('one');
$('expEdited').onclick = () => exportLibrary('edited');
$('expAll').onclick = () => exportLibrary('all');
$('impFileBtn').onclick = () => $('impFile').click();
$('impFile').onchange = async () => { const f = $('impFile').files[0]; if (!f) return; try { const bytes = new Uint8Array(await f.arrayBuffer()); const text = /\.zip$/i.test(f.name) || (bytes[0] === 80 && bytes[1] === 75) ? readLibraryZIP(bytes) : new TextDecoder().decode(bytes); requestLibraryImport(text, f.name); } catch (error) { status(`Import: ${error.message}`, true); } finally { $('impFile').value = ''; } };
$('revertBtn').onclick = revert;
$('makeCutterBtn').onclick = cutterAction;
$('libSearch').oninput = applyLibFilter;
$('libFilter').onchange = () => { applyLibFilter(); try { localStorage.setItem('gw-lib-filter', $('libFilter').value); } catch (e) {} };
try { const f = localStorage.getItem('gw-lib-filter'); if (f && [...$('libFilter').options].some(o => o.value === f)) $('libFilter').value = f; } catch (e) {}
$('libSearchIcon').innerHTML = uiIcon('search-outline');
listen(document, 'keydown', e => {
  if (!root.contains(document.activeElement) && document.activeElement !== document.body) return;
  const t = e.target; if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
  const mod = e.metaKey || e.ctrlKey;
  if(t?.closest?.('#lib')) {
    if(e.key === 'Delete' || e.key === 'Backspace'){e.preventDefault();deleteLibraryIcons();return;}
    if(mod && e.key.toLowerCase()==='a'){e.preventDefault();$('selectShownIconsBtn').click();return;}
    if(e.key === 'Escape'){e.preventDefault();$('clearIconSelectionBtn').click();return;}
  }
  if (penDraft && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); finishPen(); setTool('select'); return; }
  if(areaPolygon && (e.key==='Enter' || e.key==='Escape')){e.preventDefault();if(e.key==='Enter')finishAreaPolygon();else {areaPolygon=null;$('anchorMarquee')?.remove();status('Polygon selection cancelled.');}return;}
  if (e.key === 'Escape' && drag?.kind === 'area-selection') {
    e.preventDefault(); drag = null; $('anchorMarquee')?.remove(); refresh(true);
    status('Selection gesture cancelled.'); return;
  }
  const key = shortcutFromEvent(e), action = Object.keys(shortcuts).find(action => shortcuts[action] === key);
  if (action) {
    e.preventDefault();
    if (['select', 'direct', 'pen'].includes(action)) setTool(action);
    else if (action === 'undo') undo(); else if (action === 'redo') redo();
    else if (action === 'duplicate') duplicate(); else if (action === 'group') group('union'); else if (action === 'ungroup') ungroup();
    else if (action === 'delete') { if (!deleteAnchor()) del(); }
    else if (action === 'selectAll') { if(S.tool==='direct' || S.tool==='area' && S.areaScope==='anchors')selectAllAnchors();else { S.sel = S.glyph.layers.filter(layer => layer.visible !== false).map(layer => ({ l: S.glyph.layers.indexOf(layer), p: [] })); S.anchor = null; S.selectedAnchors=[];refresh(true); } }
    else if (action === 'handles') { S.hmode = S.hmode === 'transform' ? 'shape' : 'transform'; syncToggles(); renderSelection(); }
    return;
  }
  if (e.key === 'Escape') {
    e.preventDefault();
    if (!S.sel.length && !S.selectedAnchors.length && !S.sourceAnchor && isoExit()) return;
    S.sel = []; S.anchor = null; S.selectedAnchors = []; S.sourceAnchor = null;
    refresh(true); status('Selection cleared.'); return;
  }
  const step = (S.snap || 0.1) * (e.shiftKey ? 10 : 1);
  const dirs = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (dirs[e.key] && t && t.getAttribute && t.getAttribute('role') === 'treeitem' && !S.sel.some(s => s.p !== null)) return;
  if (dirs[e.key] && nudge(...dirs[e.key])) e.preventDefault();
});
const resizeObserver = new ResizeObserver(() => { if (!S.glyph || disposed) return; renderGrid(); renderRulers(); renderSelection(); });
resizeObserver.observe(cv);

// ---------- boot: saved edits applied, then the last-open glyph (or camera) loaded ----------
window.__gw = { S, core, refresh, group, addShape, commit, setTool, setOrigin, getNode, fullMatrix, loadGlyph, idx, paintUI, isoEnter, isoExit,
  revert, flushSaves, linkFormGroup, findSharedForms:()=>findSharedForms(S.lib,core), exportLibrary, importLibraryText, isEdited, EDITS, ORIG, ready: false };
const ready = (async () => {
  await loadSaved();
  if (disposed) return;
  try {
    for(const g of JSON.parse(localStorage.getItem('gw-open-pending-components') || '[]')) { const glyph=normalizeGlyph(g);if(deletedIcons.has(glyph.name))continue;const at=idx(glyph.name);if(at>=0){S.lib[at]=glyph;queueSave(glyph.name);} }
    const journal = localStorage.getItem('gw-open-pending-glyph');
    if (journal) { const glyph = normalizeGlyph(JSON.parse(journal)); if(deletedIcons.has(glyph.name))throw new Error('Deleted icon journal'); const at = idx(glyph.name); if (at >= 0) S.lib[at] = glyph; else S.lib.push(glyph); queueSave(glyph.name); }
  } catch {}
  try { const journal = localStorage.getItem('gw-open-pending-set-style'); if (journal) { const style = JSON.parse(journal); S.lib = S.lib.map(glyph => ({ ...glyph, setStyle: clone(style) })); for (const glyph of S.lib) queueSave(glyph.name); } } catch {}
  // A fully deleted library stays empty; editing the blank canvas creates a new icon.
  S.lib.forEach(ensureLayerNames);
  renderLibrary();
  let last = null; try { last = localStorage.getItem('gw-current'); } catch (e) {}
  const at = last ? idx(last) : -1;
  loadGlyph(at >= 0 ? at : 0);
  if (DB.db) {
    try { const snapshots=await DB.run('readonly',store=>store.getAll(),'snapshots'); if(!snapshots.some(v=>v.id.startsWith('version-')))await saveLibraryVersion('Initial library checkpoint'); }catch(error){status(error.message,true);}
  }
  window.__gw.ready = true; window.__gw.readyAt = performance.now();
})();
return {
  ready,
  dispose() {
    disposed = true;
    abort.abort(); resizeObserver.disconnect(); thumbObserver?.disconnect();
    clearTimeout(saveTimer);
    if (pendingSave.size && DB.db) flushSaves().finally(() => DB.db?.close());
    else DB.db?.close();
    project.remove();
    if (window.__gw?.S === S) delete window.__gw;
  },
};
}
