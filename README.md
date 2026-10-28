# SuperVille · Gestão de Perdas

Painel de perdas (vencidos e avariados) da Loja 1 — Vila Romana (Coriolano).

- Importação diária dos PDFs "Trocas de Fornecedores" (vencidos e avariados) e mensal do "Rentabilidade de Vendas".
- Classificação automática por setor (mix), encarregado, gerente e segmento (Açougue e Frios).
- Fechamento mensal em PDF (loja e por setor/gerente/encarregado), Excel e visão anual.

Dados ficam no Firebase (projeto `superville-perdas`), acessíveis só com login.
`data/catalogo.json` = PLU → setor (mix), gerado a partir das listagens de mix do sistema.
