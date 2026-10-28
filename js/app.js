// SuperVille · Gestão de Perdas — aplicação
import { firebaseConfig, LOJA, MESES, ADMINS } from './config.js';
import { loadCatalog, classify, setManual, setResponsaveis, mixList, mixInfo, num, brl, pct, esc, sum, consolidate, kpiVenda } from './core.js';
import { parseTrocas, parseVendas } from './parse.js';
import * as R from './report.js';
import { columns, hbar } from './charts.js';
import { exportExcel } from './excel.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth(), db = firebase.firestore();
const $ = s => document.querySelector(s);
const app = $('#app');


// ---------------- atualização automática do site ----------------
export const APP_V = '14';
async function checkVersion() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    const { v } = await r.json();
    if (v && v !== APP_V && !document.querySelector('.drop.on') && !location.search.includes('v=' + v)) location.replace(location.pathname + '?v=' + v);
  } catch (e) { /* sem conexão: tenta de novo depois */ }
}
setInterval(checkVersion, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkVersion(); });
checkVersion();

const state = { mes: '', tab: 'painel', imports: [], vendas: null, rows: [], user: null };
const hoje = new Date();
const mesAtual = () => `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
const mesLabel = m => { const [y, mm] = m.split('-'); return `${MESES[+mm]}/${y}`; };
const ANO0 = 2026;
function mesesOpcoes() { const out = []; const ey = hoje.getFullYear();
  for (let y = ey; y >= ANO0; y--) for (let m = 12; m >= 1; m--) { const k = `${y}-${String(m).padStart(2, '0')}`; if (y === ey || k <= mesAtual()) out.push(k); } return out; }
const anosFechados = {};
const anoFechado = ano => anosFechados[ano]?.fechado;

// ---------------- autenticação ----------------
auth.onAuthStateChanged(async u => {
  state.user = u;
  if (!u) return renderLogin();
  await loadCatalog();
  await loadConfig();
  state.mes = state.mes || mesAtual();
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
  const a = await db.collection('config').doc('anos').get(); Object.assign(anosFechados, a.exists ? a.data().map || {} : {});
}

// ---------------- estrutura ----------------
const isAdmin = () => ADMINS.includes((state.user?.email || '').toLowerCase());
const TABS_COLAB = ['painel', 'importar', 'historico'];
const TABS = [['painel', 'Painel'], ['importar', 'Importar'], ['classificar', 'Classificar'], ['relatorios', 'Relatórios'], ['historico', 'Histórico'], ['anual', 'Anual']];
function renderShell() {
  app.innerHTML = `<div class="top"><img src="img/logo.png?v=2"><div><h1>Gestão de Perdas</h1><div class="sub">${LOJA.nome} · ${esc(state.user?.email || '')}${isAdmin() ? ' (administrador)' : ' (colaborador)'}</div></div><div class="sp"></div>
    <select id="mes">${[...new Set(mesesOpcoes().map(m => m.slice(0, 4)))].map(y => `<optgroup label="${y}${anoFechado(y) ? ' · ano fechado' : ''}">${mesesOpcoes().filter(m => m.startsWith(y)).map(m => `<option value="${m}" ${m === state.mes ? 'selected' : ''}>${mesLabel(m)}</option>`).join('')}</optgroup>`).join('')}</select>
    <button class="btn sec" id="sair">Sair</button></div>
    <nav>${TABS.filter(([k]) => isAdmin() || TABS_COLAB.includes(k)).map(([k, l]) => `<a data-t="${k}" class="${state.tab === k ? 'on' : ''}">${l}</a>`).join('')}</nav><main id="main"></main>`;
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
  if (!isAdmin() && !TABS_COLAB.includes(state.tab)) state.tab = 'importar';
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
    <p class="muted">Envie o PDF de <b>vencidos</b> e o de <b>avariados</b>. No relatório <b>com data (DT.INC)</b>, cada item entra no dia em que foi lançado — pode mandar o acumulado do mês todo dia, ele substitui sem duplicar. O relatório <b>geral</b> (vencidos + avariados juntos) também pode ir em qualquer um dos dois quadros: o site separa pelo motivo.</p>
    <label class="field" style="max-width:420px;margin-bottom:12px">Mês de referência
      <select id="refmes"><option value="">Automático — usar a data do relatório (uso diário)</option>
      ${mesesOpcoes().map(m => `<option value="${m}">${mesLabel(m)} — relatório do mês inteiro (histórico)</option>`).join('')}</select>
      <span class="muted" style="font-weight:400">Para meses passados, escolha o mês: o relatório entra no último dia daquele mês.</span></label>
    <div class="grid2"><div class="drop" data-tipo="VENCIDO"><b>Vencidos</b><span class="muted">clique ou arraste o PDF aqui</span><input type="file" accept="application/pdf" hidden multiple></div>
    <div class="drop" data-tipo="AVARIADO"><b>Avariados</b><span class="muted">clique ou arraste o PDF aqui</span><input type="file" accept="application/pdf" hidden multiple></div></div><div id="imsg"></div></div>
    ${isAdmin() ? `    <div class="card"><h2>Vendas do mês — Rentabilidade de Vendas</h2><p class="muted">Envie no início do mês o relatório do mês anterior (só a coluna Venda e o lucro bruto são usados).</p>
    <div class="drop" data-tipo="VENDAS"><b>Vendas</b><span class="muted">clique ou arraste o PDF aqui</span><input type="file" accept="application/pdf" hidden></div><div id="vmsg"></div></div>` : ''}
    ${isAdmin() ? `    <div class="card"><h2>Histórico / backup (JSON)</h2><p class="muted">Para carregar meses antigos (ex.: setembro/2026 da planilha) ou restaurar um backup.</p>
    <div class="drop" data-tipo="JSON"><b>Arquivo .json</b><span class="muted">clique ou arraste aqui</span><input type="file" accept=".json,application/json" hidden></div><div id="jmsg"></div></div>` : ''}`;
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
        const fj = [...new Set(j.imports.map(i => i.data.slice(0, 4)))].filter(anoFechado);
        if (fj.length) throw new Error(`O ano ${fj.join(', ')} está fechado. Para corrigir algo nele, reabra o ano na aba Anual.`);
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
        const conf = r.totalRelatorio != null && Math.abs(r.totalRelatorio - r.total) > 0.5 ? ` <b>Atenção:</b> o total do relatório é ${brl(r.totalRelatorio)}.` : ' Total confere com o relatório.';
        // monta os lançamentos: relatório "com data" → um por dia (e por motivo); senão → um pela data do relatório
        const grupos = {};
        const tipoDe = x => x.mot === 'VEN' ? 'VENCIDO' : x.mot === 'AVA' ? 'AVARIADO' : tipo;
        const ref = $('#refmes')?.value;
        let dataFixa = r.data;
        if (ref) { const [ry, rm] = ref.split('-').map(Number); dataFixa = `${ref}-${String(new Date(ry, rm, 0).getDate()).padStart(2, '0')}`; }
        for (const x of r.items) {
          const d = r.comData && !ref ? x.dia : dataFixa, t = r.comData ? tipoDe(x) : tipo, key = d + '|' + t;
          (grupos[key] ||= { data: d, tipo: t, items: [] }).items.push({ plu: x.plu, desc: x.desc, cod: x.cod, qtd: x.qtd, valor: x.valor });
        }
        const lst = Object.values(grupos).sort((a, b) => a.data.localeCompare(b.data) || a.tipo.localeCompare(b.tipo));
        const fech = [...new Set(lst.map(g => g.data.slice(0, 4)))].filter(anoFechado);
        if (fech.length) throw new Error(`O ano ${fech.join(', ')} está fechado. Para corrigir algo nele, reabra o ano na aba Anual.`);
        const ids = lst.map(g => `${LOJA.id}_${g.data}_${g.tipo}`);
        const exs = (await Promise.all(ids.map(id => db.collection('imports').doc(id).get()))).filter(e => e.exists);
        if (exs.length && !confirm(lst.length > 1
          ? `${exs.length} dia(s) deste relatório já estavam importados. Substituir pelos dados deste arquivo? (não duplica)`
          : `Já existe ${lst[0].tipo.toLowerCase()} de ${lst[0].data.split('-').reverse().join('/')} importado (${exs[0].data().items.length} itens). Substituir pelo novo arquivo?`)) continue;
        let semMix = 0;
        for (let i = 0; i < lst.length; i++) {
          const g = lst[i], mes = g.data.slice(0, 7), tot = Math.round(g.items.reduce((s, x) => s + x.valor, 0) * 100) / 100;
          await db.collection('imports').doc(ids[i]).set({ loja: LOJA.id, data: g.data, mes, tipo: g.tipo, arquivo: f.name, items: g.items, total: tot, n: g.items.length,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp(), criadoPor: state.user.email });
          semMix += g.items.filter(it => classify(it, { data: g.data, mes, tipo: g.tipo }).mix === 'A CLASSIFICAR').length;
        }
        const nome = { VENCIDO: 'Vencidos', AVARIADO: 'Avariados' };
        const tipos = [...new Set(lst.map(g => g.tipo))].map(t => nome[t]).join(' e ');
        const dias = [...new Set(lst.map(g => g.data))].sort();
        const quando = dias.length > 1 ? `${dias.length} dias (${dias[0].split('-').reverse().join('/')} a ${dias.at(-1).split('-').reverse().join('/')}), separados pela data de cada item` : dias[0].split('-').reverse().join('/');
        msg('#imsg', 'ok', `✔ <b>${tipos}</b> — ${quando}: ${r.items.length} itens, ${brl(r.total)}.${conf}${semMix ? ` ${semMix} item(ns) sem setor — veja a aba <b>Classificar</b>.` : ''}`);
        const mes = dias.at(-1).slice(0, 7);
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
    ${state.imports.map(i => `<tr><td>${i.data.split('-').reverse().join('/')}</td><td>${i.tipo}</td><td>${esc(i.arquivo || '')}</td><td class="n">${num(i.items.length)}</td><td class="n">${brl(i.total)}</td><td>${esc(i.criadoPor || '')}</td><td>${isAdmin() ? `<button class="btn red" data-del="${esc(i.id)}">Excluir</button>` : ''}</td></tr>`).join('')}
    <tr class="tot"><td colspan="3">TOTAL DO MÊS</td><td class="n">${num(state.imports.reduce((s, i) => s + i.items.length, 0))}</td><td class="n">${brl(state.imports.reduce((s, i) => s + i.total, 0))}</td><td colspan="2"></td></tr></table>` : '<div class="empty">Nada importado neste mês.</div>'}
    ${isAdmin() ? '<p class="muted">Se o mês não bater com os relatórios do sistema, exclua os dias e envie de novo na aba Importar — tudo é recalculado.</p>' : ''}
    ${isAdmin() ? '<div class="flex"><button class="btn out" id="bk">Baixar backup do mês (JSON)</button></div>' : '<p class="muted">Se um dia foi enviado errado, envie o PDF certo de novo na aba Importar (ele substitui) ou avise o administrador.</p>'}</div>
    <div class="card"><h2>Vendas do mês</h2>${state.vendas ? `<p>${esc(state.vendas.periodo)} · venda total ${brl(state.vendas.deptos.find(d => d.depto === '0')?.venda || 0)} · arquivo ${esc(state.vendas.arquivo || '')}</p>` : '<p class="muted">Não importadas.</p>'}</div>`;
  m.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Excluir este relatório importado? Os números do mês serão recalculados.')) return;
    await db.collection('imports').doc(b.dataset.del).delete(); await loadMes(); state.tab = 'historico'; render(); });
  if ($('#bk')) $('#bk').onclick = () => {
    const j = { formato: 'superville-perdas/1', loja: LOJA.id, imports: state.imports.map(({ id, criadoEm, ...i }) => i), vendas: state.vendas ? [(({ criadoEm, ...v }) => v)(state.vendas)] : [] };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(j)], { type: 'application/json' })); a.download = `backup_perdas_${state.mes}.json`; a.click();
  };
}

// ---------------- anual ----------------
async function dadosAno(ano) {
  const q = await db.collection('imports').where('mes', '>=', `${ano}-01`).where('mes', '<=', `${ano}-12`).get();
  const docs = q.docs.map(d => ({ id: d.id, ...d.data() })).filter(i => i.loja === LOJA.id);
  const vq = await db.collection('vendas').where('loja', '==', LOJA.id).get();
  const vend = {}; vq.docs.forEach(d => { const v = d.data(); if (v.mes?.startsWith(ano)) vend[v.mes] = v; });
  const meses = {};
  docs.forEach(i => { const x = meses[i.mes] ||= { ven: 0, ava: 0 }; x[i.tipo === 'VENCIDO' ? 'ven' : 'ava'] += i.total; });
  for (const k in meses) { const v = vend[k], t = v?.deptos?.find(d => d.depto === '0'); Object.assign(meses[k], { venda: t?.venda || 0, lucro: t?.lucro || 0, deptos: v?.deptos || [] }); }
  const rows = docs.flatMap(imp => (imp.items || []).map(it => classify(it, imp)));
  return { ano, docs, vend, meses, rows, fechado: !!anoFechado(ano) };
}

async function anual(m) {
  const anoAtual = String(hoje.getFullYear());
  state.ano = state.ano || state.mes.slice(0, 4);
  const ano = state.ano;
  m.innerHTML = '<div class="empty">Carregando o ano…</div>';
  const A = await dadosAno(ano);
  const anos = []; for (let y = +anoAtual; y >= ANO0; y--) anos.push(String(y));
  const info = anosFechados[ano];
  const sel = `<label class="field" style="max-width:160px">Ano<select id="ano">${anos.map(y => `<option ${y === ano ? 'selected' : ''}>${y}</option>`).join('')}</select></label>`;
  const ks = Object.keys(A.meses).sort();
  const podeFechar = !A.fechado && (ano < anoAtual || hoje.getMonth() === 11);
  const status = A.fechado
    ? `<div class="msg ok">🔒 <b>Ano ${ano} fechado</b> em ${new Date(info.em).toLocaleDateString('pt-BR')} por ${esc(info.por || '')}. Os dados ficam guardados e podem ser consultados e exportados; novas importações para ${ano} ficam bloqueadas.</div>`
    : `<div class="msg info">Ano <b>${ano}</b> aberto — recebendo os relatórios do dia a dia.${podeFechar ? '' : ` O fechamento fica disponível a partir de <b>dezembro de ${ano}</b>.`}</div>`;
  if (!ks.length) { m.innerHTML = `<div class="card"><div class="flex">${sel}</div>${status}<div class="empty">Sem dados em ${ano}. É só começar a importar os relatórios do dia a dia na aba Importar.</div></div>`; bindAno(); return; }
  const tv = ks.reduce((s, k) => s + A.meses[k].ven, 0), ta = ks.reduce((s, k) => s + A.meses[k].ava, 0), tot = tv + ta;
  const comV = ks.filter(k => A.meses[k].venda), vv = comV.reduce((s, k) => s + A.meses[k].venda, 0), pv = comV.reduce((s, k) => s + A.meses[k].ven + A.meses[k].ava, 0);
  m.innerHTML = `<div class="card"><div class="flex" style="align-items:flex-end">${sel}<div class="sp" style="flex:1"></div>
      <button class="btn" id="ra">Relatório anual (PDF)</button><button class="btn out" id="xa">Excel do ano</button><button class="btn out" id="ja">Arquivo do ano (JSON)</button></div>${status}
    <h2>Perdas de ${ano}, mês a mês</h2>
    <div class="kpis">${[['Perda no ano', brl(tot, 0), `${ks.length} mês(es) com dados`, 'red'], ['Média por mês', brl(tot / ks.length, 0), 'perda média de cada mês', 'dark'],
      ['De cada R$ 100 vendidos', vv ? 'R$ ' + num(pv / vv * 100, 2) : '-', vv ? `${comV.length} mês(es) com venda` : 'aguardando vendas', ''], ['Vencido', brl(tv, 0), pct(tv / tot), 'dark'],
      [A.fechado || ks.length === 12 ? 'Avariado' : 'Projeção 12 meses', A.fechado || ks.length === 12 ? brl(ta, 0) : brl(tot / ks.length * 12, 0), A.fechado || ks.length === 12 ? pct(ta / tot) : 'se a média se mantiver', '']]
      .map(([l, v, s, c]) => `<div class="kpi ${c}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('')}</div>
    <h2>Evolução</h2>${columns(ks.map(k => ({ label: MESES[+k.slice(5)].slice(0, 3), ven: A.meses[k].ven, ava: A.meses[k].ava })))}
    ${R.ler('cada coluna é um mês, na ordem do calendário (para ver a evolução). Preto = venceu, verde = estragou. O número em cima é o total do mês em milhares de reais.')}
    <h2>Ranking dos meses — do que mais perdeu para o que menos perdeu</h2>${hbar(ks.map(k => [MESES[+k.slice(5)], { ven: A.meses[k].ven, ava: A.meses[k].ava }]), tot, { labelWidth: 110, qty: false, endfmt: t => `${brl(t, 0)} · ${pct(t / tot)} do ano` })}
    ${R.secAnoMeses(R.anualCtx(A))}</div>
    <div class="card"><h2>Fechar o ano</h2>
      <p class="muted">No fim do ano, o fechamento: <b>1)</b> baixa o arquivo completo do ano (backup em um só arquivo), <b>2)</b> compacta os relatórios diários de cada mês em um só por mês (vencidos e avariados), mantendo o dia de cada item, <b>3)</b> tranca o ano contra importações por engano e <b>4)</b> o site segue no ano novo, de janeiro a dezembro, para alimentar dia a dia. O relatório anual continua disponível aqui a qualquer momento.</p>
      <div class="flex">${A.fechado ? `<button class="btn out" id="reab">Reabrir o ano ${ano}</button>` : `<button class="btn red" id="fecha" ${podeFechar ? '' : 'disabled'}>Fechar o ano ${ano}</button>`}</div><div id="amsg"></div></div>`;
  bindAno();
  const open = html => { const w = window.open('', '_blank'); if (!w) return alert('Libere as janelas pop-up deste site para abrir o relatório.'); w.document.open(); w.document.write(html); w.document.close(); };
  $('#ra').onclick = () => open(R.reportAnual(A));
  $('#xa').onclick = () => excelAno(A);
  $('#ja').onclick = () => baixarAno(A);
  if ($('#fecha')) $('#fecha').onclick = () => fecharAno(A);
  if ($('#reab')) $('#reab').onclick = async () => {
    if (!confirm(`Reabrir ${ano}? As importações para ${ano} voltam a ser aceitas.`)) return;
    anosFechados[ano] = { ...anosFechados[ano], fechado: false };
    await db.collection('config').doc('anos').set({ map: anosFechados }); renderShell(); state.tab = 'anual'; renderShellTabs(); render();
  };
}
function bindAno() { const s = $('#ano'); if (s) s.onchange = e => { state.ano = e.target.value; render(); }; }

function baixarAno(A) {
  const j = { formato: 'superville-perdas/1', loja: LOJA.id, ano: A.ano, geradoEm: new Date().toISOString(),
    imports: A.docs.map(({ id, criadoEm, ...i }) => i), vendas: Object.values(A.vend).map(({ criadoEm, ...v }) => v) };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(j)], { type: 'application/json' })); a.download = `ARQUIVO_PERDAS_LOJA${LOJA.id}_${A.ano}.json`; a.click();
}

function excelAno(A) {
  const c = R.anualCtx(A), ks = c.ks;
  const meses = ks.map(k => { const x = A.meses[k], t = x.ven + x.ava; return [MESES[+k.slice(5)], x.ven, x.ava, t, x.venda || '', x.venda ? t / x.venda : '']; });
  const n = ks.length, tv = c.ven, ta = c.ava;
  const vv = ks.reduce((s, k) => s + (A.meses[k].venda || 0), 0), pv = ks.filter(k => A.meses[k].venda).reduce((s, k) => s + A.meses[k].ven + A.meses[k].ava, 0), nv = ks.filter(k => A.meses[k].venda).length;
  const RS = '"R$" #,##0.00;-"R$" #,##0.00;"-"';
  const top = c.bymix.map(([k]) => k), mm = {};
  c.rows.forEach(x => { (mm[x.mix] ||= {})[x.mes] = (mm[x.mix][x.mes] || 0) + x.valor; });
  const setores = top.map(k => [k, mixInfo(k).enc || '', mixInfo(k).ger || '', ...ks.map(x => mm[k]?.[x] || 0), ks.reduce((s, x) => s + (mm[k]?.[x] || 0), 0), ks.reduce((s, x) => s + (mm[k]?.[x] || 0), 0) / n]);
  exportExcel('Loja 1 · Anual', String(A.ano), c.cons, A.rows, [
    { name: 'MESES', title: `PERDAS DE ${A.ano} MÊS A MÊS`, cols: [['Mês', 18], ['Vencido (R$)', 15], ['Avariado (R$)', 15], ['Total (R$)', 15], ['Venda (R$)', 17], ['Perda ÷ venda', 13]],
      rows: meses, fmts: [null, RS, RS, RS, RS, '0.00%'], totCols: [1, 2, 3, 4], after: [['MÉDIA POR MÊS', tv / n, ta / n, (tv + ta) / n, nv ? vv / nv : '', vv ? pv / vv : '']] },
    { name: 'SETORES POR MÊS', title: `SETORES MÊS A MÊS · ${A.ano}`, cols: [['Setor', 26], ['Encarregado', 14], ['Gerente', 14], ...ks.map(k => [MESES[+k.slice(5)].slice(0, 3), 12]), ['Total do ano', 15], ['Média por mês', 14]],
      rows: setores, fmts: [null, null, null, ...ks.map(() => RS), RS, RS], totCols: [...ks.map((_, i) => i + 3), ks.length + 3, ks.length + 4] },
  ]);
}

async function fecharAno(A) {
  const ano = A.ano, el = '#amsg';
  if (!confirm(`Fechar o ano ${ano}?\n\n1) Vai baixar o arquivo completo do ano (guarde-o).\n2) Os relatórios diários de cada mês serão compactados em um por mês.\n3) O ano ficará trancado para novas importações (dá para reabrir).`)) return;
  try {
    baixarAno(A);
    msg(el, 'info', 'Arquivo do ano baixado. Compactando os meses…');
    let antes = 0, depois = 0;
    const porMes = {}; A.docs.forEach(d => (porMes[d.mes] ||= []).push(d));
    for (const mes of Object.keys(porMes).sort()) {
      const [y, mm] = mes.split('-').map(Number), ult = `${mes}-${String(new Date(y, mm, 0).getDate()).padStart(2, '0')}`;
      for (const tipo of ['VENCIDO', 'AVARIADO']) {
        const ds = porMes[mes].filter(d => d.tipo === tipo); if (!ds.length) continue;
        antes += ds.length; depois++;
        const id = `${LOJA.id}_${ult}_${tipo}`;
        if (ds.length === 1 && ds[0].id === id) continue;
        const items = ds.flatMap(d => d.items.map(it => ({ ...it, dia: it.dia || d.data })));
        const total = Math.round(items.reduce((s, x) => s + x.valor, 0) * 100) / 100;
        await db.collection('imports').doc(id).set({ loja: LOJA.id, data: ult, mes, tipo, arquivo: `Mês compactado no fechamento de ${ano} (${ds.length} relatório(s))`, items, total, n: items.length,
          criadoEm: firebase.firestore.FieldValue.serverTimestamp(), criadoPor: state.user.email });
        const chk = await db.collection('imports').doc(id).get();
        if (!chk.exists || Math.abs(chk.data().total - total) > 0.01) throw new Error(`Falha ao gravar ${mesLabel(mes)} — nada foi apagado.`);
        for (const d of ds) if (d.id !== id) await db.collection('imports').doc(d.id).delete();
      }
    }
    const tot = A.rows.reduce((s, x) => s + x.valor, 0);
    anosFechados[ano] = { fechado: true, em: new Date().toISOString(), por: state.user.email, total: Math.round(tot * 100) / 100, meses: Object.keys(A.meses).length };
    await db.collection('config').doc('anos').set({ map: anosFechados });
    msg(el, 'ok', `✔ Ano ${ano} fechado: ${antes} relatório(s) compactados em ${depois} (um por mês e tipo). Total do ano: ${brl(tot)}.`);
    if (ano === state.mes.slice(0, 4) && ano < String(hoje.getFullYear())) state.mes = mesAtual();
    renderShell(); state.tab = 'anual'; renderShellTabs(); render();
  } catch (e) { console.error(e); msg(el, 'err', '✖ ' + esc(e.message)); }
}
