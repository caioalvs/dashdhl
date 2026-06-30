# Painel de Tracking — DHL × Mercado Livre

Torre de controle web da operação de tracking de logística, construída sobre a base **Controle Tracking New** (que o robô **Sentinela** atualiza). O painel só **lê** a planilha — não mexe no Sentinela.

🌐 **No ar:** https://caioalvs.github.io/dashdhl/ (GitHub Pages — `caioalvs/dashdhl`)

Tema DHL: amarelo `#FFCC00` e vermelho `#D40511` (vermelho reservado a alertas) sobre fundo claro. Logo lockup **DHL × Mercado Livre**. Responsivo (no celular a navegação vira barra inferior). Tem tema escuro NOC opcional.

## Arquivos

- `index.html` — estrutura visual, tema, layout responsivo, sidebar/topo
- `app.js` — toda a lógica: carregamento dos CSVs, parser, mapeadores, KPIs, gráficos (Chart.js), mapa (Leaflet), filtros, busca, detalhe, etc.
- `data.js` — dados de **exemplo** (usados só se `DATA_SOURCE = 'sample'`)
- `abrir-painel.bat` + `server.py` — servidor local sem cache (não precisam ir pro GitHub)
- `coordenadas-service-centers.gs.txt` — Apps Script de apoio que roda **na planilha** (não no site): preenche as coordenadas dos service centers na coluna H da aba Links

## As visões

1. **GESTÃO** — visão executiva: placar de SLA (pontualidade vs meta), tendência da pontualidade, atrasos por destino (clicável) e principais ofensores com o motivo do atraso.
2. **ALERTAS** — central por prioridade (kanban Crítico / Atenção / Portal).
3. **ETA** — veículos chegando para carregar. No prazo / Atrasado / Aguardando.
4. **ETD** — veículos em viagem. Faixas de risco, parados, **aguardando início**, não prioritárias, posto fiscal, e barra de progresso por rota.
5. **XPT** — validação de checkpoint (bipagem CPT).
6. **PORTAL** — auditoria base Meli × Portal × SM (divergências).
7. **MAPA** — frota sobre a estrada (rota real), posição por % concluído.

## Fonte de dados (modo produção)

No topo do `app.js`, `DATA_SOURCE = 'sheets'` e o bloco `SHEET_CSV` aponta para abas publicadas como CSV (Arquivo → Compartilhar → Publicar na web → cada aba como CSV):

- **abas do painel**: `eta`, `etd`, `xpt`, `validacao`
- **apoio**: `sm` (origem/destino cidade+UF), `ocorrencias` (motivo em sistema), `base` (fonte central de status), `links` (sigla → nome/endereço/coordenada do service center), `od` (nomenclatura → siglas/nomes de origem e destino)

O painel **se atualiza sozinho a cada 5 min** (`AUTO_REFRESH_MIN`). O botão **↻ Atualizar** força recarregamento. Falha em uma aba não derruba as outras. Pra rodar local, **não abra por duplo clique** (o `file://` bloqueia o fetch) — use o `abrir-painel.bat`.

## Regras de negócio (definidas pela operação)

Colunas lidas por **posição** (letra), via `cell(row,'X')`:

**ETA** — `F` horário máx. de chegada · `G` horário real → **G < F No prazo**, **G ≥ F Atrasado**, **G vazio Aguardando** · `U` status da viagem.

**ETD** — `A` protocolo (= Rostering ID) · `B` nomenclatura · `C` placa · `F` horário destino · `L` status da SM · `Q` km/h médio necessário (≤46 No prazo · 47–55 Risco · >55 Possível atraso) · `R` km última hora · `S` velocidade · `U`/`V` posto fiscal. XPT/REV/reversa → "Não prioritárias".

**Base** (fonte central, liga por **Rostering ID**) — `AM` Estado (`Pendente`/`Em andamento`/`Finalizado`/`Cancelado`) · `AN` Substatus · `T` saída real da origem · `AQ` causa raiz. **A Base manda sobre a SM**: `Pendente` → "Aguardando início" (não vira parado/risco); `Finalizado`/`Cancelado` → oculta; `Em andamento` → continua visível mesmo se a SM finalizou antes (divergência a corrigir).

**Origem-destino** (liga por **nomenclatura**, col F) — `B`/`C` sigla/nome origem · `D`/`E` sigla/nome destino.

**Links** (liga por **sigla**) — `A` nome · `B` sigla · `E` endereço · `G` link Maps · `H` coordenada `lat, lon`.

**SM** (apoio) — `F` protocolo · `O`/`P` cidade/UF origem · `T`/`U` cidade/UF destino.

### Mapa e barra de progresso (% concluída)

`% = (distância total origem→destino − km faltante) / distância total`. A linha é a **rota rodoviária real** (OSRM) e o veículo fica **sobre a estrada**. A localização de origem/destino usa a **coordenada exata do service center**: primeiro a coluna H da Links (`lat, lon`), senão o pin do link do Maps (`!3d!4d` ou `@`), senão geocodifica o endereço, senão cidade+UF. Cache em `localStorage`.

### Coordenadas dos service centers (coluna H)

Os endereços escritos costumam ser marcos de rodovia que o geocodificador não acha, então a coordenada exata vem da **coluna H** da aba Links. O script `coordenadas-service-centers.gs.txt` preenche essa coluna automaticamente (resolvendo os links curtos do Maps) — roda na planilha em Extensões → Apps Script, é re-rodável e pode ter gatilho diário. Casos que o script não resolve dá pra preencher na mão: clique direito no Maps → copiar coordenadas → colar em H no formato `-23.5112776, -46.8232641` (ponto no decimal).

## Interatividade

- **Filtros multi-seleção** e **cabeçalhos ordenáveis** (A-Z/Z-A) em ETA e ETD.
- **KPIs clicáveis**: clicar num card filtra as tabelas; o card ativo mostra "✓ filtrando".
- **Busca global** (protocolo/placa/rota/destino), **observar protocolo** (fixar), **detalhe da rota** (drawer com ação recomendada, dados da Base e service center de origem/destino com endereço + "Abrir no mapa").
- **Modo telão** (tela cheia rotativa pra TV), **Imprimir/PDF**, **modo compacto** de tabela.
- Sempre que aparece uma rota: **protocolo + nomenclatura** juntos.

## Publicar atualizações

Site servido pelo GitHub (`caioalvs/dashdhl`), não pela pasta local:

- **Dados** (planilha): atualizam sozinhos, sem republicar.
- **Código**: depois de mudar arquivos, **Commit → Push** (GitHub Desktop ou git). O Pages republica em ~1–2 min.

## Notas técnicas

- Parser CSV próprio (aspas/vírgulas/quebras dentro da célula); datas/números BR.
- Mapeadores aceitam coluna por **letra** (`cell`) e por **nome** (fallback `pick`, tolerante a acento/maiúscula).
- Sem testes automatizados nem bundler: valida-se com `node --check app.js` + funções isoladas no Node + conferência visual.
- A aba **ACOMP CPT** segue como modelo (URL vazia) — é só publicar e preencher quando quiser.
