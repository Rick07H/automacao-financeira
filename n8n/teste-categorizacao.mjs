import fs from 'node:fs';
const src = fs.readFileSync(new URL('./code-node-categorizacao.js', import.meta.url), 'utf8');

// Casos que representam os furos reais encontrados na base.
// Cada caso traz a transação, a conta de origem e o banco de origem — os três
// que o node combina via itemMatching().
const casos = [
  { nome:'compra no cartao (sinal invertido pela Pluggy)',
    tx:{id:'1',date:'2026-08-08T14:00:00.000Z',amount:291.74,description:'Jim.Com* Tudo Junto e 1/12',category:'Shopping'},
    conta:{name:'croma-platinum',type:'CREDIT'}, banco:{banco:'Nubank'},
    espera:{Valor:-291.74,Fluxo:'Saída',Categoria:'Compras',Tipo:'Crédito',Conta:'Nubank · Cartão Platinum',Banco:'Nubank'} },
  { nome:'pagamento de fatura rotulado como Transfers',
    tx:{id:'2',date:'2026-08-05T12:00:00.000Z',amount:-826.18,description:'Pagamento de fatura',category:'Transfers'},
    conta:{name:'Nu Pagamentos',type:'BANK'}, banco:{banco:'Nubank'},
    espera:{Fluxo:'Movimentação interna',Categoria:'—'} },
  { nome:'GASTOS CARTAO DE CREDITO (Bradesco)',
    tx:{id:'3',date:'2026-04-09T12:00:00.000Z',amount:-772.01,description:'GASTOS CARTAO DE CREDITO - DOCTO: 3990251',category:'Credit card fees'},
    conta:{name:'Conta Corrente',type:'BANK'}, banco:{banco:'Bradesco'},
    espera:{Fluxo:'Movimentação interna',Banco:'Bradesco',Conta:'Bradesco · Conta'} },
  { nome:'emprestimo Mercado Pago rotulado Online shopping',
    tx:{id:'4',date:'2026-08-05T12:00:00.000Z',amount:-97.58,description:'Pagamento de parcela Empréstimos Mercado Pago',category:'Online shopping'},
    conta:{name:'Mercado Pago',type:'BANK'}, banco:{banco:'Mercado Pago'},
    espera:{Categoria:'Empréstimos',Fluxo:'Saída'} },
  { nome:'Uber (antes caia em Outros)',
    tx:{id:'5',date:'2026-08-10T12:00:00.000Z',amount:-19.90,description:'Uber *TRIP',category:'Taxi and ride-hailing'},
    conta:{name:'Nu Pagamentos',type:'BANK'}, banco:{banco:'Nubank'},
    espera:{Categoria:'Transporte'} },
  { nome:'virada de dia por fuso (01:00Z do dia 01 = dia 31 no Brasil)',
    tx:{id:'6',date:'2026-08-01T01:00:00.000Z',amount:-50,description:'Compra no débito|SAO BENTO',category:'Shopping'},
    conta:{name:'Nu Pagamentos',type:'BANK'}, banco:{banco:'Nubank'},
    espera:{Data:'31/07/2026',['Mês']:'2026-07'} },
  { nome:'parcela futura',
    tx:{id:'7',date:'2027-03-09T12:00:00.000Z',amount:291.66,description:'Jim.Com* Tudo Junto e 8/12',category:'Shopping'},
    conta:{name:'croma-platinum',type:'CREDIT'}, banco:{banco:'Nubank'},
    espera:{['Situação']:'Futuro'} },
  { nome:'entrada (salario)',
    tx:{id:'8',date:'2026-08-05T12:00:00.000Z',amount:2500,description:'Transferência Recebida|EMPRESA',category:'Transfers'},
    conta:{name:'Nu Pagamentos',type:'BANK'}, banco:{banco:'Nubank'},
    espera:{Fluxo:'Entrada',Valor:2500} },
];

// mocks dos helpers do n8n
const fn = new Function('$input','$','console', src + '\n');
const roda = (lista, idsExistentes = []) => {
  const $input = { all: () => lista.map(c => ({ json: c.tx })) };
  const $ = nome => ({
    all: () => nome === 'Ler IDs Existentes'
      ? idsExistentes.map(id => ({ json: { 'ID Transação': id } }))
      : [],
    itemMatching: i => ({ json: nome === 'Split Accounts' ? lista[i].conta : lista[i].banco }),
  });
  return fn($input, $, { log: () => {} });
};

let falhas = 0;
for (const c of casos) {
  const out = roda([c]);
  if (!out.length) { console.log(`FALHA  ${c.nome}: node nao devolveu item`); falhas++; continue; }
  const j = out[0].json;
  const erros = Object.entries(c.espera).filter(([k,v]) => j[k] !== v)
                      .map(([k,v]) => `${k}: esperado ${JSON.stringify(v)}, veio ${JSON.stringify(j[k])}`);
  if (erros.length) { console.log(`FALHA  ${c.nome}\n       ${erros.join('\n       ')}`); falhas++; }
  else console.log(`ok     ${c.nome}`);
}

// anti-duplicata: o caso que faltou na primeira versao e duplicou a base inteira
const semFiltro = roda(casos);
const comFiltro = roda(casos, casos.map(c => c.tx.id));
console.log(`\nanti-duplicata: ${semFiltro.length} itens sem IDs conhecidos, ${comFiltro.length} com todos ja na planilha`);
if (semFiltro.length !== casos.length || comFiltro.length !== 0) { console.log('FALHA  anti-duplicata'); falhas++; }
else console.log('ok     anti-duplicata descarta o que ja existe');

console.log(falhas ? `\n>>> ${falhas} falha(s)` : '\n>>> todos os casos passaram');
