// Leitura dos PDFs do sistema (reconstrução das linhas pela coordenada Y)
const br = v => parseFloat(v.replace(/\./g, '').replace(',', '.'));

export async function pdfLines(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    const rows = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = it.transform[5], x = it.transform[4];
      let r = rows.find(r => Math.abs(r.y - y) < 2.5);
      if (!r) rows.push(r = { y, parts: [] });
      r.parts.push({ x, s: it.str });
    }
    rows.sort((a, b) => b.y - a.y);
    for (const r of rows) lines.push(r.parts.sort((a, b) => a.x - b.x).map(p => p.s).join('  ').replace(/\s+/g, ' ').trim());
  }
  return lines;
}

// "TROCAS DE FORNECEDORES" (vencidos / avariados)
export async function parseTrocas(file) {
  const lines = await pdfLines(file);
  const txt = lines.join('\n');
  if (!/TROCAS DE FORNECEDORES/i.test(txt)) throw new Error('Este PDF não parece ser o relatório "Trocas de Fornecedores".');
  const dm = txt.match(/(\d{2})\/(\d{2})\/(\d{4})\s+\d{2}:\d{2}/);
  const data = dm ? `${dm[3]}-${dm[2]}-${dm[1]}` : '';
  const loja = (txt.match(/Loja:\s*(\d+)/) || [])[1] || '';
  const tgm = txt.match(/TOTAL GERAL:\s*[\d.]+\s+([\d.]*\d,\d{2})/);
  const items = []; let cod = '';
  for (const l of lines) {
    const h = l.match(/Dpt\/Sec\/Grp\/S-Grp:\s*([\d/]+)/);
    if (h) { cod = h[1]; continue; }
    // formato antigo: termina no valor · formato "com data": + motivo (VEN/AVA) e DT.INC
    const m = l.match(/^(\d+-\d)\s+(.+?)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]*\d,\d{2})(?:\s+([A-Z]{2,4})\s+(\d{2})\/(\d{2})\/(\d{4}))?$/);
    if (m) items.push({ plu: m[1], desc: m[2].replace(/\s+/g, ' ').trim(), cod, qtd: parseFloat(m[3]), custo: parseFloat(m[4]), valor: br(m[5]),
      mot: m[6] || '', dia: m[7] ? `${m[9]}-${m[8]}-${m[7]}` : '' });
  }
  const total = Math.round(items.reduce((s, x) => s + x.valor, 0) * 100) / 100;
  return { data, loja, items, total, totalRelatorio: tgm ? br(tgm[1]) : null, comData: items.length > 0 && items.every(x => x.dia) };
}

// "Rentabilidade de Vendas" — usa só a coluna VENDA (e o lucro bruto para a análise de lucro)
export async function parseVendas(file) {
  const lines = await pdfLines(file);
  const txt = lines.join('\n');
  let per = txt.match(/Rentabilidade de Vendas\s+(\d{2})\/(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!per) { const pm = txt.match(/Rentabilidade de Vendas\s+(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{4})/i);
    if (pm) per = [pm[0], '01', pm[1], pm[2], String(new Date(+pm[4], +pm[3], 0).getDate()).padStart(2, '0'), pm[3], pm[4]]; }
  if (!per) throw new Error('Este PDF não parece ser o relatório "Rentabilidade de Vendas".');
  const deptos = [];
  for (const l of lines) {
    const m = l.match(/^(\d+)\s+(.*)$/); if (!m) continue;
    const nums = m[2].match(/-?[\d.]*\d,\d{2}/g) || [];
    if (nums.length < 10) continue;
    const nome = m[2].slice(0, m[2].indexOf(nums[0])).trim();
    const f = nums.slice(0, 10).map(br);
    deptos.push({ depto: m[1], nome, custo: f[0], venda: f[1], lucro: f[6] });
  }
  return { periodo: `${per[1]}/${per[2]}/${per[3]} a ${per[4]}/${per[5]}/${per[6]}`, mes: `${per[6]}-${per[5]}`, deptos };
}

// "RELATÓRIO DE AJUSTE DE ESTOQUE" (Padaria: perda, sobra de mesa, sobra de vitrine · Flores: perda) — enviado no fim do mês
const AJ_SETOR = { 'FLORES': 'Garden', 'PADARIA': 'Padaria' };
const AJ_MOTIVO = m => ({ 'PERDA': 'Perda', 'SOBRA MESA': 'Sobra de mesa', 'SOBRA VITRINE': 'Sobra de vitrine' })[m] || (m.charAt(0) + m.slice(1).toLowerCase());
const br3 = v => Math.abs(parseFloat(v.replace(/\./g, '').replace(',', '.')));
export async function parseAjuste(file) {
  const lines = await pdfLines(file);
  const txt = lines.join('\n');
  if (!/AJUSTE DE ESTOQUE/i.test(txt)) throw new Error('Este PDF não parece ser o "Relatório de Ajuste de Estoque".');
  const per = txt.match(/de\s+(\d{2})\/(\d{2})\/(\d{4})\s+até\s+(\d{2})\/(\d{2})\/(\d{4})/i);
  const loja = (txt.match(/Loja:\s*(\d+)/) || [])[1] || '';
  const tg = txt.match(/TOTAL GERAL:\s*(-?[\d.]+)\s+(-?[\d.]*\d,\d{3})/);
  const items = []; let setor = '', motivo = '', setorNome = '';
  for (const l of lines) {
    const h = l.match(/Setor:\s*\d+-(.+?)\s+Motivo:\s*\d+-(.+)$/);
    if (h) { setorNome = h[1].trim(); setor = AJ_SETOR[setorNome.toUpperCase()] || ''; motivo = AJ_MOTIVO(h[2].trim().toUpperCase()); continue; }
    const m = l.match(/^(\d+-\d)\s+(?:(\d{8,14})\s+)?(.+?)\s+(-?[\d.]+)\s+(-?[\d.]*\d,\d{3})\s+(-?[\d.]*\d,\d{3})\s+(\d{2})\/(\d{2})\/(\d{4})\s+\d{1,3}$/);
    if (m) items.push({ plu: m[1], desc: m[3].replace(/\s+/g, ' ').trim(), qtd: Math.abs(parseFloat(m[4])), custo: br3(m[5]), valor: br3(m[6]),
      dia: `${m[9]}-${m[8]}-${m[7]}`, motivo, setorRel: setorNome, ...(setor ? { mix: setor } : {}) });
  }
  const total = Math.round(items.reduce((s, x) => s + x.valor, 0) * 100) / 100;
  return { items, total, totalRelatorio: tg ? br3(tg[2]) : null, loja, mes: per ? `${per[6]}-${per[5]}` : '', inicio: per ? `${per[3]}-${per[2]}-${per[1]}` : '', fim: per ? `${per[6]}-${per[5]}-${per[4]}` : '',
    setores: [...new Set(items.map(x => x.setorRel))], motivos: [...new Set(items.map(x => x.motivo))] };
}
