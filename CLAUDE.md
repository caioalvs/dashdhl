# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é isto
Painel web estático (HTML/CSS/JS puro, Chart.js pra gráficos, Leaflet pro mapa) que **lê** a planilha Google "Controle Tracking New" — a mesma que o robô `Sentinela` (`../Automacao_ML/robo_ml.py`) alimenta. O painel só lê; não escreve na planilha nem interage com os robôs. Publicado em produção via GitHub Pages (`caioalvs/dashdhl`). Único projeto desta pasta `Claudinho/` que é um repositório git de fato.

## Como rodar
- **Local**: `python server.py` ou duplo-clique em `abrir-painel.bat` → abre `http://localhost:8000/index.html`. O `server.py` é um `http.server` com headers `no-store/no-cache`.
- **Nunca abrir `index.html` por duplo clique direto** — como `file://` o navegador bloqueia o `fetch()` dos CSVs do Google e o painel cai pra aviso de erro.
- **Sem testes automatizados/CI.** Validação: `node --check app.js` (sintaxe) + conferir visualmente. Como o mount do ambiente pode ficar congelado, valida-se lógica nova escrevendo a função isolada em `/tmp/snipN.js` e rodando `node`.
- **Publicar**: commit + push pra `main` no repo `caioalvs/dashdhl` — GitHub Pages republica em ~1–2 min. Os dados da planilha atualizam sozinhos no cliente (auto-refresh 5 min), não precisa republicar pra isso.

## Arquitetura
Tudo roda no navegador, sem build step/bundler:
- **`index.html`** — estrutura, tema (amarelo `#FFCC00` / vermelho `#D40511` da DHL, fundo claro "premium"; tema escuro NOC opcional via `body.noc`), layout responsivo (sidebar no desktop, barra inferior no celular). Chart.js + Leaflet carregados no fim do `<body>`.
- **`app.js`** (~2200+ linhas) — toda a lógica. Sem módulos; um arquivo carregado depois de `data.js`.
- **`data.js`** — dados de **exemplo**, usados só quando `DATA_SOURCE = 'sample'`; em produção (`'sheets'`, valor atual) é ignorado.
- **`coordenadas-service-centers.gs.txt`** — Apps Script de apoio (roda na planilha, não no painel): preenche a coluna H da aba Links com as coordenadas, resolvendo os links curtos do Maps. Re-rodável; pode ter gatilho diário.
- **`historico-supabase-apps-script.gs.txt`** — Apps Script que, todo dia, lê a Base e envia as viagens **finalizadas** pro Supabase (histórico de longo prazo). Chave de upsert = `protocolo|trecho`. Usa a `service_role` (secret, só no script).
- **`historico-supabase-setup.md`** — passo a passo pra criar o projeto Supabase + a tabela `viagens_historico` (SQL + RLS de leitura pública).

### Fonte de dados e ciclo de carga (`app.js`)
- Config no topo: `DATA_SOURCE` (`'sample'`/`'sheets'`) e `SHEET_CSV` — mapa de URLs de CSV publicado (cada aba como CSV) para as abas:
  - **abas do painel**: `eta`, `etd`, `xpt`, `validacao`
  - **apoio**: `sm` (origem/destino cidade+UF por protocolo), `ocorrencias` (motivo em sistema), `base` (fonte central de status), `links` (sigla → nome/endereço/coordenada do service center), `od` (nomenclatura → siglas/nomes de origem e destino)
  - `acompCpt` segue como placeholder (URL vazia).
- **`SUPABASE`** (const no topo, separado do `SHEET_CSV`): `url` + `anon` (chave pública, só leitura via RLS). É a fonte da aba **Relatórios** (histórico), não das outras abas.
- `boot()` (em `DOMContentLoaded`) detecta `file://` (mostra aviso, usa exemplo), senão chama `loadFromSheets()`, monta filtros, `renderAll()` e arma o auto-refresh (`AUTO_REFRESH_MIN` = 5 min). Também liga `bindViewTools` (telão/PDF/compacto), `bindGlobalSearch`, `bindKeyboard`, `DIST.load()`.
- `loadFromSheets()` busca todas as abas em paralelo (`Promise.allSettled`); falha em uma não derruba as outras.
- `parseCsv()` é parser RFC 4180 à mão; trata a **linha 0 como cabeçalho** (abas sem cabeçalho perdem a 1ª linha). `cell(row,'X')` lê coluna por **letra** (inclusive duplas, ex. `AM`); `pick(idx, aliases)` é fallback tolerante por **nome** de cabeçalho.
- Datas/números em formato BR (`parseDateBR`, `parseNum`).

### Regras de negócio por aba (lidas por posição de coluna)
- **ETA**: `F` = horário máx. de chegada, `G` = horário real. `G < F` No prazo; `G ≥ F` Atrasado; `G` vazio Aguardando. `U` = status da viagem. Tabela mostra **Ocorrência/Motivo** (ocorrência + causa raiz da Base), também no popup do mapa.
- **ETD**: `A` protocolo (= **Rostering ID** da Base), `B` nomenclatura, `C` placa, `D` CPT, `F` horário de destino, `L` status da SM, `Q` km/h médio necessário (≤46 No prazo, 47–55 Risco, >55 Possível atraso), `R` km última hora, `S` velocidade, `T` pacotes, `U`/`V` posto fiscal, `W` **Documentos (DOCS)**. Rotas XPT/REV/reversa vão pra "Não prioritárias".
- **SM** (apoio): `F` protocolo, `O`/`P` cidade/UF origem, `T`/`U` cidade/UF destino.
- **Base** (apoio, **fonte central**, liga por **Rostering ID** = protocolo do ETD): `B` Rostering ID, `A` Route ID, `S` Origem ETD (saída **programada** — usada no Portal), `T` Origem ATD (saída real), `AM` **Estado** (`Pendente`/`Em andamento`/`Finalizado`/`Cancelado`), `AN` Substatus, `AQ` Causa raiz do incidente. É uma **janela rolante de ~13 dias** (não guarda passado — por isso o histórico vai pro Supabase).
- **Origem-destino** (apoio, liga por **nomenclatura** = col B do ETD): `B`/`C` sigla/nome origem, `D`/`E` sigla/nome destino, `F` nomenclatura.
- **Links** (apoio, liga por **sigla**): `A` nome/cidade, `B` sigla, `E` endereço escrito, `G` link do Maps, `H` coordenada `lat, lon` (preenchida pelo Apps Script).
- **XPT**: validação de checkpoint (bipagem CPT). **PORTAL** (`validacao`): auditoria, `H` status portal, `O` divergência, + coluna **Saída programada** (puxada da Base col `S` pelo protocolo, pra saber prioridade).

### Status pela Base (correção do "aguardando início" e do "finalizado")
A Base **manda sobre a SM** (`enrichData`, loop do ETD):
- `Estado = Pendente` → `naoIniciada`: a rota não saiu; não conta como parado/risco/ofensor/alerta, sai do cálculo de SLA e do mapa, e aparece na tabela "Aguardando início".
- `Estado = Finalizado` ou `Cancelado` → oculta (`finalizada`).
- `Estado = Em andamento` → **mostra**, mesmo que a SM tenha finalizado antes (divergência: SM finaliza cedo, Base ainda em viagem → continua visível pra corrigir).
- Sem registro na Base → cai no comportamento da SM (`L` contém "finaliz" → oculta).

### Localização precisa do service center (mapa + distância)
A linha/pontilhado e a distância usam a **coordenada exata** do service center, não o centro da cidade:
1. **Coluna H** da Links (`lat, lon`) tem prioridade; senão
2. extrai do link do Maps (`!3d!4d` = pin exato, ou `@lat,lon` = centro); senão
3. geocodifica o endereço escrito (col E) via Nominatim — **mas** muitos endereços são marcos de rodovia que o Nominatim não acha; por isso a coluna H é a fonte boa; senão
4. cai pra cidade+UF da SM (fallback).
`DIST.seed(str, coords)` injeta coords conhecidas no cache (`dhl_geo`) sem chamar Nominatim. A rota rodoviária real vem do OSRM (`DIST.route`), com geometria cacheada (`dhl_geom`) e `pointAlong` posicionando o veículo sobre a estrada.

### Histórico e Relatórios (Supabase)
A Base é uma janela rolante (~13 dias), então o histórico de longo prazo vive no **Supabase** (Postgres grátis):
- **Fluxo**: Base → `historico-supabase-apps-script.gs.txt` (Apps Script diário) → tabela `viagens_historico` no Supabase → aba **Relatórios** do painel lê via REST com a chave `anon` (RLS só-leitura).
- **Grava só viagens `Finalizado`**, chave = `protocolo|trecho` (viagem multi-trecho tem 1 linha por trecho — não deduplica por protocolo!). Upsert por essa chave.
- No `app.js`: `fetchHistorico(start,end)` (REST paginado), `renderRelatorios()` (agrega no cliente) e `renderRelCharts()`. Seletor de período: Hoje/7d/Mês/Trimestre/Semestre/Ano.
- Cortes: pontualidade (no prazo × atraso via `resultado`=Substatus), pacotes (soma), ocorrência (`causa_raiz`), **finalizadas por hora da chegada**, **volumetria de saída por turno** (dia 06:30–18:30 = 390–1110 min; resto = noite; sobre `saida_programada`).
- Chave `service_role` (escrita) **nunca** vai pro painel — só no Apps Script. A `anon` é pública por design.

### Abas/visões do painel
ALERTAS (kanban por prioridade), **GESTÃO** (placar SLA, tendência de pontualidade, atrasos por destino clicável, principais ofensores com motivo, resumo clicável), ETA, ETD, XPT, PORTAL, MAPA, **RELATÓRIOS** (histórico via Supabase). Nav com ícones SVG.

### Interatividade e recursos
- **Filtros multi-seleção** + **cabeçalhos ordenáveis** (A-Z/Z-A) + **KPIs clicáveis** (ETA/ETD).
- **Busca global**, **observar protocolo** (fixar), **detalhe da rota** (drawer com ação recomendada, dados da Base, service center origem/destino com endereço + "Abrir no mapa").
- **Modo telão** (tela cheia rotativa pra TV), **Imprimir/PDF** (print CSS), **modo compacto** de tabela.
- **Toasts** de novo crítico, **saúde dos dados** (contagem regressiva do próximo sync), **histórico leve** em `localStorage` pra tendência.
- Caches em `localStorage`: `dhl_geo`/`dhl_pair`/`dhl_geom` (geo/rota), `dhl_hist` (snapshots), `dhl_view` (aba+filtros), `dhl_watch` (observados), `dhl_compact`, `dhl_theme`.

## Pontos de atenção
- Mudança de **posição** de coluna nas abas exige atualizar a letra hardcoded no mapeador. Mudança de **nome** de cabeçalho normalmente só precisa de novo alias em `pick(...)`.
- A ligação Origem-destino é por nomenclatura (col F): rotas novas sem cadastro caem no fallback da SM até serem adicionadas na aba.
- Service centers sem coordenada (coluna H vazia e link sem `@`/`!3d`) caem no fallback de cidade — preencher a H (script ou manual) resolve.
- Sem testes automatizados nem bundler: validar abrindo o painel local e/ou rodando funções isoladas no Node.
