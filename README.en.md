# Financial Automation

Automatic capture of credit card and bank account transactions through Open Finance, with categorization and a spending dashboard that runs with no manual entry. A personal project, built to stop typing expenses by hand.

> This is the public version. Spreadsheet IDs, service account details and the sample values in `planilha/` were replaced with fictional data. The logic and formulas are the real ones. The real transaction history is never committed.

Portuguese version: [README.md](README.md)

## Architecture

```
Nubank · Bradesco · Inter (Open Finance)
        ↓ consent through Open Finance (revocable OAuth token)
Pluggy (aggregator certified by the Brazilian central bank)
        ↓ API returns normalized transactions
n8n (self-hosted)
  1. Trigger: Schedule (once a day)
  2. HTTP Request → Pluggy API (/transactions)
  3. Code node → normalization + automatic categorization
  4. Filter node → skip duplicates (Pluggy's unique transaction ID)
  5. Google Sheets node → append a row
        ↓
Google Sheets — spending dashboard
```

No bank credentials are handled directly. Every capture goes through the official Open Finance flow via Pluggy.

## Stack

| Part | Tool |
|---|---|
| Bank aggregator | Pluggy (Open Finance) |
| Orchestration | n8n (self-hosted) |
| Storage and dashboard | Google Sheets |
| Categorization | JavaScript in an n8n Code node: rules and normalization |

## Real data problems solved in the Code node

`n8n/code-node-categorizacao.js` exists because Pluggy returns raw data with inconsistencies that would break any direct sum in the spreadsheet:

- **Inverted sign on credit cards.** Purchases come as positive and refunds as negative. The node normalizes everything to "negative = money out of pocket", for every account.
- **Card bill payment counted as a new expense.** Each bank labels this event differently and none uses the right category. A description-based rule marks it as an internal movement, so the same purchase is not counted twice.
- **Time zone moving a transaction to the wrong month.** Some timestamps arrive in UTC between 00:00 and 03:00, which is still the previous day in Brazil. The node converts to `America/Sao_Paulo` before taking the month.
- **Future installments counted as spending this month.** Installment purchases show up with the date of each future installment. A status column (`Realizado` / `Futuro`) keeps the dashboard from adding spending that has not happened yet.
- **Duplicate protection.** Each run reads the IDs already saved in the sheet before processing, so the daily schedule never duplicates a row.

## Run the tests

The categorization rules have test cases, each one based on a real bug found in the data. They run without n8n:

```bash
node n8n/teste-categorizacao.mjs
```

Tested with Node 24. Expected last line: `todos os casos passaram` (all cases passed).

## Setup, in outline

The n8n workflow is built in the n8n editor following the architecture above; the Code node content is in `n8n/code-node-categorizacao.js`. There is no import file for the full workflow in this repository.

1. Create a Pluggy account and an application, and keep the client ID and secret in `.env` (see `.env.example`).
2. Connect your accounts through Pluggy; this is where Open Finance consent is given.
3. Create a Google Sheet and a Google Cloud service account with edit access to it.
4. In n8n, create the workflow from the architecture above and paste the Code node.

The sheet layout, formulas and the reasons behind each design choice are in [`planilha/ESTRUTURA.md`](planilha/ESTRUTURA.md) (in Portuguese).

## Status

In daily use since August 2026, running once a day with no manual work.
