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
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/contents/${folder}?ref=main`, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? '访问频繁，请稍后再刷新。' : '暂时无法连接 GitHub，请稍后刷新。');
  const files = await response.json();
  if (!Array.isArray(files)) throw new Error('内容暂时无法读取。');
  return files.filter(file => file.type === 'file').sort((a, b) => b.name.localeCompare(a.name, 'zh-CN', { numeric: true }));
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
async function loadNotes() {
  $('note-retry').disabled = true;
  $('note-status').textContent = '正在整理笔记…';
  try {
    const files = (await listFiles('notes')).filter(file => /\.md$/i.test(file.name) && file.name.toLowerCase() !== 'readme.md');
    $('note-grid').replaceChildren();
    files.forEach(file => {
      const info = fileInfo(file.name);
      const card = element('button', undefined, 'note-card'); card.type = 'button';
      const time = element('time', info.date || '学习记录'); if (info.date) time.dateTime = info.date;
      card.append(time, element('h3', info.title), element('span', '阅读笔记 ↗'));
      card.addEventListener('click', () => openNote(file)); $('note-grid').append(card);
    });
    $('note-status').textContent = files.length ? `${files.length} 篇学习记录` : '还没有笔记。记下今天学会的一件小事，就是很好的开始。';
  } catch (error) { $('note-status').textContent = error.message || '笔记加载失败，请重试。'; }
  finally { $('note-retry').disabled = false; }
}
$('note-retry').addEventListener('click', loadNotes);
const today = new Intl.DateTimeFormat('sv-SE').format(new Date());
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
