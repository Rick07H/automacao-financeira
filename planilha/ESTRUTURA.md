# Planilha — estrutura (clareza + anti-estouro)

> **Nota sobre esta versão:** este documento é a versão pública/portfólio do
> projeto — os identificadores reais (ID da planilha, conta de serviço, IDs de
> backup) e os valores financeiros foram trocados por exemplos fictícios,
> mantidos internamente consistentes entre si. A lógica, as fórmulas e o
> racional de cada decisão são exatamente os aplicados na planilha real.
>
> **APLICADO em 2026-08-30**, via API do Sheets com uma conta de serviço
> dedicada (Google Cloud service account).
> Backup do estado anterior feito antes da mudança (cópia da planilha).
>
> ## Como ficou
>
> | Aba | Tamanho | Papel |
> |---|---|---|
> | `Resumo Mensal` | 1000×26 | painel principal — abre nele |
> | `Resumo Anual` | 1000×26 | ano corrente + evolução mensal |
> | `Cartões` | 12×8 | faturas: Pluggy (linhas 2–10) + manuais (12+) |
> | `Empréstimos` | 12×7 | manual — a Pluggy só vê a parcela saindo |
> | `Manuais` | 520×7 | Shopee, Amazon, dinheiro |
> | `Transações` | 1787×12 | log, **oculta** |
>
> A aba `Auxiliar` (30.000×12) **foi apagada**. Nenhuma fórmula a referenciava.
>
> ### Mapa de células do `Resumo Mensal`
>
> | Faixa | Bloco |
> |---|---|
> | `B2` | mês de referência (`=TEXT(TODAY();"yyyy-mm")`) — edite para ver outro mês |
> | `A4:C12` | **Quanto este mês vai me custar** (a tabela central) |
> | `A14:F21` | Faturas de cartão (QUERY sobre `Cartões`) |
> | `A25:E31` | Empréstimos (QUERY sobre `Empréstimos`) |
> | `A33:B46` | Gastos por categoria · `D33:E40` indicadores |
> | `D42:E48` | Renda & benefícios (dias úteis editáveis em `E44`) |
> | `A50:E61` | Maiores saídas do mês (QUERY, 10 primeiras) |
>
> O restante deste documento é o **racional de projeto** — por que cada coluna
> e cada filtro existe. As fórmulas em português continuam válidas para colar
> pela interface; o que foi de fato gravado usa nome em inglês (ver a nota de
> locale logo abaixo).

Planilha: **Automação Financeira - Controle de Gastos**
locale `pt_BR`

> **Locale pt_BR — e um detalhe que só apareceu ao ler a planilha pela API:**
>
> - **Colando pela interface:** nome da função em português e `;` como separador
>   (`SOMASES`, `TEXTO`, `SEERRO`, `HOJE`). As fórmulas deste documento estão
>   nessa forma — cole como estão.
> - **Escrevendo pela API do Sheets:** a API só aceita o nome **em inglês**
>   (`SUMIFS`, `TEXT`, `IFERROR`, `TODAY`), mantendo o `;` do locale. As fórmulas
>   que já existem na planilha estão gravadas assim; a interface é que traduz na
>   exibição. Escrever `SOMASES` pela API gera `#NAME?`.
> - Decimal continua com vírgula nos dois casos (`=21,6*Auxiliar!$J$3` é real,
>   está na planilha hoje).
>
> `QUERY` e `ARRAYFORMULA` não são traduzidos em nenhum dos dois casos.

---

## 1. Aba `Transações` — novo cabeçalho

| Col | Nome | Conteúdo | Por que existe |
|-----|------|----------|----------------|
| A | ID Transação | UUID da Pluggy | chave do anti-duplicata |
| B | Data | `DD/MM/AAAA`, data real | leitura e ordenação |
| C | Mês | `AAAA-MM` texto | agrupamento sem aritmética de data |
| D | Banco | Nubank, Bradesco, Inter, Mercado Pago | |
| E | Conta | `Nubank · Cartão Gold` | antes era `gold`, `croma-platinum` |
| F | Descrição | texto do banco | |
| G | Valor | **negativo = saiu do bolso, sempre** | antes o cartão vinha invertido |
| H | Fluxo | `Saída` · `Entrada` · `Movimentação interna` | decide se é gasto |
| I | Categoria | uma das 11 fixas | |
| J | Situação | `Realizado` · `Futuro` | parcela futura não é gasto do mês |
| K | Tipo | `Débito` · `Crédito` | |
| L | Categoria Original | valor cru da Pluggy | rastreabilidade / auditoria |

**Saíram:** `Ano` (o QUERY usa `Mês like '2026%'`) e qualquer coluna auxiliar.

**A coluna que resolve quase tudo é a H (`Fluxo`).** `Movimentação interna` é
dinheiro que mudou de lugar mas continua seu, ou que já foi contado antes:
pagamento de fatura, aplicação em reserva, transferência entre contas próprias,
rendimento. Era uma fração relevante da base que o dashboard vinha somando
como gasto, sem ser.

---

## 2. Aba `Auxiliar` — apagar

Ela existia para gerar Mês/Ano/Classe via `ARRAYFORMULA` sobre 30.000 linhas.
O Code Node agora escreve essas colunas prontas, então a aba não tem mais função.

**Apagar é o principal ganho de performance da planilha.** O peso nunca foram as
linhas de dado — são ~110/mês, ~1.300/ano, coisa que o Sheets aguenta por anos.
O peso são 30 mil fórmulas vivas recalculando a cada `append` diário.

---

## 3. Aba `Resumo Mensal`

> A tabela central (**item 7b**) vai no topo desta aba, acima de tudo que está
> descrito aqui. Ela é a resposta; o que segue é o detalhamento dela.

### Célula de controle

`B2` — mês de referência:

```
=TEXTO(HOJE();"aaaa-mm")
```

Para olhar outro mês, digite por cima (ex.: `2026-07`). Todo o resto do painel
segue esta célula.

### Gastos do mês por categoria

Lista **fixa** de 11 linhas em `A6:A16`, nesta ordem:

```
Alimentação · Transporte · Moradia · Saúde & Bem-estar · Educação · Compras
Assinaturas & Lazer · Serviços & Taxas · Empréstimos · Transferências · Outros
```

Em `B6`, arrastar até `B16`:

```
=-SOMASES(Transações!$G:$G;
          Transações!$C:$C; $B$2;
          Transações!$H:$H; "Saída";
          Transações!$K:$K; "Débito";
          Transações!$J:$J; "Realizado";
          Transações!$I:$I; $A6)
```

> **Por que lista fixa e `SOMASES` em vez de `QUERY` com `group by`:** o QUERY
> devolve só as categorias que tiveram movimento no mês, então o bloco muda de
> tamanho todo mês e o gráfico ancorado nele quebra. Com lista fixa as 11 linhas
> estão sempre lá — categoria zerada mostra `R$ 0,00`, que também é informação.
> É também o que evita repetir o bug de `#REF!` da `D3`.
>
> O `-` na frente é porque a coluna G guarda gasto como negativo. Somar e
> inverter no fim é mais confiável que gravar o sinal trocado na base.

Total em `B17`: `=SOMA(B6:B16)`

### Resumo do mês

| Indicador | Fórmula |
|---|---|
| Total gasto no débito | `=B17` |
| Gasto no crédito (compras do mês) | `=-SOMASES(Transações!$G:$G; Transações!$C:$C;$B$2; Transações!$H:$H;"Saída"; Transações!$K:$K;"Crédito"; Transações!$J:$J;"Realizado")` |
| Entradas recebidas no mês | `=SOMASES(Transações!$G:$G; Transações!$C:$C;$B$2; Transações!$H:$H;"Entrada")` |
| Movimentação interna (não é gasto) | `=SOMASES(Transações!$G:$G; Transações!$C:$C;$B$2; Transações!$H:$H;"Movimentação interna")` |
| Saldo do mês (entradas − gastos) | `=<entradas> - B17` |

O bloco de **faturas em aberto e limites** passa a ler a aba `Cartões` (item 5),
não mais valores escritos direto aqui. O ganho é que os cartões fora do Open
Finance — Shopee, Amazon — entram no mesmo bloco, e o total da tabela central
soma os dois tipos sem tratamento especial.

### Bloco novo: maiores gastos do mês

O objetivo é **você nunca mais precisar abrir a aba Transações**:

```
=SEERRO(
  QUERY(Transações!$A$2:$L;
    "select B, F, G, I
     where C = '"&$B$2&"'
       and H = 'Saída'
       and J = 'Realizado'
     order by G asc
     limit 10
     label B 'Data', F 'Descrição', G 'Valor', I 'Categoria'"; 0);
  "sem lançamentos")
```

`order by G asc` traz os mais negativos primeiro — ou seja, os maiores gastos.

---

## 4. Aba `Resumo Anual`

Mesma lógica, trocando o critério de mês por ano. Célula de controle `B2`:

```
=TEXTO(HOJE();"aaaa")
```

Gastos do ano por categoria (`B6:B16`), usando `like` no texto do mês:

```
=-SOMASES(Transações!$G:$G;
          Transações!$C:$C; $B$2&"-*";
          Transações!$H:$H; "Saída";
          Transações!$K:$K; "Débito";
          Transações!$J:$J; "Realizado";
          Transações!$I:$I; $A6)
```

> `$B$2&"-*"` vira `2026-*`, e o `SOMASES` aceita curinga em critério de texto.
> É o equivalente barato do `like '2026%'` do QUERY.

### Evolução mensal

Coluna de meses em `E6:E17` (`2026-01` a `2026-12`):

```
=ARRAYFORMULA($B$2&"-"&TEXTO(LIN(A1:A12);"00"))
```

Gasto de cada mês, em `F6`, arrastando até `F17`:

```
=-SOMASES(Transações!$G:$G;
          Transações!$C:$C; $E6;
          Transações!$H:$H; "Saída";
          Transações!$K:$K; "Débito";
          Transações!$J:$J; "Realizado")
```

> O filtro `Situação = "Realizado"` é o que corrige o bug atual de aparecer gasto
> em `set` e `out` — meses que ainda não aconteceram. Eram parcelas futuras de
> cartão (compras já feitas mas ainda não faturadas) vazando para dentro do
> total do mês errado.

---

## 5. Aba `Cartões` — faturas automáticas e manuais no mesmo lugar

| Col | Nome | Preenchimento |
|-----|------|---------------|
| A | Cartão | `Nubank · Cartão Gold` |
| B | Origem | banco ou loja (Shopee, Amazon) |
| C | Fonte | `Pluggy` ou `Manual` |
| D | Fatura atual | R$ |
| E | Vencimento | data |
| F | Mês venc. | `=SEERRO(TEXTO(E2;"aaaa-mm");"")` |
| G | Limite | R$ |
| H | Disponível | R$ |

**Linhas 2–10 são do N8N** (`Fonte = Pluggy`), reescritas a cada execução.
**Linha 12 em diante é sua** (`Fonte = Manual`) — o N8N nunca toca abaixo da linha 10.

> **Correção (2026-08-30, lendo a planilha pela API):** o bloco de faturas em
> `Resumo Mensal!A6:F8` era **valor digitado à mão**, não fórmula — o workflow só
> escrevia na aba `Transações`, e por isso os números envelheciam em silêncio.
> Resolvido: a tabela central passou a ler `Cartões!` via QUERY (item 7b), então
> qualquer linha aqui atualiza o painel automaticamente.
>
> **Confirmado: um marketplace, uma loja online e um cartão adicional (fora da
> cobertura do Open Finance) são permanentemente manuais.** Não é bug a
> investigar nem pendência de configuração — a Pluggy simplesmente não alcança
> essas fontes (o marketplace e a loja nunca tiveram Open Finance; o cartão
> adicional é de uma emissora/consentimento fora da cobertura). `Fonte = Manual`
> para eles, para sempre — reescrever fatura e vencimento à mão a cada ciclo é
> o preço de ter visibilidade sobre eles.

---

## 6. Aba `Empréstimos`

| Col | Nome | Preenchimento |
|-----|------|---------------|
| A | Credor | `Empréstimo do Pai` |
| B | Parcela | valor mensal |
| C | Dia venc. | 1–31 |
| D | Parcelas totais | nº |
| E | Parcelas pagas | nº |
| F | Situação | `Ativo` · `Quitado` |
| G | Restante | `=SEERRO((D2-E2)*B2;"")` |

A Pluggy só mostra a parcela **saindo** da conta — ela não sabe o total contratado
nem quantas faltam. Por isso esta aba é manual: é ela que responde "quanto ainda
devo", que é a pergunta que a transação sozinha não responde.

Exemplo ilustrativo: dois empréstimos ativos identificados na base, um via
transferência bancária (~R$ 350,00/mês) e outro via um app de pagamentos
(~R$ 100,00/mês) — cada um com sua parcela e data de vencimento próprias.

---

## 7. Aba `Manuais` — o que o Open Finance não vê

| Col | Nome | Preenchimento |
|-----|------|---------------|
| A | Data | data |
| B | Mês | `=SEERRO(TEXTO(A2;"aaaa-mm");"")` |
| C | Descrição | texto |
| D | Valor | **negativo** para gasto |
| E | Categoria | uma das 11 (validação de dados) |
| F | Origem | Shopee, Amazon, dinheiro… |
| G | Situação | `Realizado` · `Previsto` |

> A fórmula da coluna B vai só até a **linha 500**, não a coluna inteira. É de
> propósito — ver a política anti-estouro. Se um dia passar de 500 lançamentos
> manuais, estenda o intervalo, não troque por coluna inteira.

Coloque **validação de dados** em `E` (as 11 categorias) e em `G`. Sem isso a
lista de categorias racha em variações de digitação e o `SOMASES` para de casar.

---

## 7b. A tabela central — `Quanto este mês vai me custar`

Vai no **topo** do `Resumo Mensal`, antes de tudo. É a resposta que você quer
quando abre a planilha; o resto é detalhamento.

| Linha | Componente | Fórmula |
|---|---|---|
| 1 | Débito já realizado | `=-SOMASES(Transações!$G:$G; Transações!$C:$C;$B$2; Transações!$H:$H;"Saída"; Transações!$K:$K;"Débito"; Transações!$J:$J;"Realizado"; Transações!$I:$I;"<>Empréstimos")` |
| 2 | Empréstimos — parcelas do mês | `=SOMASES(Empréstimos!$B:$B; Empréstimos!$F:$F;"Ativo")` |
| 3 | Faturas de cartão a vencer | `=SOMASES(Cartões!$D:$D; Cartões!$F:$F;$B$2)` |
| 4 | Compras manuais | `=-SOMASES(Manuais!$D:$D; Manuais!$B:$B;$B$2)` |
| 5 | **TOTAL PREVISTO** | `=SOMA(C6:C9)` |
| 6 | Entradas recebidas | `=SOMASES(Transações!$G:$G; Transações!$C:$C;$B$2; Transações!$H:$H;"Entrada")` |
| 7 | Diferença | `=C11-C10` |

> **O `"<>Empréstimos"` na linha 1 não é detalhe.** A parcela do empréstimo já sai
> do débito e já está contada na linha 2, vinda da aba `Empréstimos`. Sem esse
> critério ela entra duas vezes e o total previsto fica maior do que a
> realidade, no valor exato da soma das parcelas.
>
> **Por que a fatura entra pelo valor a vencer e não pelas compras do mês:** o
> cartão é fluxo de caixa futuro. O que sai do seu bolso em agosto é a fatura que
> vence em agosto, não o que você comprou em agosto — isso vence em setembro.
> Somar os dois seria contar a mesma compra duas vezes, em meses diferentes.

Exemplo ilustrativo (valores fictícios, para mostrar a leitura do painel):

```
Débito já realizado              R$ 1.100,00
Empréstimos — parcelas do mês    R$   450,00
Faturas de cartão a vencer       R$ 2.300,00
Compras manuais                  R$     0,00
────────────────────────────────────────────
TOTAL PREVISTO                   R$ 3.850,00
Entradas recebidas               R$ 3.800,00
Diferença                        −R$    50,00
```

---

## 7c. Arquivos prontos para importar

`planilha/abas-novas/` traz as três abas com o que já foi descoberto nos dados —
importe cada CSV numa aba nova (separador `;`, UTF-8):

| Arquivo | Estado |
|---|---|
| `Cartoes.csv` | 3 cartões do Pluggy com fatura/limite (valores fictícios), o cartão adicional em branco e os slots do marketplace e da loja |
| `Emprestimos.csv` | os dois empréstimos identificados na base (valores fictícios) — falta preencher parcelas totais/pagas |
| `Manuais.csv` | só o cabeçalho, de propósito: nada de dado de exemplo em planilha financeira |
| `_categorias-para-validacao.csv` | as 11 categorias, para colar na validação de dados |

> **Os CSVs não trazem as fórmulas** (`Mês venc.`, `Restante`, `Mês`). O separador
> de argumento do pt_BR é `;`, o mesmo do CSV — a fórmula sairia quebrada na
> importação. Cole essas colunas à mão depois, conforme os itens 5, 6 e 7.

---

## 8. Formatação

- **Coluna G (Valor):** formato personalizado
  `"R$ "#.##0,00;[Vermelho]-"R$ "#.##0,00`
  Saída fica vermelha e com sinal, entrada verde-neutra. Bate o olho e entende.
- **Colunas de dashboard:** `"R$ "#.##0,00` — sem sinal, porque o bloco já diz
  que é gasto.
- **Coluna H (Fluxo):** formatação condicional, `Movimentação interna` em cinza.
  Ela aparece na base mas não conta em lugar nenhum — o cinza lembra disso.
- **Aba Transações:** congelar a linha 1, e **ocultar a aba**. Ela é log, não
  painel. Se precisar consultar, use o bloco "maiores gastos do mês".

---

## 9. Política anti-estouro

O volume real é ~110 linhas/mês. A planilha não vai estourar por tamanho — mas
vai por fórmula viva e por acumular anos de log numa aba só.

| Regra | Por quê |
|---|---|
| Nenhuma `ARRAYFORMULA` sobre intervalo aberto | foi o que criou as 30 mil fórmulas da `Auxiliar` |
| `SOMASES` com coluna inteira (`$G:$G`) é seguro | o Sheets otimiza; não recalcula tudo |
| Arquivar por ano: em janeiro, mover o ano fechado para `Transações 2026` | mantém a aba ativa em ~1.300 linhas |
| A aba ativa guarda ano corrente + anterior | histórico continua acessível, sem peso |
| Toda coluna derivada é escrita pelo N8N, não por fórmula | cálculo acontece uma vez, não a cada abertura |

---

## 10. Ordem de aplicação

1. Duplicar a planilha inteira (`Arquivo → Fazer uma cópia`) — rede de segurança.
2. Trocar o Code Node do N8N pelo `n8n/code-node-categorizacao.js`.
3. Rodar o workflow **uma vez em modo manual** e conferir a saída do node antes
   de deixar chegar na planilha.
4. Limpar a aba `Transações` e colar `migracao/transacoes_migradas.csv`
   (`Arquivo → Importar → Substituir planilha atual`, separador `;`).
5. Conferir o mapeamento de colunas no node "Google Sheets - Append" — os nomes
   mudaram, ele casa por nome exato de cabeçalho.
6. Criar as abas `Cartões`, `Empréstimos` e `Manuais` (itens 5, 6 e 7), com
   validação de dados nas colunas de Categoria e Situação.
7. Aplicar as fórmulas — **a tabela central do item 7b primeiro**, depois os
   itens 3 e 4.
8. Preencher à mão o que o Open Finance não vê: Shopee e Amazon em `Cartões`,
   e os dois empréstimos já identificados em `Empréstimos`.
9. Apagar a aba `Auxiliar`.
10. Ocultar a aba `Transações`.
