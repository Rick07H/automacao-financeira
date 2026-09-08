# CLAUDE.md — Automação Financeira (Projeto Pessoal Henrique)

## Contexto

Projeto pessoal de Henrique (Founder & CEO da Synexa Oliveira, Automation Technician MES/AVEVA na S.Build/Synexa). Objetivo: eliminar o registro manual de gastos de cartão de crédito, capturando transações automaticamente via Open Finance e alimentando uma planilha de controle financeiro.

Este NÃO é um produto comercial nem um cliente Synexa — é infraestrutura pessoal. Prioridade é **simplicidade e robustez**, não escalabilidade multi-usuário.

## Quem sou eu (para o Claude Code)

Dev em início de carreira. Domínio forte em SQL avançado. HTML/CSS/JS básicos. Conceitos de POO. Experiência com MQTT/IoT/AVEVA (mundo industrial, não web). **Pouca experiência com Node.js/JavaScript de automação e APIs REST modernas** — explique o "porquê" antes do "como" quando o Code Node do N8N tiver lógica não trivial. Não sou iniciante absoluto: pule explicações de fundamentos de programação (variáveis, loops, condicionais).

## Princípio de segurança inegociável

- **NUNCA** implementar login/senha bancário direto (screen scraping). Toda captura passa OBRIGATORIAMENTE pelo fluxo oficial de Open Finance via Pluggy (agregador certificado BACEN).
- Credenciais (CLIENT_ID, CLIENT_SECRET da Pluggy) SEMPRE em `.env`, nunca hardcoded, nunca commitado. `.gitignore` deve cobrir `.env` desde o primeiro commit.
- Se o N8N tiver webhook público, exigir autenticação (Basic Auth mínimo) antes de liberar qualquer endpoint.

## Arquitetura

```
Nubank · Bradesco · Inter (Open Finance)
        ↓ autorização via Open Finance (token OAuth revogável)
Pluggy (agregador certificado BACEN)
        ↓ API retorna transações normalizadas
N8N (instância self-hosted já existente)
  1. Trigger: Schedule (1x/dia)
  2. HTTP Request → Pluggy API (/transactions)
  3. Code Node → categorização automática (regras simples)
  4. Filter Node → evitar duplicadas (comparar ID único da Pluggy)
  5. Google Sheets Node → adicionar linha
        ↓
Google Sheets — Planilha de Controle Financeiro
  Aba: Transações (Data, Banco, Descrição, Valor, Categoria, Tipo)
  Aba: Dashboard (gráficos automáticos via QUERY() / tabela dinâmica)
```

## Stack

| Componente                 | Ferramenta                                                   |
| -------------------------- | ------------------------------------------------------------ |
| Agregador bancário         | Pluggy (Open Finance, certificado BACEN)                     |
| Automação/orquestração     | N8N (self-hosted, instância já existente)                    |
| Armazenamento/visualização | Google Sheets                                                |
| Categorização              | Regras simples (Code Node, JS) — pode evoluir para IA depois |

## Plano de execução — 4 semanas

### Semana 1 — Conexão e Captura Bruta
- [ ] Criar conta na Pluggy (free tier, uso pessoal)
- [ ] Conectar Nubank, Bradesco e Inter via Open Finance
- [ ] Obter `CLIENT_ID` e `CLIENT_SECRET` da API
- [ ] Workflow N8N básico: Schedule Trigger + HTTP Request → Pluggy `/transactions`
- [ ] Validar que as transações vêm corretas (log simples, sem planilha ainda)

**Critério de pronto:** rodar o workflow manualmente e ver no console do N8N as transações reais dos 3 bancos, sem erro de auth.

### Semana 2 — Categorização e Planilha
- [ ] Criar planilha Google Sheets, aba "Transações" (Data, Banco, Descrição, Valor, Categoria, Tipo)
- [ ] Code Node com regras de categorização (Uber/99 → Transporte, iFood/Mercado → Alimentação, etc.)
- [ ] Filter Node anti-duplicata (comparar ID único do Pluggy)
- [ ] Google Sheets Node (Append Row) conectado ao fluxo
- [ ] Rodar por alguns dias, validar dados reais caindo na planilha

**Critério de pronto:** rodando 1x/dia sozinho, sem duplicar, sem intervenção manual.

### Semana 3 — Dashboard Visual
- [ ] Aba "Dashboard" na planilha
- [ ] Gráficos (gasto por categoria, por banco, por mês)
- [ ] Validar que os números cruzam com o diagnóstico manual de gastos já feito

### Semana 4 — Alertas (opcional)
- [ ] Node de notificação (WhatsApp ou Telegram) com resumo diário/semanal
- [ ] Definir conteúdo do alerta (total gasto, categoria que mais pesou, comparação com semana anterior)

## O que NÃO fazer

- Não construir tudo de uma vez — seguir a ordem das 4 semanas
- Não pular a Semana 1 (captura bruta) para já categorizar — validar a base primeiro
- Não conectar dados bancários fora do Open Finance / agregador certificado
- Não expor CLIENT_SECRET em log, print, ou código-fonte versionado
- Não superengenheirar — é projeto pessoal de 1 usuário, não plataforma

## Convenções de código

- Code Nodes do N8N: JavaScript comentado, nomes de variável em português ou inglês (consistência dentro do mesmo node)
- Nomenclatura de categorias: fixar uma lista curta (~8-10 categorias) antes de escrever a regra, para não gerar categoria nova a cada transação
- Documentar cada workflow do N8N com uma nota (Sticky Note) explicando o que o bloco faz — Henrique vai revisar isso daqui a meses

## Formato de trabalho esperado

- Explicação antes do código, intercalado (nunca despejar tudo de uma vez)
- Uma pergunta por vez quando houver ambiguidade
- Entregar código quando solicitado
- Sinalizar riscos sem travar o progresso
- Preferir soluções de camada gratuita (Pluggy free tier, N8N self-hosted, Google Sheets)

---
*Criado: Julho 2026 — Sessão com Claude (Anthropic), a partir do planejamento original registrado no Henrique OS (Notion).*