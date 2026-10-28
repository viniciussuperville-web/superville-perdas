// Gráficos em SVG (mesmo visual na tela e no PDF)
import { num, brl, pct, esc, qfmt } from './core.js';
export const C = { green: '#3BB072', black: '#1F1F1F', dgreen: '#1E7B46', lgreen: '#A9DCC0', red: '#D64545', yel: '#F2B705', grey: '#BFBFBF' };
export const LEG_V = 'Vencido (passou da validade)', LEG_A = 'Avariado (estragou, quebrou ou amassou)';
const FONT = `font-family="Montserrat,Arial,sans-serif"`;

function legend(items, y = 14) {
  let x = 0, s = '';
  for (const [c, t] of items) { s += `<rect x="${x}" y="${y - 9}" width="12" height="12" rx="2" fill="${c}"/><text x="${x + 17}" y="${y + 1}" font-size="11" fill="#404040">${esc(t)}</text>`; x += 26 + t.length * 6.3; }
  return s;
}

// Barras horizontais empilhadas: % de cada parte dentro da barra, valor e % do total no fim, quantidade abaixo do nome
export function hbar(items, baseTotal, o = {}) {
  const keys = o.keys || ['ven', 'ava'], cols = o.colors || [C.black, C.green], leg = o.legend || [LEG_V, LEG_A];
  items = items.filter(([, a]) => (a[keys[0]] || 0) + (a[keys[1]] || 0) > 0);
  const W = o.width || 760, LW = o.labelWidth || 200, RH = 36, top = 34, H = top + items.length * RH + 6;
  const mx = Math.max(1, ...items.map(([, a]) => a[keys[0]] + a[keys[1]]));
  const BW = (W - LW - 10) / (W < 700 ? 1.8 : 1.45);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" ${FONT} xmlns="http://www.w3.org/2000/svg"><g>${legend([[cols[0], leg[0]], [cols[1], leg[1]]])}</g>`;
  items.forEach(([nome, a], i) => {
    const y = top + i * RH, p = a[keys[0]] || 0, q = a[keys[1]] || 0, t = p + q;
    const w1 = p / mx * BW, w2 = q / mx * BW;
    const sub = o.qty === false ? '' : qfmt(a.un, a.kg);
    s += `<text x="${LW - 8}" y="${y + (sub ? 13 : 18)}" text-anchor="end" font-size="11.5" font-weight="600" fill="#262626">${esc(nome)}</text>`;
    if (sub) s += `<text x="${LW - 8}" y="${y + 27}" text-anchor="end" font-size="10" fill="#7a7a7a">${esc(sub)}</text>`;
    s += `<rect x="${LW}" y="${y + 5}" width="${w1}" height="24" fill="${cols[0]}"/><rect x="${LW + w1}" y="${y + 5}" width="${w2}" height="24" fill="${cols[1]}"/>`;
    for (const [x0, w, v] of [[LW, w1, p], [LW + w1, w2, q]]) if (t && w > 34) s += `<text x="${x0 + w / 2}" y="${y + 21}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff">${pct(v / t, 0)}</text>`;
    const lbl = o.endfmt ? o.endfmt(t, a) : `${brl(t, 0)} · ${pct(t / baseTotal)} do total`;
    s += `<text x="${LW + w1 + w2 + 6}" y="${y + 21}" font-size="11.5" font-weight="700" fill="#262626">${esc(lbl)}</text>`;
  });
  return s + '</svg>';
}

export function donut(parts, center, size = 220) {
  const tot = parts.reduce((s, p) => s + p[1], 0) || 1, r = 92, r0 = 60, cx = size / 2, cy = size / 2;
  let a0 = -Math.PI / 2, s = `<svg viewBox="0 0 ${size} ${size}" width="${size}" ${FONT} xmlns="http://www.w3.org/2000/svg">`;
  for (const [nome, v, cor] of parts) {
    const a1 = a0 + v / tot * Math.PI * 2, large = a1 - a0 > Math.PI ? 1 : 0;
    const P = (rr, a) => `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`;
    if (v > 0) s += `<path d="M${P(r, a0)} A${r},${r} 0 ${large} 1 ${P(r, a1)} L${P(r0, a1)} A${r0},${r0} 0 ${large} 0 ${P(r0, a0)} Z" fill="${cor}" stroke="#fff" stroke-width="2"/>`;
    const am = (a0 + a1) / 2;
    if (v / tot > 0.06) s += `<text x="${cx + 76 * Math.cos(am)}" y="${cy + 76 * Math.sin(am) + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">${pct(v / tot, 0)}</text>`;
    a0 = a1;
  }
  return s + `<text x="${cx}" y="${cy + 2}" text-anchor="middle" font-size="15" font-weight="800" fill="#262626">${esc(center[0])}</text><text x="${cx}" y="${cy + 20}" text-anchor="middle" font-size="10" fill="#595959">${esc(center[1])}</text></svg>`;
}

export function pareto(cons) {
  const tot = cons.reduce((s, a) => s + a.tot, 0) || 1, n = cons.length || 1, W = 760, H = 180, L = 40, B = 30;
  let acc = 0, pts = [], k80 = n;
  cons.forEach((a, i) => { acc += a.tot; const v = acc / tot; pts.push([L + (i + 1) / n * (W - L - 10), 10 + (1 - v) * (H - B - 10)]); if (v >= 0.8 && k80 === n) k80 = i + 1; });
  const x80 = L + k80 / n * (W - L - 10), y80 = 10 + 0.2 * (H - B - 10);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" ${FONT} xmlns="http://www.w3.org/2000/svg">`;
  s += `<path d="M${L},${H - B} ${pts.map(p => 'L' + p.join(',')).join(' ')} L${W - 10},${H - B} Z" fill="${C.lgreen}" opacity=".6"/>`;
  s += `<polyline points="${L},${H - B} ${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${C.dgreen}" stroke-width="2.5"/>`;
  s += `<line x1="${L}" x2="${W - 10}" y1="${y80}" y2="${y80}" stroke="#8C8C8C" stroke-dasharray="4 4"/><line x1="${x80}" x2="${x80}" y1="10" y2="${H - B}" stroke="${C.red}" stroke-width="1.5"/>`;
  s += `<text x="${x80 + 6}" y="${H / 2}" font-size="12" font-weight="800" fill="${C.red}">${k80} produtos</text><text x="${x80 + 6}" y="${H / 2 + 15}" font-size="10.5" fill="${C.red}">(${pct(k80 / n, 0)} dos produtos)</text>`;
  s += `<text x="${W - 12}" y="${y80 - 5}" text-anchor="end" font-size="10" fill="#595959">80% da perda</text>`;
  [0, 50, 100].forEach(v => s += `<text x="${L - 6}" y="${10 + (1 - v / 100) * (H - B - 10) + 4}" text-anchor="end" font-size="10" fill="#595959">${v}%</text>`);
  s += `<text x="${(W + L) / 2}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#595959">produtos, do que mais perdeu para o que menos perdeu →</text>`;
  return { svg: s + '</svg>', k80 };
}

export function metaBars(linhas) {
  linhas = linhas.filter(l => l.idx >= 0.0005).sort((a, b) => b.idx - a.idx);
  const W = 760, LW = 210, RH = 30, top = 32, H = top + linhas.length * RH + 6;
  const mx = Math.max(0.0001, ...linhas.map(l => Math.max(l.idx, l.meta))), BW = (W - LW - 10) / 1.6;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" ${FONT} xmlns="http://www.w3.org/2000/svg">` +
    legend([[C.green, 'Dentro da meta'], [C.yel, 'Atenção (até 20% acima)'], [C.red, 'Acima da meta'], ['#262626', '| = meta']]);
  linhas.forEach((l, i) => {
    const y = top + i * RH, w = l.idx / mx * BW, xm = LW + l.meta / mx * BW;
    s += `<text x="${LW - 8}" y="${y + 18}" text-anchor="end" font-size="11.5" font-weight="600" fill="#262626">${esc(l.nome)}</text>`;
    s += `<rect x="${LW}" y="${y + 5}" width="${w}" height="20" fill="${l.st[0]}"/><line x1="${xm}" x2="${xm}" y1="${y + 1}" y2="${y + 29}" stroke="#262626" stroke-width="2.5"/>`;
    s += `<text x="${Math.max(LW + w, xm) + 8}" y="${y + 19}" font-size="11.5" font-weight="700" fill="#262626">R$ ${num(l.idx * 100, 2)} (meta R$ ${num(l.meta * 100, 2)})</text>`;
  });
  return s + '</svg>';
}

// Colunas por dia ou por mês (vencido + avariado empilhados)
export function columns(series, o = {}) {
  const W = 760, H = o.height || 220, L = 10, B = 34, T = 30, n = series.length || 1;
  const mx = Math.max(1, ...series.map(s => s.ven + s.ava)), bw = Math.min(46, (W - L * 2) / n * 0.7), step = (W - L * 2) / n;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" ${FONT} xmlns="http://www.w3.org/2000/svg">` + legend([[C.black, 'Vencido'], [C.green, 'Avariado']]);
  series.forEach((d, i) => {
    const x = L + i * step + (step - bw) / 2, h1 = d.ven / mx * (H - B - T - 14), h2 = d.ava / mx * (H - B - T - 14), y0 = H - B;
    s += `<rect x="${x}" y="${y0 - h1}" width="${bw}" height="${h1}" fill="${C.black}"/><rect x="${x}" y="${y0 - h1 - h2}" width="${bw}" height="${h2}" fill="${C.green}"/>`;
    if (o.values !== false) s += `<text x="${x + bw / 2}" y="${y0 - h1 - h2 - 4}" text-anchor="middle" font-size="${n > 20 ? 7.5 : 10}" font-weight="700" fill="#262626">${o.fmt ? o.fmt(d.ven + d.ava) : num((d.ven + d.ava) / 1000, 1) + ' mil'}</text>`;
    s += `<text x="${x + bw / 2}" y="${y0 + 14}" text-anchor="middle" font-size="${n > 20 ? 8 : 10.5}" fill="#404040">${esc(d.label)}</text>`;
  });
  return s + `<line x1="${L}" x2="${W - L}" y1="${H - B}" y2="${H - B}" stroke="#BFBFBF"/></svg>`;
}
