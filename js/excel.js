// Exportação Excel no padrão SuperVille (xlsx-js-style)
const HDR = { font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 }, fill: { fgColor: { rgb: '000000' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
const TIT = { font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 14 }, fill: { fgColor: { rgb: '000000' } } };
const SUB = { font: { color: { rgb: '3BB072' }, name: 'Arial', sz: 10, bold: true }, fill: { fgColor: { rgb: '000000' } } };
const TOT = { font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 10 }, fill: { fgColor: { rgb: '3BB072' } } };
const cell = (v, s, z) => ({ v: v ?? '', t: typeof v === 'number' ? 'n' : 's', s, z });
const BODY = (i, extra = {}) => ({ font: { name: 'Arial', sz: 9 }, fill: i % 2 ? { fgColor: { rgb: 'EEF7F1' } } : undefined, border: { bottom: { style: 'thin', color: { rgb: 'D9D9D9' } } }, ...extra });
const RS = '"R$" #,##0.00;-"R$" #,##0.00;"-"';

function sheet(title, sub, cols, rows, fmts, totCols, after = []) {
  const data = [[cell('SUPERVILLE · ' + title, TIT), ...cols.slice(1).map(() => cell('', TIT))],
                [cell(sub, SUB), ...cols.slice(1).map(() => cell('', SUB))], [],
                cols.map(c => cell(c[0], HDR))];
  rows.forEach((r, i) => data.push(r.map((v, j) => cell(v, BODY(i), fmts[j]))));
  const tot = cols.map((c, j) => totCols.includes(j) ? cell(rows.reduce((s, r) => s + (Number(r[j]) || 0), 0), TOT, fmts[j]) : cell(j === 0 ? 'TOTAL' : '', TOT));
  data.push(tot);
  after.forEach(r => data.push(r.map((v, j) => cell(v, { ...TOT, fill: { fgColor: { rgb: '262626' } } }, fmts[j]))));
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = cols.map(c => ({ wch: c[1] }));
  ws['!rows'] = [{ hpt: 24 }, { hpt: 16 }, {}, { hpt: 30 }];
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 3, c: 0 }, e: { r: 3 + rows.length, c: cols.length - 1 } }) };
  ws['!freeze'] = { xSplit: 0, ySplit: 4 };
  return ws;
}

const GUIA = [
  ['O QUE É CADA ABA', ''],
  ['PRODUTOS POR KG', 'Produtos vendidos por quilo (pesados na balança), somados no mês, do que mais perdeu para o que menos perdeu.'],
  ['PRODUTOS POR UNIDADE', 'Produtos vendidos por unidade (contados um a um), somados no mês, do que mais perdeu para o que menos perdeu.'],
  ['REGISTROS', 'Cada lançamento de perda, com a data, o tipo (vencido ou avariado), o setor, o encarregado e o gerente.'],
  ['', ''],
  ['O QUE SIGNIFICA CADA COLUNA', ''],
  ['PLU', 'Código do produto no sistema.'],
  ['Setor', 'Área da loja e equipe responsável (ex.: Açougue, Corredor 1).'],
  ['Tipo de produto', 'Divisão dentro do setor (ex.: bovinos, iogurtes, queijos).'],
  ['Quilos / Unidades', 'Quantidade total perdida no mês.'],
  ['Vencido (R$)', 'Valor dos produtos que passaram da validade.'],
  ['Avariado (R$)', 'Valor dos produtos que estragaram, quebraram ou ficaram impróprios para venda.'],
  ['Total (R$)', 'Vencido + avariado. Os valores são a preço de custo (o que pagamos ao fornecedor).'],
  ['Vezes recolhido', 'Quantas vezes o produto foi lançado como perda no mês. Muitas vezes = problema que se repete.'],
  ['', ''],
  ['DICAS', ''],
  ['Filtro', 'Use as setas no cabeçalho de cada coluna para filtrar por setor, tipo ou encarregado.'],
  ['Linha verde', 'A última linha verde de cada aba é o TOTAL.'],
  ['Onde agir', 'Comece pelos primeiros produtos da lista: poucos produtos costumam causar a maior parte da perda.'],
];
function guiaSheet(nome, label) {
  const data = [[cell('SUPERVILLE · COMO LER ESTA PLANILHA', TIT), cell('', TIT)], [cell(`${nome} · ${label} · Loja 1`, SUB), cell('', SUB)], []];
  GUIA.forEach((r, i) => data.push(r[1] === '' && r[0] ? [cell(r[0], HDR), cell('', HDR)] : [cell(r[0], BODY(i, { font: { name: 'Arial', sz: 10, bold: true } })), cell(r[1], BODY(i, { font: { name: 'Arial', sz: 10 }, alignment: { wrapText: true, vertical: 'center' } }))]));
  const ws = XLSX.utils.aoa_to_sheet(data); ws['!cols'] = [{ wch: 26 }, { wch: 100 }]; ws['!rows'] = [{ hpt: 24 }, { hpt: 16 }];
  return ws;
}

export { RS };
export function exportExcel(nome, label, cons, rows, extra = []) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, guiaSheet(nome, label), 'COMO LER');
  for (const e of extra) XLSX.utils.book_append_sheet(wb, sheet(e.title, `${nome} · ${label} · Loja 1`, e.cols, e.rows, e.fmts, e.totCols, e.after), e.name);
  for (const [unit, t, qn] of [['kg', 'PRODUTOS POR KG', 'Quilos'], ['un', 'PRODUTOS POR UNIDADE', 'Unidades']]) {
    const lst = cons.filter(a => a.unit === unit);
    const fq = unit === 'kg' ? '#,##0.000' : '#,##0';
    XLSX.utils.book_append_sheet(wb, sheet(t, `${nome} · ${label} · Loja 1`,
      [['#', 5], ['PLU', 11], ['Produto', 44], ['Setor', 22], ['Tipo de produto', 22], [qn, 11], [`${qn} vencid${unit === 'un' ? 'as' : 'os'}`, 12], [`${qn} avariad${unit === 'un' ? 'as' : 'os'}`, 12], ['Vencido (R$)', 13], ['Avariado (R$)', 13], ['Total (R$)', 13], ['Vezes recolhido', 11]],
      lst.map((a, i) => [i + 1, a.plu, a.desc, a.mix, a.seg, a.q, a.qv, a.qa, a.ven, a.ava, a.tot, a.n]),
      [null, null, null, null, null, fq, fq, fq, RS, RS, RS, '0'], [5, 6, 7, 8, 9, 10, 11]), t.slice(0, 31));
  }
  XLSX.utils.book_append_sheet(wb, sheet('TODOS OS REGISTROS', `${nome} · ${label} · Loja 1`,
    [['Data', 11], ['Tipo', 11], ['PLU', 11], ['Produto', 44], ['Setor', 22], ['Encarregado', 15], ['Gerente', 16], ['Tipo de produto', 22], ['Unidade', 9], ['Quantidade', 11], ['Valor (R$)', 13]],
    [...rows].sort((a, b) => b.valor - a.valor).map(x => [x.data.split('-').reverse().join('/'), x.tipo, x.plu, x.desc, x.mix, x.enc, x.ger, x.seg, x.pes, x.pes === 'kg' ? x.kg : x.un, x.valor]),
    [null, null, null, null, null, null, null, null, null, '#,##0.###', RS], [10]), 'REGISTROS');
  XLSX.writeFile(wb, `PERDAS_${nome.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]+/g, '_')}_${label.replace('/', '_')}.xlsx`);
}
