/* Spigot design system — router, palette, tabs, font switcher */

/* Single-path 24×24 outlines, drawn with the link's own colour so icon and label can never
   disagree about state. Kept as bare path data rather than 33 inline <svg> blobs. */
const ICONS = {
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  droplet: 'M12 2.7l5.3 5.3a7.5 7.5 0 1 1-10.6 0z',
  type: 'M4 7V4h16v3M9 20h6M12 4v16',
  ruler: 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4',
  cube: 'M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  layers: 'M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.2-6.2 3.2L7 14.2l-5-4.9 6.9-1L12 2z',
  a11y: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 7h.01M8 11h8M12 11v4l-2 4M12 15l2 4',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  hex: 'M12 2l8.7 5v10L12 22l-8.7-5V7z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01',
  image: 'M3 3h18v18H3zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  frame: 'M4 4h16v16H4zM4 9h16M9 4v16',
  click: 'M9 3v4M3 9h4M4.9 4.9l2.8 2.8M13 13l8 3-3.5 1.5L16 21z',
  field: 'M3 8h18v8H3zM7 12h6',
  dot: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  chip: 'M6 6h12v12H6zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3',
  card: 'M3 5h18v14H3zM3 10h18',
  table: 'M3 4h18v16H3zM3 10h18M3 15h18M9 4v16',
  steps: 'M4 6h4v4H4zM4 14h4v4H4zM12 8h9M12 16h9',
  window: 'M3 5h18v14H3zM3 9h18M6 7h.01M9 7h.01',
  empty: 'M4 5h16v14H4zM4 5l16 14',
  code: 'M8 6l-6 6 6 6M16 6l6 6-6 6',
  skeleton: 'M3 5h18v3H3zM3 12h12v3H3zM3 19h8v2H3z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0',
  caret: 'M6 9l6 6 6-6',
  tabs: 'M3 8h6V4h12v16H3zM9 8v12',
  tooltip: 'M21 12a2 2 0 0 1-2 2H9l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  pager: 'M11 18l-6-6 6-6M19 18l-6-6 6-6',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  bar: 'M3 10h18v4H3zM3 10v4',
  group: 'M4 7h16v13H4zM8 4h8M8 12h8M8 16h5',
  tree: 'M6 4h12M9 4v6h9M9 10v6h9M9 16v4h9',
  copy: 'M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  check: 'M20 6L9 17l-5-5',
};

function icon(name, cls) {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name]}"/></svg>`;
}

const ROUTES = [
  { id: 'introduction', title: 'Introduction', group: 'Foundations', icon: 'book', status: 'foundation' },
  { id: 'contributing', title: 'Adding a page', group: 'Foundations', icon: 'list', status: 'foundation' },
  { id: 'colors', title: 'Colors', group: 'Foundations', icon: 'droplet', status: 'foundation' },
  { id: 'typography', title: 'Typography', group: 'Foundations', icon: 'type', status: 'foundation' },
  { id: 'space', title: 'Space & radius', group: 'Foundations', icon: 'ruler', status: 'foundation' },
  { id: 'depth', title: 'Depth', group: 'Foundations', icon: 'cube', status: 'foundation' },
  { id: 'motion', title: 'Motion', group: 'Foundations', icon: 'zap', status: 'foundation' },
  { id: 'layers', title: 'Layers & breakpoints', group: 'Foundations', icon: 'layers', status: 'foundation' },
  { id: 'grid', title: 'Grid', group: 'Foundations', icon: 'grid', status: 'foundation' },
  { id: 'icons', title: 'Icons', group: 'Foundations', icon: 'star', status: 'foundation' },
  { id: 'a11y', title: 'Accessibility', group: 'Foundations', icon: 'a11y', status: 'foundation' },
  { id: 'content', title: 'Content', group: 'Foundations', icon: 'message', status: 'foundation' },
  { id: 'brand', title: 'Brand', group: 'Foundations', icon: 'hex', status: 'foundation' },
  { id: 'spec-row', title: 'Spec row', group: 'Patterns', icon: 'list', status: 'shipped' },
  { id: 'labels', title: 'Mono label', group: 'Patterns', icon: 'tag', status: 'foundation' },
  { id: 'imagery', title: 'Imagery', group: 'Patterns', icon: 'image', status: 'foundation' },
  { id: 'placeholders', title: 'Placeholders', group: 'Patterns', icon: 'frame', status: 'foundation' },
  { id: 'button', title: 'Button', group: 'Components', icon: 'click', status: 'shipped' },
  { id: 'input', title: 'Input', group: 'Components', icon: 'field', status: 'shipped' },
  { id: 'status', title: 'StatusBadge', group: 'Components', icon: 'dot', status: 'shipped' },
  { id: 'skilltag', title: 'SkillTag', group: 'Components', icon: 'chip', status: 'shipped' },
  { id: 'card', title: 'Card', group: 'Components', icon: 'card', status: 'shipped' },
  { id: 'table', title: 'Table', group: 'Components', icon: 'table', status: 'shipped' },
  { id: 'wizard', title: 'WizardRail', group: 'Components', icon: 'steps', status: 'shipped' },
  { id: 'modal', title: 'Modal', group: 'Components', icon: 'window', status: 'shipped' },
  { id: 'empty', title: 'EmptyState', group: 'Components', icon: 'empty', status: 'shipped' },
  { id: 'codeblock', title: 'CodeBlock', group: 'Components', icon: 'code', status: 'shipped' },
  { id: 'skeleton', title: 'Skeleton', group: 'Components', icon: 'skeleton', status: 'shipped' },
  { id: 'toast', title: 'Toast & Banner', group: 'Components', icon: 'bell', status: 'shipped' },
  { id: 'select', title: 'Select', group: 'Components', icon: 'caret', status: 'shipped' },
  { id: 'tabs', title: 'Tabs', group: 'Components', icon: 'tabs', status: 'shipped' },
  { id: 'tooltip', title: 'Tooltip', group: 'Components', icon: 'tooltip', status: 'shipped' },
  { id: 'avatar', title: 'Avatar', group: 'Components', icon: 'user', status: 'shipped' },
  { id: 'upload', title: 'FileUpload', group: 'Components', icon: 'upload', status: 'shipped' },
  { id: 'progress', title: 'Progress', group: 'Components', icon: 'bar', status: 'shipped' },
  { id: 'fieldset', title: 'Fieldset', group: 'Components', icon: 'group', status: 'shipped' },
  { id: 'filetree', title: 'FileTree', group: 'Components', icon: 'tree', status: 'shipped' },
  { id: 'pagination', title: 'Pagination', group: 'Components', icon: 'pager', status: 'shipped' },
];


/* ---------- sidebar ---------- */
function buildNav() {
  const nav = document.getElementById('nav');
  let html = '';
  const groups = [...new Set(ROUTES.map((r) => r.group))];
  for (const g of groups) {
    html += `<div class="nav-group" data-g="${g}">
      <button class="nav-head" onclick="toggleGroup(this)">
        <svg class="chev" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>
        ${g}
      </button>
      <div class="nav-items">
        ${ROUTES.filter((r) => r.group === g)
          .map(
            (r) =>
              `<a class="nav-link" data-id="${r.id}" href="#/${r.id}">${icon(r.icon, 'ni')}<span>${r.title}</span></a>`
          )
          .join('')}
      </div>
    </div>`;
  }
  nav.innerHTML = html;
}
function toggleGroup(btn) {
  btn.parentElement.classList.toggle('closed');
}


/* ---------- router ---------- */
function currentId() {
  const h = location.hash.replace(/^#\/?/, '');
  return ROUTES.some((r) => r.id === h) ? h : ROUTES[0].id;
}
function go() {
  const id = currentId();
  document.querySelectorAll('.route').forEach((s) => s.classList.toggle('on', s.id === id));
  document
    .querySelectorAll('.nav-link')
    .forEach((a) => a.classList.toggle('on', a.dataset.id === id));

  const r = ROUTES.find((x) => x.id === id);
  document.title = `${r.title} — Spigot Design System`;

  buildPager(id);
  mountStatus(id);
  mountCopy(id);
  closeNav();
  window.scrollTo(0, 0);
}

/* ---------- page status ---------- */
/* Every page declares whether the thing it documents exists yet. `shipped` has a primitive in
   `components/common/`; `spec` is the page running ahead of the code; `foundation` is tokens
   or rules with no primitive to have. The status lives in ROUTES so the badge, the sidebar
   and the generated Markdown can never disagree about it. */
const STATUS_LABEL = { shipped: 'Shipped', spec: 'Spec', foundation: 'Foundation' };

function mountStatus(id) {
  const eyebrow = document.getElementById(id)?.querySelector('.head .eyebrow');
  if (!eyebrow || eyebrow.querySelector('.pstatus')) return;
  const r = ROUTES.find((x) => x.id === id);
  if (!r) return;
  const el = document.createElement('span');
  el.className = `pstatus s-${r.status}`;
  el.textContent = STATUS_LABEL[r.status];
  eyebrow.appendChild(el);
}

/* ---------- copy page as markdown ---------- */
/* Every route is mirrored as a generated `<id>-llm.txt`; the first route also carries
   `llm.txt`, which is every page concatenated. The control is injected rather than authored
   into all 33 heads, so a route added to ROUTES gets one without touching index.html. */
function mountCopy(id) {
  const head = document.getElementById(id)?.querySelector('.head');
  if (!head || head.querySelector('.llmbar')) return;

  const btn = (file, label) =>
    `<button class="copy llmbtn" data-file="${file}" onclick="copyLlm(this)">` +
    `<span class="ic">${icon('copy', 'c1')}${icon('check', 'c2')}</span>` +
    `<span class="lbl">${label}</span></button>`;

  const bar = document.createElement('div');
  bar.className = 'llmbar';
  bar.innerHTML =
    btn(`${id}-llm.txt`, 'Copy page as Markdown') +
    (id === ROUTES[0].id ? btn('llm.txt', `Copy all ${ROUTES.length} pages`) : '');
  head.appendChild(bar);
}

async function copyLlm(btn) {
  const lbl = btn.querySelector('.lbl');
  const original = lbl.textContent;
  try {
    const res = await fetch(`/designsystem/${btn.dataset.file}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    await navigator.clipboard.writeText(await res.text());
    btn.classList.add('done');
    lbl.textContent = 'Copied';
  } catch {
    // Most likely cause is opening index.html over file://, where fetch is blocked.
    lbl.textContent = 'Copy failed';
  }
  setTimeout(() => {
    btn.classList.remove('done');
    lbl.textContent = original;
  }, 1600);
}
function buildPager(id) {
  const i = ROUTES.findIndex((r) => r.id === id);
  const prev = ROUTES[i - 1];
  const next = ROUTES[i + 1];
  const L = '<svg class="prevchev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
  const R = '<svg class="nextchev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
  document.getElementById('pager').innerHTML =
    (prev
      ? `<a href="#/${prev.id}"><div class="d">Previous</div><div class="n">${L}${prev.title}</div></a>`
      : '<span></span>') +
    (next
      ? `<a class="next" href="#/${next.id}"><div class="d">Next</div><div class="n">${next.title}${R}</div></a>`
      : '<span class="next"></span>');
}

/* ---------- ⌘K palette ---------- */
let palIdx = 0;
let palHits = [];
function openPal() {
  document.getElementById('pal').classList.add('open');
  const i = document.getElementById('palInput');
  i.value = '';
  filterPal('');
  setTimeout(() => i.focus(), 30);
}
function closePal() {
  document.getElementById('pal').classList.remove('open');
}
function filterPal(q) {
  q = q.toLowerCase().trim();
  palHits = ROUTES.filter(
    (r) => !q || r.title.toLowerCase().includes(q) || r.group.toLowerCase().includes(q)
  );
  palIdx = 0;
  renderPal();
}
function renderPal() {
  const list = document.getElementById('palList');
  if (!palHits.length) {
    list.innerHTML = '<div class="pal-empty">No matches</div>';
    return;
  }
  list.innerHTML = palHits
    .map(
      (r, i) =>
        `<div class="pal-item${i === palIdx ? ' on' : ''}" onclick="palGo(${i})"><span class="g">${r.group}</span>${r.title}</div>`
    )
    .join('');
}
function palGo(i) {
  const r = palHits[i];
  if (!r) return;
  location.hash = `#/${r.id}`;
  closePal();
}

/* ---------- demo tabs + copy ---------- */
function toggleCode(btn) {
  const demo = btn.closest('.demo');
  const open = demo.classList.toggle('showcode');
  btn.querySelector('.lbl').textContent = open ? 'Hide code' : 'Show code';
}
function copyDemo(el) {
  el.classList.add('done');
  setTimeout(() => el.classList.remove('done'), 1500);
}
function copyCode(btn) {
  const code = btn.closest('.demo-code');
  const txt = [...code.childNodes]
    .filter((n) => n.nodeType === 3 || (n.nodeType === 1 && !n.classList?.contains('codecopy')))
    .map((n) => n.textContent)
    .join('');
  navigator.clipboard?.writeText(txt.trim());
  copyDemo(btn);
}

/* ---------- toast ---------- */
let toastN = 0;
function fireToast(kind) {
  const t = document.getElementById('toaster');
  const map = {
    success: ['success', 'Payment settled', '0.0250 USDC · tx QK7X2M…9FA3D1'],
    error: ['error', 'Publish failed', 'Domain verification did not complete'],
    info: ['info', 'Provisioning started', 'Your wallet is being created'],
  };
  const [tok, title, desc] = map[kind];
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML =
    `<i class="dot ti" style="background: var(--${tok}); width:8px; height:8px; margin-top:7px"></i>` +
    `<div style="flex:1"><div class="tt">${title}</div><div class="td">${desc}</div></div>` +
    `<button class="tx" aria-label="Dismiss">&times;</button>`;
  el.querySelector('.tx').onclick = () => el.remove();
  t.appendChild(el);
  const id = ++toastN;
  setTimeout(() => el.isConnected && el.remove(), 4500);
  return id;
}

/* ---------- misc demo state ---------- */
function pickTab(btn) {
  [...btn.parentElement.children].forEach((b) => b.classList.remove('on'));
  btn.classList.add('on');
}

/* ---------- modal ---------- */
function openModal() {
  document.getElementById('ovl').classList.add('open');
}
function closeModal() {
  document.getElementById('ovl').classList.remove('open');
}

/* ---------- mobile nav drawer ---------- */
function toggleNav() {
  const open = document.getElementById('nav').classList.toggle('open');
  document.getElementById('navscrim').classList.toggle('open', open);
}
function closeNav() {
  document.getElementById('nav').classList.remove('open');
  document.getElementById('navscrim').classList.remove('open');
}

/* ---------- theme ---------- */
function setTheme(n) {
  document.documentElement.dataset.theme = n;
  hexes();
}
function hexes() {
  const c = getComputedStyle(document.documentElement);
  document.querySelectorAll('[data-hex]').forEach((el) => {
    el.textContent = c.getPropertyValue(el.dataset.hex).trim().toUpperCase();
  });
}

/* ---------- boot ---------- */
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openPal();
    return;
  }
  if (e.key === 'Escape') {
    closePal();
    closeModal();
    closeNav();
    return;
  }
  if (!document.getElementById('pal').classList.contains('open')) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    palIdx = Math.min(palIdx + 1, palHits.length - 1);
    renderPal();
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    palIdx = Math.max(palIdx - 1, 0);
    renderPal();
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    palGo(palIdx);
  }
});

window.addEventListener('hashchange', go);

buildNav();
go();
hexes();

// Identicons: deterministic 5x5 mirrored dot pattern from a name hash.
// No Math.random — the same name must always produce the same avatar.
function fillAvatar(el) {
  // Seeded on the name plus the entity's creation date, so two publishers with the same name
  // still differ. The date is authored into the markup, never read from the clock: reading it
  // at render time would draw a different avatar on each load.
  const seed = `${el.dataset.name || ''}|${el.dataset.created || ''}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  el.style.setProperty('--av-hue', `var(--cat-${(h % 5) + 1})`);
  // 15 bits fill the left three columns; columns 4 and 5 mirror 2 and 1.
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const src = c < 3 ? c : 4 - c;
      const bit = r * 3 + src;
      const i = document.createElement('i');
      if (!((h >>> bit) & 1)) i.className = 'off';
      // A second slice of the same hash varies the weight, so a filled grid still has texture.
      else if (!((h >>> (bit + 15)) & 1)) i.className = 'dim';
      el.appendChild(i);
    }
  }
}

document.querySelectorAll('.av[data-name]').forEach(fillAvatar);

// placeholder logo marks — deterministic bit pattern, no Math.random
const MARK_BITS = [0,1,1,1,0, 1,0,0,0,1, 1,1,1,1,1, 1,0,0,0,1, 0,1,0,1,0];
document.querySelectorAll('.mark').forEach((m) => {
  if (m.childElementCount) return;
  MARK_BITS.forEach((b) => {
    const i = document.createElement('i');
    if (!b) i.style.opacity = '0.16';
    m.appendChild(i);
  });
});

// dot-matrix: radius encodes magnitude. Deterministic — no Math.random.
const dm = document.getElementById('dm');
if (dm) {
  for (let i = 0; i < 28 * 6; i++) {
    const x = i % 28,
      y = (i / 28) | 0;
    const v = (Math.sin(x * 0.5) + Math.cos(y * 0.8 + x * 0.16) + 2) / 4;
    const el = document.createElement('i');
    el.style.transform = `scale(${(0.16 + v * 0.84).toFixed(3)})`;
    el.style.opacity = (0.2 + v * 0.8).toFixed(3);
    dm.appendChild(el);
  }
}

// mark the platform key in the search hint
document.getElementById('metaKey').textContent = /Mac|iPhone|iPad/.test(navigator.platform)
  ? '⌘'
  : 'Ctrl';
