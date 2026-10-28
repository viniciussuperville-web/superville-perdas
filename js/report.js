// Seções do painel e do relatório de fechamento (mesmo conteúdo na tela e no PDF)
import { num, brl, pct, esc, qfmt, consolidate, group, sum, kpiVenda, mixInfo } from './core.js';
import { hbar, donut, pareto, metaBars, columns, C } from './charts.js';
import { MESES, AC_SEGS, FR_SEGS, REF, QUEBRA, MEDIA_LOJA, LOJA } from './config.js';

export const ler = t => `<div class="ler"><b>Como ler:</b> ${t}</div>`;
const kpi = (l, v, s = '', cls = '') => `<div class="kpi ${cls}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
const vp = (v, t) => v ? `${brl(v)}<br><span class="p">${t ? pct(v / t, 0) : '-'}</span>` : '-';
const u = unit => `<span class="u ${unit}">${unit}</span>`;

export function ctxOf(rows, mes, vendas) {
  const [y, m] = mes.split('-');
  const tot = sum(rows), ven = sum(rows.filter(x => x.tipo === 'VENCIDO'));
  return { rows, mes, mesNome: MESES[+m], label: `${MESES[+m]}/${y}`, tot, ven, ava: tot - ven, kg: sum(rows, x => x.kg), un: sum(rows, x => x.un),
    cons: consolidate(rows), bymix: group(rows, 'mix'), byger: group(rows, 'ger').filter(([k]) => k !== '—'), byenc: group(rows, 'enc').filter(([k]) => k !== '—'), vendas };
}

export function secResumo(c) {
  const k = c.vendas ? kpiVenda(c.rows, c.vendas) : null;
  const top2 = c.bymix.slice(0, 2).reduce((s, [, a]) => s + a.tot, 0);
  let h = '<div class="kpis">' + kpi('Quanto perdemos', brl(c.tot, 0), `${num(c.rows.length)} registros no mês`, 'red') +
    kpi('Vencido', brl(c.ven, 0), `${pct(c.ven / c.tot)} da perda`, 'dark') + kpi('Avariado', brl(c.ava, 0), `${pct(c.ava / c.tot)} da perda`) +
    kpi('Por quilo', num(c.kg) + ' kg', 'produtos pesados na balança') + kpi('Por unidade', num(c.un) + ' un', 'produtos contados um a um', 'dark') + '</div>';
  let frase = `Em ${c.mesNome.toLowerCase()} a loja perdeu <b>${brl(c.tot, 0)}</b> em produtos. `;
  if (k && k.vt) frase += `Isso é <b>${pct(c.tot / k.vt, 2)}</b> de tudo o que vendemos (meta: até ${num(MEDIA_LOJA * QUEBRA, 2)}%). `;
  frase += `De cada <b>R$ 100</b> perdidos, <b>R$ ${num(c.ven / c.tot * 100)}</b> foram de produtos que <b>venceram</b> e <b>R$ ${num(c.ava / c.tot * 100)}</b> de produtos que <b>estragaram</b>.`;
  h += `<div class="big">${frase}</div>`;
  if (c.bymix.length >= 2) h += `<h2>O mais importante</h2><div class="hl"><ul>
    <li><b>${esc(c.bymix[0][0])}</b> e <b>${esc(c.bymix[1][0])}</b> são os setores que mais perdem: juntos, <b>${pct(top2 / c.tot, 0)}</b> da perda (de cada R$ 100, R$ ${num(top2 / c.tot * 100)}).</li>
    <li>O produto que mais deu perda foi <b>${esc(c.cons[0].desc)}</b>: ${brl(c.cons[0].tot)}.</li>
    <li>Foram <b>${num(c.cons.length)}</b> produtos diferentes com perda no mês.</li></ul></div>`;
  h += `<div class="row"><div class="col" style="flex:1.75"><h2>Perda por gerente</h2>${hbar(c.byger, c.tot, { labelWidth: 150, width: 560 })}
    ${ler('cada barra é um gerente. Preto = venceu, verde = estragou. O número dentro mostra a divisão entre os dois.')}</div>
    <div class="col" style="flex:1"><h2>Venceu ou estragou?</h2><div class="center">${donut([['Vencido', c.ven, C.black], ['Avariado', c.ava, C.green]], [brl(c.tot / 1000, 1) + ' mil', 'perda do mês'])}</div>
    <div class="leg2"><span class="sem" style="background:${C.black}"></span><b>Vencido</b> ${pct(c.ven / c.tot, 0)} · ${brl(c.ven, 0)}<br>
    <span class="sem" style="background:${C.green}"></span><b>Avariado</b> ${pct(c.ava / c.tot, 0)} · ${brl(c.ava, 0)}</div></div></div>`;
  return h;
}

export const secGlossario = () => '<h2>Entenda as palavras deste relatório</h2><div class="glos">' + [
  ['Perda', 'produto que saiu da loja sem ser vendido. O valor é o que pagamos por ele (custo).'], ['Vencido', 'produto que passou da data de validade.'],
  ['Avariado', 'produto que estragou, quebrou, amassou ou ficou impróprio para venda.'], ['Setor', 'a área da loja e a equipe responsável (ex.: Açougue, Corredor 1).'],
  ['kg e un', 'kg = produtos vendidos por quilo; un = produtos vendidos por unidade.'], ['Meta', 'o máximo de perda aceitável para cada setor, em % da venda.'],
].map(([a, b]) => `<div><b>${a}:</b> ${b}</div>`).join('') + '</div>';

export const secRanking = c => '<h2>Ranking dos setores — os 12 que mais perderam</h2>' + hbar(c.bymix.slice(0, 12), c.tot) +
  ler('cada barra é um setor, do que mais perdeu para o que menos perdeu. <b>Preto</b> = venceu, <b>verde</b> = estragou; a porcentagem dentro da barra mostra quanto é cada parte. No fim da barra: o valor perdido e quanto ele é de toda a perda da loja. Embaixo do nome: a quantidade perdida.');

export function secTabela(c) {
  let h = '<h2>Tabela completa dos setores</h2><table><tr><th>Setor</th><th>Encarregado · Gerente</th><th class="n">Vencido</th><th class="n">Avariado</th><th class="n">Total</th><th class="n">% da loja</th><th class="n">Quantidade</th></tr>';
  for (const [k, a] of c.bymix) { const i = mixInfo(k);
    h += `<tr><td><b>${esc(k)}</b></td><td>${esc(i.enc)} · ${esc(i.ger)}</td><td class="n">${vp(a.ven, a.tot)}</td><td class="n">${vp(a.ava, a.tot)}</td><td class="n"><b>${brl(a.tot)}</b></td><td class="n"><b>${pct(a.tot / c.tot)}</b></td><td class="n">${qfmt(a.un, a.kg)}</td></tr>`; }
  return h + `<tr class="tot"><td>TOTAL DA LOJA</td><td></td><td class="n">${brl(c.ven)}</td><td class="n">${brl(c.ava)}</td><td class="n">${brl(c.tot)}</td><td class="n">100%</td><td class="n">${qfmt(c.un, c.kg)}</td></tr></table>
    <div class="small">A porcentagem embaixo de cada valor mostra quanto daquele setor foi vencido e quanto foi avariado.</div>`;
}

export const secDemais = c => '<h2>Os demais setores lado a lado (sem Açougue, Frios e Pães)</h2>' +
  hbar(c.bymix.filter(([k]) => !['Açougue e Peixaria', 'Frios e Laticínios', 'Pães e Bolos'].includes(k)).slice(0, 14), c.tot) +
  ler('Açougue, Frios e Pães perdem muito mais que os outros e "esmagariam" este gráfico. Aqui eles ficam de fora para dar para comparar os setores menores entre si. A porcentagem no fim da barra continua sendo sobre a perda de toda a loja.');

export function secSeg(c, mix, withKpis = true) {
  const rr = c.rows.filter(x => x.mix === mix), segs = mix === 'Açougue e Peixaria' ? AC_SEGS : FR_SEGS;
  const tot = sum(rr), ven = sum(rr.filter(x => x.tipo === 'VENCIDO')), ava = tot - ven, kg = sum(rr, x => x.kg), un = sum(rr, x => x.un), vkg = sum(rr.filter(x => x.pes === 'kg'));
  if (!rr.length) return `<div class="note">Sem perdas registradas em ${esc(mix)} neste mês.</div>`;
  const g = new Map(group(rr, 'seg')); const items = segs.filter(s => g.has(s)).map(s => [s, g.get(s)]).sort((a, b) => b[1].tot - a[1].tot);
  let h = withKpis ? '<div class="kpis">' + kpi('Perda do setor', brl(tot, 0), `${pct(tot / c.tot)} de toda a perda da loja`) + kpi('Vencido', brl(ven, 0), pct(ven / tot) + ' do setor', 'dark') +
    kpi('Avariado', brl(ava, 0), pct(ava / tot) + ' do setor') + kpi('Produtos por quilo', num(kg, 1) + ' kg', `R$ ${num(kg ? vkg / kg : 0, 2)} por kg perdido`) +
    kpi('Produtos por unidade', num(un) + ' un', brl(tot - vkg, 0) + ' em valor', 'dark') + '</div>' : '';
  h += '<h2>Perda por tipo de produto</h2>' + hbar(items, tot) +
    ler('cada barra é um tipo de produto. A parte <b>preta</b> é o que venceu e a <b>verde</b> é o que estragou; o número dentro da barra é quanto cada parte representa daquele tipo. No fim da barra: o valor perdido e quanto ele é do setor. Embaixo do nome: a quantidade perdida (un = unidades, kg = quilos).');
  h += '<h2>Tabela do setor</h2><table><tr><th>Tipo de produto</th><th class="n">Vencido</th><th class="n">Avariado</th><th class="n">Total</th><th class="n">% do setor</th><th class="n">Unidades</th><th class="n">Quilos</th><th class="n">R$ por kg</th></tr>';
  for (const [s, a] of items) h += `<tr><td><b>${esc(s)}</b></td><td class="n">${vp(a.ven, a.tot)}</td><td class="n">${vp(a.ava, a.tot)}</td><td class="n"><b>${brl(a.tot)}</b></td><td class="n">${pct(a.tot / tot)}</td><td class="n">${a.un ? num(a.un) : '-'}</td><td class="n">${a.kg ? num(a.kg, 1) : '-'}</td><td class="n">${a.kg ? brl(a.vkg / a.kg) : '-'}</td></tr>`;
  return h + `<tr class="tot"><td>TOTAL</td><td class="n">${brl(ven)}</td><td class="n">${brl(ava)}</td><td class="n">${brl(tot)}</td><td class="n">100%</td><td class="n">${num(un)}</td><td class="n">${num(kg, 1)}</td><td class="n">${brl(kg ? vkg / kg : 0)}</td></tr></table>`;
}

export function tblItems(items, o = {}) {
  let h = `<table><tr><th>#</th><th>Produto</th>${o.mix !== false ? '<th>Setor</th>' : ''}<th class="n">Quanto perdeu</th><th class="n">Vencido</th><th class="n">Avariado</th><th class="n">Total</th>${o.total ? '<th class="n">% do total</th>' : ''}<th class="n">Vezes</th></tr>`;
  items.forEach((a, i) => { h += `<tr><td>${(o.start || 1) + i}</td><td>${esc(a.desc)}</td>${o.mix !== false ? `<td>${esc(a.mix)}</td>` : ''}<td class="n">${num(a.q, a.unit === 'kg' ? 1 : 0)} ${u(a.unit)}</td>
    <td class="n">${a.ven ? brl(a.ven) : '-'}</td><td class="n">${a.ava ? brl(a.ava) : '-'}</td><td class="n"><b>${brl(a.tot)}</b></td>${o.total ? `<td class="n">${pct(a.tot / o.total)}</td>` : ''}<td class="n">${a.n}</td></tr>`; });
  return h + '</table>';
}

export function tblTipo(cons, key, unit, n = 12) {
  const lst = cons.filter(a => a[key] > 0 && a.unit === unit).sort((a, b) => b[key] - a[key]).slice(0, n);
  let h = '<table><tr><th>#</th><th>Produto</th><th>Setor</th><th class="n">Quanto perdeu</th><th class="n">Valor</th></tr>';
  lst.forEach((a, i) => { const q = key === 'ven' ? a.qv : a.qa; h += `<tr><td>${i + 1}</td><td>${esc(a.desc)}</td><td>${esc(a.mix)}</td><td class="n">${num(q, unit === 'kg' ? 1 : 0)} ${u(unit)}</td><td class="n"><b>${brl(a[key])}</b></td></tr>`; });
  if (!lst.length) h += '<tr><td colspan="5" class="small">Nenhum produto neste grupo no mês.</td></tr>';
  return h + '</table>';
}

export function secTop(c) {
  const p = pareto(c.cons);
  return `<div class="big">Poucos produtos causam quase toda a perda: <b>${p.k80}</b> produtos, de ${num(c.cons.length)}, somam <b>80%</b> de tudo o que perdemos. É neles que vale agir primeiro.</div>` +
    p.svg + ler('a linha verde soma a perda dos produtos, começando pelo que mais perdeu. Onde ela cruza a linha tracejada de 80% está a quantidade de produtos que concentra a maior parte da perda.') +
    '<h2>Top 20 produtos do mês</h2>' + tblItems(c.cons.slice(0, 20), { total: c.tot }) +
    `<div class="small">${u('kg')} vendido por quilo · ${u('un')} vendido por unidade · "Vezes" = quantas vezes o produto foi recolhido no mês.</div>`;
}

export const secUnit = (c, unit) => `<h2>Os que mais <u>venceram</u></h2>${tblTipo(c.cons, 'ven', unit)}<h2>Os que mais <u>estragaram</u> (avariados)</h2>${tblTipo(c.cons, 'ava', unit)}`;

export function secRepetidos(c) {
  const both = c.cons.filter(a => a.ven > 0 && a.ava > 0).slice(0, 15);
  const freq = c.cons.filter(a => a.n >= 3).sort((a, b) => b.n - a.n || b.tot - a.tot).slice(0, 15);
  return '<h2>Venceram E estragaram no mesmo mês</h2>' + (both.length ? tblItems(both) : '<div class="small">Nenhum.</div>') +
    ler('produto que aparece nos dois lados pode estar sendo pedido demais (vence) e também mal armazenado ou manuseado (estraga).') +
    '<h2>Recolhidos 3 vezes ou mais no mês</h2>' + (freq.length ? tblItems(freq) : '<div class="small">Nenhum.</div>') +
    ler('"Vezes" é quantas vezes o produto foi recolhido. Produto que volta sempre é candidato a reduzir pedido ou mudar a exposição.');
}

export function secEvolucao(c) {
  const dias = {}; c.rows.forEach(x => { const d = dias[x.data] ||= { ven: 0, ava: 0 }; d[x.tipo === 'VENCIDO' ? 'ven' : 'ava'] += x.valor; });
  const ks = Object.keys(dias).sort();
  if (ks.length < 2) return '';
  const ser = ks.map(k => ({ label: k.slice(8, 10) + '/' + k.slice(5, 7), ...dias[k] }));
  const dow = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'], sem = dow.map(l => ({ label: l, ven: 0, ava: 0 }));
  ks.forEach(k => { const d = new Date(k + 'T12:00:00').getDay(); sem[d].ven += dias[k].ven; sem[d].ava += dias[k].ava; });
  return '<h2>Perda dia a dia</h2>' + columns(ser, { fmt: v => num(v / 1000, 1) + 'k' }) + ler('cada coluna é um dia em que o relatório foi enviado. Preto = venceu, verde = estragou. O número em cima é o total do dia, em milhares de reais (k = mil).') +
    '<h2>Por dia da semana</h2>' + columns(sem, { height: 190 }) + ler('soma da perda de cada dia da semana no mês. Ajuda a ver em que dias a perda costuma ser maior.');
}

export function secVenda(c) {
  if (!c.vendas) return '<div class="note"><b>Aguardando as vendas do mês.</b> Quando as vendas forem enviadas (aba Importar), esta parte mostra, setor por setor, quanto perdemos de cada R$ 100 vendidos, com a meta e um sinal de cor: <span class="sem" style="background:#3BB072"></span>dentro da meta, <span class="sem" style="background:#F2B705"></span>atenção, <span class="sem" style="background:#D64545"></span>acima da meta.</div>';
  const k = kpiVenda(c.rows, c.vendas);
  let h = `<div class="big">Em ${c.mesNome.toLowerCase()} vendemos <b>${brl(k.vt, 0)}</b> e perdemos <b>${brl(k.pt, 0)}</b>: de cada <b>R$ 100</b> vendidos, perdemos <b>R$ ${num(k.pt / k.vt * 100, 2)}</b> (meta: até R$ ${num(MEDIA_LOJA * QUEBRA, 2)}). A perda consumiu <b>${pct(k.pt / k.lt)}</b> do lucro bruto da loja (${brl(k.lt, 0)}).</div>`;
  h += '<h2>De cada R$ 100 vendidos, quanto cada setor perdeu</h2>' + metaBars(k.linhas) +
    ler('cada barra mostra quanto o setor perdeu para cada R$ 100 que vendeu. O tracinho preto é a meta. Barra <b>verde</b> = dentro da meta; <b>amarela</b> = um pouco acima; <b>vermelha</b> = acima da meta. Setores sem registro de perda neste controle (ex.: Hortifruti) não aparecem no gráfico.');
  return h;
}

export function secVendaTabela(c) {
  if (!c.vendas) return '';
  const k = kpiVenda(c.rows, c.vendas);
  let h = `<h2>Tabela de perda x venda — ${esc(c.vendas.periodo)}</h2><table><tr><th>Setor</th><th class="n">Vendemos</th><th class="n">Lucro bruto</th><th class="n">Perdemos</th><th class="n">De cada R$ 100<br>vendidos, perdemos</th><th class="n">Meta</th><th>Sinal</th><th class="n">A perda "comeu"<br>do lucro</th></tr>`;
  for (const l of k.linhas) h += `<tr><td><b>${l.nome}</b></td><td class="n">${brl(l.v, 0)}</td><td class="n">${brl(l.lb, 0)}</td><td class="n">${brl(l.p, 0)}</td><td class="n"><b>R$ ${num(l.idx * 100, 2)}</b></td><td class="n">R$ ${num(l.meta * 100, 2)}</td><td><span class="sem" style="background:${l.st[0]}"></span>${l.st[1]}</td><td class="n"><b>${pct(l.lb ? l.p / l.lb : 0)}</b></td></tr>`;
  return h + `<tr class="tot"><td>LOJA (todos os setores)</td><td class="n">${brl(k.vt, 0)}</td><td class="n">${brl(k.lt, 0)}</td><td class="n">${brl(k.pt, 0)}</td><td class="n">R$ ${num(k.pt / k.vt * 100, 2)}</td><td class="n">R$ ${num(MEDIA_LOJA * QUEBRA, 2)}</td><td></td><td class="n">${pct(k.pt / k.lt)}</td></tr></table>` +
    ler('"Lucro bruto" é o que sobra da venda depois de pagar o produto. "A perda comeu do lucro" mostra quanto desse lucro foi embora com a perda. Vendas e lucro: relatório Rentabilidade de Vendas do sistema; perda a preço de custo.');
}

export function secMetas() {
  let h = '<h2>Metas por setor</h2><table><tr><th>Setor</th><th class="n">Média do mercado (todas as perdas)</th><th class="n">Nossa meta (vencido + avariado)</th><th class="n">Em reais: de cada R$ 100 vendidos, perder no máximo</th></tr>';
  for (const [nome, , media] of REF) h += `<tr><td>${nome}</td><td class="n">${num(media, 2)}%</td><td class="n"><b>${num(media * QUEBRA, 2)}%</b></td><td class="n">R$ ${num(media * QUEBRA, 2)}</td></tr>`;
  return h + `<tr class="tot"><td>Loja</td><td class="n">${num(MEDIA_LOJA, 2)}%</td><td class="n">${num(MEDIA_LOJA * QUEBRA, 2)}%</td><td class="n">R$ ${num(MEDIA_LOJA * QUEBRA, 2)}</td></tr></table>` +
    ler('a "média do mercado" é a perda média dos supermercados do Brasil (ABRAS). Ela inclui furtos e erros de estoque; como aqui só contamos vencidos e avariados, a nossa meta é 62% dessa média — a parte das perdas que vem de vencidos e avariados (ABRAS, dados de 2025).');
}

// --------- documento para impressão / PDF ---------
const header = (t, sub, tag) => `<div class="hd"><img src="img/logo.png"><div><h1>${esc(t)}</h1><div class="sub">${esc(sub)}</div></div><div class="tag">${tag}</div></div>`;
function doc(pages, label, title) {
  const body = pages.map((p, i) => `<div class="page">${p}<div class="foot"><span>SuperVille · Controladoria · ${esc(label)}</span><span>Página ${i + 1}</span></div></div>`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title><base href="${location.href.replace(/[^/]*$/, '')}"><link rel="stylesheet" href="css/report.css"></head>
  <body><div class="toolbar"><button onclick="window.print()">Salvar em PDF / Imprimir</button><span>Na janela de impressão, escolha "Salvar como PDF" e ative "Gráficos de fundo".</span></div>${body}</body></html>`;
}
const today = () => new Date().toLocaleDateString('pt-BR');

export function reportGeral(c) {
  const tag = `FECHAMENTO DE PERDAS<br><span>Gerado em ${today()}</span>`, sub = `${c.label} · ${LOJA.nome}`;
  const P = [];
  P.push(header('Fechamento de Perdas', sub, tag) + secResumo(c) + secGlossario());
  P.push(header('Onde perdemos mais', sub, tag) + secRanking(c));
  P.push(header('Todos os setores', sub, tag) + secTabela(c));
  P.push(header('Setores menores', sub, tag) + secDemais(c));
  for (const mix of ['Açougue e Peixaria', 'Frios e Laticínios']) { const i = mixInfo(mix); P.push(header(mix, `${c.label} · Encarregado: ${i.enc} · Gerente: ${i.ger}`, tag) + secSeg(c, mix)); }
  const ev = secEvolucao(c); if (ev) P.push(header('Perda dia a dia', sub, tag) + ev);
  P.push(header('Produtos que mais deram perda', `${c.label} · todos juntos (quilo e unidade)`, tag) + secTop(c));
  for (const [unit, nome] of [['kg', 'vendidos por quilo (kg)'], ['un', 'vendidos por unidade (un)']]) {
    const lst = c.cons.filter(a => a.unit === unit), tu = lst.reduce((s, a) => s + a.tot, 0);
    P.push(header(`Produtos ${nome}`, `${c.label} · ${num(lst.length)} produtos · ${brl(tu, 0)} (${pct(tu / c.tot)} da perda)`, tag) + secUnit(c, unit));
  }
  P.push(header('Produtos que se repetem', `${c.label} · sinais de problema no pedido, na exposição ou no manuseio`, tag) + secRepetidos(c));
  if (c.vendas) { P.push(header('Perda x Venda', sub, tag) + secVenda(c)); P.push(header('Perda x Venda e metas', sub, tag) + secVendaTabela(c)); P.push(header('Metas', sub, tag) + secMetas()); }
  else P.push(header('Perda x Venda e metas', sub, tag) + secVenda(c) + secMetas());
  return doc(P, `Fechamento de Perdas ${c.label}`, `Fechamento de Perdas ${c.label}`);
}

export function reportSetor(c, key, val, titulo) {
  const rr = c.rows.filter(x => x[key] === val), cs = ctxOf(rr, c.mes, null);
  const enc = [...new Set(rr.map(x => x.enc))].join(', '), ger = [...new Set(rr.map(x => x.ger))].join(', ');
  const tag = `RELATÓRIO DO SETOR<br><span>Gerado em ${today()}</span>`, sub = `${c.label} · Loja 1 · Encarregado: ${enc} · Gerente: ${ger}`;
  const P = [];
  let p1 = header(titulo, sub, tag);
  if (key === 'mix' && (val === 'Açougue e Peixaria' || val === 'Frios e Laticínios')) p1 += secSeg(c, val);
  else {
    p1 += '<div class="kpis">' + kpi('Perda', brl(cs.tot, 0), `${pct(cs.tot / c.tot)} da loja`, 'red') + kpi('Vencido', brl(cs.ven, 0), pct(cs.ven / cs.tot), 'dark') +
      kpi('Avariado', brl(cs.ava, 0), pct(cs.ava / cs.tot)) + kpi('Por quilo', num(cs.kg, 1) + ' kg') + kpi('Por unidade', num(cs.un) + ' un', '', 'dark') + '</div>';
    const g = key === 'mix' ? group(rr.map(x => ({ ...x, sec: x.cod.split('/').slice(0, 2).join('/') || '—' })), 'sec') : group(rr, 'mix');
    p1 += `<h2>${key === 'mix' ? 'Por grupo de produto (departamento/seção do sistema)' : 'Por setor'}</h2>` + hbar(g.slice(0, 12), cs.tot) + ler('preto = venceu, verde = estragou; % dentro da barra = divisão entre os dois; no fim, o valor e a % do total.');
  }
  p1 += `<div class="big">De cada <b>R$ 100</b> perdidos aqui, <b>R$ ${num(cs.ven / cs.tot * 100)}</b> venceram e <b>R$ ${num(cs.ava / cs.tot * 100)}</b> estragaram. Isso responde por <b>${pct(cs.tot / c.tot)}</b> de toda a perda da loja.</div>`;
  P.push(p1);
  for (const [unit, nome] of [['kg', 'por quilo (kg)'], ['un', 'por unidade (un)']]) {
    if (!cs.cons.some(a => a.unit === unit)) continue;
    P.push(header(titulo, `${c.label} · produtos vendidos ${nome}`, tag) + `<h2>Os que mais venceram — ${nome}</h2>${tblTipo(cs.cons, 'ven', unit, 10)}<h2>Os que mais estragaram — ${nome}</h2>${tblTipo(cs.cons, 'ava', unit, 10)}`);
  }
  const CH = 30;
  for (const [unit, nome] of [['kg', 'por quilo (kg)'], ['un', 'por unidade (un)']]) {
    const lst = cs.cons.filter(a => a.unit === unit), tu = lst.reduce((s, a) => s + a.tot, 0);
    for (let i = 0; i < lst.length; i += CH) {
      let p = header(titulo, `${c.label} · lista completa — produtos ${nome} · ${lst.length} produtos · parte ${i / CH + 1}`, tag) + tblItems(lst.slice(i, i + CH), { mix: key !== 'mix', start: i + 1, total: cs.tot });
      if (i + CH >= lst.length) p += `<table style="margin-top:4px"><tr class="tot"><td>TOTAL — produtos ${nome}</td><td class="n">${brl(tu)} · ${pct(tu / cs.tot)} do total</td></tr></table>`;
      P.push(p);
    }
  }
  return { html: doc(P, `${titulo} · ${c.label}`, `${titulo} ${c.label}`), rows: rr, cons: cs.cons };
}
