// Pure logic for the model picker (no DOM). The page imports it at build time to render the
// default view, and inlines this same source into its one page script, so build-time and
// in-browser grouping can never disagree. Text comes from a dictionary T (picker-i18n.js);
// the scoring logic is language-independent. Keep it dependency-free and ES2019-safe.

// The axis list is data: T.faces is filled at build time from site-data.json (amber.db axes.sql).
export const axisIds = (T) => T.faces.map(([id]) => id);
// Lanes whose public total carries an apostrophe even where no cell holds an NA (frozen display rows).
export const FROZEN_HELD = ['devin', 'gpt-luna', 'doubao', 'claude', 'gpt-sol'];

// Fill the {name} slots; {cases} becomes the language's word for n cases.
export function tr(T, key, vars = {}) {
  const n = vars.n;
  return String(T[key]).replace(/\{(\w+)\}/g, (m, k) => {
    if (k === 'cases') return T.lang === 'en' ? (n === 1 ? 'case' : 'cases') : T.caseWord;
    if (k === 'lanes') return T.lang === 'en' ? (n === 1 ? 'lane' : 'lanes') : T.laneWord;
    return k in vars ? String(vars[k]) : m;
  });
}
export const labels = (T) => Object.fromEntries(T.faces.map(([id, label]) => [id, label]));

export const held = (c) => c.na ?? 0;
export const usable = (c) => (c.n > 0 ? c.n - held(c) : 0);
export const tierName = (i, T) => T.tierNames[i] || tr(T, 'tierN', { n: i + 1 });
export const displayTotal = (l) => (Object.values(l.axis).some((c) => held(c) > 0) || FROZEN_HELD.includes(l.id)) ? `${l.total}'` : String(l.total);
export function fmtSec(s, T) {
  if (s == null) return '—';
  if (s < 90) return tr(T, 'sec', { n: Math.round(s) });
  if (s < 5400) return tr(T, 'min', { n: (s / 60).toFixed(s < 600 ? 1 : 0) });
  return tr(T, 'hr', { n: (s / 3600).toFixed(1) });
}
export function fmtTok(t, T) {
  if (t == null) return T.tokNone;
  if (T.lang === 'en') return t >= 1e9 ? tr(T, 'tokBig', { n: (t / 1e9).toFixed(1) }) : tr(T, 'tokSmall', { n: (t / 1e6).toFixed(1) });
  return t >= 1e8 ? tr(T, 'tokBig', { n: (t / 1e8).toFixed(1) }) : tr(T, 'tokSmall', { n: Math.round(t / 1e4) });
}

// Public lane records + their effort record, with the language's display labels (as on /rank/).
export function joinLanes(axes, siteData, T) {
  return axes.map((l) => ({ ...l, ...(T.laneLabels[l.id] || {}), e: siteData.lanes[l.id] || null }));
}
// Case slots of the largest axis on the board; every bar track has this many equal slots.
export function axisN(lanes, T) {
  return Object.fromEntries(axisIds(T).map((id) => [id, Math.max(...lanes.map((l) => l.axis[id].n))]));
}

// Ranking basis. No selection: total score. With a selection: weakest selected axis, then the sum.
// A selected axis that is wholly held (every case NA) has no result to compare, so that lane is
// not placed against lanes that sat it: key null → the separate unranked group.
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
export function splitters(rows, active, T) {
  if (rows.length < 2) return [];
  return axisIds(T).filter((id) => !active.includes(id)).map((id) => {
    const rates = rows.map((r) => r.lane.axis[id]).filter((c) => usable(c) > 0).map((c) => c.p / usable(c));
    if (rates.length < 2) return null;
    const best = Math.max(...rates), top = rates.filter((x) => x === best).length;
    if (top === rates.length) return null;
    return { id, balance: Math.abs(top / rates.length - 0.5) };
  }).filter(Boolean).sort((a, b) => a.balance - b.balance).slice(0, 3).map((x) => x.id);
}
export function tierTitle(t, active, T) {
  const r0 = t.rows[0], L = labels(T);
  const what = !active.length ? tr(T, 'tierTotal', { s: r0.label })
    : active.length === 1 ? tr(T, 'tierOne', { axis: L[active[0]], n: r0.min })
      : tr(T, 'tierMulti', { min: r0.min, sum: r0.sum });
  return (t.rows.length > 1 ? tr(T, 'tied', { n: t.rows.length }) : T.alone) + T.titleJoin + what;
}
export function verdictText(result, active, T) {
  const ts = result.tiers, L = labels(T);
  if (!ts.length) return T.noMatch;
  const t0 = ts[0];
  const scope = active.length ? tr(T, 'scopeSel', { axes: active.map((id) => L[id]).join(T.axesJoin) }) : T.scopeAll;
  const head = t0.rows.length > 1 ? tr(T, 'headTied', { n: t0.rows.length }) : tr(T, 'headAlone', { name: t0.rows[0].lane.name });
  // no 'fastest of the tie' here: the tied lanes sat in different weeks and endpoints, so a speed ranking in the headline would compare unlike runs
  return tr(T, 'verdict', { scope, head, n: ts.length });
}
