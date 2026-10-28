// Configuração do SuperVille Perdas
export const firebaseConfig = {
  apiKey: "AIzaSyCm8FKho5RlgQ_oKoJDRC4knUduD5PLQS4",
  authDomain: "superville-perdas.firebaseapp.com",
  projectId: "superville-perdas",
  storageBucket: "superville-perdas.firebasestorage.app",
  messagingSenderId: "322849900384",
  appId: "1:322849900384:web:e6d82710a3cc06d3ff4005"
};

export const LOJA = { id: '1', nome: 'Loja 1 — Vila Romana (Coriolano)' };

export const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Segmentos de Açougue e Frios (prefixo Depto/Seção/Grupo do sistema -> segmento; vale o prefixo mais longo)
export const AC_SEGS = ['Bovinos', 'Suínos', 'Frangos', 'Chacutaria', 'Autoatendimento Vácuo', 'Peixaria', 'Outros'];
export const FR_SEGS = ['Balcão (granel/kg)', 'Queijos e Requeijões', 'Iogurtes e Lácteos', 'Manteigas e Margarinas', 'Massas Frescas',
  'Sucos Refrigerados', 'Frios Pré-embalados', 'Congelados', 'Outros'];
export const SEGMAP = [
  ['107/01', 'Bovinos'], ['107/16', 'Bovinos'], ['107/16/02/02', 'Suínos'], ['107/16/02/03', 'Frangos'], ['107/16/03', 'Frangos'],
  ['107/21', 'Bovinos'], ['107/04/01', 'Bovinos'], ['107/04/02', 'Suínos'], ['107/04/03', 'Frangos'],
  ['107/17/02', 'Frangos'], ['107/17/03', 'Frangos'], ['107/17/04', 'Bovinos'], ['107/17/05', 'Bovinos'], ['107/17/06', 'Suínos'],
  ['107/17/07', 'Suínos'], ['107/17/08', 'Bovinos'], ['107/17/09', 'Chacutaria'],
  ['107/02', 'Suínos'], ['107/10', 'Suínos'], ['107/03', 'Frangos'], ['107/11', 'Frangos'],
  ['107/07', 'Chacutaria'], ['107/14', 'Chacutaria'], ['107/15', 'Chacutaria'], ['119/02', 'Chacutaria'], ['119/03', 'Chacutaria'],
  ['107/18', 'Autoatendimento Vácuo'], ['119/01', 'Autoatendimento Vácuo'], ['107/05', 'Autoatendimento Vácuo'],
  ['112', 'Peixaria'], ['107/12', 'Peixaria'],
  ['104/12', 'Congelados'], ['104/03', 'Queijos e Requeijões'], ['104/07/02/02', 'Queijos e Requeijões'], ['104/07/02/03', 'Queijos e Requeijões'],
  ['104/11', 'Iogurtes e Lácteos'], ['104/02', 'Iogurtes e Lácteos'], ['104/09', 'Manteigas e Margarinas'], ['104/10', 'Massas Frescas'],
  ['104/18', 'Sucos Refrigerados'], ['104/13', 'Balcão (granel/kg)'], ['104/07/01', 'Balcão (granel/kg)'], ['104/06', 'Balcão (granel/kg)'],
  ['104/15', 'Frios Pré-embalados'], ['104/16', 'Frios Pré-embalados'], ['104/05', 'Frios Pré-embalados'],
];

// Metas: média ABRAS por seção (dados 2023; loja: 2025) x 62% (parte da quebra operacional no total de perdas, ABRAS dados 2025)
export const QUEBRA = 0.62;
export const MEDIA_LOJA = 1.82;
export const REF = [
  ['Hortifruti', ['29'], 5.83], ['Açougue', ['107', '119'], 3.98], ['Peixaria', ['112'], 1.67],
  ['Padaria (produção)', ['40'], 2.97], ['Pães e Bolos industrializados', ['24'], 2.97], ['Frios e Laticínios', ['104'], 2.60],
  ['Culinária Japonesa', ['68'], 3.50], ['Mercearia seca', ['100'], 0.80], ['Mercearia líquida (bebidas)', ['101'], 0.70],
  ['Vinhos', ['114'], 0.70], ['Higiene, Limpeza e Perfumaria', ['102', '103'], 0.94], ['Ovos', ['113'], 2.60], ['Potinhos', ['115'], 0.80],
];
// mix -> departamento usado quando o item não tem código de departamento
export const MIX2DEP = {
  'Frios e Laticínios': '104', 'Açougue e Peixaria': '107', 'Pães e Bolos': '24', 'Padaria': '40', 'Hortifruti': '29',
  'Salinha de Manipulação': '29', 'Refrigerante e Água': '101', 'Cerveja': '101', 'Adega': '114', 'Ovos e Alho Trit': '113',
  'Potinhos': '115', 'Garden': '56', 'Embalagem': '43',
};
