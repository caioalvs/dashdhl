# Painel de Tracking — DHL Operações

Dashboard web para acompanhamento das operações de tracking (Mercado Livre · BRK · TSMS · DHL Portal), construído sobre a base **Controle Tracking New**.

## Como abrir

Abra o arquivo `index.html` no navegador (duplo clique já funciona). Não precisa de servidor nem instalação.

## Estrutura

- `index.html` — estrutura visual do dashboard (tema DHL: amarelo/vermelho sobre grafite)
- `app.js` — toda a lógica: KPIs, gráficos (Chart.js), filtros, troca de abas, busca
- `data.js` — os dados. **Hoje contém dados de exemplo derivados da planilha real.**

## As 4 abas

1. **ETA** — veículos chegando para carregar (perna de origem). KPIs de no prazo / risco / atraso / sem dados, timeline por horário, classificação semáforo, por responsável.
2. **ETD** — veículos em viagem para o destino. KPIs de no prazo / atrasados / parados / pacotes em rota, km restante, status da viagem, situação fiscal.
3. **XPT** — validação de checkpoint (bipagem CPT).
4. **Auditoria base x portal** — cruzamento Meli x Portal x SM, divergências.

## Ligar os dados reais

A máquina de carregamento **já está pronta e testada** no `app.js`. Hoje o painel roda em modo `sample` (lê o `data.js`). Para ligar a planilha viva (que o Sentinela atualiza), são 3 passos:

### 1. Publicar a planilha como CSV

No Google Sheets: **Arquivo → Compartilhar → Publicar na web**. Publique **cada aba** (ETA, ETD, XPT, Validação e, se quiser, ACOMP CPT) com formato **CSV** e copie a URL de cada uma. A URL tem o formato:

```
https://docs.google.com/spreadsheets/d/e/2PACX-XXXX/pub?gid=NNNN&single=true&output=csv
```

### 2. Colar as URLs no `app.js`

Logo no topo do `app.js`, preencha o bloco `SHEET_CSV` e troque a fonte:

```js
const DATA_SOURCE = 'sheets';   // estava 'sample'
const SHEET_CSV = {
  eta:      'https://.../pub?gid=...&output=csv',
  etd:      'https://.../pub?gid=...&output=csv',
  xpt:      'https://.../pub?gid=...&output=csv',
  validacao:'https://.../pub?gid=...&output=csv',
  acompCpt: ''   // opcional — deixe '' se ainda não publicou esta aba
};
```

Abas com URL vazia (`''`) são simplesmente ignoradas — o painel mantém o que já tinha. Pode ligar uma aba de cada vez.

### 3. Conferir os nomes das colunas (só se precisar)

Os mapeadores (`mapEtaRow`, `mapEtdRow`, etc., no fim do `app.js`) já reconhecem os cabeçalhos prováveis em português, **ignorando acentos e maiúsculas**. Se alguma coluna da sua planilha tiver um nome diferente, é só **adicionar** esse nome na lista de `pick(...)` da coluna correspondente — não precisa remover os outros. Exemplo:

```js
// se sua coluna de ETA na origem se chama "Previsão Chegada"
etaOrigem: parseDateBR(pick(x, ['eta origem','eta','previsao chegada'])),
```

Pronto: o painel passa a puxar os dados publicados, derruba o `data.js` de exemplo, e **se atualiza sozinho a cada 5 min** (configurável em `AUTO_REFRESH_MIN`). O botão **↻ Atualizar dados** força um recarregamento na hora. Se uma aba falhar, as outras continuam funcionando e o erro aparece no cabeçalho.

> O parser já lida com vírgulas/aspas/quebras de linha dentro de células, datas no formato BR (`18/06/2026 04:00`) e números BR (`2.895`, `1.234,5`). A classificação semáforo 🟢🟡🔴 é derivada automaticamente do texto da coluna de classificação.

Hospedagem gratuita sugerida: **GitHub Pages**.

## Observação sobre os dados

A aba **ACOMP CPT** entrou como modelo (estrutura provável de acompanhamento de CPT) porque não veio no dump completo da planilha — quando ligarmos os dados reais, é só mapear as colunas certas dela.
