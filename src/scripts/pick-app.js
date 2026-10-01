// /pick/ page script (inlined after picker-core). Ported from the approved prototype.
// Data comes from the page (generated from amber.db by amber-run sync_site.py); logic from picker-core.
const root = document.getElementById('pick-app');
const lanes = joinLanes(JSON.parse(root.dataset.axes), JSON.parse(root.dataset.site));
const AXIS_N = axisN(lanes);
// An axis is "small" when the most case slots any lane has on it is 2 or fewer.
const small = (id) => AXIS_N[id] <= 2;
document.body.style.setProperty('--slots', String(Math.max(...Object.values(AXIS_N))));
const tinyTag = (id) => { const t = document.createElement('span'); t.className = 'tiny'; t.textContent = `${AXIS_N[id]} 题`; return t; };
const MAX_MED = Math.max(...lanes.filter((l) => l.e).map((l) => l.e.t_med));

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let active = [];
let query = '';
let tb = 'time';
let firstRender = true;
const compare = [];

/* ---------- chips (rendered at build time; the script only wires them) ---------- */
document.querySelectorAll('.pk-chip').forEach((b) => b.addEventListener('click', () => toggleFace(b.dataset.face)));
function toggleFace(id) { active = active.includes(id) ? active.filter((x) => x !== id) : [...active, id]; render(); }
document.querySelectorAll('.pk-preset').forEach((p) => p.addEventListener('click', () => { active = p.dataset.preset ? p.dataset.preset.split(',') : []; render(); }));
document.getElementById('q').addEventListener('input', (e) => { query = e.target.value.trim().toLowerCase(); render(); });
document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
  tb = b.dataset.tb; document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tb === tb))); render();
}));

/* ---------- cards ---------- */
const grid = document.getElementById('grid');
const cards = new Map();
function pips(c) {
  const wrap = document.createElement('div'); wrap.className = 'pips';
  const fail = c.n - c.p - held(c);
  for (let i = 0; i < c.p; i++) wrap.append(Object.assign(document.createElement('i'), { className: 'pip p' }));
  for (let i = 0; i < fail; i++) wrap.append(Object.assign(document.createElement('i'), { className: 'pip' }));
  for (let i = 0; i < held(c); i++) wrap.append(Object.assign(document.createElement('i'), { className: 'pip h', title: '挂起' }));
  return wrap;
}
function axisRow(l, id, weakest) {
  const c = l.axis[id];
  const row = document.createElement('div'); row.className = 'axis-row';
  const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = LABEL[id];
  if (small(id)) lbl.append(tinyTag(id));
  const frac = document.createElement('span'); frac.className = 'frac';
  row.append(lbl);
  if (c.n === 0) { const n = document.createElement('span'); n.className = 'none'; n.textContent = '未考'; row.append(n); frac.textContent = '—'; }
  else { row.append(pips(c)); frac.textContent = `${c.p}/${c.n}`; }
  if (weakest) row.classList.add('weak');
  row.append(frac);
  return row;
}
function buildCard(l) {
  const el = document.createElement('article');
  el.className = 'card glass'; el.tabIndex = 0; el.dataset.id = l.id;
  el.innerHTML = `<div class="card-head"><div class="who"><b></b><small></small></div><div class="pk-score"><big></big><small></small></div></div><div class="rows"></div>
    <div class="effort"><span class="k">每题用时</span><span class="v"><b class="tm"></b><span class="tbar"><i></i></span></span><span class="k">合计</span><span class="v"><small class="tt"></small></span></div>
    <div class="card-foot"><span class="wk"></span><button type="button" class="cmp-toggle" aria-pressed="false">加入对比</button></div>`;
  el.querySelector('.who b').textContent = l.name;
  el.querySelector('.who small').textContent = l.vendor;
  el.querySelector('.wk').textContent = `${l.wk} 测 · ${l.cases} 案`;
  el.querySelector('.tm').textContent = `中位 ${fmtSec(l.e.t_med)}`;
  el.querySelector('.tbar i').style.width = `${Math.max(4, Math.round(l.e.t_med / MAX_MED * 100))}%`;
  el.querySelector('.tt').textContent = `${fmtSec(l.e.t_total)}（${l.e.t_n} 题） · ${fmtTok(l.e.tok)} token`;
  el.querySelector('.cmp-toggle').addEventListener('click', (e) => { e.stopPropagation(); toggleCompare(l.id); });
  el.addEventListener('click', () => openDetail(l.id, el));
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(l.id, el); } });
  glassify(el);
  return el;
}
lanes.forEach((l) => cards.set(l.id, buildCard(l)));

function fillCard(el, l, row) {
  const score = el.querySelector('.pk-score');
  if (active.length && row.key) {
    score.querySelector('big').textContent = `${row.sum}/${active.reduce((a, id) => a + usable(l.axis[id]), 0)}`;
    score.querySelector('small').textContent = '所选合计';
  } else {
    score.querySelector('big').textContent = `${displayTotal(l)}/${l.n}`;
    score.querySelector('small').textContent = '总分';
  }
  const rows = el.querySelector('.rows'); rows.textContent = '';
  const faces = active.length ? active : FACES.map(([id]) => id);
  faces.forEach((id) => {
    const c = l.axis[id];
    const weak = active.length > 1 && row.key && c.n > 0 && usable(c) > 0 && c.p === row.min && c.p < usable(c);
    rows.append(axisRow(l, id, weak));
  });
  syncToggle(el, l.id);
}
function syncToggle(el, id) {
  const t = el.querySelector('.cmp-toggle');
  t.setAttribute('aria-pressed', String(compare.includes(id)));
  t.textContent = compare.includes(id) ? '已加入' : '加入对比';
}

/* ---------- tier headers ---------- */
const tierEls = new Map();
function tierEl(i, t, total) {
  const key = `t${i}`;
  let el = tierEls.get(key);
  if (!el) { el = document.createElement('div'); el.className = 'tier'; tierEls.set(key, el); }
  el.dataset.tier = i + 1;
  el.id = `tier-${i + 1}`;
  el.dataset.name = tierName(i);
  el.dataset.count = t.rows.length;
  el.textContent = '';
  const line = document.createElement('div'); line.className = 'tier-line';
  const no = Object.assign(document.createElement('span'), { className: 'tier-no', textContent: tierName(i) });
  const title = Object.assign(document.createElement('span'), { className: 'tier-title', textContent: tierTitle(t, active) });
  line.append(no, title);
  el.append(line);
  const sp = splitters(t.rows, active);
  if (sp.length) {
    const sub = document.createElement('div'); sub.className = 'tier-sub';
    sub.append(Object.assign(document.createElement('span'), { textContent: '它们的成绩在这些工作上才分得开：' }));
    sp.forEach((id) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'split'; b.textContent = `+ ${LABEL[id]}`;
      if (small(id)) b.append(tinyTag(id));
      b.addEventListener('click', () => toggleFace(id));
      sub.append(b);
    });
    el.append(sub);
  } else if (t.rows.length > 1) {
    el.append(Object.assign(document.createElement('div'), { className: 'tier-sub', textContent: '其余工作上成绩也完全一样，只能看用时和 token。' }));
  }
  return el;
}

function render() {
  document.querySelectorAll('.pk-chip').forEach((c) => c.setAttribute('aria-pressed', String(active.includes(c.dataset.face))));
  const { tiers: ts, unranked: unordered, eligible } = tiers(lanes, active, tb);
  const match = (l) => !query || (l.name + ' ' + l.vendor).toLowerCase().includes(query);

  const before = new Map();
  if (!reduce) cards.forEach((el, id) => { if (el.isConnected) before.set(id, el.getBoundingClientRect()); });

  const seq = [];
  ts.forEach((t, i) => {
    const vis = t.rows.filter((r) => match(r.lane));
    if (!vis.length) return;
    seq.push(tierEl(i, t));
    vis.forEach((r) => { fillCard(cards.get(r.lane.id), r.lane, r); seq.push(cards.get(r.lane.id)); });
  });
  const heldRows = unordered.filter((r) => match(r.lane));
  if (heldRows.length) {
    let h = tierEls.get('held');
    if (!h) { h = document.createElement('div'); h.className = 'tier held'; tierEls.set('held', h); }
    h.id = 'tier-held'; h.dataset.tier = 'held'; h.dataset.name = '未分档'; h.dataset.count = heldRows.length;
    h.textContent = '';
    const line = document.createElement('div'); line.className = 'tier-line';
    line.append(Object.assign(document.createElement('span'), { className: 'tier-no', textContent: '未分档' }),
      Object.assign(document.createElement('span'), { className: 'tier-title', textContent: `${heldRows.length} 个 · 所选工作里有一项整项挂起` }));
    h.append(line, Object.assign(document.createElement('div'), { className: 'tier-sub', textContent: '挂起的题不算过也不算没过；这一项没有可比的成绩，所以不和上面的梯队排高下。' }));
    seq.push(h);
    heldRows.forEach((r) => { fillCard(cards.get(r.lane.id), r.lane, r); seq.push(cards.get(r.lane.id)); });
  }
  const keep = new Set(seq);
  [...grid.children].forEach((c) => { if (!keep.has(c)) c.remove(); });
  seq.forEach((el) => grid.append(el));

  if (!reduce && !firstRender) {
    const z = parseFloat(getComputedStyle(document.body).zoom) || 1;
    let k = 0;
    seq.forEach((el) => {
      if (el.classList.contains('tier')) { el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 }); return; }
      const old = before.get(el.dataset.id);
      const now = el.getBoundingClientRect();
      if (old) {
        const dx = (old.left - now.left) / z, dy = (old.top - now.top) / z;
        if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 600, easing: 'cubic-bezier(.2,.9,.3,1.08)' });
      } else {
        el.animate([{ opacity: 0, transform: 'translateY(18px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: Math.min(k++, 8) * 30, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
      }
      el.querySelectorAll('.pip.p').forEach((p, j) => p.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 380, delay: 120 + j * 35, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' }));
    });
  }

  // verdict: say how many are tied, never crown one model out of a tie
  document.getElementById('verdict').textContent = verdictText({ tiers: ts }, active);
  const smallSel = active.filter(small);
  const cv = document.getElementById('caveat');
  cv.hidden = !smallSel.length;
  if (smallSel.length) {
    cv.textContent = '';
    cv.append(Object.assign(document.createElement('b'), { textContent: '题少提醒 ' }), `${smallSel.map((id) => `${LABEL[id]}只有 ${AXIS_N[id]} 题`).join('、')}。过或不过偶然性大，梯队差距可能只是一次发挥。`);
  }
  const out = document.getElementById('out');
  const excluded = lanes.length - eligible;
  out.hidden = excluded === 0;
  out.textContent = excluded ? `另有 ${excluded} 个模型没考过所选的某类工作，不参与分档。` : '';
  renderDock();
  renderCtx();
  firstRender = false;
}

/* ---------- context bar: what is selected, which tier you are in ---------- */
const ctx = document.getElementById('ctx');
const ctxSum = document.getElementById('ctx-sum');
const SHORT = ['一档', '二档', '三档', '四档', '五档', '六档', '七档', '八档', '九档', '十档'];
let currentTier = null;
function renderCtx() {
  const sel = document.getElementById('ctx-sel'); sel.textContent = '';
  if (!active.length) sel.append(Object.assign(document.createElement('span'), { className: 'all', textContent: '全部工作 · 按总分' }));
  active.forEach((id) => {
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = LABEL[id];
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', `去掉${LABEL[id]}`);
    x.addEventListener('click', () => toggleFace(id));
    tag.append(x); sel.append(tag);
  });
  const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'edit'; edit.textContent = '改';
  edit.addEventListener('click', () => document.querySelector('.ask').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }));
  sel.append(edit);
  const tw = document.getElementById('ctx-tiers'); tw.textContent = '';
  [...grid.querySelectorAll('.tier')].forEach((t) => {
    const n = Number(t.dataset.tier);
    const b = document.createElement('button'); b.type = 'button'; b.dataset.tier = n;
    b.append(Object.assign(document.createElement('b'), { textContent: t.dataset.tier === 'held' ? '未分档' : (SHORT[n - 1] || `${n} 档`) }), `${t.dataset.count}`);
    b.setAttribute('aria-label', `${t.dataset.name}，${t.dataset.count} 个模型`);
    b.addEventListener('click', () => { t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); ctx.classList.remove('open'); ctxSum.setAttribute('aria-expanded', 'false'); });
    tw.append(b);
  });
  spy();
}
function spy() {
  const tiersOnPage = [...grid.querySelectorAll('.tier')];
  const line = Math.max(ctx.getBoundingClientRect().bottom, 0) + 48;
  let cur = tiersOnPage[0] || null;
  tiersOnPage.forEach((t) => { if (t.getBoundingClientRect().top <= line) cur = t; });
  currentTier = cur;
  document.querySelectorAll('#ctx-tiers button').forEach((b) => b.setAttribute('aria-current', String(!!cur && b.dataset.tier === cur.dataset.tier)));
  const what = active.length ? active.map((id) => LABEL[id]).join('+') : '全部 · 总分';
  ctxSum.textContent = cur ? `${what} · ${cur.dataset.name} · ${cur.dataset.count} 个` : what;
}
ctxSum.addEventListener('click', () => { const o = ctx.classList.toggle('open'); ctxSum.setAttribute('aria-expanded', String(o)); });
// the bar appears once the question panel has scrolled away
new IntersectionObserver(([e]) => { ctx.classList.toggle('on', !e.isIntersecting); if (e.isIntersecting) ctx.classList.remove('open', 'hide'); }, { rootMargin: '-40px 0px 0px 0px' })
  .observe(document.querySelector('.ask'));
// on phones it tucks away while scrolling down and returns on any upward scroll
let lastY = scrollY, ticking = false;
addEventListener('scroll', () => {
  if (ticking) return; ticking = true;
  requestAnimationFrame(() => {
    const y = scrollY;
    if (matchMedia('(max-width: 900px), (max-height: 520px)').matches && !ctx.classList.contains('open')) {
      if (y > lastY + 6) ctx.classList.add('hide'); else if (y < lastY - 6) ctx.classList.remove('hide');
    }
    lastY = y; spy(); ticking = false;
  });
}, { passive: true });

/* ---------- compare ---------- */
function toggleCompare(id) {
  const i = compare.indexOf(id);
  if (i >= 0) compare.splice(i, 1); else { if (compare.length >= 3) compare.shift(); compare.push(id); }
  cards.forEach((el, lid) => syncToggle(el, lid));
  renderDock();
}
function renderDock() {
  const dock = document.getElementById('dock');
  const picked = document.getElementById('picked'); picked.textContent = '';
  compare.forEach((id) => picked.append(Object.assign(document.createElement('span'), { textContent: lanes.find((l) => l.id === id).name })));
  if (compare.length === 1) { const s = document.createElement('span'); s.style.boxShadow = 'none'; s.style.background = 'transparent'; s.textContent = '再选 1–2 个'; picked.append(s); }
  dock.classList.toggle('show', compare.length > 0);
  const ob = document.getElementById('open-cmp');
  ob.disabled = compare.length < 2; ob.style.opacity = compare.length < 2 ? .5 : 1;
}
document.getElementById('clear-cmp').addEventListener('click', () => { compare.length = 0; cards.forEach((el, lid) => syncToggle(el, lid)); renderDock(); });
document.getElementById('open-cmp').addEventListener('click', () => { if (compare.length >= 2) openCompare(); });

/* ---------- sheet ---------- */
const sheet = document.getElementById('sheet');
const body = document.getElementById('sheet-body');
function withTransition(from, fill) {
  const open = () => { fill(); if (!sheet.open) sheet.showModal(); };
  if (reduce || !document.startViewTransition || !from) { open(); return; }
  from.style.viewTransitionName = 'focus';
  let done = false;
  const run = () => { if (done) return; done = true; from.style.viewTransitionName = ''; open(); body.style.viewTransitionName = 'focus'; };
  // A view transition waits for a rendered frame. If none comes (background tab, stalled renderer),
  // open the sheet anyway instead of leaving the click without effect.
  const fallback = setTimeout(() => { run(); body.style.viewTransitionName = ''; }, 400);
  document.startViewTransition(() => { clearTimeout(fallback); run(); })
    .finished.finally(() => { body.style.viewTransitionName = ''; });
}
function head(title, sub) {
  const h = document.createElement('div'); h.className = 'sheet-head';
  h.innerHTML = `<div><h3 id="sheet-title"></h3><p></p></div><button class="x" type="button" aria-label="关闭">×</button>`;
  h.querySelector('h3').textContent = title; h.querySelector('p').textContent = sub;
  h.querySelector('.x').addEventListener('click', () => sheet.close());
  return h;
}
const MONEY_NOTE = '费用：暂无可靠数据。多数车道是订阅制，库里记的金额为 0；按量计费的价格表还没收录。';
function openDetail(id, from) {
  const l = lanes.find((x) => x.id === id);
  withTransition(from, () => {
    body.textContent = '';
    body.append(head(l.name, `${l.vendor} · ${l.wk} 测 · ${l.cases} 案`));
    const facts = document.createElement('div'); facts.className = 'facts';
    const strong = FACES.filter(([fid]) => l.axis[fid].n > 0 && l.axis[fid].p === l.axis[fid].n && !held(l.axis[fid])).map(([, lb]) => lb);
    const weak = FACES.filter(([fid]) => usable(l.axis[fid]) > 0 && l.axis[fid].p === 0).map(([, lb]) => lb);
    [`总分 ${displayTotal(l)}/${l.n}`, strong.length ? `全过：${strong.join('、')}` : null, weak.length ? `全没过：${weak.join('、')}` : null]
      .filter(Boolean).forEach((t) => facts.append(Object.assign(document.createElement('span'), { textContent: t })));
    body.append(facts);
    const ef = document.createElement('div'); ef.className = 'facts';
    [`每题用时中位 ${fmtSec(l.e.t_med)}`, `最慢一成 ≥ ${fmtSec(l.e.t_p90)}`, `合计 ${fmtSec(l.e.t_total)}（${l.e.t_n} 题有计时）`, `token ${fmtTok(l.e.tok)}${l.e.tok != null && l.e.tok_n < l.e.t_n ? `（${l.e.tok_n} 题有上报）` : ''}`]
      .forEach((t) => ef.append(Object.assign(document.createElement('span'), { className: 'eff', textContent: t })));
    body.append(ef);
    // one row per axis: result on the left, time spent on the right
    const ax = document.createElement('div'); ax.className = 'detail-axes';
    const hd = document.createElement('div'); hd.className = 'drow dhead';
    hd.append(Object.assign(document.createElement('span'), { className: 'd-lbl' }), Object.assign(document.createElement('span'), { className: 'd-res', textContent: '成绩' }), Object.assign(document.createElement('span'), { className: 'd-time', textContent: '用时（合计 / 题数）' }));
    ax.append(hd);
    const maxAx = Math.max(...Object.values(l.e.ax).map(([sec]) => sec));
    FACES.forEach(([fid]) => {
      const r = axisRow(l, fid, false);
      const row = document.createElement('div'); row.className = 'drow';
      const [lbl, track, frac] = r.children;
      lbl.classList.add('d-lbl');
      const res = document.createElement('span'); res.className = 'd-res'; res.append(track, frac);
      const tm = document.createElement('span'); tm.className = 'd-time';
      const t = l.e.ax[fid];
      if (t) {
        const bar = document.createElement('span'); bar.className = 'tbar';
        const fill = document.createElement('i'); fill.style.width = `${Math.max(3, Math.round(t[0] / maxAx * 100))}%`; bar.append(fill);
        tm.append(bar, Object.assign(document.createElement('span'), { className: 'd-tt', textContent: `${fmtSec(t[0])} / ${t[1]} 题` }));
      } else tm.append(Object.assign(document.createElement('span'), { className: 'none', textContent: l.axis[fid].n ? '未计时' : '—' }));
      row.append(lbl, res, tm);
      ax.append(row);
    });
    body.append(ax);
    const note = document.createElement('p'); note.className = 'fine';
    note.textContent = `用时是每题从开考到交卷的墙钟时间，包含工具执行；有些题跑到驱动的时间上限才停，最慢一成的数字会偏大。token 含缓存读写，不同厂商的分词方式不同，只适合粗比。${MONEY_NOTE}`;
    body.append(note);
    const src = document.createElement('p'); src.className = 'fine';
    src.innerHTML = `挂起的题不计输赢；总分带 ′ 表示有挂起题。完整成绩页和更正记录：<a target="_blank" rel="noopener"></a>`;
    const a = src.querySelector('a'); a.href = `https://github.com/getaskclaw/${l.repo}`; a.textContent = `getaskclaw/${l.repo}`;
    body.append(src);
  });
}
function openCompare() {
  const ls = compare.map((id) => lanes.find((l) => l.id === id));
  withTransition(document.getElementById('dock'), () => {
    body.textContent = '';
    body.append(head('并排对比', active.length ? `按你选的工作：${active.map((id) => LABEL[id]).join('、')}` : '全部工作类型'));
    const wrap = document.createElement('div'); wrap.className = 'cmp-table';
    const t = document.createElement('table');
    const cg = document.createElement('colgroup');
    cg.append(Object.assign(document.createElement('col'), { className: 'lbl' }));
    ls.forEach(() => cg.append(document.createElement('col')));
    t.append(cg);
    const hr = document.createElement('tr');
    hr.append(Object.assign(document.createElement('th'), { textContent: '' }));
    ls.forEach((l) => hr.append(Object.assign(document.createElement('th'), { className: 'm', textContent: l.name })));
    const thead = document.createElement('thead'); thead.append(hr); t.append(thead);
    const tb_ = document.createElement('tbody');
    const faces = active.length ? FACES.filter(([id]) => active.includes(id)) : FACES;
    const rowsSpec = [
      ...faces.map(([fid, lb]) => ({ lb, small: small(fid), hi: true,
        val: (l) => usable(l.axis[fid]) ? l.axis[fid].p / usable(l.axis[fid]) : null,
        txt: (l) => { const c = l.axis[fid]; return c.n ? `${c.p}/${c.n}${held(c) ? `（${held(c)} 挂起）` : ''}` : '未考'; },
        fid })),
      { lb: '总分', hi: true, val: (l) => l.total / l.n, txt: (l) => `${displayTotal(l)}/${l.n}` },
      { lb: '每题用时（中位）', hi: false, val: (l) => l.e.t_med, txt: (l) => fmtSec(l.e.t_med) },
      { lb: '合计用时', hi: false, val: (l) => l.e.t_total / l.e.t_n, txt: (l) => `${fmtSec(l.e.t_total)}（${l.e.t_n} 题）` },
      { lb: 'token', hi: false, val: (l) => l.e.tok, txt: (l) => fmtTok(l.e.tok) },
    ];
    rowsSpec.forEach((r) => {
      const tr = document.createElement('tr');
      const th = document.createElement('td'); th.textContent = r.lb; if (r.small) th.append(tinyTag(r.fid));
      tr.append(th);
      const vals = ls.map(r.val).filter((x) => x != null);
      const best = vals.length ? (r.hi ? Math.max(...vals) : Math.min(...vals)) : null;
      ls.forEach((l) => {
        const td = document.createElement('td'); td.textContent = r.txt(l);
        const x = r.val(l);
        if (x != null && best != null && vals.length > 1 && x === best && vals.some((o) => o !== best)) td.classList.add('win');
        tr.append(td);
      });
      tb_.append(tr);
    });
    t.append(tb_); wrap.append(t); body.append(wrap);
    body.append(Object.assign(document.createElement('p'), { className: 'fine', textContent: `高亮的是该项更好的一方：成绩比通过率（挂起题不计入分母），用时和 token 越少越好；合计用时按每题平均比，因为各模型有计时的题数不同。${MONEY_NOTE}` }));
  });
}
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
const syncMore = () => body.classList.toggle('more', body.scrollHeight - body.scrollTop - body.clientHeight > 8);
body.addEventListener('scroll', syncMore, { passive: true });
new MutationObserver(() => requestAnimationFrame(syncMore)).observe(body, { childList: true });
addEventListener('resize', syncMore);

/* ---------- glass specular follows the pointer ---------- */
function glassify(el) {
  if (reduce) return;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
}
document.querySelectorAll('.glass').forEach((el) => { if (!cards.has(el.dataset.id)) glassify(el); });

/* ---------- amber caustics: slow light drifting through resin ---------- */
(function caustics() {
  const cv = document.getElementById('caustics');
  const ctx = cv.getContext('2d');
  const blobs = [
    { k: '--blob-a', x: .18, y: .12, r: .55, sx: .00011, sy: .00007, p: 0 },
    { k: '--blob-b', x: .82, y: .30, r: .48, sx: .00008, sy: .00012, p: 2 },
    { k: '--blob-c', x: .55, y: .85, r: .60, sx: .00006, sy: .00009, p: 4 },
    { k: '--blob-a', x: .30, y: .70, r: .38, sx: .00013, sy: .00005, p: 1 },
  ];
  let colors = [];
  const readColors = () => { const cs = getComputedStyle(document.body); colors = blobs.map((b) => cs.getPropertyValue(b.k).trim()); };
  const size = () => { const d = Math.min(devicePixelRatio || 1, 1.5); cv.width = innerWidth * d * .5; cv.height = innerHeight * d * .5; };
  function draw(t) {
    const w = cv.width, h = cv.height, m = Math.max(w, h);
    ctx.clearRect(0, 0, w, h);
    blobs.forEach((b, i) => {
      const x = (b.x + Math.sin(t * b.sx + b.p) * .12) * w;
      const y = (b.y + Math.cos(t * b.sy + b.p) * .10) * h;
      const g = ctx.createRadialGradient(x, y, 0, x, y, b.r * m);
      g.addColorStop(0, colors[i]); g.addColorStop(1, 'transparent');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
  }
  size(); readColors(); draw(0);
  addEventListener('resize', () => { size(); draw(performance.now()); });
  if (reduce) return;
  let last = 0;
  (function loop(t) { if (!document.hidden && t - last > 33) { draw(t); last = t; } requestAnimationFrame(loop); })(0);
})();

/* ---------- back to top: appears after one screen, lifts above the compare dock ---------- */
const totop = document.getElementById('totop');
totop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }));
const syncTop = () => { totop.classList.toggle('on', scrollY > innerHeight * 0.8); totop.classList.toggle('lift', compare.length > 0); };
addEventListener('scroll', syncTop, { passive: true });
new MutationObserver(syncTop).observe(document.getElementById('dock'), { attributes: true, attributeFilter: ['class'] });

render();
