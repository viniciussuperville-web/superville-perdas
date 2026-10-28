// Classificação e cálculos (mesma lógica do relatório de fechamento)
import { SEGMAP, AC_SEGS, FR_SEGS, MIX2DEP, REF, QUEBRA } from './config.js';

export const num = (v, d = 0) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const brl = (v, d = 2) => 'R$ ' + num(v, d);
export const pct = (v, d = 1) => num((v || 0) * 100, d) + '%';
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const qfmt = (un, kg) => [un ? `${num(un)} un` : '', kg ? `${num(kg, 1)} kg` : ''].filter(Boolean).join(' · ') || '—';

let CAT = null, MIXINFO = {}, MANUAL = {};
export async function loadCatalog() {
  if (CAT) return CAT;
  CAT = await (await fetch('data/catalogo.json', { cache: 'no-cache' })).json();
  CAT.mixes.forEach(m => MIXINFO[m.nome] = m);
  return CAT;
}
export const mixList = () => CAT.mixes.map(m => m.nome);
export const mixInfo = n => MIXINFO[n] || { enc: '', ger: '' };
export function setManual(map) { MANUAL = map || {}; }
export function setResponsaveis(map) { Object.entries(map || {}).forEach(([k, v]) => { if (MIXINFO[k]) Object.assign(MIXINFO[k], v); }); }

export function segOf(cod, desc) {
  let best = null;
  for (const [p, s] of SEGMAP) if ((cod === p || cod.startsWith(p + '/')) && (!best || p.length > best[0].length)) best = [p, s];
  let s = best ? best[1] : '';
  if (cod.startsWith('104/') && s !== 'Congelados' && /\bKG\s*$/.test(desc)) s = 'Balcão (granel/kg)';
  return s;
}

// Item importado -> lançamento classificado
export function classify(it, imp) {
  const mix = it.mix || MANUAL[it.plu] || (CAT.plu[it.plu] !== undefined ? CAT.mixes[CAT.plu[it.plu]].nome : 'A CLASSIFICAR');
  const info = mixInfo(mix);
  const isKg = it.kg != null || /\bKG\s*$/.test(it.desc);
  const kg = isKg ? Number(it.kg ?? it.qtd) || 0 : 0;
  const un = isKg ? 0 : Number(it.qtd) || 0;
  const cod = it.cod || (CAT.cod && CAT.cod[it.plu]) || '';
  let seg = '';
  if (mix === 'Açougue e Peixaria' || mix === 'Frios e Laticínios') {
    const s = segOf(cod, it.desc);
    const lst = mix === 'Açougue e Peixaria' ? AC_SEGS : FR_SEGS;
    seg = lst.includes(s) ? s : 'Outros';
  }
  return {
    data: it.dia || imp.data, mes: imp.mes, tipo: imp.tipo, origem: it.origem || '', plu: it.plu || '', desc: it.desc, cod,
    qtd: Number(it.qtd) || 0, valor: Number(it.valor) || 0, mix, enc: info.enc || '', ger: info.ger || '', seg, kg, un, pes: isKg ? 'kg' : 'un',
    dep: cod ? cod.split('/')[0] : (MIX2DEP[mix] || '100'),
  };
}

export function consolidate(rows) {
  const m = new Map();
  for (const x of rows) {
    const k = x.plu || x.desc;
    if (!m.has(k)) m.set(k, { plu: x.plu, desc: x.desc, mix: x.mix, seg: x.seg, enc: x.enc, ger: x.ger, un: 0, kg: 0, ven: 0, ava: 0, n: 0, qv: 0, qa: 0, unit: 'un', dias: new Set() });
    const a = m.get(k), q = x.pes === 'kg' ? x.kg : x.un;
    if (x.pes === 'kg') a.unit = 'kg';
    a.un += x.un; a.kg += x.kg; a.n++; a.dias.add(x.data);
    if (x.tipo === 'VENCIDO') { a.ven += x.valor; a.qv += q; } else { a.ava += x.valor; a.qa += q; }
  }
  const out = [...m.values()];
  out.forEach(a => { a.tot = a.ven + a.ava; a.q = a.unit === 'kg' ? a.kg : a.un; });
  return out.sort((a, b) => b.tot - a.tot);
}

export function group(rows, key) {
  const m = new Map();
  for (const x of rows) {
    const k = x[key] || '—';
    if (!m.has(k)) m.set(k, { ven: 0, ava: 0, un: 0, kg: 0, vkg: 0, n: 0 });
    const a = m.get(k);
    a[x.tipo === 'VENCIDO' ? 'ven' : 'ava'] += x.valor; a.un += x.un; a.kg += x.kg; a.n++;
    if (x.pes === 'kg') a.vkg += x.valor;
  }
  const out = [...m.entries()];
  out.forEach(([, a]) => a.tot = a.ven + a.ava);
  return out.sort((a, b) => b[1].tot - a[1].tot);
}

export const sum = (rows, f = x => x.valor) => rows.reduce((s, x) => s + f(x), 0);

export function kpiVenda(rows, vendas) {
  const pd = {}; rows.forEach(x => pd[x.dep] = (pd[x.dep] || 0) + x.valor);
  const vd = {}; (vendas?.deptos || []).forEach(v => vd[v.depto] = v);
  const linhas = [];
  for (const [nome, deps, media] of REF) {
    const v = deps.reduce((s, d) => s + (vd[d]?.venda || 0), 0), lb = deps.reduce((s, d) => s + (vd[d]?.lucro || 0), 0), p = deps.reduce((s, d) => s + (pd[d] || 0), 0);
    if (!v) continue;
    const idx = p / v, meta = media * QUEBRA / 100;
    const st = idx < 0.0005 ? ['#BFBFBF', 'Sem registro de perda'] : idx <= meta ? ['#3BB072', 'Dentro da meta'] : idx <= meta * 1.2 ? ['#F2B705', 'Atenção'] : ['#D64545', 'Acima da meta'];
    linhas.push({ nome, v, lb, p, idx, meta, st });
  }
  const tot = vd['0'] || { venda: 0, lucro: 0 };
  return { linhas, vt: tot.venda, lt: tot.lucro, pt: sum(rows) };
}
