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
    const m = l.match(/^(\d+-\d)\s+(.+?)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]*\d,\d{2})$/);
    if (m) items.push({ plu: m[1], desc: m[2].replace(/\s+/g, ' ').trim(), cod, qtd: parseFloat(m[3]), custo: parseFloat(m[4]), valor: br(m[5]) });
  }
  const total = Math.round(items.reduce((s, x) => s + x.valor, 0) * 100) / 100;
  return { data, loja, items, total, totalRelatorio: tgm ? br(tgm[1]) : null };
}

// "Rentabilidade de Vendas" — usa só a coluna VENDA (e o lucro bruto para a análise de lucro)
export async function parseVendas(file) {
  const lines = await pdfLines(file);
  const txt = lines.join('\n');
  const per = txt.match(/Rentabilidade de Vendas\s+(\d{2})\/(\d{2})\/(\d{4})\s+a\s+(\d{2})\/(\d{2})\/(\d{4})/i);
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
