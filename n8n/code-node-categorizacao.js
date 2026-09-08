/**
 * N8N Code Node — "Normalizar e Categorizar"
 * Posição no workflow: depois de "Pluggy Get Transactions", antes do Filter anti-duplicata.
 * Modo: "Run Once for All Items".
 *
 * O que este node faz, em ordem:
 *   1. Normaliza o sinal do valor (gasto SEMPRE negativo, entrada SEMPRE positiva)
 *   2. Decide o Fluxo: Saída / Entrada / Movimentação interna
 *   3. Mapeia a categoria da Pluggy para a nossa lista fixa de 11
 *   4. Converte a data UTC para data local (America/Sao_Paulo) e já emite o Mês
 *   5. Monta um nome legível de conta/cartão
 *   6. Marca parcelas com data futura como "Futuro" (não podem entrar no gasto do mês)
 *   7. Descarta transações cujo ID já está na planilha (anti-duplicata)
 *
 * As colunas de saída são exatamente o cabeçalho da aba "Transações".
 * Se mudar nome de coluna aqui, mude no cabeçalho da planilha também — o node
 * "Google Sheets - Append" casa as colunas pelo nome exato.
 */

// ---------------------------------------------------------------------------
// 1. TABELA DE CATEGORIAS
// Lista fixa de 11. Qualquer categoria da Pluggy que não esteja aqui cai em
// "Outros" — e o node loga quais foram, para a gente adicionar depois em vez
// de deixar o "Outros" inchar em silêncio (foi o que aconteceu até agora).
// ---------------------------------------------------------------------------
const CATEGORIAS = {
  'Groceries': 'Alimentação',
  'Eating out': 'Alimentação',
  'Food delivery': 'Alimentação',
  'Food and drinks': 'Alimentação',

  'Taxi and ride-hailing': 'Transporte',
  'Public transportation': 'Transporte',
  'Transportation': 'Transporte',
  'Gas stations': 'Transporte',
  'Vehicle maintenance': 'Transporte',
  'Automotive': 'Transporte',
  'Tolls and in vehicle payment': 'Transporte',
  'Airport and airlines': 'Transporte',
  'Travel': 'Transporte',

  'Housing': 'Moradia',
  'Utilities': 'Moradia',
  'Electricity': 'Moradia',
  'Internet': 'Moradia',
  'Telecommunications': 'Moradia',

  'Healthcare': 'Saúde & Bem-estar',
  'Health insurance': 'Saúde & Bem-estar',
  'Pharmacy': 'Saúde & Bem-estar',
  'Gyms and fitness centers': 'Saúde & Bem-estar',
  'Wellness and fitness': 'Saúde & Bem-estar',

  'University': 'Educação',
  'School': 'Educação',
  'Bookstore': 'Educação',
  'Office supplies': 'Educação',

  'Shopping': 'Compras',
  'Online shopping': 'Compras',
  'Electronics': 'Compras',
  'Clothing': 'Compras',
  'Houseware': 'Compras',
  'Kids and toys': 'Compras',
  'Pet supplies and vet': 'Compras',

  'Digital services': 'Assinaturas & Lazer',
  'Video streaming': 'Assinaturas & Lazer',
  'Gaming': 'Assinaturas & Lazer',
  'Leisure': 'Assinaturas & Lazer',
  'Tickets': 'Assinaturas & Lazer',
  'Gambling': 'Assinaturas & Lazer',
  'Mileage programs': 'Assinaturas & Lazer',

  'Services': 'Serviços & Taxas',
  'Insurance': 'Serviços & Taxas',
  'Taxes': 'Serviços & Taxas',
  'Tax on financial operations': 'Serviços & Taxas',
  'Credit card fees': 'Serviços & Taxas',

  'Loans and financing': 'Empréstimos',

  'Transfers': 'Transferências',
  'Transfer - PIX': 'Transferências',
  'Transfer - Bank Slip': 'Transferências',

  'Other': 'Outros',
  'Sem categoria': 'Outros',
  'Cashback': 'Outros',
};

// ---------------------------------------------------------------------------
// 2. MOVIMENTAÇÃO INTERNA
// Dinheiro que mudou de lugar mas continua sendo seu, ou que já foi contado
// antes. Nunca entra no "gasto do mês" — é a correção que tira uma fatia
// relevante de falso gasto do dashboard.
//
// Credit card payment: a compra já foi contada quando entrou na fatura;
//   contar o pagamento de novo é contar duas vezes.
// Investments / Fixed income / Mutual funds: aplicação, o dinheiro é seu.
// Proceeds interests and dividends: rendimento da aplicação.
// Transfer - Internal / Same person transfer: entre contas suas.
// ---------------------------------------------------------------------------
const MOVIMENTACAO_INTERNA = new Set([
  'Credit card payment',
  'Investments',
  'Fixed income',
  'Mutual funds',
  'Proceeds interests and dividends',
  'Transfer - Internal',
  'Same person transfer',
  'Same person transfer - CASH',
]);

// ---------------------------------------------------------------------------
// 2b. REGRAS POR DESCRIÇÃO — têm precedência sobre a categoria da Pluggy
//
// Por que existe: em alguns casos o rótulo da Pluggy é simplesmente errado, e o
// texto que o banco escreve é mais confiável. Dois casos custaram caro:
//
//   - Pagamento de fatura: o Nubank manda como "Transfers" e o Bradesco como
//     "Credit card fees" — nenhum dos dois usa "Credit card payment". Sem esta
//     regra, o valor de cada pagamento de fatura entra como gasto, duplicando
//     o que já foi contado quando a compra caiu na fatura.
//   - Empréstimo do Mercado Pago: vem como "Online shopping" e "Groceries",
//     porque a Pluggy categoriza pelo estabelecimento e não pela natureza.
//
// A ordem importa: a primeira regra que casar vence. Fatura vem antes de
// empréstimo, senão "Pagamento de fatura" cairia na regra de parcela.
// ---------------------------------------------------------------------------
const REGRAS_DESCRICAO = [
  {
    re: /pagamento\s+(de\s+)?fatura|fatura\s+(do\s+)?cart|gastos\s+cart[aã]o\s+de\s+cr[eé]dito/i,
    fluxo: 'Movimentação interna',
  },
  {
    re: /empr[eé]stimo|parcela\s+paga|d[eé]bito\s+por\s+d[ií]vida|financiamento/i,
    categoria: 'Empréstimos',
  },
];

// ---------------------------------------------------------------------------
// 3. NOMES LEGÍVEIS DE CARTÃO
// A Pluggy devolve o apelido cru do cartão ("gold", "ELO MAIS", "croma-platinum",
// e no Inter o nome do titular). Sem isso a coluna Conta fica ilegível.
// Chave = nome cru em minúsculas. Cartão novo que não esteja aqui usa o nome
// original, só que prefixado pelo banco.
// ---------------------------------------------------------------------------
const NOMES_CARTAO = {
  'gold': 'Cartão Gold',
  'croma-platinum': 'Cartão Platinum',
  'elo mais': 'Cartão Elo Mais',
  'henrique oliveira': 'Cartão Mastercard',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converte o timestamp UTC da Pluggy para a data-calendário em São Paulo.
 *
 * Por que isso importa: boa parte das transações vem com hora entre 00h e 03h
 * UTC. Uma compra de 31/07 às 01:00 UTC aconteceu, no Brasil, em 30/07 às 22h.
 * Sem converter, ela cai no mês errado — e na virada de mês isso desloca o
 * total do dashboard.
 *
 * 'en-CA' é usado de propósito: é o locale que formata como AAAA-MM-DD, que é
 * o formato que ordena e agrupa corretamente como texto.
 */
function dataLocal(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d); // -> "2026-08-29"
}

/** AAAA-MM-DD -> DD/MM/AAAA, para leitura humana na planilha. */
function paraBR(ymd) {
  const [a, m, d] = ymd.split('-');
  return `${d}/${m}/${a}`;
}

// Hoje, também no fuso de São Paulo — a VPS roda em UTC, então usar new Date()
// puro erraria o corte em 3 horas por dia.
const HOJE = dataLocal(new Date().toISOString());

// ---------------------------------------------------------------------------
// Processamento
// ---------------------------------------------------------------------------
const saida = [];
const categoriasDesconhecidas = new Set();

// Anti-duplicata: IDs que já estão na planilha. O node "Ler IDs Existentes" lê a
// aba Transações inteira; aqui só interessa a coluna do ID.
const idsExistentes = new Set(
  $('Ler IDs Existentes').all().map(item => item.json['ID Transação'])
);

// O laço usa índice de propósito: itemMatching(i) precisa dele para achar, nos
// nodes anteriores, QUAL conta e QUAL banco geraram esta transação — o fluxo
// passa por dois Split, então a correspondência não é posicional trivial.
const transacoes = $input.all();

for (let i = 0; i < transacoes.length; i++) {
  const tx = transacoes[i].json;

  // Já está na planilha: nada a fazer. Este teste vem primeiro porque é o mais
  // barato e descarta a maior parte do lote em execução normal.
  if (idsExistentes.has(tx.id)) continue;

  const contaOrigem = $('Split Accounts').itemMatching(i).json;
  const bancoOrigem = $('Lista de Bancos').itemMatching(i).json;
  const banco = bancoOrigem.banco || 'Desconhecido';
  const contaNome = contaOrigem.name || '';
  const ehCartao = String(contaOrigem.type).toUpperCase() === 'CREDIT';

  // --- Sinal ---------------------------------------------------------------
  // Em conta corrente a Pluggy já assina (negativo = saiu).
  // Em cartão ela inverte: compra vem positiva, estorno/pagamento vem negativo.
  // Aqui todo mundo passa a falar a mesma língua: negativo = saiu do bolso.
  let valor = Number(tx.amount);
  if (ehCartao) valor = -valor;
  valor = Math.round(valor * 100) / 100; // mata ruído de float

  // --- Categoria e Fluxo ---------------------------------------------------
  const catOriginal = tx.category || 'Sem categoria';
  const descricao = tx.description || '';

  let categoria = CATEGORIAS[catOriginal] ?? 'Outros';
  let fluxo;
  if (MOVIMENTACAO_INTERNA.has(catOriginal)) fluxo = 'Movimentação interna';
  else if (valor < 0) fluxo = 'Saída';
  else fluxo = 'Entrada';

  // A descrição tem a última palavra — ver o bloco 2b.
  for (const regra of REGRAS_DESCRICAO) {
    if (!regra.re.test(descricao)) continue;
    if (regra.fluxo) fluxo = regra.fluxo;
    if (regra.categoria) categoria = regra.categoria;
    break;
  }

  if (fluxo !== 'Movimentação interna' && !CATEGORIAS[catOriginal]) {
    categoriasDesconhecidas.add(catOriginal);
  }
  if (fluxo === 'Movimentação interna') categoria = '—';

  // --- Data ----------------------------------------------------------------
  const ymd = dataLocal(tx.date);
  if (!ymd) continue; // sem data utilizável, não entra na planilha

  // --- Situação ------------------------------------------------------------
  // Parcelas futuras de cartão vêm com data lá na frente. Elas são previsão,
  // não gasto ocorrido — o dashboard filtra por esta coluna.
  const situacao = ymd > HOJE ? 'Futuro' : 'Realizado';

  // --- Conta legível -------------------------------------------------------
  const conta = ehCartao
    ? `${banco} · ${NOMES_CARTAO[String(contaNome).toLowerCase()] || contaNome}`
    : `${banco} · Conta`;

  saida.push({
    json: {
      'ID Transação': tx.id,
      // Sai como DD/MM/AAAA. O node do Sheets precisa estar em USER_ENTERED
      // para o Google interpretar isso como data de verdade (ordena e filtra).
      'Data': paraBR(ymd),
      // AAAA-MM como texto. A coluna C da planilha está formatada como TEXTO
      // PURO de propósito: sem isso o Sheets converte "2026-08" em data e o
      // QUERY do painel para de casar.
      'Mês': ymd.slice(0, 7),
      'Banco': banco,
      'Conta': conta,
      'Descrição': descricao,
      'Valor': valor,
      'Fluxo': fluxo,
      'Categoria': categoria,
      'Situação': situacao,
      'Tipo': ehCartao ? 'Crédito' : 'Débito',
      'Categoria Original': catOriginal,
    },
  });
}

// Aviso, não erro: se a Pluggy inventar categoria nova, ela cai em "Outros" e
// a execução continua — mas fica registrado no log do N8N para a gente mapear.
if (categoriasDesconhecidas.size > 0) {
  console.log(
    'Categorias da Pluggy sem mapeamento (caíram em Outros): ' +
    [...categoriasDesconhecidas].join(', ')
  );
}

return saida;
