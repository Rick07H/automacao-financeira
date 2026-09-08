# Automação Financeira

Captura automática de transações de cartão e conta via Open Finance, com
categorização e um painel de controle de gastos alimentado sem digitação
manual. Projeto pessoal para eliminar o registro manual de gastos.

> **Nota:** esta é a versão pública do projeto. Os IDs (planilha, conta de
> serviço) e os valores financeiros de exemplo em `planilha/` foram
> substituídos por dados fictícios, mantendo a lógica e as fórmulas reais —
> ver a nota no topo de `planilha/ESTRUTURA.md`. O histórico real de
> transações (`migracao/`) nunca é versionado, por conter nomes de terceiros.

## Arquitetura

```
Nubank · Bradesco · Inter (Open Finance)
        ↓ autorização via Open Finance (token OAuth revogável)
Pluggy (agregador certificado BACEN)
        ↓ API retorna transações normalizadas
N8N (self-hosted)
  1. Trigger: Schedule (1x/dia)
  2. HTTP Request → Pluggy API (/transactions)
  3. Code Node → normalização + categorização automática
  4. Filter Node → evitar duplicadas (ID único da Pluggy)
  5. Google Sheets Node → adicionar linha
        ↓
Google Sheets — painel de controle financeiro
```

Nenhuma credencial bancária é manipulada diretamente: toda captura passa pelo
fluxo oficial de Open Finance via Pluggy (agregador certificado pelo BACEN).

## Stack

| Componente | Ferramenta |
|---|---|
| Agregador bancário | Pluggy (Open Finance) |
| Orquestração | N8N (self-hosted) |
| Armazenamento/visualização | Google Sheets |
| Categorização | Code Node em JavaScript, regras + normalização |

## Problemas reais resolvidos no Code Node

O `n8n/code-node-categorizacao.js` existe porque a Pluggy entrega os dados
"crus", com inconsistências que quebrariam qualquer soma direta na planilha:

- **Sinal invertido em cartão de crédito** — a Pluggy assina compra como
  positiva e estorno/pagamento como negativa; o node normaliza para
  "negativo = saiu do bolso" sempre, em toda conta.
- **Pagamento de fatura contado como gasto novo** — cada banco rotula esse
  evento de um jeito diferente na categoria da Pluggy (nenhum usa
  `Credit card payment`); uma regra por descrição identifica e marca como
  "Movimentação interna", para não contar a mesma compra duas vezes.
- **Fuso horário deslocando o mês da transação** — parte das transações vem
  com timestamp UTC entre 00h–03h, que já é o dia seguinte no Brasil; o node
  converte para `America/Sao_Paulo` antes de extrair o mês.
- **Parcela futura de cartão contando como gasto do mês atual** — compras
  parceladas aparecem com a data de cada parcela futura; uma coluna
  `Situação` (`Realizado`/`Futuro`) evita que o painel some gasto que ainda
  não aconteceu.
- **Anti-duplicata** — cada execução lê os IDs já gravados na planilha antes
  de processar, para o Schedule Trigger diário nunca duplicar linha.

`n8n/teste-categorizacao.mjs` roda esses cenários como casos de teste
isolados (sem precisar do N8N no ar), cada um representando um bug real
encontrado nos dados durante o desenvolvimento.

## A planilha

Estrutura completa — abas, fórmulas, mapa de células e o racional de cada
decisão de design (por que lista fixa em vez de `QUERY`, por que a fatura
entra pelo valor a vencer e não pelas compras do mês, política anti-estouro
para não acumular milhares de fórmulas vivas) — está documentada em
[`planilha/ESTRUTURA.md`](planilha/ESTRUTURA.md).

## Status

Em uso ativo desde agosto/2026, rodando 1x/dia sem intervenção manual.
