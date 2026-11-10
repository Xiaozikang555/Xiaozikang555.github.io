document.getElementById('year').textContent = new Date().getFullYear();

const REPOSITORY = 'Xiaozikang555/Xiaozikang555.github.io';
const githubRoot = `https://github.com/${REPOSITORY}`;
const $ = (id) => document.getElementById(id);
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function fileInfo(name) {
  const stem = name.replace(/\.[^.]+$/, '');
  const match = stem.match(/^(\d{4}-\d{2}-\d{2})[_\s-]*(.*)$/);
  return { date: match ? match[1] : '', title: (match ? match[2] : stem).replace(/_/g, ' ') || '值得记住的一天' };
}
function rawUrl(file) {
  return `https://raw.githubusercontent.com/${REPOSITORY}/main/${file.path.split('/').map(encodeURIComponent).join('/')}?v=${encodeURIComponent(file.sha)}`;
}
async function listFiles(folder) {
  const files = await getCatalog();
  if (!Array.isArray(files)) throw new Error('内容暂时无法读取。');
  const unique = new Map();
  for (const file of files) {
    if (file.type === 'file' && typeof file.path === 'string' && file.path.startsWith(`${folder}/`)) unique.set(file.path, file);
  }
  return [...unique.values()].sort((a, b) => b.name.localeCompare(a.name, 'zh-CN', { numeric: true }));
}
let catalogPromise;
function getCatalog() {
  if (!catalogPromise) catalogPromise = fetch(`collections.json?v=${Date.now()}`, { signal: AbortSignal.timeout(15000) }).then(async response => {
    if (!response.ok) throw new Error('内容正在发布或暂时无法加载，请稍后刷新。');
    return response.json();
  }).finally(() => { catalogPromise = null; });
  return catalogPromise;
}

let photos = [];
let photoIndex = 0;
function showPhoto(index) {
  if (!photos.length) return;
  photoIndex = (index + photos.length) % photos.length;
  const file = photos[photoIndex];
  const info = fileInfo(file.name);
  $('full-photo').src = rawUrl(file);
  $('full-photo').alt = info.title;
  $('full-caption').textContent = [info.date, info.title].filter(Boolean).join(' · ');
  $('photo-position').textContent = `${photoIndex + 1} / ${photos.length}`;
  if (!$('photo-dialog').open) $('photo-dialog').showModal();
}
async function loadPhotos() {
  $('photo-retry').disabled = true;
  $('photo-status').textContent = '正在翻开相册…';
  try {
    const files = (await listFiles('photos')).filter(file => /\.(jpe?g|png|webp|gif|avif)$/i.test(file.name));
    photos = files;
    $('photo-grid').replaceChildren();
    files.forEach((file, index) => {
      const info = fileInfo(file.name);
      const card = element('figure', undefined, 'photo-card');
      const button = element('button', undefined, 'photo-open');
      button.type = 'button';
      button.setAttribute('aria-label', `查看照片：${info.title}`);
      const img = element('img');
      img.src = rawUrl(file); img.alt = info.title; img.loading = 'lazy'; img.decoding = 'async';
      button.append(img); button.addEventListener('click', () => showPhoto(index));
      const caption = element('figcaption');
      if (info.date) { const time = element('time', info.date); time.dateTime = info.date; caption.append(time); }
      caption.append(element('h3', info.title)); card.append(button, caption); $('photo-grid').append(card);
      img.addEventListener('error', () => { button.replaceChildren(element('span', '照片暂未加载，点击重试')); button.addEventListener('click', () => { img.src = rawUrl(file); button.replaceChildren(img); }, { once: true }); }, { once: true });
    });
    $('photo-status').textContent = files.length ? `${files.length} 个被珍藏的瞬间` : '相册已准备好。上传第一张照片，把平凡的一天变成值得珍藏的回忆。';
  } catch (error) { $('photo-status').textContent = error.message || '相册加载失败，请重试。'; }
  finally { $('photo-retry').disabled = false; }
}
$('photo-retry').addEventListener('click', loadPhotos);
$('previous-photo').addEventListener('click', () => showPhoto(photoIndex - 1));
$('next-photo').addEventListener('click', () => showPhoto(photoIndex + 1));
$('photo-dialog').addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') showPhoto(photoIndex - 1);
  if (event.key === 'ArrowRight') showPhoto(photoIndex + 1);
});

// A small, text-only Markdown renderer. User content never becomes executable HTML.
function renderNote(markdown) {
  const fragment = document.createDocumentFragment();
  let code = null;
  for (const line of markdown.replace(/\r/g, '').split('\n')) {
    if (line.startsWith('```')) { if (code) code = null; else { code = element('pre', ''); fragment.append(code); } continue; }
    if (code) { code.textContent += `${line}\n`; continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) fragment.append(element(`h${heading[1].length}`, heading[2]));
    else if (/^\s*[-*]\s+/.test(line)) fragment.append(element('p', `• ${line.replace(/^\s*[-*]\s+/, '')}`));
    else if (line.trim()) fragment.append(element('p', line));
  }
  return fragment;
}
let noteRequest = 0;
async function openNote(file) {
  const request = ++noteRequest;
  $('note-content').textContent = '正在打开笔记…';
  $('edit-note').href = `${githubRoot}/edit/main/${file.path.split('/').map(encodeURIComponent).join('/')}`;
  $('note-dialog').showModal();
  try {
    const response = await fetch(rawUrl(file), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('笔记加载失败，请关闭后重新打开。');
    const markdown = await response.text();
    if (request === noteRequest && $('note-dialog').open) $('note-content').replaceChildren(renderNote(markdown));
  } catch (error) { if (request === noteRequest) $('note-content').textContent = error.message; }
}
let noteFiles = [];
let noteMeta = new Map();
const expandedNoteModules = new Set();
let noteCatalogAvailable = false;
const noteModuleOrder = ['项目总览', '建站部署', '界面设计', '内容管理', '交互功能', '问题修复', '项目交付', '我的笔记'];
function noteDetails(file) {
  return noteMeta.get(file.path) || { title: fileInfo(file.name).title, module: '我的笔记', summary: '记录新的知识、理解与实践。', order: 999 };
}
function renderNotes() {
  $('notes-folder-count').textContent = `${new Set(noteFiles.map(file => noteDetails(file).module)).size} 个模块 · ${noteFiles.length} 篇笔记`;
  const query = $('note-search').value.trim().toLocaleLowerCase();
  const shown = noteFiles.filter(file => {
    const info = noteDetails(file);
    return `${info.title} ${info.summary} ${info.module}`.toLocaleLowerCase().includes(query);
  });
  $('note-grid').replaceChildren();
  const groups = new Map();
  shown.forEach(file => {
    const module = noteDetails(file).module;
    if (!groups.has(module)) groups.set(module, []);
    groups.get(module).push(file);
  });
  const modules = [...noteModuleOrder.filter(module => groups.has(module)), ...[...groups.keys()].filter(module => !noteModuleOrder.includes(module))];
  modules.forEach((module, index) => {
    const panel = element('details', undefined, 'note-module-panel');
    panel.open = expandedNoteModules.has(module);
    const summary = element('summary', undefined, 'note-module-summary');
    const number = element('span', String(index + 1).padStart(2, '0'), 'note-module-number'); number.setAttribute('aria-hidden', 'true');
    const name = element('span', module, 'note-module-title');
    const count = element('span', `${groups.get(module).length} 篇笔记`, 'note-module-count');
    const affordance = element('span', undefined, 'note-module-affordance'); affordance.setAttribute('aria-hidden', 'true');
    const closed = element('span', '展开', 'when-closed');
    const opened = element('span', '收起', 'when-open');
    affordance.append(closed, opened, element('span', '⌄', 'note-module-chevron'));
    summary.append(number, name, count, affordance);
    const cards = element('div', undefined, 'module-notes');
    panel.addEventListener('toggle', () => {
      if (!panel.isConnected) return;
      if (panel.open) expandedNoteModules.add(module); else expandedNoteModules.delete(module);
    });
    panel.append(summary, cards); $('note-grid').append(panel);
    groups.get(module).forEach(file => cards.append(createNoteCard(file)));
  });
  $('note-status').textContent = noteFiles.length ? `${shown.length} / ${noteFiles.length} 篇记录 · ${modules.length} 个模块${shown.length ? ' · 点击模块标题展开' : ' · 没有匹配的笔记，请换个关键词'}${noteCatalogAvailable ? '' : ' · 模块信息暂未加载，可刷新重试'}` : '还没有笔记。记下今天学会的一件小事，就是很好的开始。';
}
function createNoteCard(file) {
    const info = noteDetails(file);
    const card = element('button', undefined, 'note-card'); card.type = 'button';
    const top = element('div', undefined, 'note-card-top');
    const date = fileInfo(file.name).date;
    const time = element('time', date || '学习记录'); if (date) time.dateTime = date;
    top.append(element('span', info.module, 'note-module'), time);
    card.append(top, element('h3', info.title), element('p', info.summary, 'note-summary'), element('span', '阅读任务记录 ↗', 'note-open'));
    card.addEventListener('click', () => openNote(file));
    return card;
}
async function loadNotes() {
  $('note-retry').disabled = true;
  $('note-status').textContent = '正在整理笔记…';
  try {
    const [files, metadata] = await Promise.all([
      listFiles('notes'),
      fetch(`notes/modules.json?v=${Date.now()}`, { signal: AbortSignal.timeout(15000) }).then(response => { if (!response.ok) throw new Error('metadata'); return response.json(); }).catch(() => null)
    ]);
    noteCatalogAvailable = Array.isArray(metadata);
    noteMeta = new Map((noteCatalogAvailable ? metadata : []).filter(item => item && typeof item.path === 'string' && typeof item.title === 'string' && typeof item.module === 'string').map(item => [item.path, item]));
    noteFiles = files.filter(file => /\.md$/i.test(file.name) && file.name.toLowerCase() !== 'readme.md');
    noteFiles.sort((a, b) => (noteDetails(a).order ?? 999) - (noteDetails(b).order ?? 999));
    expandedNoteModules.clear(); renderNotes();
  } catch (error) { $('note-status').textContent = error.message || '笔记加载失败，请重试。'; }
  finally { $('note-retry').disabled = false; }
}
$('note-retry').addEventListener('click', loadNotes);
$('note-search').addEventListener('input', renderNotes);
$('notes-collapse-all').addEventListener('click', () => {
  expandedNoteModules.clear();
  $('note-grid').querySelectorAll('details').forEach(panel => { panel.open = false; });
  $('notes-folder').open = false;
});
$('notes-folder').addEventListener('toggle', () => {
  if (!$('notes-folder').open) {
    expandedNoteModules.clear();
    $('note-grid').querySelectorAll('details').forEach(panel => { panel.open = false; });
  }
});
const hobbyDescriptions = {
  '音乐': ['♫', '让旋律成为生活的背景音。'],
  '旅行': ['↗', '去看看日常之外的风景。'],
  '运动': ['◉', '让身体动起来，给心情一点空间。'],
  '游戏': ['✧', '探索不同的世界，收集纯粹的快乐。']
};
async function loadHobbies() {
  $('hobby-retry').disabled = true;
  $('hobby-status').textContent = '正在收集生活里的热爱…';
  try {
    const files = (await listFiles('hobbies')).filter(file => /\.md$/i.test(file.name) && file.name.toLowerCase() !== 'readme.md');
    const order = Object.keys(hobbyDescriptions);
    files.sort((a, b) => { const rank = file => { const n = order.indexOf(fileInfo(file.name).title); return n < 0 ? order.length : n; }; return rank(a) - rank(b); });
    $('hobby-grid').replaceChildren();
    files.forEach((file, index) => {
      const info = fileInfo(file.name);
      const [symbol, description] = hobbyDescriptions[info.title] || ['✧', '记录这份喜欢，留住生活里的灵感。'];
      const card = element('button', undefined, 'hobby-card'); card.type = 'button';
      const top = element('div', undefined, 'hobby-card-top');
      const icon = element('span', symbol, 'hobby-icon'); icon.setAttribute('aria-hidden', 'true');
      top.append(icon, element('span', String(index + 1).padStart(2, '0'), 'hobby-number'));
      card.append(top, element('h3', info.title), element('p', description), element('span', '打开兴趣手记 ↗', 'hobby-open'));
      card.addEventListener('click', () => openNote(file)); $('hobby-grid').append(card);
    });
    $('hobby-status').textContent = files.length ? '' : '给喜欢的事留一个位置，从第一篇兴趣手记开始。';
  } catch (error) { $('hobby-status').textContent = error.message || '爱好加载失败，请重试。'; }
  finally { $('hobby-retry').disabled = false; }
}
$('hobby-retry').addEventListener('click', loadHobbies);
const today = new Intl.DateTimeFormat('sv-SE').format(new Date());
$('new-hobby').href = `${githubRoot}/new/main?filename=${encodeURIComponent(`hobbies/新的爱好-${Date.now().toString(36)}.md`)}&value=${encodeURIComponent('# 我的爱好\n\n## 为什么喜欢\n\n## 最近在做\n\n## 想尝试的事情\n')}`;
$('new-note').href = `${githubRoot}/new/main?filename=${encodeURIComponent(`notes/${today}_学习笔记-${Date.now().toString(36)}.md`)}&value=${encodeURIComponent('# 今天的学习\n\n## 学习主题\n\n## 学到了什么\n\n## 我的理解\n\n## 下一步\n')}`;
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
});

const memoKey = 'xiaozikang555-memos-v1';
let memos = [];
let filter = 'all';
let storageError = '';
try {
  const saved = JSON.parse(localStorage.getItem(memoKey) || '[]');
  if (!Array.isArray(saved) || saved.some(memo => !memo || typeof memo.id !== 'string' || typeof memo.text !== 'string' || typeof memo.done !== 'boolean')) throw new Error('invalid');
  memos = saved;
} catch { storageError = '本地数据无法读取。请先检查浏览器存储设置；本次新记录可导出备份。'; }
function persistMemos() {
  try { localStorage.setItem(memoKey, JSON.stringify(memos)); storageError = ''; }
  catch { storageError = '保存失败（存储已满或被禁用）。本次记录仅暂存在页面中，请立即导出备份。'; }
  renderMemos();
}
function renderMemos() {
  $('memo-list').replaceChildren();
  const shown = memos.filter(memo => filter === 'all' || (filter === 'done' ? memo.done : !memo.done));
  shown.forEach(memo => {
    const item = element('li', undefined, `memo-item${memo.done ? ' done' : ''}`);
    const check = element('input', undefined, 'memo-check'); check.type = 'checkbox'; check.checked = memo.done;
    check.setAttribute('aria-label', `${memo.done ? '标记未完成' : '标记完成'}：${memo.text}`);
    check.addEventListener('change', () => { memo.done = check.checked; persistMemos(); });
    const remove = element('button', '删除', 'memo-delete'); remove.type = 'button'; remove.setAttribute('aria-label', `删除备忘录：${memo.text}`);
    remove.addEventListener('click', () => { if (window.confirm('删除这条备忘录？')) { memos = memos.filter(other => other.id !== memo.id); persistMemos(); } });
    item.append(check, element('span', memo.text, 'memo-text'), remove); $('memo-list').append(item);
  });
  $('memo-count').textContent = `${memos.filter(memo => !memo.done).length} 件待完成`;
  $('memo-status').textContent = storageError || (shown.length ? '' : filter === 'all' ? '暂时没有备忘。把想做的事，写在这里。' : '这个分类下还没有备忘。');
}
$('memo-form').addEventListener('submit', event => {
  event.preventDefault(); const text = $('memo-input').value.trim(); if (!text) return;
  memos.unshift({ id: crypto.randomUUID(), text, done: false, createdAt: new Date().toISOString() });
  $('memo-input').value = ''; persistMemos(); $('memo-input').focus();
});
document.querySelectorAll('.memo-filter').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  document.querySelectorAll('.memo-filter').forEach(other => { const selected = other === button; other.classList.toggle('selected', selected); other.setAttribute('aria-pressed', String(selected)); }); renderMemos();
}));
$('export-memos').addEventListener('click', () => {
  const text = `我的备忘录 · ${today}\n\n${memos.map(memo => `[${memo.done ? 'x' : ' '}] ${memo.text}`).join('\n\n')}`;
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = element('a'); link.href = url; link.download = `备忘录-${today}.txt`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('storage', event => {
  if (event.key !== memoKey) return;
  try { const next = JSON.parse(event.newValue || '[]'); if (Array.isArray(next) && next.every(memo => memo && typeof memo.id === 'string' && typeof memo.text === 'string' && typeof memo.done === 'boolean')) { memos = next; renderMemos(); } } catch { /* Keep the current view when another tab has invalid data. */ }
});
renderMemos();
loadPhotos();
loadNotes();
loadHobbies();

const planetScene = document.querySelector('.planetarium');
const planetToggle = $('planet-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let planetPaused = false;
function updatePlanetMotion() {
  const paused = planetPaused || reducedMotion.matches;
  planetScene.classList.toggle('is-paused', paused);
  planetToggle.disabled = reducedMotion.matches;
  planetToggle.textContent = reducedMotion.matches ? '已减少动态效果' : paused ? '播放动画 ▷' : '暂停动画 Ⅱ';
  planetToggle.setAttribute('aria-label', reducedMotion.matches ? '已遵循系统减少动态效果设置' : paused ? '播放星球动画' : '暂停星球动画');
  planetToggle.setAttribute('aria-pressed', String(paused));
}
planetToggle.addEventListener('click', () => { planetPaused = !planetPaused; updatePlanetMotion(); });
reducedMotion.addEventListener('change', updatePlanetMotion);
if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => planetScene.classList.toggle('is-offscreen', !entries[0].isIntersecting)).observe(planetScene);
}
document.addEventListener('visibilitychange', () => planetScene.classList.toggle('is-hidden', document.hidden));
updatePlanetMotion();
