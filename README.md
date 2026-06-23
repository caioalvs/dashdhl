# Painel de Tracking — DHL × Mercado Livre

Torre de controle web da operação de tracking de logística, construída sobre a base **Controle Tracking New** (que o robô **Sentinela** atualiza). O painel só **lê** a planilha — não mexe no Sentinela.

🌐 **No ar:** https://caioalvs.github.io/dashdhl/ (GitHub Pages — `caioalvs/dashdhl`)

Tema DHL: amarelo `#FFCC00` e vermelho `#D40511` (vermelho reservado a alertas) sobre fundo claro. Logo lockup **DHL × Mercado Livre**. Responsivo (no celular a navegação vira barra inferior).

## Arquivos

- `index.html` — estrutura visual, tema, layout responsivo, sidebar/topo
- `app.js` — toda a lógica: carregamento dos CSVs, parser, mapeadores, KPIs, gráficos (Chart.js), filtros multi-seleção, KPIs clicáveis, barra de progresso por distância
- `data.js` — dados de **exemplo** (usados só se `DATA_SOURCE = 'sample'`)
- `abrir-painel.bat` + `server.py` — servidor local sem cache (para rodar na máquina; **não precisam ir pro GitHub**)

## As 4 abas

1. **ETA** — veículos chegando para carregar. No prazo / Atrasado / Aguardando, taxa de pontualidade e atraso médio.
2. **ETD** — veículos em viagem para o destino. Faixas de risco, parados, pacotes, 3 tabelas por faixa + 1 de não prioritárias, e barra de progresso por rota.
3. **XPT** — validação de checkpoint (bipagem CPT).
4. **PORTAL** — auditoria base Meli × Portal × SM (divergências).

## Fonte de dados (modo produção)

No topo do `app.js`, `DATA_SOURCE = 'sheets'` e o bloco `SHEET_CSV` aponta para **5 abas publicadas** como CSV (Arquivo → Compartilhar → Publicar na web → cada aba como CSV):

- `eta`, `etd`, `xpt`, `validacao` — as 4 abas do painel
- `sm` — aba de apoio: liga **origem/destino (cidade + UF)** ao protocolo, usada no cálculo de distância

O painel **se atualiza sozinho a cada 5 min** (`AUTO_REFRESH_MIN`). O botão **↻ Atualizar** força recarregamento. Falha em uma aba não derruba as outras (o erro aparece no cabeçalho). Para rodar local, **não abra por duplo clique** (o `file://` bloqueia o fetch) — use o `abrir-painel.bat`.

## Regras de negócio (definidas pela operação)

Várias colunas são lidas por **posição** (letra da coluna), via `cell(row,'X')`:

**ETA**
- `F` = horário máximo de chegada · `G` = horário real da chegada
- Resultado: **G < F → No prazo** · **G ≥ F → Atrasado** (guarda os minutos de atraso) · **G vazio → Aguardando**
- `K` e `L` = status da rota (exibidos na tabela)

**ETD**
- `A` = protocolo · `B` = nomenclatura · `C` = placa · `F` = horário de destino
- `L` = status da SM → usado para **Parados** (status contém "parado")
- `Q` = km/h médio necessário → faixa: **≤55 No prazo** · **56–65 Risco** · **>65 Possível atraso**
- `R` = km percorridos na última hora · `S` = velocidade atual
- Rotas **XPT / REV / reversa** vão para a tabela "Não prioritárias"
- **Origem/Destino reais** vêm da aba **SM** (cidade + UF) ligada pelo protocolo — a coluna `O` do ETD é o **sinal de GPS**, não o destino

**Aba SM** (apoio): `F` = protocolo · `O`/`P` = cidade/UF de origem · `T`/`U` = cidade/UF de destino

### Barra de progresso (% concluída)

`% = (distância total origem→destino − km faltante) / distância total`. A distância total é obtida por **geocodificação gratuita**: Nominatim (cidade+UF → coordenadas) + OSRM (rota rodoviária), com **cache em `localStorage`** (cada par resolve uma vez). A barra é colorida pela faixa de risco (verde/amarelo/vermelho). Enquanto resolve aparece "…"; se a cidade não geocodificar, "s/ rota".

## Interatividade

- **Filtros multi-seleção** (caixas de seleção; vazio = todos) em ETA e ETD.
- **KPIs clicáveis**: clicar num card filtra as tabelas (ex.: "Atrasados", "Risco", "Parados"); o card "Total" limpa. O card ativo mostra "✓ filtrando".

## Publicar atualizações

O site é servido pelo GitHub (repo `caioalvs/dashdhl`), não pela pasta local:

- **Dados** (planilha): atualizam sozinhos, sem republicar.
- **Código**: depois de mudar arquivos, faça **Commit → Push** (GitHub Desktop ou `git add -A && git commit -m "..." && git push`). O Pages republica sozinho em ~1–2 min.

## Notas técnicas

- Parser CSV próprio lida com aspas/vírgulas/quebras de linha dentro de células; datas BR (`18/06/2026 04:00`) e números BR (`2.895`, `1.234,5`).
- Mapeadores também aceitam cabeçalhos por nome (tolerante a acento/maiúscula) como fallback — para ajustar, é só **adicionar** o nome do cabeçalho na lista `pick(...)` da coluna.
- Validado com Node: `node --check app.js` (sintaxe) + testes de lógica das funções reais (ETA F/G, faixas Q, parados/L, SM, filtros) e verificação de que todo `$('#id')` do `app.js` existe no `index.html`.
- A aba **ACOMP CPT** segue como modelo (`acompCpt` com URL vazia) — é só publicar e preencher quando quiser.
