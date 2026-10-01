// Pure logic for /pick/ (no DOM). The page imports it at build time to render the default view,
// and inlines this same source into its one page script, so build-time and in-browser grouping
// can never disagree. Keep it dependency-free and ES2019-safe.

export const FACES = [
  ['build', '施工', '写代码、交付功能'],
  ['ops', '运维', '排障、配置、上线'],
  ['text', '文本', '文档与报告'],
  ['verify', '核验', '查证结论'],
  ['review', '审查', '代码审查'],
  ['req-drift', '需求漂移', '需求中途改了'],
  ['ui-build', 'UI 搭建', '做前端界面'],
  ['vision', '视觉审图', '看截图找问题'],
  ['convergence', '收敛', '长对话按时收尾'],
];
export const LABEL = Object.fromEntries(FACES.map(([id, label]) => [id, label]));
export const TIER_NAMES = ['第一梯队', '第二梯队', '第三梯队', '第四梯队', '第五梯队', '第六梯队', '第七梯队', '第八梯队', '第九梯队', '第十梯队'];
// Lanes whose public total carries an apostrophe even where no cell holds an NA (frozen display rows).
export const FROZEN_HELD = ['devin', 'gpt-luna', 'doubao', 'claude', 'stepfun', 'gpt-sol'];

export const held = (c) => c.na ?? 0;
export const usable = (c) => (c.n > 0 ? c.n - held(c) : 0);
export const tierName = (i) => TIER_NAMES[i] || `第 ${i + 1} 梯队`;
export const displayTotal = (l) => (Object.values(l.axis).some((c) => held(c) > 0) || FROZEN_HELD.includes(l.id)) ? `${l.total}'` : String(l.total);
export const fmtSec = (s) => s == null ? '—' : s < 90 ? `${Math.round(s)} 秒` : s < 5400 ? `${(s / 60).toFixed(s < 600 ? 1 : 0)} 分钟` : `${(s / 3600).toFixed(1)} 小时`;
export const fmtTok = (t) => t == null ? '未上报' : t >= 1e8 ? `${(t / 1e8).toFixed(1)} 亿` : `${Math.round(t / 1e4)} 万`;

// Public lane records + their effort record, with the same display mappings as /rank/.
export function joinLanes(axes, siteData) {
  return axes.map((l) => ({
    ...l,
    vendor: l.id === 'kimi' ? 'Kimi 官方 coding' : l.vendor,
    e: siteData.lanes[l.id] || null,
  }));
}
// Case slots of the largest axis on the board; every bar track has this many equal slots.
export function axisN(lanes) {
  return Object.fromEntries(FACES.map(([id]) => [id, Math.max(...lanes.map((l) => l.axis[id].n))]));
}

// Ranking basis. No selection: total score. With a selection: weakest selected axis, then the sum.
// A selected axis that is wholly held (every case NA) has no result to compare, so that lane is
// not placed against lanes that sat it: key null → the separate "未分档" group.
export function scored(lanes, active) {
  return lanes
    .filter((l) => active.every((id) => l.axis[id].n > 0))
    .map((l) => {
      if (!active.length) return { lane: l, key: [l.total, l.n], label: `${displayTotal(l)}/${l.n}` };
      if (active.some((id) => usable(l.axis[id]) === 0)) return { lane: l, key: null };
      const vals = active.map((id) => l.axis[id].p);
      const min = Math.min(...vals), sum = vals.reduce((a, b) => a + b, 0);
      return { lane: l, key: [min, sum], min, sum };
    });
}
const tMed = (l) => (l.e ? l.e.t_med : Infinity);
export function withinTier(tb) {
  if (tb === 'time') return (a, b) => tMed(a.lane) - tMed(b.lane);
  if (tb === 'tok') return (a, b) => ((a.lane.e && a.lane.e.tok) ?? Infinity) - ((b.lane.e && b.lane.e.tok) ?? Infinity) || tMed(a.lane) - tMed(b.lane);
  return (a, b) => a.lane.name.localeCompare(b.lane.name);
}
// Identical scores form one tier; order exists only between tiers.
export function tiers(lanes, active, tb) {
  const rows = scored(lanes, active);
  const ranked = rows.filter((r) => r.key).sort((a, b) => b.key[0] - a.key[0] || b.key[1] - a.key[1]);
  const out = [];
  ranked.forEach((r) => {
    const t = out[out.length - 1];
    if (t && t.key[0] === r.key[0] && t.key[1] === r.key[1]) t.rows.push(r); else out.push({ key: r.key, rows: [r] });
  });
  const cmp = withinTier(tb);
  out.forEach((t) => t.rows.sort(cmp));
  return { tiers: out, unranked: rows.filter((r) => !r.key).sort(cmp), eligible: rows.length };
}
// Axes outside the selection on which members of a tier actually differ, most even split first.
export function splitters(rows, active) {
  if (rows.length < 2) return [];
  return FACES.map(([id]) => id).filter((id) => !active.includes(id)).map((id) => {
    const rates = rows.map((r) => r.lane.axis[id]).filter((c) => usable(c) > 0).map((c) => c.p / usable(c));
    if (rates.length < 2) return null;
    const best = Math.max(...rates), top = rates.filter((x) => x === best).length;
    if (top === rates.length) return null;
    return { id, balance: Math.abs(top / rates.length - 0.5) };
  }).filter(Boolean).sort((a, b) => a.balance - b.balance).slice(0, 3).map((x) => x.id);
}
export function tierTitle(t, active) {
  const r0 = t.rows[0];
  const what = !active.length ? `总分 ${r0.label}`
    : active.length === 1 ? `${LABEL[active[0]]} 过 ${r0.min} 题`
      : `所选里最弱一项过 ${r0.min} 题，合计 ${r0.sum} 题`;
  return `${t.rows.length > 1 ? `${t.rows.length} 个并列` : '独占'} · ${what}`;
}
export function verdictText(result, active) {
  const ts = result.tiers;
  if (!ts.length) return '没有匹配的模型';
  const t0 = ts[0];
  const scope = active.length ? `做「${active.map((id) => LABEL[id]).join(' + ')}」` : '看总分';
  const head = t0.rows.length > 1 ? `${t0.rows.length} 个模型并列第一梯队` : `${t0.rows[0].lane.name} 独占第一梯队`;
  const fast = t0.rows.length > 1 ? [...t0.rows].filter((r) => r.lane.e).sort((a, b) => a.lane.e.t_med - b.lane.e.t_med)[0] : null;
  return `${scope}：${head}，共分 ${ts.length} 档${fast ? `。其中最快的是 ${fast.lane.name}（每题中位 ${fmtSec(fast.lane.e.t_med)}）` : ''}`;
}
