# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é isto
Painel web estático (HTML/CSS/JS puro, sem framework, Chart.js pra gráficos) que **lê** a planilha Google "Controle Tracking New" — a mesma que o robô `Sentinela` (`../Automacao_ML/robo_ml.py`) alimenta. O painel só lê; não escreve na planilha nem interage com os robôs. Publicado em produção via GitHub Pages (`caioalvs/dashdhl`). Único projeto desta pasta `Claudinho/` que é um repositório git de fato — os outros dois são só pastas locais.

## Como rodar
- **Local**: `python server.py` ou duplo-clique em `abrir-painel.bat` → abre `http://localhost:8000/index.html`. O `.bat` tenta nesta ordem `py`, `python`, depois `npx http-server`; `server.py` é um `http.server` simples com headers `no-store/no-cache` pra refletir mudanças no reload sem precisar de hard-refresh.
- **Nunca abrir `index.html` por duplo clique direto** — rodando como `file://` o navegador bloqueia o `fetch()` dos CSVs do Google, e o painel cai silenciosamente pra aviso de erro.
- **Sem testes automatizados/CI.** Validação manual descrita no README: `node --check app.js` (só sintaxe) + confirmação visual de que cada `$('#id')` referenciado em `app.js` existe em `index.html`.
- **Publicar**: commit + push pra `main` no repo `caioalvs/dashdhl` — GitHub Pages republica sozinho em ~1–2 min. Os dados da planilha atualizam sozinhos (auto-refresh no cliente), não precisa republicar pra isso.

## Arquitetura
Três arquivos fazem o painel; tudo roda no navegador, sem build step/bundler/transpilação:
- **`index.html`** — estrutura, tema (amarelo `#FFCC00` / vermelho `#D40511` da DHL), layout responsivo (sidebar no desktop, barra inferior no celular).
- **`app.js`** (~1100 linhas) — toda a lógica. Sem módulos/import; um único arquivo carregado depois de `data.js`.
- **`data.js`** — dados de **exemplo**, usados só quando `DATA_SOURCE = 'sample'`; em produção (`DATA_SOURCE = 'sheets'`, já o valor atual no topo de `app.js`) é ignorado.

### Fonte de dados e ciclo de carga (`app.js`)
- Config no topo do arquivo: `DATA_SOURCE` (`'sample'`/`'sheets'`) e `SHEET_CSV` — mapa de URLs de CSV publicado (Arquivo → Compartilhar → Publicar na web, cada aba como CSV) para as abas `eta`, `etd`, `xpt`, `validacao`, `sm` (apoio: origem/destino por protocolo) e `acompCpt` (opcional, ainda vazio — aba "ACOMP CPT" é só placeholder até ser preenchida). **As URLs já estão preenchidas com a planilha real** — são links de "publicar na web" (públicos por natureza, mas evite divulgar/colar em lugares externos sem necessidade).
- `boot()` (disparado em `DOMContentLoaded`) detecta se está rodando como `file://` (mostra aviso e usa só os dados de exemplo), senão chama `loadFromSheets()`, monta filtros (`initEtaFilters`/`initEtdFilters`), renderiza tudo (`renderAll()`) e arma o auto-refresh (`startAutoRefresh`, a cada `AUTO_REFRESH_MIN` = 5 min).
- `loadFromSheets()` busca todas as abas configuradas em paralelo (`Promise.allSettled`) via `fetchTab()` → `parseCsv()` → mapeador da aba (`mapEtaRow`, `mapEtdRow`, `mapXptRow`, `mapValRow`, `mapSmRow`, `mapAcompRow`); falha em uma aba não derruba as outras, e o erro de cada uma aparece concatenado no cabeçalho.
- `parseCsv()` é um parser RFC 4180 escrito à mão (aspas, vírgulas e quebras de linha dentro de campo); `cell(row,'X')` lê coluna por **letra** (posição), e `pick(idx, aliases, fallback)` é o fallback tolerante por **nome** de cabeçalho (aceita variação de acento/maiúscula) — pra ajustar um cabeçalho que mudou na planilha, normalmente basta adicionar o nome novo na lista de aliases do mapeador correspondente, sem tocar no resto.
- Datas/números são parseados em formato BR (`parseDateBR`, `parseNum`: `18/06/2026 04:00`, `2.895`, `1.234,5`).

### Regras de negócio por aba (lidas por posição de coluna)
- **ETA**: `F` = horário máximo de chegada, `G` = horário real. `G < F` → No prazo; `G ≥ F` → Atrasado (guarda minutos de atraso); `G` vazio → Aguardando. `K`/`L` = status da rota, só exibidos.
- **ETD**: `A` protocolo, `B` nomenclatura, `C` placa, `F` horário de destino, `L` status da SM (contém "parado" → entra na lista de Parados), `Q` km/h médio necessário (faixa: ≤55 No prazo, 56–65 Risco, >65 Possível atraso), `R` km percorridos na última hora, `S` velocidade atual. Rotas XPT/REV/reversa vão pra tabela "Não prioritárias". Origem/destino reais vêm da aba **SM** (ligada pelo protocolo) — a coluna `O` do ETD é só o sinal de GPS, não o destino.
- **SM** (apoio, não é aba própria do painel): `F` protocolo, `O`/`P` cidade/UF de origem, `T`/`U` cidade/UF de destino.
- **XPT**: validação de checkpoint (bipagem CPT). **PORTAL**: auditoria Meli × Portal × SM (divergências).

### Barra de progresso por distância (objeto `DIST`, perto do fim de `app.js`)
`% = (distância total origem→destino − km faltante) / distância total`. Distância total resolvida por geocodificação gratuita: **Nominatim** (cidade+UF → lat/lon) + **OSRM** (rota rodoviária real, não linha reta) — encadeados em `DIST.geocode()`/`DIST.route()`, com fila (`DIST.queue`/`DIST.run()`) e cache em `localStorage` (`dhl_geo`, `dhl_pair`) pra cada par origem/destino resolver só uma vez. Respeita o rate limit do Nominatim (~1 req/seg, `sleep(1100)` entre chamadas). Enquanto resolve, a célula mostra "…"; se a cidade não geocodificar, "s/ rota".

### Interatividade
- **Filtros multi-seleção** (`buildMultiSelect`, checkboxes; vazio = todos) nas abas ETA/ETD, estado em `filters.eta`/`filters.etd`.
- **KPIs clicáveis** (`bindKpiCards`): clicar num card filtra as tabelas (ex. "Atrasados", "Risco", "Parados"); o card "Total" limpa o filtro; o card ativo mostra "✓ filtrando" (`syncKpiActive`).

## Pontos de atenção
- `DATA_SOURCE` já está em `'sheets'` com `SHEET_CSV` preenchido com URLs reais da planilha de produção — qualquer teste local já bate na planilha de verdade (modo somente-leitura, então é seguro, mas não é um ambiente isolado de "exemplo").
- Mudança de cabeçalho na planilha de origem normalmente não exige tocar na lógica — só adicionar o alias novo em `pick(...)` do mapeador certo. Mudança de **posição** de coluna (lidas por letra via `cell(row,'X')`) é mais arriscada: exige atualizar a letra hardcoded no mapeador correspondente.
- A aba **ACOMP CPT** está deliberadamente incompleta (`acompCpt: ''`, `mapAcompRow` existe mas sem URL ligada) — é esperado, só falta publicar a aba e colar a URL quando o usuário decidir ativar.
- Sem testes automatizados nem bundler: qualquer mudança em `app.js` se valida abrindo o painel local (`abrir-painel.bat`) e observando as 4 abas com dado real.
