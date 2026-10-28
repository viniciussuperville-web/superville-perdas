// SuperVille · Gestão de Perdas — aplicação
import { firebaseConfig, LOJA, MESES } from './config.js';
import { loadCatalog, classify, setManual, setResponsaveis, mixList, mixInfo, num, brl, pct, esc, sum, consolidate, kpiVenda } from './core.js';
import { parseTrocas, parseVendas } from './parse.js';
import * as R from './report.js';
import { columns } from './charts.js';
import { exportExcel } from './excel.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(), db = firebase.firestore();
const $ = s => document.querySelector(s);
const app = $('#app');

const state = { mes: '', tab: 'painel', imports: [], vendas: null, rows: [], user: null };
const hoje = new Date();
const mesAtual = () => `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const mesLabel = m => { const [y, mm] = m.split('-'); return `${MESES[+mm]}/${y}`; };
function mesesOpcoes() { const out = []; let y = 2025, m = 1; const [ey, em] = mesAtual().split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) { out.push(`${y}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; y++; } } return out.reverse(); }

// ---------------- autenticação ----------------
auth.onAuthStateChanged(async u => {
  state.user = u;
  if (!u) return renderLogin();
  await loadCatalog();
  await loadConfig();
  state.mes = state.mes || mesesOpcoes()[0];
  renderShell(); await loadMes();
});

function renderLogin(err = '') {
  app.innerHTML = `<div class="login"><div class="h"><img src="img/logo.png?v=2"><div><b>Gestão de Perdas</b><span>Padrão SuperVille</span></div></div><form id="lf">
    <div class="muted">Entre com seu e-mail e senha.</div>
    <label class="field">E-mail<input type="email" id="le" required autocomplete="username"></label>
    <label class="field">Senha<input type="password" id="lp" required autocomplete="current-password"></label>
    <button class="btn" type="submit">Entrar</button>${err ? `<div class="msg err">${esc(err)}</div>` : ''}</form></div>`;
  $('#lf').onsubmit = async e => { e.preventDefault();
    try { await auth.signInWithEmailAndPassword($('#le').value.trim(), $('#lp').value); } catch (x) { renderLogin('E-mail ou senha incorretos.'); } };
}

async function loadConfig() {
  const c = await db.collection('config').doc('classificacao').get(); setManual(c.exists ? c.data().map : {});
  const r = await db.collection('config').doc('responsaveis').get(); if (r.exists) setResponsaveis(r.data().map);
}

// ---------------- estrutura ----------------
const TABS = [['painel', 'Painel'], ['importar', 'Importar'], ['classificar', 'Classificar'], ['relatorios', 'Relatórios'], ['historico', 'Histórico'], ['anual', 'Anual']];
function renderShell() {
  app.innerHTML = `<div class="top"><img src="img/logo.png?v=2"><div><h1>Gestão de Perdas</h1><div class="sub">${LOJA.nome}</div></div><div class="sp"></div>
    <select id="mes">${mesesOpcoes().map(m => `<option value="${m}" ${m === state.mes ? 'selected' : ''}>${mesLabel(m)}</option>`).join('')}</select>
    <button class="btn sec" id="sair">Sair</button></div>
    <nav>${TABS.map(([k, l]) => `<a data-t="${k}" class="${state.tab === k ? 'on' : ''}">${l}</a>`).join('')}</nav><main id="main"></main>`;
  $('#mes').onchange = async e => { state.mes = e.target.value; await loadMes(); };
  $('#sair').onclick = () => auth.signOut();
  document.querySelectorAll('nav a').forEach(a => a.onclick = () => { state.tab = a.dataset.t; document.querySelectorAll('nav a').forEach(b => b.classList.toggle('on', b === a)); render(); });
}

async function loadMes() {
  $('#main').innerHTML = '<div class="empty">Carregando dados do mês…</div>';
  const q = await db.collection('imports').where('mes', '==', state.mes).get();
  state.imports = q.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.loja === LOJA.id).sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));
  const v = await db.collection('vendas').doc(`${LOJA.id}_${state.mes}`).get();
  state.vendas = v.exists ? v.data() : null;
  state.rows = state.imports.flatMap(imp => (imp.items || []).map(it => classify(it, imp)));
  render();
}

function render() {
  const m = $('#main'); if (!m) return;
  ({ painel, importar, classificar, relatorios, historico, anual })[state.tab](m);
}

// ---------------- painel ----------------
function painel(m) {
  if (!state.rows.length) { m.innerHTML = `<div class="card empty"><b>Nenhuma perda importada em ${mesLabel(state.mes)}.</b><br><br>Vá na aba <b>Importar</b> e envie os relatórios de vencidos e avariados.</div>`; return; }
  const c = R.ctxOf(state.rows, state.mes, state.vendas);
  const dias = new Set(state.rows.map(x => x.data)).size;
  m.innerHTML = `<div class="card"><div class="flex"><h2 style="margin:0">Resumo de ${mesLabel(state.mes)}</h2><span class="muted">${dias} dia(s) importado(s) · ${state.vendas ? 'vendas importadas ✔' : 'vendas do mês ainda não importadas'}</span></div>${R.secResumo(c)}</div>
    <div class="card">${R.secRanking(c)}</div>
    <div class="card">${R.secVenda(c)}${R.secVendaTabela(c)}</div>
    ${dias > 1 ? `<div class="card">${R.secEvolucao(c)}</div>` : ''}
    <div class="grid2"><div class="card"><h2>Açougue e Peixaria</h2>${R.secSeg(c, 'Açougue e Peixaria')}</div><div class="card"><h2>Frios e Laticínios</h2>${R.secSeg(c, 'Frios e Laticínios')}</div></div>
    <div class="card">${R.secDemais(c)}</div><div class="card">${R.secTabela(c)}</div>
    <div class="card"><h2>Produtos que mais deram perda</h2>${R.secTop(c)}</div>
    <div class="grid2"><div class="card"><h2>Produtos por quilo (kg)</h2>${R.secUnit(c, 'kg')}</div><div class="card"><h2>Produtos por unidade (un)</h2>${R.secUnit(c, 'un')}</div></div>
    <div class="card"><h2>Produtos que se repetem</h2>${R.secRepetidos(c)}</div><div class="card">${R.secMetas()}</div>`;
}

// ---------------- importar ----------------
function importar(m) {
  m.innerHTML = `<div class="card"><h2>Relatórios do dia — Trocas de Fornecedores</h2>
    <p class="muted">Envie o PDF de <b>vencidos</b> e o de <b>avariados</b>. A data usada é a data impressa no relatório. Se o mesmo dia for enviado de novo, ele substitui o anterior.</p>
    <label class="field" style="max-width:420px;margin-bottom:12px">Mês de referência
      <select id="refmes"><option value="">Automático — usar a data do relatório (uso diário)</option>
      ${mesesOpcoes().map(m => `<option value="${m}">${mesLabel(m)} — relatório do mês inteiro (histórico)</option>`).join('')}</select>
      <span class="muted" style="font-weight:400">Para meses passados, escolha o mês: o relatório entra no último dia daquele mês.</span></label>
    <div class="grid2"><div class="drop" data-tipo="VENCIDO"><b>Vencidos</b><span class="muted">clique ou arraste o PDF aqui</span><input type="file" accept="application/pdf" hidden multiple></div>
    <div class="drop" data-tipo="AVARIADO"><b>Avariados</b><span class="muted">clique ou arraste o PDF aqui</span><input type="file" accept="application/pdf" hidden multiple></div></div><div id="imsg"></div></div>
    <div class="card"><h2>Vendas do mês — Rentabilidade de Vendas</h2><p class="muted">Envie no início do mês o relatório do mês anterior (só a coluna Venda e o lucro bruto são usados).</p>
    <div class="drop" data-tipo="VENDAS"><b>Vendas</b><span class="muted">clique ou arraste o PDF aqui</span><input type="file" accept="application/pdf" hidden></div><div id="vmsg"></div></div>
    <div class="card"><h2>Histórico / backup (JSON)</h2><p class="muted">Para carregar meses antigos (ex.: setembro/2026 da planilha) ou restaurar um backup.</p>
    <div class="drop" data-tipo="JSON"><b>Arquivo .json</b><span class="muted">clique ou arraste aqui</span><input type="file" accept=".json,application/json" hidden></div><div id="jmsg"></div></div>`;
  m.querySelectorAll('.drop').forEach(d => {
    const inp = d.querySelector('input');
    d.onclick = () => inp.click();
    d.ondragover = e => { e.preventDefault(); d.classList.add('on'); }; d.ondragleave = () => d.classList.remove('on');
    d.ondrop = e => { e.preventDefault(); d.classList.remove('on'); handle(d.dataset.tipo, [...e.dataTransfer.files]); };
    inp.onchange = () => handle(d.dataset.tipo, [...inp.files]);
  });
}
const msg = (id, cls, html) => { const el = $(id); if (el) el.innerHTML += `<div class="msg ${cls}">${html}</div>`; };

async function handle(tipo, files) {
  for (const f of files) {
    try {
      if (tipo === 'VENDAS') {
        const v = await parseVendas(f);
        if (!v.deptos.length) throw new Error('Nenhum departamento encontrado no PDF.');
        await db.collection('vendas').doc(`${LOJA.id}_${v.mes}`).set({ loja: LOJA.id, ...v, arquivo: f.name, criadoEm: firebase.firestore.FieldValue.serverTimestamp(), criadoPor: state.user.email });
        const tot = v.deptos.find(d => d.depto === '0');
        msg('#vmsg', 'ok', `✔ Vendas de <b>${mesLabel(v.mes)}</b> (${esc(v.periodo)}) importadas: ${v.deptos.length - 1} departamentos, venda total ${brl(tot?.venda || 0)}.`);
        if (v.mes === state.mes) await loadMes(), state.tab = 'importar', render();
      } else if (tipo === 'JSON') {
        const j = JSON.parse(await f.text());
        if (j.formato !== 'superville-perdas/1') throw new Error('Arquivo JSON em formato desconhecido.');
        for (const imp of j.imports) {
          const id = `${imp.loja}_${imp.data}_${imp.tipo}`;
          await db.collection('imports').doc(id).set({ ...imp, criadoEm: firebase.firestore.FieldValue.serverTimestamp(), criadoPor: state.user.email });
          msg('#jmsg', 'ok', `✔ ${esc(imp.tipo)} de ${imp.data.split('-').reverse().join('/')}: ${imp.items.length} itens, ${brl(imp.total)}.`);
        }
        if (j.vendas) for (const v of j.vendas) await db.collection('vendas').doc(`${v.loja}_${v.mes}`).set(v);
        await loadMes(); state.tab = 'importar'; render();
      } else {
        const r = await parseTrocas(f);
        if (!r.items.length) throw new Error('Nenhum item encontrado no PDF.');
        if (r.loja && r.loja !== LOJA.id) throw new Error(`O relatório é da loja ${r.loja}; este painel é da loja ${LOJA.id}.`);
        const ref = $('#refmes')?.value;
        if (ref) { const [ry, rm] = ref.split('-').map(Number); r.data = `${ref}-${String(new Date(ry, rm, 0).getDate()).padStart(2, '0')}`; }
        const mes = r.data.slice(0, 7), id = `${LOJA.id}_${r.data}_${tipo}`;
        const ex = await db.collection('imports').doc(id).get();
        if (ex.exists && !confirm(`Já existe ${tipo.toLowerCase()} de ${r.data.split('-').reverse().join('/')} importado (${ex.data().items.length} itens). Substituir pelo novo arquivo?`)) continue;
        const items = r.items.map(({ plu, desc, cod, qtd, valor }) => ({ plu, desc, cod, qtd, valor }));
        await db.collection('imports').doc(id).set({ loja: LOJA.id, data: r.data, mes, tipo, arquivo: f.name, items, total: r.total, n: items.length,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(), criadoPor: state.user.email });
        const conf = r.totalRelatorio != null && Math.abs(r.totalRelatorio - r.total) > 0.5 ? ` <b>Atenção:</b> o total do relatório é ${brl(r.totalRelatorio)}.` : ' Total confere com o relatório.';
        const semMix = items.filter(it => classify(it, { data: r.data, mes, tipo }).mix === 'A CLASSIFICAR').length;
        msg('#imsg', 'ok', `✔ <b>${tipo === 'VENCIDO' ? 'Vencidos' : 'Avariados'}</b> de ${r.data.split('-').reverse().join('/')}: ${items.length} itens, ${brl(r.total)}.${conf}${semMix ? ` ${semMix} item(ns) sem setor — veja a aba <b>Classificar</b>.` : ''}`);
        if (mes !== state.mes) { state.mes = mes; renderShell(); }
        await loadMes(); state.tab = 'importar'; renderShellTabs(); render();
      }
    } catch (e) { console.error(e); msg(tipo === 'VENDAS' ? '#vmsg' : tipo === 'JSON' ? '#jmsg' : '#imsg', 'err', `✖ ${esc(f.name)}: ${esc(e.message)}`); }
  }
}
function renderShellTabs() { document.querySelectorAll('nav a').forEach(b => b.classList.toggle('on', b.dataset.t === state.tab)); const s = $('#mes'); if (s) s.value = state.mes; }

// ---------------- classificar ----------------
function classificar(m) {
  const pend = consolidate(state.rows.filter(x => x.mix === 'A CLASSIFICAR'));
  if (!pend.length) { m.innerHTML = `<div class="card empty">✔ Todos os itens de ${mesLabel(state.mes)} já têm setor.</div>`; return; }
  const opts = mixList().map(n => `<option>${esc(n)}</option>`).join('');
  m.innerHTML = `<div class="card"><h2>Itens sem setor em ${mesLabel(state.mes)}</h2><p class="muted">Escolha o setor de cada item e clique em Salvar. A escolha vale para os próximos meses também.</p>
    <table><tr><th>PLU</th><th>Produto</th><th>Depto/Seção</th><th class="n">Valor</th><th>Setor</th></tr>
    ${pend.map(a => `<tr><td>${esc(a.plu)}</td><td>${esc(a.desc)}</td><td>${esc(state.rows.find(x => x.plu === a.plu)?.cod || '')}</td><td class="n">${brl(a.tot)}</td><td><select data-plu="${esc(a.plu)}"><option value="">— escolher —</option>${opts}</select></td></tr>`).join('')}</table>
    <div class="flex" style="margin-top:12px"><button class="btn" id="salvar">Salvar classificação</button><span id="cmsg"></span></div></div>`;
  $('#salvar').onclick = async () => {
    const map = {}; m.querySelectorAll('select[data-plu]').forEach(s => { if (s.value) map[s.dataset.plu] = s.value; });
    if (!Object.keys(map).length) return;
    const ref = db.collection('config').doc('classificacao'); const cur = (await ref.get()).data()?.map || {};
    await ref.set({ map: { ...cur, ...map } }); setManual({ ...cur, ...map });
    state.rows = state.imports.flatMap(imp => imp.items.map(it => classify(it, imp))); render();
  };
}

// ---------------- relatórios ----------------
function relatorios(m) {
  if (!state.rows.length) { m.innerHTML = `<div class="card empty">Sem dados em ${mesLabel(state.mes)}.</div>`; return; }
  const mixes = [...new Set(state.rows.map(x => x.mix))].sort(), gers = [...new Set(state.rows.map(x => x.ger).filter(Boolean))].sort(), encs = [...new Set(state.rows.map(x => x.enc).filter(Boolean))].sort();
  m.innerHTML = `<div class="card"><h2>Fechamento do mês — loja inteira</h2><p class="muted">Relatório completo para o proprietário: resumo, setores, Açougue e Frios, produtos por quilo e por unidade, perda x venda e metas.</p>
    <div class="flex"><button class="btn" id="rg">Abrir fechamento (PDF)</button><button class="btn out" id="xg">Baixar Excel da loja</button></div>
    ${state.vendas ? '' : '<div class="msg info">As vendas deste mês ainda não foram importadas — a parte de perda x venda vai sair como "aguardando".</div>'}</div>
    <div class="card"><h2>Relatório de um setor, gerente ou encarregado</h2><p class="muted">Com gráficos, os produtos que mais venceram e estragaram (quilo e unidade separados) e a lista completa dos produtos do mês.</p>
    <div class="flex"><label class="field">Tipo<select id="rk"><option value="mix">Setor</option><option value="ger">Gerente</option><option value="enc">Encarregado</option></select></label>
    <label class="field">Qual<select id="rv"></select></label><button class="btn" id="rs" style="align-self:flex-end">Abrir relatório (PDF)</button><button class="btn out" id="xs" style="align-self:flex-end">Baixar Excel</button></div></div>`;
  const fill = () => { const k = $('#rk').value, l = k === 'mix' ? mixes : k === 'ger' ? gers : encs; $('#rv').innerHTML = l.map(v => `<option>${esc(v)}</option>`).join(''); };
  $('#rk').onchange = fill; fill();
  const c = () => R.ctxOf(state.rows, state.mes, state.vendas);
  const open = html => { const w = window.open('', '_blank'); if (!w) return alert('Libere as janelas pop-up deste site para abrir o relatório.'); w.document.open(); w.document.write(html); w.document.close(); };
  $('#rg').onclick = () => open(R.reportGeral(c()));
  $('#xg').onclick = () => { const cc = c(); exportExcel('Loja 1', mesLabel(state.mes), cc.cons, state.rows); };
  const titulo = () => { const k = $('#rk').value, v = $('#rv').value; return k === 'mix' ? v : k === 'ger' ? `Gerente ${v}` : `Encarregado ${v}`; };
  $('#rs').onclick = () => open(R.reportSetor(c(), $('#rk').value, $('#rv').value, titulo()).html);
  $('#xs').onclick = () => { const r = R.reportSetor(c(), $('#rk').value, $('#rv').value, titulo()); exportExcel(titulo(), mesLabel(state.mes), r.cons, r.rows); };
}

// ---------------- histórico ----------------
function historico(m) {
  m.innerHTML = `<div class="card"><h2>Relatórios importados em ${mesLabel(state.mes)}</h2>
    ${state.imports.length ? `<table><tr><th>Data</th><th>Tipo</th><th>Arquivo</th><th class="n">Itens</th><th class="n">Total</th><th>Enviado por</th><th></th></tr>
    ${state.imports.map(i => `<tr><td>${i.data.split('-').reverse().join('/')}</td><td>${i.tipo}</td><td>${esc(i.arquivo || '')}</td><td class="n">${num(i.items.length)}</td><td class="n">${brl(i.total)}</td><td>${esc(i.criadoPor || '')}</td><td><button class="btn red" data-del="${esc(i.id)}">Excluir</button></td></tr>`).join('')}
    <tr class="tot"><td colspan="3">TOTAL DO MÊS</td><td class="n">${num(state.imports.reduce((s, i) => s + i.items.length, 0))}</td><td class="n">${brl(state.imports.reduce((s, i) => s + i.total, 0))}</td><td colspan="2"></td></tr></table>` : '<div class="empty">Nada importado neste mês.</div>'}
    <p class="muted">Se o mês não bater com os relatórios do sistema, exclua os dias e envie de novo na aba Importar — tudo é recalculado.</p>
    <div class="flex"><button class="btn out" id="bk">Baixar backup do mês (JSON)</button></div></div>
    <div class="card"><h2>Vendas do mês</h2>${state.vendas ? `<p>${esc(state.vendas.periodo)} · venda total ${brl(state.vendas.deptos.find(d => d.depto === '0')?.venda || 0)} · arquivo ${esc(state.vendas.arquivo || '')}</p>` : '<p class="muted">Não importadas.</p>'}</div>`;
  m.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Excluir este relatório importado? Os números do mês serão recalculados.')) return;
    await db.collection('imports').doc(b.dataset.del).delete(); await loadMes(); state.tab = 'historico'; render(); });
  $('#bk').onclick = () => {
    const j = { formato: 'superville-perdas/1', loja: LOJA.id, imports: state.imports.map(({ id, criadoEm, ...i }) => i), vendas: state.vendas ? [(({ criadoEm, ...v }) => v)(state.vendas)] : [] };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(j)], { type: 'application/json' })); a.download = `backup_perdas_${state.mes}.json`; a.click();
  };
}

// ---------------- anual ----------------
async function anual(m) {
  const ano = state.mes.slice(0, 4);
  m.innerHTML = '<div class="empty">Carregando o ano…</div>';
  const q = await db.collection('imports').where('mes', '>=', `${ano}-01`).where('mes', '<=', `${ano}-12`).get();
  const vq = await db.collection('vendas').where('loja', '==', LOJA.id).get();
  const vend = {}; vq.docs.forEach(d => vend[d.data().mes] = d.data());
  const meses = {}; q.docs.map(d => d.data()).filter(i => i.loja === LOJA.id).forEach(i => { const x = meses[i.mes] ||= { ven: 0, ava: 0 }; x[i.tipo === 'VENCIDO' ? 'ven' : 'ava'] += i.total; });
  const ks = Object.keys(meses).sort();
  if (!ks.length) { m.innerHTML = `<div class="card empty">Sem dados em ${ano}.</div>`; return; }
  const tv = ks.reduce((s, k) => s + meses[k].ven, 0), ta = ks.reduce((s, k) => s + meses[k].ava, 0);
  m.innerHTML = `<div class="card"><h2>Perdas de ${ano}, mês a mês</h2>
    <div class="kpis">${[['Perda no ano', brl(tv + ta, 0), `${ks.length} mês(es) com dados`, 'red'], ['Vencido', brl(tv, 0), pct(tv / (tv + ta)), 'dark'], ['Avariado', brl(ta, 0), pct(ta / (tv + ta)), ''], ['Média por mês', brl((tv + ta) / ks.length, 0), '', ''], ['Projeção 12 meses', brl((tv + ta) / ks.length * 12, 0), 'se a média se mantiver', 'dark']]
      .map(([l, v, s, c]) => `<div class="kpi ${c}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('')}</div>
    <h2>Evolução</h2>${columns(ks.map(k => ({ label: MESES[+k.slice(5)].slice(0, 3), ...meses[k] })))}
    ${R.ler('cada coluna é um mês. Preto = venceu, verde = estragou. O número em cima é o total do mês em milhares de reais.')}
    <h2>Tabela</h2><table><tr><th>Mês</th><th class="n">Vencido</th><th class="n">Avariado</th><th class="n">Total</th><th class="n">Venda</th><th class="n">De cada R$ 100 vendidos</th><th class="n">Variação</th></tr>
    ${ks.map((k, i) => { const t = meses[k].ven + meses[k].ava, v = vend[k]?.deptos?.find(d => d.depto === '0')?.venda, prev = i ? meses[ks[i - 1]].ven + meses[ks[i - 1]].ava : null;
      return `<tr><td><b>${mesLabel(k)}</b></td><td class="n">${brl(meses[k].ven)}</td><td class="n">${brl(meses[k].ava)}</td><td class="n"><b>${brl(t)}</b></td><td class="n">${v ? brl(v, 0) : '-'}</td><td class="n">${v ? 'R$ ' + num(t / v * 100, 2) : '-'}</td><td class="n">${prev ? (t > prev ? '▲ ' : '▼ ') + pct(Math.abs(t / prev - 1)) : '-'}</td></tr>`; }).join('')}
    <tr class="tot"><td>TOTAL</td><td class="n">${brl(tv)}</td><td class="n">${brl(ta)}</td><td class="n">${brl(tv + ta)}</td><td></td><td></td><td></td></tr></table></div>`;
}
