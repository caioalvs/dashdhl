/* =========================================================================
   Painel de Tracking DHL — lógica principal
   Consome DASHBOARD_DATA (data.js). Em produção, troque a fonte por
   loadFromSheets() (ver bloco no fim do arquivo) sem mudar o resto.
   ========================================================================= */

const PALETTE = {
  yellow: '#FFCC00',
  red:    '#D40511',
  redSoft:'#e23b46',
  green:  '#16a34a',
  amber:  '#e08a00',
  grey:   '#9aa0aa',
  blue:   '#2D3277',
  text:   '#1b1c20',
  dim:    '#6b707b',
  border: '#e3e6ec',
  panel2: '#f5f6f9'
};

/* =========================================================================
   CONFIG DA FONTE DE DADOS
   -------------------------------------------------------------------------
   DATA_SOURCE controla de onde o painel lê:
     'sample' → usa os dados de exemplo do data.js (estado atual / offline)
     'sheets' → puxa os CSVs publicados do Google Sheets (produção)

   PARA LIGAR OS DADOS REAIS (passo a passo no README):
     1) Publique a planilha: Arquivo → Compartilhar → Publicar na web →
        publique CADA aba como CSV e copie a URL de cada uma.
     2) Cole as URLs em SHEET_CSV abaixo (deixe '' nas abas que ainda não tem).
     3) Troque DATA_SOURCE para 'sheets'.
     4) Se algum cabeçalho da sua planilha for diferente, ajuste os "aliases"
        nos mapeadores (mapEtaRow, mapEtdRow, ...) mais abaixo. Não precisa
        mudar mais nada — KPIs, gráficos e filtros continuam iguais.
   ========================================================================= */
const DATA_SOURCE = 'sheets';      // 'sample' | 'sheets'

const SHEET_CSV = {
  eta:      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIA0s8fgtB3zxdzJ7xPoWoaVgxO0R7IFDwaVqinmhm0AMDWDLhRXwzFHvNlosniSamBgxokptIS2Ic/pub?gid=280511390&single=true&output=csv',
  etd:      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIA0s8fgtB3zxdzJ7xPoWoaVgxO0R7IFDwaVqinmhm0AMDWDLhRXwzFHvNlosniSamBgxokptIS2Ic/pub?gid=471819294&single=true&output=csv',
  xpt:      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIA0s8fgtB3zxdzJ7xPoWoaVgxO0R7IFDwaVqinmhm0AMDWDLhRXwzFHvNlosniSamBgxokptIS2Ic/pub?gid=977192473&single=true&output=csv',
  validacao:'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIA0s8fgtB3zxdzJ7xPoWoaVgxO0R7IFDwaVqinmhm0AMDWDLhRXwzFHvNlosniSamBgxokptIS2Ic/pub?gid=217934034&single=true&output=csv',
  sm:       'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIA0s8fgtB3zxdzJ7xPoWoaVgxO0R7IFDwaVqinmhm0AMDWDLhRXwzFHvNlosniSamBgxokptIS2Ic/pub?gid=810330774&single=true&output=csv',  // aba SM: origem/destino (cidade+UF) por protocolo
  ocorrencias:'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIA0s8fgtB3zxdzJ7xPoWoaVgxO0R7IFDwaVqinmhm0AMDWDLhRXwzFHvNlosniSamBgxokptIS2Ic/pub?gid=761153438&single=true&output=csv',  // aba Ocorrências: A=protocolo, O=ocorrência
  acompCpt: ''   // (opcional) URL CSV da aba ACOMP CPT
};

const AUTO_REFRESH_MIN = 5;        // intervalo de auto-atualização (minutos) no modo 'sheets'

// Estado de filtros por aba (multi-seleção: arrays; search é texto)
const filters = {
  eta: { classe:[], status:[], tipo:[], resp:[], search:'' },
  etd: { banda:[], status:[], tipo:[], destino:[], parados:[], posto:[], search:'' }
};

// rótulos das faixas de risco da ETD (para o filtro "banda")
const BANDA_LABEL = { verde:'No prazo (≤46)', amarelo:'Risco (47–55)', vermelho:'Possível atraso (>55)' };

let charts = {}; // guarda instâncias Chart.js para destruir/recriar

/* ----------------------------------------------------------------------- */
/* Helpers                                                                  */
/* ----------------------------------------------------------------------- */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function fmtDateTime(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  if(isNaN(d)) return '—';
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const hh = String(d.getHours()).padStart(2,'0');
  const mi = String(d.getMinutes()).padStart(2,'0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

function uniqueSorted(arr){
  return [...new Set(arr.filter(v => v !== undefined && v !== null && v !== ''))].sort();
}

function classeBadge(classe, texto){
  const map = { verde:'b-verde', amarelo:'b-amarelo', vermelho:'b-vermelho', cinza:'b-cinza' };
  const cls = map[classe] || 'b-cinza';
  const label = texto || classe || '—';
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${label}</span>`;
}

function statusBadge(status){
  let cls = 'b-cinza';
  if(/andamento/i.test(status)) cls = 'b-amarelo';
  else if(/finaliz/i.test(status)) cls = 'b-verde';
  else if(/cancel/i.test(status)) cls = 'b-vermelho';
  else if(/pendente/i.test(status)) cls = 'b-cinza';
  return `<span class="badge ${cls}"><span class="badge-dot"></span>${status||'—'}</span>`;
}

function escapeHtml(s){
  if(s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ----------------------------------------------------------------------- */
/* Multi-select (checkboxes) — componente leve                              */
/* ----------------------------------------------------------------------- */
// Constrói/atualiza um multi-select dentro de .ms[data-tab][data-key]
function buildMultiSelect(container, values){
  const tab = container.dataset.tab, key = container.dataset.key, cap = container.dataset.cap;
  const sel = filters[tab][key]; // array
  // mantém apenas valores ainda existentes
  filters[tab][key] = sel.filter(v => values.includes(v));
  const opts = values.map(v => {
    const checked = filters[tab][key].includes(v) ? 'checked' : '';
    const lbl = (tab==='etd' && key==='banda') ? (BANDA_LABEL[v] || v) : v;
    return `<label class="ms-opt"><input type="checkbox" value="${escapeHtml(v)}" ${checked}><span>${escapeHtml(lbl)}</span></label>`;
  }).join('');
  container.innerHTML = `
    <button class="ms-btn" type="button">
      <span class="ms-cap">${escapeHtml(cap)}</span>
      ${msCountBadge(tab,key)}
      <span class="ms-caret">▾</span>
    </button>
    <div class="ms-pop">${opts || '<div class="empty-state" style="padding:16px">Sem opções</div>'}
      <button class="ms-clear" type="button">Limpar “${escapeHtml(cap)}”</button>
    </div>`;
  // eventos
  const btn = container.querySelector('.ms-btn');
  btn.addEventListener('click', e => { e.stopPropagation(); closeAllMs(container); container.classList.toggle('open'); });
  container.querySelectorAll('.ms-opt input').forEach(inp => {
    inp.addEventListener('change', () => {
      const arr = filters[tab][key];
      if(inp.checked){ if(!arr.includes(inp.value)) arr.push(inp.value); }
      else { const i = arr.indexOf(inp.value); if(i>=0) arr.splice(i,1); }
      onFilterChange(tab);
    });
  });
  container.querySelector('.ms-clear').addEventListener('click', e => {
    e.stopPropagation(); filters[tab][key] = []; onFilterChange(tab);
  });
}
function msCountBadge(tab,key){
  const n = filters[tab][key].length;
  return n ? `<span class="ms-count">${n}</span>` : `<span class="ms-cap" style="font-weight:700">Todos</span>`;
}
function closeAllMs(except){ $$('.ms.open').forEach(m => { if(m!==except) m.classList.remove('open'); }); }
document.addEventListener('click', () => closeAllMs(null));

// chamado quando qualquer filtro muda → re-render da aba + sincroniza KPIs/badges
function onFilterChange(tab){
  if(tab==='eta'){ refreshEta(); } else { refreshEtd(); }
  syncFilterUI(tab);
}
// re-renderiza os multi-selects daquela aba (atualiza contadores) e os KPIs ativos
function syncFilterUI(tab){
  $$(`.ms[data-tab="${tab}"]`).forEach(c => {
    const wasOpen = c.classList.contains('open');
    rebuildMs(c);
    if(wasOpen) c.classList.add('open');
  });
  syncKpiActive(tab);
}
function rebuildMs(container){
  const tab = container.dataset.tab, key = container.dataset.key;
  buildMultiSelect(container, currentFilterValues(tab,key));
}
function currentFilterValues(tab,key){
  const data = DASHBOARD_DATA[tab];
  if(tab==='eta'){
    if(key==='classe') return uniqueSorted(data.map(d=>d.classificacaoTexto));
    if(key==='status') return uniqueSorted(data.map(d=>d.statusK || d.status));
    if(key==='tipo')   return uniqueSorted(data.map(d=>d.tipoRota));
    if(key==='resp')   return uniqueSorted(data.map(d=>d.statusViagem));   // coluna U = status da viagem
  } else {
    if(key==='banda')   return ['verde','amarelo','vermelho'];           // chaves de cor; exibidas via BANDA_LABEL
    if(key==='status')  return uniqueSorted(data.filter(d=>!d.finalizada).map(d=>d.statusSM));
    if(key==='tipo')    return uniqueSorted(data.map(d=>d.tipoRota));
    if(key==='destino') return uniqueSorted(data.filter(d=>!d.finalizada).map(d=>d.destino));
  }
  return [];
}

function initEtaFilters(){
  enrichData();
  $$('.ms[data-tab="eta"]').forEach(c => buildMultiSelect(c, currentFilterValues('eta', c.dataset.key)));
}
function initEtdFilters(){
  enrichData();
  $$('.ms[data-tab="etd"]').forEach(c => buildMultiSelect(c, currentFilterValues('etd', c.dataset.key)));
}

/* ----------------------------------------------------------------------- */
/* Filtragem (arrays: vazio = todos)                                        */
/* ----------------------------------------------------------------------- */
function getEtaFiltered(){
  const f = filters.eta;
  return DASHBOARD_DATA.eta.filter(d => {
    if(f.classe.length && !f.classe.includes(d.classificacaoTexto)) return false;
    if(f.status.length && !f.status.includes(d.statusK || d.status)) return false;
    if(f.tipo.length   && !f.tipo.includes(d.tipoRota)) return false;
    if(f.resp.length   && !f.resp.includes(d.statusViagem)) return false;
    if(f.search){
      const q = f.search.toLowerCase();
      const hay = `${d.protocolo} ${d.rota} ${d.motorista} ${d.placa} ${d.origem} ${d.destino}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

function getEtdFiltered(){
  const f = filters.etd;
  return DASHBOARD_DATA.etd.filter(d => {
    if(d.finalizada) return false;   // viagem finalizada na base → não exibe
    if(f.banda.length   && !f.banda.includes(d.risco)) return false;
    if(f.posto.length   && !d.postoFiscal) return false;
    if(f.status.length  && !f.status.includes(d.statusSM)) return false;
    if(f.tipo.length    && !f.tipo.includes(d.tipoRota)) return false;
    if(f.destino.length && !f.destino.includes(d.destino)) return false;
    if(f.parados.length && !d.parado) return false;
    if(f.search){
      const q = f.search.toLowerCase();
      const hay = `${d.protocolo} ${d.rota} ${d.placa} ${d.posicaoAtual} ${d.sm}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

/* ----------------------------------------------------------------------- */
/* KPIs                                                                     */
/* ----------------------------------------------------------------------- */
/* ----------------------------------------------------------------------- */
/* Enriquecimento: deriva resultado da ETA (F vs G) e faixa da ETD (col Q)  */
/* ----------------------------------------------------------------------- */
// Índice da aba SM: protocolo -> { origem:"Cidade, UF", destino:"Cidade, UF" }
let SM_INDEX = {};
function buildSmIndex(){
  SM_INDEX = {};
  (DASHBOARD_DATA.sm || []).forEach(r => {
    const p = String(r.protocolo || '').trim();
    if(!p) return;
    SM_INDEX[p] = {
      origem:  [r.oCidade, r.oUF].filter(Boolean).join(', '),
      destino: [r.dCidade, r.dUF].filter(Boolean).join(', ')
    };
  });
}

// Índice de Ocorrências: protocolo -> texto da ocorrência (motivo em sistema)
let OCOR_INDEX = {};
function buildOcorIndex(){
  OCOR_INDEX = {};
  (DASHBOARD_DATA.ocorrencias || []).forEach(r => {
    const p = String(r.protocolo || '').trim();
    const o = (r.ocorrencia || '').trim();
    if(!p || !o) return;
    if(OCOR_INDEX[p]){ if(!OCOR_INDEX[p].includes(o)) OCOR_INDEX[p] += ' · ' + o; }  // junta múltiplas
    else OCOR_INDEX[p] = o;
  });
}

// Ordem de exibição por status da SM — os que já iniciaram aparecem primeiro
function statusRank(s){
  const t = normKey(s);
  if(/desloc/.test(t)) return 0;                    // EM DESLOCAMENTO
  if(/parad/.test(t)) return 1;                     // PARADO
  if(/origem/.test(t)) return 2;                    // NA ORIGEM
  if(/inicio|aguard|ag inicio|inicio viagem/.test(t)) return 3; // AG. INÍCIO VIAGEM
  return 4;                                         // #N/A / demais
}

function enrichData(){
  buildSmIndex();
  buildOcorIndex();
  // ---- ETA: no prazo se G < F ; atrasado se G >= F ; aguardando se G vazio
  DASHBOARD_DATA.eta.forEach(d => {
    // fallback p/ modo sample (sem células posicionais)
    if(d.horarioMax == null && d.etaOrigem)  d.horarioMax  = d.etaOrigem;
    if(d.horarioReal === undefined)          d.horarioReal = d.etaBipagem || null;
    let cls = 'cinza', txt = 'Aguardando chegada';
    d.atrasoMin = null;
    if(d.horarioReal && d.horarioMax){
      const diff = (new Date(d.horarioReal) - new Date(d.horarioMax)) / 60000; // minutos
      if(diff < 0){ cls = 'verde'; txt = 'No prazo'; }
      else { cls = 'vermelho'; txt = 'Atrasado'; d.atrasoMin = Math.round(diff); }
    }
    d.classificacao = cls;
    d.classificacaoTexto = txt;
  });

  // ---- ETD: faixa pela coluna Q (km/h médio necessário), parados (col L) e prioridade
  DASHBOARD_DATA.etd.forEach(d => {
    // fallback p/ modo sample (sem coluna Q)
    if(d.kmMedio == null){
      d.kmMedio = (d.substatus === 'Atrasado') ? 72 : ((d.kmFaltante || 0) > 500 ? 60 : 48);
    }
    let cls = 'cinza', txt = 'Sem dado';
    const q = d.kmMedio;
    if(q != null){
      if(q <= 46)      { cls = 'verde';    txt = 'No prazo'; }
      else if(q <= 55) { cls = 'amarelo';  txt = 'Risco'; }
      else             { cls = 'vermelho'; txt = 'Possível atraso'; }
    }
    d.risco = cls;
    d.riscoTexto = txt;

    // fallback de status SM p/ modo sample
    if(d.statusSM == null || d.statusSM === '') d.statusSM = d.statusSM || (d.velocidadeAtual===0 ? 'PARADO' : '');
    // Parado: coluna L (status SM) indica parado
    d.parado = /parad/i.test(d.statusSM || '');
    // Finalizada: viagem concluída na base (não exibir)
    d.finalizada = /finaliz/i.test(d.statusSM || '');
    // Posto fiscal: U = situação ("Rota sem excepcionalidade" = não precisa); V = km até o posto (tem fórmula em todas)
    const sitU = (d.postoU || '').trim();
    d.postoSituacao = sitU;
    d.postoKm = parseNum(d.postoV);
    d.postoFiscal = sitU !== '' && !/sem excepcional/i.test(sitU) && !/^#n\/?a$/i.test(sitU);
    // Não prioritária: rotas XPT / REV / reversa não são rastreadas com prioridade
    d.naoPrioritaria = /xpt|rev|revers/i.test(`${d.rota||''} ${d.tipoRota||''}`);
    // Ordem de status SM (já iniciados primeiro)
    d.statusRank = statusRank(d.statusSM);

    // Origem/Destino reais vêm da aba SM (cidade+UF). A coluna O do ETD é o sinal de GPS.
    const pkey = String(d.protocolo || '').trim();
    const sm = SM_INDEX[pkey];
    d.origemGeo  = (sm && sm.origem)  ? sm.origem  : d.origem;
    d.destinoGeo = (sm && sm.destino) ? sm.destino : d.destino;
    if(sm && sm.destino) d.destino = sm.destino;   // exibição e filtro de destino
    if(sm && sm.origem)  d.origem  = sm.origem;
    // Ocorrência (motivo em sistema) ligada pelo protocolo
    d.ocorrencia = OCOR_INDEX[pkey] || '';
  });
}

function renderEtaKpis(rows){
  $('#eta-kpi-total').textContent     = rows.length;
  const noprazo    = rows.filter(d => d.classificacao === 'verde').length;
  const atraso     = rows.filter(d => d.classificacao === 'vermelho').length;
  const aguardando = rows.filter(d => d.classificacao === 'cinza').length;
  $('#eta-kpi-noprazo').textContent    = noprazo;
  $('#eta-kpi-atraso').textContent     = atraso;
  $('#eta-kpi-aguardando').textContent = aguardando;
  const jaChegaram = noprazo + atraso;
  const pct = jaChegaram ? Math.round(noprazo / jaChegaram * 100) : 0;
  $('#eta-kpi-noprazo-pct').textContent = `${pct}% das que já chegaram`;
  $('#eta-kpi-pont').textContent = jaChegaram ? `${pct}%` : '—';
  // atraso médio (min) entre as atrasadas
  const atrasos = rows.filter(d => d.atrasoMin != null).map(d => d.atrasoMin);
  const media = atrasos.length ? Math.round(atrasos.reduce((s,v)=>s+v,0)/atrasos.length) : null;
  $('#eta-kpi-atrasomed').textContent = media != null ? `${media} min` : '—';

  // leitura rápida (aside do gráfico)
  $('#eta-readout').innerHTML = `
    <div class="ca-row"><span class="ca-dot" style="background:var(--green)"></span><div><b>${noprazo}</b> no prazo</div></div>
    <div class="ca-row"><span class="ca-dot" style="background:var(--red)"></span><div><b>${atraso}</b> atrasadas${media!=null?` · média ${media} min`:''}</div></div>
    <div class="ca-row"><span class="ca-dot" style="background:var(--grey)"></span><div><b>${aguardando}</b> aguardando chegada</div></div>`;
}

function renderEtdKpis(rows){
  $('#etd-kpi-total').textContent = rows.length;
  const prio    = rows.filter(d => !d.naoPrioritaria);
  const noprazo = prio.filter(d => d.risco === 'verde').length;
  const risco   = prio.filter(d => d.risco === 'amarelo').length;
  const atraso  = prio.filter(d => d.risco === 'vermelho').length;
  const parados = rows.filter(d => d.parado).length;       // coluna L (status SM)
  const posto   = rows.filter(d => d.postoFiscal).length;  // colunas U/V
  const pacotes = rows.reduce((s,d) => s + (d.pacotes || 0), 0);
  $('#etd-kpi-noprazo').textContent = noprazo;
  $('#etd-kpi-risco').textContent   = risco;
  $('#etd-kpi-atraso').textContent  = atraso;
  $('#etd-kpi-parados').textContent = parados;
  $('#etd-kpi-posto').textContent   = posto;
  $('#etd-kpi-pacotes').textContent = pacotes.toLocaleString('pt-BR');

  const naoPrio = rows.length - prio.length;
  $('#etd-readout').innerHTML = `
    <div class="ca-row"><span class="ca-dot" style="background:var(--green)"></span><div><b>${noprazo}</b> no prazo (≤46 km/h)</div></div>
    <div class="ca-row"><span class="ca-dot" style="background:var(--amber)"></span><div><b>${risco}</b> em risco (47–55)</div></div>
    <div class="ca-row"><span class="ca-dot" style="background:var(--red)"></span><div><b>${atraso}</b> possível atraso (&gt;55)</div></div>
    <div class="ca-row"><span class="ca-dot" style="background:var(--amber)"></span><div><b>${parados}</b> parados</div></div>
    <div class="ca-row"><span class="ca-dot" style="background:var(--grey)"></span><div><b>${naoPrio}</b> não prioritárias</div></div>`;
}

/* ----------------------------------------------------------------------- */
/* Tabelas                                                                  */
/* ----------------------------------------------------------------------- */
function renderEtaTable(rows){
  const tb = $('#eta-tbody');
  if(!rows.length){
    tb.innerHTML = `<tr><td colspan="10"><div class="empty-state">Nenhuma rota corresponde aos filtros.</div></td></tr>`;
  } else {
    const ord = { vermelho:0, cinza:1, verde:2 };  // críticos (atrasados) no topo
    rows = [...rows].sort((a,b) => (ord[a.classificacao]??3) - (ord[b.classificacao]??3));
    tb.innerHTML = rows.map(d => `
      <tr class="${d.classificacao==='vermelho'?'crit':''}">
        <td class="mono">${escapeHtml(d.protocolo)}</td>
        <td class="mono">${escapeHtml(d.rota)}</td>
        <td>${escapeHtml(d.motorista)}</td>
        <td class="mono">${escapeHtml(d.placa)}</td>
        <td>${fmtDateTime(d.horarioMax)}</td>
        <td>${fmtDateTime(d.horarioReal)}</td>
        <td>${classeBadge(d.classificacao, d.classificacaoTexto)}</td>
        <td>${escapeHtml(d.statusK || d.status || '—')}</td>
        <td>${escapeHtml(d.statusL || '—')}</td>
        <td><span class="resp-pill">${escapeHtml(d.statusViagem||'—')}</span></td>
      </tr>`).join('');
  }
  $('#eta-count').textContent = rows.length;
}

// Barra de progresso por protocolo: % concluída = (distância total N→O − km faltante) / total
const FILL = { verde:'f-verde', amarelo:'f-amarelo', vermelho:'f-vermelho', cinza:'f-cinza' };
function progressCell(d){
  if(d.kmFaltante == null) return `<span class="bm-pct dim">—</span>`;
  const o = d.origemGeo || d.origem, dst = d.destinoGeo || d.destino;
  const total = DIST.get(o, dst);
  if(total && total > 0){
    const pct = Math.max(0, Math.min(100, Math.round((total - d.kmFaltante) / total * 100)));
    return `
      <div class="bar-mini" title="${escapeHtml(o||'?')} → ${escapeHtml(dst||'?')} · ${total} km totais (faltam ${d.kmFaltante})">
        <div class="bm-track"><div class="bm-fill ${FILL[d.risco]||'f-cinza'}" style="width:${pct}%"></div></div>
        <span class="bm-pct">${pct}%</span>
      </div>`;
  }
  // ainda não resolveu a distância → enfileira e mostra estado "calculando"
  const st = DIST.statusOf(o, dst);
  if(st !== 'fail') DIST.enqueue(o, dst);
  if(st === 'fail'){
    return `<div class="bar-mini" title="Não foi possível geocodificar ${escapeHtml(o||'?')} → ${escapeHtml(dst||'?')}"><div class="bm-track"><div class="bm-fill f-cinza" style="width:0%"></div></div><span class="bm-pct dim">s/ rota</span></div>`;
  }
  return `<div class="bar-mini"><div class="bm-track pending"><div class="bm-fill"></div></div><span class="bm-pct dim">…</span></div>`;
}

// Tabelas: 3 prioritárias por faixa (Q) + 1 de não prioritárias (XPT/REV)
function renderEtdTables(rows){
  const prio = rows.filter(d => !d.naoPrioritaria);
  const nao  = rows.filter(d =>  d.naoPrioritaria);
  const groups = { verde:[], amarelo:[], vermelho:[] };
  prio.forEach(d => { if(groups[d.risco]) groups[d.risco].push(d); });
  fillEtdTable('verde',    groups.verde);
  fillEtdTable('amarelo',  groups.amarelo);
  fillEtdTable('vermelho', groups.vermelho);
  fillEtdNaoPrio(nao);
  fillEtdPosto(rows.filter(d => d.postoFiscal));
  $('#etd-count').textContent = rows.length;
}

// Tabela de Posto Fiscal — veículos com excepcionalidade a acompanhar (coluna U), km até o posto (coluna V)
function fillEtdPosto(rows){
  $('#etd-cnt-posto').textContent = rows.length;
  const tb = $('#etd-tbody-posto');
  if(!rows.length){
    tb.innerHTML = `<tr><td colspan="10"><div class="empty-state">Nenhum veículo com excepcionalidade de posto fiscal.</div></td></tr>`;
    return;
  }
  rows.sort((a,b) => (a.postoKm==null?1e9:a.postoKm) - (b.postoKm==null?1e9:b.postoKm));  // mais próximos do posto primeiro
  tb.innerHTML = rows.map(d => `
    <tr class="${d.risco==='vermelho'?'crit':''}">
      <td class="mono">${escapeHtml(d.protocolo)}</td>
      <td class="mono">${escapeHtml(d.rota)}</td>
      <td class="mono">${escapeHtml(d.placa)}</td>
      <td>${escapeHtml(d.destino||'—')}</td>
      <td>${progressCell(d)}</td>
      <td>${d.kmFaltante!=null ? d.kmFaltante+' km' : '—'}</td>
      <td><b>${d.kmMedio!=null ? d.kmMedio+' km/h' : '—'}</b></td>
      <td><span class="ocor-info">${escapeHtml(d.postoSituacao||'—')}</span></td>
      <td><b>${d.postoKm!=null ? d.postoKm+' km' : '—'}</b></td>
      <td>${escapeHtml(d.statusSM||'—')}</td>
    </tr>`).join('');
}

function fillEtdTable(key, rows){
  $('#etd-cnt-'+key).textContent = rows.length;
  const tb = $('#etd-tbody-'+key);
  if(!rows.length){
    tb.innerHTML = `<tr><td colspan="13"><div class="empty-state">Nenhuma rota nesta faixa.</div></td></tr>`;
    return;
  }
  rows.sort((a,b) => (a.statusRank - b.statusRank) || ((b.kmMedio||0) - (a.kmMedio||0)));  // já iniciados primeiro
  tb.innerHTML = rows.map(d => `
    <tr class="${d.risco==='vermelho'?'crit':''}">
      <td class="mono">${escapeHtml(d.protocolo)}</td>
      <td class="mono">${escapeHtml(d.rota)}</td>
      <td class="mono">${escapeHtml(d.placa)}</td>
      <td>${escapeHtml(d.destino||'—')}</td>
      <td>${fmtDateTime(d.etaDestino)}</td>
      <td>${progressCell(d)}</td>
      <td>${d.kmFaltante!=null ? d.kmFaltante+' km' : '—'}</td>
      <td><b>${d.kmMedio!=null ? d.kmMedio+' km/h' : '—'}</b></td>
      <td>${d.deslocHora!=null ? d.deslocHora+' km' : '—'}</td>
      <td>${d.velocidadeAtual!=null ? d.velocidadeAtual+' km/h' : '—'}</td>
      <td>${escapeHtml(d.statusSM||'—')}</td>
      <td>${d.pacotes!=null ? d.pacotes.toLocaleString('pt-BR') : '—'}</td>
      ${ocorCell(d)}
    </tr>`).join('');
}

// célula de ocorrência (motivo em sistema); destaca em vermelho se a rota é possível atraso
function ocorCell(d){
  if(!d.ocorrencia) return `<td class="ocor"><span class="ocor-empty">—</span></td>`;
  const cls = d.risco === 'vermelho' ? 'ocor-alert' : 'ocor-info';
  return `<td class="ocor"><span class="${cls}" title="${escapeHtml(d.ocorrencia)}">${escapeHtml(d.ocorrencia)}</span></td>`;
}

function fillEtdNaoPrio(rows){
  $('#etd-cnt-nao').textContent = rows.length;
  const tb = $('#etd-tbody-nao');
  if(!rows.length){
    tb.innerHTML = `<tr><td colspan="11"><div class="empty-state">Nenhuma rota XPT/reversa no momento.</div></td></tr>`;
    return;
  }
  tb.innerHTML = rows.map(d => `
    <tr>
      <td class="mono">${escapeHtml(d.protocolo)}</td>
      <td class="mono">${escapeHtml(d.rota)}</td>
      <td class="mono">${escapeHtml(d.placa)}</td>
      <td>${escapeHtml(d.destino||'—')}</td>
      <td>${fmtDateTime(d.etaDestino)}</td>
      <td>${d.kmFaltante!=null ? d.kmFaltante+' km' : '—'}</td>
      <td>${d.deslocHora!=null ? d.deslocHora+' km' : '—'}</td>
      <td>${d.velocidadeAtual!=null ? d.velocidadeAtual+' km/h' : '—'}</td>
      <td>${escapeHtml(d.statusSM||'—')}</td>
      <td>${d.pacotes!=null ? d.pacotes.toLocaleString('pt-BR') : '—'}</td>
      ${ocorCell(d)}
    </tr>`).join('');
}

function renderXptTable(){
  const rows = DASHBOARD_DATA.xpt;
  $('#xpt-kpi-total').textContent = rows.length;
  $('#xpt-kpi-fin').textContent = rows.filter(d=>/finaliz/i.test(d.status)).length;
  $('#xpt-kpi-and').textContent = rows.filter(d=>/andamento/i.test(d.status)).length;
  $('#xpt-kpi-can').textContent = rows.filter(d=>/cancel/i.test(d.status)).length;
  $('#xpt-tbody').innerHTML = rows.map(d=>`
    <tr>
      <td class="mono">${escapeHtml(d.protocolo)}</td>
      <td class="mono">${escapeHtml(d.rota)}</td>
      <td>${escapeHtml(d.motorista||'—')}</td>
      <td class="mono">${escapeHtml(d.placa)}</td>
      <td>${escapeHtml(d.veiculo||'—')}</td>
      <td>${statusBadge(d.status)}</td>
      <td>${d.hus!=null?d.hus:'—'}</td>
      <td>${d.pacotes!=null?d.pacotes:'—'}</td>
      <td>${escapeHtml(d.doc||'—')}</td>
      <td>${escapeHtml(d.obs||'—')}</td>
    </tr>`).join('');
}

function renderValTable(){
  const rows = DASHBOARD_DATA.validacao;
  $('#val-kpi-total').textContent = rows.length;
  // divergência = coluna O tem texto do que está errado; sem texto = ok
  const comDiv = rows.filter(d => (d.divergencia||'').trim() !== '').length;
  $('#val-kpi-ok').textContent  = rows.length - comDiv;
  $('#val-kpi-div').textContent = comDiv;
  $('#val-tbody').innerHTML = rows.map(d=>{
    const temDiv = (d.divergencia||'').trim() !== '';
    const cls = temDiv ? 'b-vermelho' : 'b-verde';
    return `
    <tr class="${temDiv?'crit':''}">
      <td class="mono">${escapeHtml(d.protocolo)}</td>
      <td class="mono">${escapeHtml(d.servico)}</td>
      <td class="mono">${escapeHtml(d.placas)}</td>
      <td><span class="badge ${cls}"><span class="badge-dot"></span>${escapeHtml(d.statusPortal||'—')}</span></td>
      <td>${temDiv ? `<span class="ocor-alert">${escapeHtml(d.divergencia)}</span>` : '<span class="ocor-empty">—</span>'}</td>
    </tr>`;
  }).join('');
}

/* ----------------------------------------------------------------------- */
/* Gráficos                                                                 */
/* ----------------------------------------------------------------------- */
Chart.defaults.color = PALETTE.dim;
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11;

function destroyChart(key){ if(charts[key]){ charts[key].destroy(); delete charts[key]; } }

function renderEtaCharts(rows){
  // Resultado de chegada (doughnut): No prazo (G<F) / Atrasado / Aguardando
  const noprazo    = rows.filter(d => d.classificacao === 'verde').length;
  const atraso     = rows.filter(d => d.classificacao === 'vermelho').length;
  const aguardando = rows.filter(d => d.classificacao === 'cinza').length;
  destroyChart('etaStatus');
  charts.etaStatus = new Chart($('#chartEtaStatus'), {
    type:'doughnut',
    data:{ labels:['No prazo','Atrasado','Aguardando'],
      datasets:[{ data:[noprazo,atraso,aguardando],
        backgroundColor:[PALETTE.green, PALETTE.red, PALETTE.grey], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
      plugins:{legend:{position:'bottom', labels:{padding:12, usePointStyle:true, pointStyle:'circle'}}} }
  });
}

function renderEtdBuckets(rows){
  const noprazo = rows.filter(d => d.risco === 'verde').length;
  const risco   = rows.filter(d => d.risco === 'amarelo').length;
  const atraso  = rows.filter(d => d.risco === 'vermelho').length;
  destroyChart('etdBuckets');
  charts.etdBuckets = new Chart($('#chartEtdBuckets'), {
    type:'doughnut',
    data:{ labels:['No prazo (≤46)','Risco (47–55)','Possível atraso (>55)'],
      datasets:[{ data:[noprazo,risco,atraso],
        backgroundColor:[PALETTE.green, PALETTE.amber, PALETTE.red], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{legend:{position:'bottom', labels:{padding:10, usePointStyle:true, pointStyle:'circle', font:{size:10}}}} }
  });
}

/* ----------------------------------------------------------------------- */
/* Orquestração de render                                                   */
/* ----------------------------------------------------------------------- */
function refreshEta(){
  const rows = getEtaFiltered();
  renderEtaKpis(rows);
  renderEtaRibbon(rows);
  renderEtaTable(rows);
  renderEtaCharts(rows);
}
function refreshEtd(){
  const rows = getEtdFiltered();
  renderEtdKpis(rows);
  renderEtdRibbon(rows);
  renderEtdBuckets(rows.filter(d => !d.naoPrioritaria));
  renderEtdTables(rows);
}

/* ----------------------------------------------------------------------- */
/* Status ribbon (assinatura: leitura de comando no topo da aba)            */
/* ----------------------------------------------------------------------- */
function segBar(parts){
  const total = parts.reduce((s,p)=>s+p.n,0) || 1;
  return parts.map(p => p.n>0 ? `<span style="width:${(p.n/total*100).toFixed(1)}%;background:${p.color}"></span>` : '').join('');
}
function statItem(color, label, n){
  return `<div class="os"><i style="background:${color}"></i>${label} <b>${n}</b></div>`;
}
function setRibbon(tab, state, headlineHtml, barHtml, statsHtml){
  const rib = $('#ribbon-'+tab);
  if(rib){ rib.classList.remove('state-verde','state-amarelo','state-vermelho'); rib.classList.add('state-'+state); }
  $('#'+tab+'-ops-headline').innerHTML = headlineHtml;
  $('#'+tab+'-ops-bar').innerHTML = barHtml;
  $('#'+tab+'-ops-stats').innerHTML = statsHtml;
}
function renderEtaRibbon(rows){
  const np = rows.filter(d => d.classificacao === 'verde').length;
  const at = rows.filter(d => d.classificacao === 'vermelho').length;
  const ag = rows.filter(d => d.classificacao === 'cinza').length;
  const state = at>0 ? 'vermelho' : 'verde';
  const hl = at>0
    ? `<span class="hl-strong">${at}</span> chegada${at>1?'s':''} atrasada${at>1?'s':''}`
    : (rows.length ? 'Todas as chegadas no prazo' : 'Sem rotas no momento');
  setRibbon('eta', state, hl,
    segBar([{n:np,color:'var(--green)'},{n:at,color:'var(--red)'},{n:ag,color:'var(--grey)'}]),
    statItem('var(--green)','No prazo',np)+statItem('var(--red)','Atrasado',at)+statItem('var(--grey)','Aguardando',ag));
}
function renderEtdRibbon(rows){
  const prio = rows.filter(d => !d.naoPrioritaria);
  const np = prio.filter(d => d.risco === 'verde').length;
  const ri = prio.filter(d => d.risco === 'amarelo').length;
  const at = prio.filter(d => d.risco === 'vermelho').length;
  const pa = rows.filter(d => d.parado).length;
  const state = (at>0 || pa>0) ? 'vermelho' : (ri>0 ? 'amarelo' : 'verde');
  let hl;
  if(at>0 || pa>0){
    const bits = [];
    if(at>0) bits.push(`<span class="hl-strong">${at}</span> em possível atraso`);
    if(pa>0) bits.push(`<span class="hl-strong">${pa}</span> parada${pa>1?'s':''}`);
    hl = bits.join(' · ');
  } else if(ri>0){
    hl = `<span class="hl-strong" style="color:var(--amber)">${ri}</span> rota${ri>1?'s':''} em risco`;
  } else {
    hl = rows.length ? 'Frota fluindo no prazo' : 'Sem rotas em viagem';
  }
  setRibbon('etd', state, hl,
    segBar([{n:np,color:'var(--green)'},{n:ri,color:'var(--amber)'},{n:at,color:'var(--red)'}]),
    statItem('var(--green)','No prazo',np)+statItem('var(--amber)','Risco',ri)+statItem('var(--red)','Possível atraso',at)+statItem('var(--grey)','Parados',pa));
}

// nav badges (trilho) sinalizam onde estão os problemas — sobre os dados completos
function setNavBadge(id, kind){
  const el = $('#'+id); if(!el) return;
  el.classList.remove('bad','warn'); if(kind) el.classList.add(kind);
}
function updateNavHealth(){
  const etd = DASHBOARD_DATA.etd || [];
  const etdBad  = etd.some(d => (!d.naoPrioritaria && d.risco === 'vermelho') || d.parado);
  const etdWarn = etd.some(d => !d.naoPrioritaria && d.risco === 'amarelo');
  setNavBadge('badgeEtd', etdBad ? 'bad' : (etdWarn ? 'warn' : ''));
  const eta = DASHBOARD_DATA.eta || [];
  setNavBadge('badgeEta', eta.some(d => d.classificacao === 'vermelho') ? 'bad' : '');
}

/* ----------------------------------------------------------------------- */
/* Central de Alertas — consolida tudo que exige ação agora                 */
/* ----------------------------------------------------------------------- */
function buildAlerts(){
  const A = [];
  (DASHBOARD_DATA.eta || []).forEach(d => {
    if(d.classificacao === 'vermelho')
      A.push({ sev:3, cls:'b-vermelho', origem:'ETA', protocolo:d.protocolo, what:'Chegada atrasada', where:`${d.origem||'?'} → ${d.destino||'?'}`, detail:(d.atrasoMin!=null?d.atrasoMin+' min de atraso':'') });
  });
  (DASHBOARD_DATA.etd || []).forEach(d => {
    if(d.finalizada || d.naoPrioritaria) return;
    if(d.risco === 'vermelho')
      A.push({ sev:3, cls:'b-vermelho', origem:'ETD', protocolo:d.protocolo, what:'Possível atraso', where:d.destino||'?', detail:(d.kmMedio!=null?d.kmMedio+' km/h necessários':'') });
    if(d.parado)
      A.push({ sev:2, cls:'b-amarelo', origem:'ETD', protocolo:d.protocolo, what:'Veículo parado', where:d.destino||'?', detail:d.statusSM||'' });
    if(d.ocorrencia && d.risco === 'vermelho')
      A.push({ sev:2, cls:'b-amarelo', origem:'ETD', protocolo:d.protocolo, what:'Ocorrência em sistema', where:d.destino||'?', detail:d.ocorrencia });
  });
  (DASHBOARD_DATA.validacao || []).forEach(d => {
    if((d.divergencia||'').trim())
      A.push({ sev:1, cls:'b-cinza', origem:'PORTAL', protocolo:d.protocolo, what:'Divergência no portal', where:d.servico||'?', detail:d.divergencia });
  });
  A.sort((a,b) => b.sev - a.sev);
  return A;
}
function renderAlertas(){
  const tb = $('#alertas-tbody'); if(!tb) return;
  const A = buildAlerts();
  const reds = A.filter(a => a.cls === 'b-vermelho').length;
  const ambs = A.filter(a => a.cls === 'b-amarelo').length;
  const greys = A.filter(a => a.cls === 'b-cinza').length;
  $('#alertas-cnt').textContent = A.length;
  const hl = $('#alertas-headline');
  if(hl) hl.innerHTML = A.length ? `<span class="hl-strong">${A.length}</span> ite${A.length>1?'ns':'m'} exige${A.length>1?'m':''} ação agora` : 'Operação sob controle';
  const rib = $('#ribbon-alertas');
  if(rib){ rib.classList.remove('state-verde','state-amarelo','state-vermelho'); rib.classList.add(reds?'state-vermelho':(ambs?'state-amarelo':'state-verde')); }
  const st = $('#alertas-stats');
  if(st) st.innerHTML = statItem('var(--red)','Críticos',reds) + statItem('var(--amber)','Atenção',ambs) + statItem('var(--grey)','Portal',greys);
  const nb = $('#badgeAlertas');
  if(nb){ nb.textContent = A.length; nb.classList.remove('bad','warn'); if(reds) nb.classList.add('bad'); else if(ambs) nb.classList.add('warn'); }
  if(!A.length){
    tb.innerHTML = `<tr><td colspan="6"><div class="empty-state">Nenhum item exige ação no momento — operação sob controle.</div></td></tr>`;
    return;
  }
  const gmap = { 'b-vermelho':'Crítico', 'b-amarelo':'Atenção', 'b-cinza':'Info' };
  tb.innerHTML = A.map(a => `
    <tr class="${a.cls==='b-vermelho'?'crit':''}">
      <td><span class="badge ${a.cls}"><span class="badge-dot"></span>${gmap[a.cls]}</span></td>
      <td><span class="resp-pill">${a.origem}</span></td>
      <td class="mono">${escapeHtml(a.protocolo)}</td>
      <td>${escapeHtml(a.what)}</td>
      <td>${escapeHtml(a.where)}</td>
      <td>${escapeHtml(a.detail)}</td>
    </tr>`).join('');
}

/* ---- Histórico leve (localStorage) + tendência de pontualidade ---------- */
function snapshotPcts(){
  const eta = DASHBOARD_DATA.eta || [];
  const np = eta.filter(d => d.classificacao === 'verde').length, at = eta.filter(d => d.classificacao === 'vermelho').length;
  const etaPct = (np + at) ? Math.round(np / (np + at) * 100) : null;
  const prio = (DASHBOARD_DATA.etd || []).filter(d => !d.naoPrioritaria && !d.finalizada);
  const v = prio.filter(d => d.risco === 'verde').length;
  const etdPct = prio.length ? Math.round(v / prio.length * 100) : null;
  return { etaPct, etdPct };
}
function recordSnapshot(){
  const { etaPct, etdPct } = snapshotPcts();
  try {
    const h = JSON.parse(localStorage.getItem('dhl_hist') || '[]');
    h.push({ t: Date.now(), eta: etaPct, etd: etdPct });
    while(h.length > 60) h.shift();
    localStorage.setItem('dhl_hist', JSON.stringify(h));
  } catch(e){}
}
function sparkSvg(vals, color){
  const w = 320, h = 64, pad = 8, n = vals.length;
  const x = i => pad + (n === 1 ? 0 : i * (w - 2*pad) / (n - 1));
  const y = v => h - pad - (v / 100) * (h - 2*pad);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = vals[n - 1];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" style="display:block">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(n-1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="3" fill="${color}"/></svg>`;
}
function renderTrend(){
  const el = $('#trend-spark'); if(!el) return;
  let h = [];
  try { h = JSON.parse(localStorage.getItem('dhl_hist') || '[]'); } catch(e){}
  const vals = h.map(x => x.etd).filter(v => v != null);
  if(vals.length < 2){
    el.innerHTML = `<div class="empty-state" style="padding:18px 8px">Coletando leituras… a tendência aparece conforme o painel atualiza (a cada 5 min).</div>`;
    return;
  }
  const cur = vals[vals.length - 1], delta = cur - vals[0];
  const arrow = delta > 0 ? '▲' : (delta < 0 ? '▼' : '■');
  const dcolor = delta > 0 ? 'var(--green)' : (delta < 0 ? 'var(--red)' : 'var(--text-dim)');
  el.innerHTML = sparkSvg(vals, '#16a34a') +
    `<div style="display:flex;align-items:baseline;gap:10px;margin-top:9px">
       <span style="font-family:var(--font-num);font-weight:700;font-size:26px;color:var(--text)">${cur}%</span>
       <span style="font-size:12px;color:${dcolor}">${arrow} ${Math.abs(delta)} pp desde o início</span>
       <span style="font-size:11px;color:var(--text-dim);margin-left:auto">${vals.length} leituras</span>
     </div>`;
}

/* ----------------------------------------------------------------------- */
/* Painel de detalhe da rota (clique numa linha)                            */
/* ----------------------------------------------------------------------- */
function dtField(label, value){
  if(value == null || value === '') return '';
  return `<div class="dt-row"><span class="dt-k">${label}</span><span class="dt-v">${escapeHtml(String(value))}</span></div>`;
}
function openDetail(proto){
  const eta = (DASHBOARD_DATA.eta || []).find(d => String(d.protocolo).trim() === proto);
  const etd = (DASHBOARD_DATA.etd || []).find(d => String(d.protocolo).trim() === proto);
  const val = (DASHBOARD_DATA.validacao || []).find(d => String(d.protocolo).trim() === proto);
  const ocor = OCOR_INDEX[proto];

  let action = 'Sem ação pendente para este protocolo no momento.', acls = 'dt-ok';
  if(etd && etd.risco === 'vermelho'){
    action = `Verifique este possível atraso: o veículo precisa manter ${etd.kmMedio} km/h de média para chegar no prazo. Acione a torre e o motorista.`; acls = 'dt-crit';
  } else if(eta && eta.classificacao === 'vermelho'){
    action = `Chegada atrasada${eta.atrasoMin!=null?` em ${eta.atrasoMin} min`:''}. Confirme o motivo na origem.`; acls = 'dt-crit';
  } else if(etd && etd.parado){
    action = `Veículo parado (status SM: ${etd.statusSM||'—'}). Confirme o motivo e acione o condutor.`; acls = 'dt-warn';
  } else if(val && (val.divergencia||'').trim()){
    action = `Divergência no portal: ${val.divergencia}. Corrija o cadastro.`; acls = 'dt-warn';
  } else if(ocor){
    action = `Ocorrência registrada: ${ocor}. Avalie a necessidade de ação.`; acls = 'dt-warn';
  }

  let html = `<div class="dt-action ${acls}"><span class="dt-action-ttl">Ação recomendada</span>${escapeHtml(action)}</div>`;
  if(eta){
    html += `<div class="dt-sec">Chegada · ETA</div>`
      + dtField('Resultado', eta.classificacaoTexto) + dtField('Horário máximo', fmtDateTime(eta.horarioMax))
      + dtField('Chegada real', fmtDateTime(eta.horarioReal)) + dtField('Status (K)', eta.statusK)
      + dtField('Status (L)', eta.statusL) + dtField('Status viagem (U)', eta.statusViagem)
      + dtField('Motorista', eta.motorista) + dtField('Placa', eta.placa);
  }
  if(etd){
    html += `<div class="dt-sec">Em viagem · ETD</div>`
      + dtField('Destino', etd.destino) + dtField('Nomenclatura', etd.rota) + dtField('Placa', etd.placa)
      + dtField('ETA destino', fmtDateTime(etd.etaDestino)) + dtField('Faixa', etd.riscoTexto)
      + dtField('Km/h médio nec. (Q)', etd.kmMedio!=null ? etd.kmMedio+' km/h' : '')
      + dtField('Km faltante', etd.kmFaltante!=null ? etd.kmFaltante+' km' : '')
      + dtField('Desloc. última 1h (R)', etd.deslocHora!=null ? etd.deslocHora+' km' : '')
      + dtField('Velocidade (S)', etd.velocidadeAtual!=null ? etd.velocidadeAtual+' km/h' : '')
      + dtField('Status SM (L)', etd.statusSM)
      + dtField('Pacotes', etd.pacotes!=null ? etd.pacotes.toLocaleString('pt-BR') : '')
      + (etd.postoFiscal ? dtField('Posto fiscal', etd.postoSituacao + (etd.postoKm!=null?` · ${etd.postoKm} km`:'')) : '')
      + (etd.ocorrencia ? dtField('Ocorrência', etd.ocorrencia) : '');
  }
  if(val){
    html += `<div class="dt-sec">Portal · auditoria</div>`
      + dtField('Status portal', val.statusPortal) + dtField('Divergência', val.divergencia) + dtField('Placas', val.placas);
  }
  if(!eta && !etd && !val) html += `<div class="empty-state">Sem dados detalhados para este protocolo.</div>`;

  $('#dt-title').textContent = 'Protocolo ' + proto;
  $('#dt-body').innerHTML = html;
  const ov = $('#detail-overlay');
  ov.style.display = 'flex'; document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => ov.classList.add('open'));
}
function closeDetail(){
  const ov = $('#detail-overlay'); if(!ov) return;
  ov.classList.remove('open'); document.body.style.overflow = '';
  setTimeout(() => { ov.style.display = 'none'; }, 200);
}
function bindRowDetails(){
  document.addEventListener('click', (e) => {
    if(e.target.closest('#dt-close') || e.target.id === 'detail-overlay'){ closeDetail(); return; }
    const tr = e.target.closest('.table-wrap tbody tr');
    if(tr && !tr.querySelector('.empty-state')){
      const cell = tr.querySelector('.mono');
      const proto = cell ? cell.textContent.trim() : '';
      if(proto) openDetail(proto);
    }
  });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeDetail(); });
}

// anima os números dos KPIs (count-up) na carga e a cada atualização
function animateNumbers(){
  if(typeof requestAnimationFrame === 'undefined') return;
  $$('.kpi-value').forEach(el => {
    const txt = el.textContent.trim();
    const num = txt.match(/[\d.]+/);
    if(!num){ el.dataset.prev = ''; return; }
    const target = parseInt(num[0].replace(/\./g,''), 10);
    if(isNaN(target)) return;
    const prefix = txt.slice(0, num.index), suffix = txt.slice(num.index + num[0].length);
    const prev = (el.dataset.prev !== undefined && el.dataset.prev !== '') ? +el.dataset.prev : 0;
    el.dataset.prev = target;
    if(prev === target) return;
    const t0 = performance.now(), dur = 650;
    (function frame(now){
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const v = Math.round(prev + (target - prev) * e);
      el.textContent = prefix + v.toLocaleString('pt-BR') + suffix;
      if(t < 1) requestAnimationFrame(frame); else el.textContent = txt;
    })(t0);
  });
}

function renderAll(){
  enrichData();
  const etdAtivos = (DASHBOARD_DATA.etd || []).filter(d => !d.finalizada);
  $('#badgeEta').textContent = DASHBOARD_DATA.eta.length;
  $('#badgeEtd').textContent = etdAtivos.length;
  $('#badgeXpt').textContent = DASHBOARD_DATA.xpt.length;
  $('#badgeVal').textContent = DASHBOARD_DATA.validacao.length;
  refreshEta();
  refreshEtd();
  renderXptTable();
  renderValTable();
  $('#badgeMapa').textContent = etdAtivos.filter(d => !d.naoPrioritaria).length;
  // resumo útil no masthead (substitui o subtítulo decorativo)
  const etaAtras = DASHBOARD_DATA.eta.filter(d => d.classificacao === 'vermelho').length;
  const etdCrit  = etdAtivos.filter(d => !d.naoPrioritaria && (d.risco === 'vermelho' || d.parado)).length;
  const mm = $('#masthead-meta');
  if(mm) mm.textContent = `${etdAtivos.length} em viagem · ${etaAtras + etdCrit} exigindo atenção`;
  renderFleetMap();
  updateNavHealth();
  recordSnapshot();
  renderAlertas();
  renderTrend();
  animateNumbers();
  const lu = DASHBOARD_DATA.lastUpdate ? fmtDateTime(DASHBOARD_DATA.lastUpdate) : '—';
  $('#lastUpdateLabel').textContent = `Atualizado ${lu}`;
}

/* ----------------------------------------------------------------------- */
/* Eventos                                                                  */
/* ----------------------------------------------------------------------- */
// KPIs clicáveis: clicar num card aplica/limpa o filtro correspondente
function bindKpiCards(){
  $$('.kpi-card.clickable').forEach(card => {
    card.addEventListener('click', () => {
      const tab = card.dataset.kpiTab, key = card.dataset.kpiKey, val = card.dataset.kpiVal;
      const f = filters[tab];
      if(key === 'parados' || key === 'posto'){
        f[key] = f[key].length ? [] : ['1'];
      } else if(val === ''){
        f[key] = [];                                   // card "Total" → limpa esse filtro
      } else {
        f[key] = (f[key].length === 1 && f[key][0] === val) ? [] : [val]; // alterna
      }
      if(tab === 'eta') refreshEta(); else refreshEtd();
      syncFilterUI(tab);
    });
  });
}

function anyFilterActive(tab){
  const f = filters[tab];
  return Object.keys(f).some(k => Array.isArray(f[k]) ? f[k].length > 0 : !!f[k]);
}
function syncKpiActive(tab){
  $$(`.kpi-card.clickable[data-kpi-tab="${tab}"]`).forEach(card => {
    const key = card.dataset.kpiKey, val = card.dataset.kpiVal;
    const f = filters[tab];
    let active;
    if(key === 'parados' || key === 'posto') active = f[key].length > 0;
    else if(val === '')   active = !anyFilterActive(tab);
    else                  active = f[key].includes(val);
    card.classList.toggle('active', active);
  });
}

function bindTabs(){
  $$('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      ['eta','etd','xpt','validacao','mapa','alertas'].forEach(t=>{
        $('#view-'+t).style.display = (t===tab)?'block':'none';
      });
      // recalcula tamanho dos gráficos da aba aberta
      Object.values(charts).forEach(c=>c.resize());
      // o mapa precisa recalcular tamanho quando a aba fica visível
      if(tab==='mapa') renderFleetMap();
      if(tab==='alertas'){ renderAlertas(); renderTrend(); }
    });
  });
}

/* ---- Exportar visão filtrada para CSV (separador ; + BOM p/ Excel BR) ---- */
function toCsv(cols, rows){
  const esc = v => { v = (v==null?'':String(v)); return /[";\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  return [cols.map(c=>c.label).join(';'), ...rows.map(r => cols.map(c=>esc(c.get(r))).join(';'))].join('\r\n');
}
function downloadCsv(name, text){
  const blob = new Blob(['﻿'+text], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
}
function csvStamp(){
  const d = new Date(), p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
function exportEtaCsv(){
  const cols = [
    {label:'Protocolo', get:d=>d.protocolo}, {label:'Rota', get:d=>d.rota}, {label:'Motorista', get:d=>d.motorista},
    {label:'Placa', get:d=>d.placa}, {label:'Horario maximo', get:d=>fmtDateTime(d.horarioMax)}, {label:'Chegada real', get:d=>fmtDateTime(d.horarioReal)},
    {label:'Resultado', get:d=>d.classificacaoTexto}, {label:'Status K', get:d=>d.statusK}, {label:'Status L', get:d=>d.statusL},
    {label:'Status viagem', get:d=>d.statusViagem}
  ];
  downloadCsv(`eta_${csvStamp()}.csv`, toCsv(cols, getEtaFiltered()));
}
function exportEtdCsv(){
  const cols = [
    {label:'Protocolo', get:d=>d.protocolo}, {label:'Nomenclatura', get:d=>d.rota}, {label:'Placa', get:d=>d.placa},
    {label:'Destino', get:d=>d.destino}, {label:'ETA destino', get:d=>fmtDateTime(d.etaDestino)}, {label:'Km faltante', get:d=>d.kmFaltante},
    {label:'Km/h medio (Q)', get:d=>d.kmMedio}, {label:'Faixa', get:d=>d.riscoTexto}, {label:'Desloc 1h (R)', get:d=>d.deslocHora},
    {label:'Velocidade (S)', get:d=>d.velocidadeAtual}, {label:'Status SM (L)', get:d=>d.statusSM}, {label:'Posto fiscal', get:d=>d.postoSituacao},
    {label:'Ocorrencia', get:d=>d.ocorrencia}
  ];
  downloadCsv(`etd_${csvStamp()}.csv`, toCsv(cols, getEtdFiltered()));
}

/* ---- Ordenação por clique no cabeçalho da tabela (A→Z / Z→A) ------------- */
function cmpCell(a, b){
  const ta = (a && a.textContent || '').trim(), tb = (b && b.textContent || '').trim();
  return ta.localeCompare(tb, 'pt-BR', { numeric:true, sensitivity:'base' });
}
function sortTableByHeader(th){
  const table = th.closest('table'), tbody = table && table.querySelector('tbody');
  if(!tbody) return;
  const idx = Array.prototype.indexOf.call(th.parentNode.children, th);
  const dir = th.getAttribute('data-sort') === 'asc' ? -1 : 1;
  th.parentNode.querySelectorAll('th').forEach(h => h.removeAttribute('data-sort'));
  th.setAttribute('data-sort', dir === 1 ? 'asc' : 'desc');
  const rows = Array.prototype.filter.call(tbody.querySelectorAll('tr'), r => !r.querySelector('.empty-state'));
  rows.sort((a, b) => cmpCell(a.children[idx], b.children[idx]) * dir);
  rows.forEach(r => tbody.appendChild(r));
}
function makeTablesSortable(){
  document.querySelectorAll('.table-wrap thead th').forEach(th => {
    th.classList.add('sortable');
    th.addEventListener('click', () => sortTableByHeader(th));
  });
}

function bindFilters(){
  $('#f-eta-search').addEventListener('input',  e=>{ filters.eta.search=e.target.value; refreshEta(); });
  $('#clearEtaFilters').addEventListener('click', ()=>{
    filters.eta = { classe:[], status:[], tipo:[], resp:[], search:'' };
    $('#f-eta-search').value=''; refreshEta(); syncFilterUI('eta');
  });

  $('#f-etd-search').addEventListener('input',   e=>{ filters.etd.search=e.target.value; refreshEtd(); });
  $('#clearEtdFilters').addEventListener('click', ()=>{
    filters.etd = { banda:[], status:[], tipo:[], destino:[], parados:[], posto:[], search:'' };
    $('#f-etd-search').value=''; refreshEtd(); syncFilterUI('etd');
  });
  const eb = $('#exportEta'); if(eb) eb.addEventListener('click', exportEtaCsv);
  const xb = $('#exportEtd'); if(xb) xb.addEventListener('click', exportEtdCsv);

  bindKpiCards();

  $('#refreshBtn').addEventListener('click', ()=>{
    const btn = $('#refreshBtn');
    if(DATA_SOURCE === 'sheets' && hasSheetUrls()){
      btn.textContent = '⏳ Atualizando…';
      loadFromSheets()
        .then(()=>{ initEtaFilters(); initEtdFilters(); renderAll(); btn.textContent = '✓ Atualizado'; })
        .catch(e=>{ setStatus('⚠ ' + e.message); btn.textContent = '⚠ Erro'; })
        .finally(()=> setTimeout(()=>{ btn.textContent = '↻ Atualizar dados'; }, 1800));
    } else {
      renderAll();
      btn.textContent = '✓ Atualizado';
      setTimeout(()=>{ btn.textContent = '↻ Atualizar dados'; }, 1500);
    }
  });
}

/* ----------------------------------------------------------------------- */
/* Boot                                                                     */
/* ----------------------------------------------------------------------- */
let autoRefreshTimer = null;

function setStatus(msg){
  if(msg) $('#lastUpdateLabel').textContent = msg;
}

function startAutoRefresh(){
  if(autoRefreshTimer) clearInterval(autoRefreshTimer);
  if(DATA_SOURCE !== 'sheets' || !hasSheetUrls()) return;
  autoRefreshTimer = setInterval(()=>{
    loadFromSheets()
      .then(()=>{ initEtaFilters(); initEtdFilters(); renderAll(); })
      .catch(e => setStatus('⚠ ' + e.message));
  }, AUTO_REFRESH_MIN * 60 * 1000);
}

// logos oficiais: tenta .svg, depois .png, e por fim cai no desenho (fallback)
function brandImgRetry(el, alt){
  if(el.dataset.tried){ const b = el.closest('.lk-brand'); if(b) b.classList.add('fail'); }
  else { el.dataset.tried = '1'; el.src = alt; }
}
function sideLogoFail(el){
  if(el.dataset.tried){ el.style.display = 'none'; const c = el.parentElement.querySelector('.dhl-chip'); if(c) c.style.display = ''; }
  else { el.dataset.tried = '1'; el.src = 'dhl.png'; }
}

function startClock(){
  const el = $('#side-clock');
  if(!el) return;
  const tick = () => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2,'0'), mi = String(d.getMinutes()).padStart(2,'0'), ss = String(d.getSeconds()).padStart(2,'0');
    const dia = d.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' });
    el.innerHTML = `<span class="clk-time">${hh}:${mi}<span class="clk-sec">${ss}</span></span><span class="clk-date">${dia}</span>`;
  };
  tick(); setInterval(tick, 1000);
}

async function boot(){
  DIST.load();
  bindTheme();
  bindTabs();
  bindFilters();
  bindMapControls();
  startClock();
  makeTablesSortable();
  bindRowDetails();

  // Aviso: aberto como arquivo (file://) bloqueia o fetch dos CSVs do Google
  const abertoComoArquivo = (location.protocol === 'file:');

  let loadErr = null;
  if(DATA_SOURCE === 'sheets' && hasSheetUrls()){
    if(abertoComoArquivo){
      // não adianta tentar buscar via file:// — mostra dados de exemplo + instrução
      setStatus('⚠ Abra pelo abrir-painel.bat (não por duplo clique)');
    } else {
      setStatus('Carregando dados do Sheets…');
      try { await loadFromSheets(); }
      catch(e){ loadErr = e; }   // erro parcial: segue com o que carregou
      startAutoRefresh();
    }
  }

  initEtaFilters();
  initEtdFilters();
  renderAll();

  if(abertoComoArquivo && DATA_SOURCE === 'sheets'){
    setStatus('⚠ Aberto como arquivo — rode o abrir-painel.bat p/ dados reais');
  } else if(loadErr){
    setStatus('⚠ Erro ao buscar: ' + loadErr.message);
  }
}

document.addEventListener('DOMContentLoaded', boot);

/* ----------------------------------------------------------------------- */
/* MAPA da frota (Leaflet + OpenStreetMap)                                  */
/* ----------------------------------------------------------------------- */
let _map = null, _fleetLayer = null;
const RISK_COLOR = { verde:'#16a34a', amarelo:'#e08a00', vermelho:'#D40511', cinza:'#9aa0aa' };
let mapBands = { verde:true, amarelo:true, vermelho:true };   // filtro por faixa no mapa
let mapFocus = null;                                          // protocolo isolado

// isolar um veículo no mapa (chamado pelo link do popup)
window.mapIsolate = function(proto){ mapFocus = proto; const r = $('#map-reset'); if(r) r.style.display='inline-flex'; renderFleetMap(); };

function bindMapControls(){
  $$('.mlf[data-band]').forEach(b => b.addEventListener('click', () => {
    const band = b.dataset.band;
    mapBands[band] = !mapBands[band];
    b.classList.toggle('off', !mapBands[band]);
    renderFleetMap();
  }));
  const reset = $('#map-reset');
  if(reset) reset.addEventListener('click', () => { mapFocus = null; reset.style.display='none'; renderFleetMap(); });
}

function initFleetMap(){
  if(_map || typeof L === 'undefined') return;
  const el = document.getElementById('fleetMap');
  if(!el) return;
  _map = L.map('fleetMap').setView([-15.0, -52.0], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(_map);
  _fleetLayer = L.layerGroup().addTo(_map);
}

function renderFleetMap(){
  if(typeof L === 'undefined') return;       // Leaflet ainda não carregou
  initFleetMap();
  if(!_map || !_fleetLayer) return;
  _map.invalidateSize();
  _fleetLayer.clearLayers();
  const rows = (DASHBOARD_DATA.etd || []).filter(d =>
    !d.naoPrioritaria && !d.finalizada &&
    mapBands[d.risco] !== false &&
    (!mapFocus || d.protocolo === mapFocus));
  let plotted = 0, np = 0, ri = 0, at = 0;
  rows.forEach(d => {
    const o = DIST.geo[normKey(d.origemGeo)], dst = DIST.geo[normKey(d.destinoGeo)];
    if(!o || o === 'FAIL' || !dst || dst === 'FAIL'){ DIST.enqueue(d.origemGeo, d.destinoGeo); return; }
    const total = DIST.get(d.origemGeo, d.destinoGeo);
    let frac = 0.5;
    if(total && total > 0 && d.kmFaltante != null) frac = Math.max(0, Math.min(1, (total - d.kmFaltante) / total));
    const color = RISK_COLOR[d.risco] || RISK_COLOR.cinza;
    const geom = DIST.geomOf(d.origemGeo, d.destinoGeo);
    let pos;
    if(geom){
      // rota real: linha pela estrada e veículo SOBRE a estrada
      L.polyline(geom, { color, weight:2, opacity:.45 }).addTo(_fleetLayer);
      pos = pointAlong(geom, frac);
    } else {
      // ainda sem geometria: linha reta provisória (busca enfileirada)
      DIST.enqueue(d.origemGeo, d.destinoGeo);
      L.polyline([[o.lat,o.lon],[dst.lat,dst.lon]], { color, weight:1, opacity:.18, dashArray:'4 5' }).addTo(_fleetLayer);
      pos = [ o.lat + frac*(dst.lat-o.lat), o.lon + frac*(dst.lon-o.lon) ];
    }
    const pct = Math.round(frac * 100);
    L.circleMarker(pos, { radius: mapFocus===d.protocolo?9:7, color:'#fff', weight:1.5, fillColor:color, fillOpacity:.95 })
      .bindPopup(`<b>${escapeHtml(d.protocolo)}</b><br>${escapeHtml(d.origemGeo||'?')} → ${escapeHtml(d.destinoGeo||'?')}<br>${pct}% concluído${d.kmFaltante!=null?' · '+d.kmFaltante+' km restantes':''}<br>${escapeHtml(d.riscoTexto||'')}${d.ocorrencia?'<br>⚠ '+escapeHtml(d.ocorrencia):''}<br><a href="#" onclick="mapIsolate('${escapeHtml(d.protocolo)}');return false;" style="color:#b8860b;font-weight:600">🔍 isolar no mapa</a>`)
      .addTo(_fleetLayer);
    plotted++;
    if(d.risco==='verde') np++; else if(d.risco==='amarelo') ri++; else if(d.risco==='vermelho') at++;
  });
  if(mapFocus && plotted > 0){ try { _map.fitBounds(_fleetLayer.getBounds(), { maxZoom:9, padding:[40,40] }); } catch(e){} }
  const hl = $('#mapa-ops-headline');
  if(hl){
    const pend = rows.length - plotted;
    hl.textContent = `${plotted} no mapa${pend>0?` · ${pend} resolvendo`:''}`;
  }
  const st = $('#mapa-ops-stats');
  if(st){
    st.innerHTML = statItem('var(--green)','No prazo',np) + statItem('var(--amber)','Risco',ri) + statItem('var(--red)','Possível atraso',at);
  }
}

/* ----------------------------------------------------------------------- */
/* Tema NOC (claro ⇄ escuro)                                                */
/* ----------------------------------------------------------------------- */
function applyTheme(noc){
  document.body.classList.toggle('noc', !!noc);
  const b = $('#themeBtn'); if(b) b.textContent = noc ? '☀️' : '🌙';
  if(typeof Chart !== 'undefined') Chart.defaults.color = noc ? '#8b92a3' : PALETTE.dim;
  try { localStorage.setItem('dhl_theme', noc ? 'noc' : 'light'); } catch(e){}
}
function bindTheme(){
  let saved = 'light';
  try { saved = localStorage.getItem('dhl_theme') || 'light'; } catch(e){}
  applyTheme(saved === 'noc');
  const b = $('#themeBtn');
  if(b) b.addEventListener('click', () => {
    applyTheme(!document.body.classList.contains('noc'));
    if(typeof renderAll === 'function') renderAll();   // re-renderiza gráficos com a cor nova
  });
}

/* =========================================================================
   PRODUÇÃO — consumo do Google Sheets publicado (CSV)
   -------------------------------------------------------------------------
   Tudo abaixo já está funcional. Para ativar:
     - preencha SHEET_CSV (lá no topo do arquivo) e troque DATA_SOURCE='sheets'
   O parser lida com aspas/vírgulas/quebras de linha dentro de células.
   ========================================================================= */

/* ---- Parser CSV robusto (RFC 4180: aspas, vírgulas e \n dentro de campo) -- */
function parseCsv(text){
  if(!text) return [];
  // remove BOM
  text = text.replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', i = 0, inQuotes = false;
  while(i < text.length){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i += 2; continue; } // aspas escapadas ""
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if(c === '"'){ inQuotes = true; i++; continue; }
    if(c === ','){ row.push(field); field=''; i++; continue; }
    if(c === '\r'){ i++; continue; }
    if(c === '\n'){ row.push(field); rows.push(row); row=[]; field=''; i++; continue; }
    field += c; i++;
  }
  // último campo/linha
  if(field.length || row.length){ row.push(field); rows.push(row); }
  if(!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1)
    .filter(r => r.some(v => (v||'').trim() !== ''))   // ignora linhas totalmente vazias
    .map(r => {
      const o = {};
      headers.forEach((h, idx) => { o[h] = (r[idx] !== undefined ? r[idx].trim() : ''); });
      // guarda as células na ordem para acesso por LETRA de coluna (A, B, C...)
      Object.defineProperty(o, '__cells', {
        value: r.map(v => (v !== undefined ? String(v).trim() : '')),
        enumerable: false
      });
      return o;
    });
}

/* ---- Acesso por letra de coluna (A=0, B=1, ... Z, AA, AB...) ------------- */
function colLetterToIndex(letter){
  let n = 0;
  const s = String(letter).toUpperCase();
  for(let i=0;i<s.length;i++){ n = n*26 + (s.charCodeAt(i)-64); }
  return n - 1;
}
// cell(row, 'F') → valor da coluna F daquela linha do CSV ('' se não existir)
function cell(row, letter){
  const cells = row && row.__cells;
  if(!cells) return '';
  const i = colLetterToIndex(letter);
  return (i >= 0 && cells[i] !== undefined) ? cells[i] : '';
}

/* ---- Helpers de leitura tolerante a nomes de coluna --------------------- */
function normKey(s){
  return String(s||'')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'') // tira acentos
    .replace(/[^a-z0-9]+/g,' ').trim();
}

// Constrói um índice {chaveNormalizada: valor} uma vez por linha
function indexRow(row){
  const idx = {};
  Object.keys(row).forEach(k => { idx[normKey(k)] = row[k]; });
  return idx;
}

// pick(idx, ['eta origem','eta','horario'], '') — primeiro alias que existir e não-vazio
function pick(idx, aliases, fallback=''){
  for(const a of aliases){
    const v = idx[normKey(a)];
    if(v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return fallback;
}

/* ---- Conversões de tipo (formatos BR) ----------------------------------- */
// Aceita "18/06/2026 04:00", "18/06 04:00", "2026-06-18T04:00", "2026-06-18 04:00:00"
function parseDateBR(v){
  if(!v) return null;
  const s = String(v).trim();
  if(!s || /^#n\/?a$/i.test(s)) return null;
  // já ISO?
  if(/^\d{4}-\d{2}-\d{2}/.test(s)){
    const d = new Date(s.replace(' ', 'T'));
    return isNaN(d) ? null : d.toISOString();
  }
  // dd/mm[/aaaa] [hh:mm[:ss]]
  const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(m){
    const dd = +m[1], mm = +m[2];
    let yy = m[3] ? +m[3] : new Date().getFullYear();
    if(yy < 100) yy += 2000;
    const hh = m[4] ? +m[4] : 0, mi = m[5] ? +m[5] : 0, ss = m[6] ? +m[6] : 0;
    const d = new Date(yy, mm-1, dd, hh, mi, ss);
    return isNaN(d) ? null : d.toISOString();
  }
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString();
}

// "1.234" -> 1234 ; "1.234,5" -> 1234.5 ; "" / "#N/A" -> null
function parseNum(v){
  if(v === null || v === undefined) return null;
  let s = String(v).trim();
  if(!s || /^#n\/?a$/i.test(s) || /sem/i.test(s)) return null;
  s = s.replace(/[^\d.,\-]/g,'');
  if(!s || s === '-' ) return null;
  if(s.includes(',')){                       // formato BR: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g,'').replace(',', '.');
  } else if(/^-?\d{1,3}(\.\d{3})+$/.test(s)){ // só pontos em grupos de 3 = separador de milhar (ex.: 2.895, 1.234.567)
    s = s.replace(/\./g,'');
  }                                          // demais casos com 1 ponto = decimal (ex.: 12.5)
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Deriva a cor do semáforo (verde/amarelo/vermelho/cinza) a partir do texto
function deriveClasse(texto){
  const t = normKey(texto);
  if(!t) return 'cinza';
  if(/nao chegara|atrasad|fora do prazo|estourou/.test(t)) return 'vermelho';
  if(/validar sm|falta|sem dado|sem posicao|conferir/.test(t)) return 'cinza';
  if(/risco|atencao|alerta/.test(t)) return 'amarelo';
  if(/no prazo|chegou|dentro do prazo|chegara dentro/.test(t)) return 'verde';
  return 'cinza';
}

/* ---- Mapeadores: linha do CSV -> objeto que o painel consome -------------
   Cada pick() lista aliases possíveis de cabeçalho. Se sua planilha usar um
   nome diferente, é só ADICIONAR o nome na lista (não precisa remover os outros).
   -------------------------------------------------------------------------- */
function mapEtaRow(row){
  const x = indexRow(row);
  const classeTexto = pick(x, ['classificacao texto','classificacao','status ots classificacao','semaforo','farol','classe']);
  return {
    protocolo:  pick(x, ['protocolo','protocolo meli','id','tracking id']),
    rota:       pick(x, ['rota','rota meli','servico','service']),
    motorista:  pick(x, ['motorista','condutor','driver']),
    placa:      pick(x, ['placa','placa cavalo','placa trator','plate']),
    etaOrigem:  parseDateBR(pick(x, ['eta origem','eta na origem','eta','previsao chegada origem','horario eta'])),
    etaBipagem: parseDateBR(pick(x, ['eta bipagem','bipagem','horario bipagem','data bipagem'])),
    status:     pick(x, ['status','status viagem','situacao']),
    statusOTS:  pick(x, ['status ots','ots','status no prazo']),
    tipoRota:   pick(x, ['tipo rota','tipo','modal','tipo de rota']),
    origem:     pick(x, ['origem','local origem','base origem','from']),
    destino:    pick(x, ['destino','local destino','base destino','to']),
    sinal:      pick(x, ['sinal','status sinal','posicao','rastreamento']),
    classificacaoTexto: classeTexto,
    classificacao:      deriveClasse(classeTexto),
    responsavel: pick(x, ['responsavel','analista','operador','owner']),
    preventivo:  pick(x, ['preventivo','contato preventivo']),
    checklist:   pick(x, ['checklist','check list']),
    velocidade:  parseNum(pick(x, ['velocidade','velocidade atual','km h','velocidade km h'])),
    // --- por POSIÇÃO de coluna (definido pelo Caio) ---
    horarioMax:  parseDateBR(cell(row,'F')),  // F = horário máximo de chegada
    horarioReal: parseDateBR(cell(row,'G')),  // G = horário real da chegada
    statusK:     cell(row,'K'),               // K = status da rota
    statusL:     cell(row,'L'),               // L = status da rota
    statusViagem: cell(row,'U')               // U = status da viagem
  };
}

function mapEtdRow(row){
  const x = indexRow(row);
  const etaDestino = parseDateBR(pick(x, ['eta destino','eta no destino','eta','previsao chegada destino']));
  let substatus = pick(x, ['substatus','sub status','status prazo','prazo']);
  const status = pick(x, ['status','status viagem','situacao']);
  if(!substatus){ // deriva se a planilha não trouxer
    if(etaDestino && new Date(etaDestino) < new Date() && !/finaliz/i.test(status)) substatus = 'Atrasado';
    else substatus = 'No prazo';
  }
  return {
    protocolo:  pick(x, ['protocolo','protocolo meli','id']),
    rota:       pick(x, ['rota','servico','service']),
    placa:      pick(x, ['placa','placa cavalo','placa trator']),
    cpt:        parseDateBR(pick(x, ['cpt','cpt previsto','data cpt','horario cpt'])),
    etaDestino: etaDestino,
    status:     status,
    substatus:  substatus,
    destino:    pick(x, ['destino','cidade destino','base destino']),
    tipoRota:   pick(x, ['tipo rota','tipo','modal']),
    sm:         pick(x, ['sm','numero sm','sm brk','id sm']),
    statusSM:   pick(x, ['status sm','situacao sm','status viagem sm']),
    posicaoAtual: pick(x, ['posicao atual','posicao','localizacao','ultima posicao']),
    kmFaltante: parseNum(pick(x, ['km faltante','km restante','distancia restante','km para destino'])),
    kmh:        parseNum(pick(x, ['kmh','km h medio','media km h'])),
    velocidadeAtual: parseNum(pick(x, ['velocidade atual','velocidade','vel atual'])),
    pacotes:    parseNum(pick(x, ['pacotes','qtd pacotes','volumes','hus'])),
    situacaoFiscal: pick(x, ['situacao fiscal','fiscal','status fiscal']),
    origem:     pick(x, ['origem','base origem']),
    carregamento: pick(x, ['carregamento','tipo carregamento','saida']),
    statusBRK:  pick(x, ['status brk','brk','status sm brk']),
    tecnologia: pick(x, ['tecnologia','rastreador','tracker']),
    parada:     pick(x, ['parada','motivo parada']),
    obs:        pick(x, ['obs','observacao','observacoes']),
    // --- por POSIÇÃO de coluna (definido pelo Caio); fallback p/ cabeçalho/sample ---
    protocolo:  cell(row,'A') || pick(x, ['protocolo','protocolo meli','id']),               // A = protocolo
    rota:       cell(row,'B') || pick(x, ['rota','servico','service']),                       // B = nomenclatura
    placa:      cell(row,'C') || pick(x, ['placa','placa cavalo','placa trator']),            // C = placa
    etaDestino: parseDateBR(cell(row,'F')) || etaDestino,                                     // F = horário de destino
    statusSM:   cell(row,'L') || pick(x, ['status sm','situacao sm','status viagem sm']),     // L = status da SM
    kmMedio:    parseNum(cell(row,'Q')),                                                      // Q = km/h médio necessário
    deslocHora: parseNum(cell(row,'R')),                                                      // R = km percorridos na última hora
    velocidadeAtual: (cell(row,'S') !== '' ? parseNum(cell(row,'S'))                          // S = velocidade atual
                                           : parseNum(pick(x, ['velocidade atual','velocidade','vel atual']))),
    postoU:     cell(row,'U'),   // U = posto fiscal (acompanhamento)
    postoV:     cell(row,'V')    // V = posto fiscal (acompanhamento)
    // origem/destino reais vêm da aba SM (cidade+UF) no enrichData — a coluna O do ETD é o sinal de GPS, não o destino
  };
}

function mapXptRow(row){
  const x = indexRow(row);
  return {
    protocolo:  pick(x, ['protocolo','protocolo meli','id']),
    rota:       pick(x, ['rota','servico','service']),
    motorista:  pick(x, ['motorista','condutor']),
    placa:      pick(x, ['placa','placa cavalo','placa trator']),
    veiculo:    pick(x, ['veiculo','tipo veiculo','tipo']),
    etaOrigem:  parseDateBR(pick(x, ['eta origem','eta','horario eta'])),
    bipagemCPT: parseDateBR(pick(x, ['bipagem cpt','bipagem','cpt','horario bipagem'])),
    status:     pick(x, ['status','situacao']),
    hus:        parseNum(pick(x, ['hus','qtd hus','unidades'])),
    pacotes:    parseNum(pick(x, ['pacotes','qtd pacotes','volumes'])),
    doc:        pick(x, ['doc','documento','status doc','nf']),
    validacaoPortal: pick(x, ['validacao portal','portal','status portal']),
    obs:        pick(x, ['obs','observacao','observacoes'])
  };
}

function mapValRow(row){
  const x = indexRow(row);
  return {
    protocolo:   pick(x, ['protocolo','protocolo meli','id']),
    placas:      pick(x, ['placas','placa','placas cavalo carreta']),
    servico:     pick(x, ['servico','rota','service']),
    statusPortal: cell(row,'H') || pick(x, ['status portal','validacao portal','portal','validacao']),  // H = status portal
    divergencia:  cell(row,'O') || pick(x, ['divergencia','divergencias','diferenca'])                  // O = o que está errado
  };
}

function mapAcompRow(row){
  const x = indexRow(row);
  return {
    protocolo:  pick(x, ['protocolo','protocolo meli','id']),
    rota:       pick(x, ['rota','servico']),
    cptPrevisto: parseDateBR(pick(x, ['cpt previsto','cpt programado','cpt'])),
    cptReal:     parseDateBR(pick(x, ['cpt real','cpt realizado','bipagem cpt'])),
    status:     pick(x, ['status','situacao']),
    desvio:     parseNum(pick(x, ['desvio','desvio min','desvio minutos']))
  };
}

// Aba SM: liga origem/destino (cidade + UF) ao protocolo. Colunas por POSIÇÃO:
// F = protocolo · O = cidade origem · P = UF origem · T = cidade destino · U = UF destino
function mapSmRow(row){
  return {
    protocolo: cell(row,'F'),
    oCidade:   cell(row,'O'),
    oUF:       cell(row,'P'),
    dCidade:   cell(row,'T'),
    dUF:       cell(row,'U')
  };
}

// Aba Ocorrências: A = protocolo · O = ocorrência (motivo em sistema)
function mapOcorrenciaRow(row){
  return { protocolo: cell(row,'A'), ocorrencia: cell(row,'O') };
}

/* ---- Carregamento a partir do Sheets ------------------------------------ */
const SHEET_MAP = {
  eta:        { key:'eta',        mapper: mapEtaRow },
  etd:        { key:'etd',        mapper: mapEtdRow },
  xpt:        { key:'xpt',        mapper: mapXptRow },
  validacao:  { key:'validacao',  mapper: mapValRow },
  sm:         { key:'sm',         mapper: mapSmRow },
  ocorrencias:{ key:'ocorrencias',mapper: mapOcorrenciaRow },
  acompCpt:   { key:'acompCpt',   mapper: mapAcompRow }
};

async function fetchTab(name){
  const url = SHEET_CSV[name];
  if(!url) return null; // aba sem URL configurada → mantém o que já tem
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error(`HTTP ${res.status} ao buscar aba ${name}`);
  const text = await res.text();
  const rows = parseCsv(text);
  return rows.map(SHEET_MAP[name].mapper);
}

// Busca todas as abas configuradas. Falha de uma aba não derruba as outras.
async function loadFromSheets(){
  const names = Object.keys(SHEET_MAP);
  const results = await Promise.allSettled(names.map(fetchTab));
  const errors = [];
  results.forEach((r, i) => {
    const name = names[i];
    if(r.status === 'fulfilled'){
      if(Array.isArray(r.value)) DASHBOARD_DATA[SHEET_MAP[name].key] = r.value;
    } else {
      errors.push(`${name}: ${r.reason && r.reason.message ? r.reason.message : r.reason}`);
    }
  });
  DASHBOARD_DATA.lastUpdate = new Date().toISOString();
  if(errors.length) throw new Error(errors.join(' · '));
}

function hasSheetUrls(){
  return Object.values(SHEET_CSV).some(u => u && u.trim());
}

/* =========================================================================
   DISTÂNCIA Origem (N) → Destino (O) via geocodificação gratuita
   -------------------------------------------------------------------------
   Nominatim (geocode) + OSRM (rota rodoviária), com cache em localStorage.
   Usado para a % concluída da barra: (total - kmFaltante) / total.
   Respeita ~1 req/seg do Nominatim; cada par é resolvido uma única vez.
   ========================================================================= */
// agrupa os redesenhos disparados pela geocodificação (no máximo 1 a cada ~1,2s)
let _distRenderTimer = null;
function scheduleDistRender(){
  if(_distRenderTimer) return;
  _distRenderTimer = setTimeout(() => {
    _distRenderTimer = null;
    if(typeof refreshEtd === 'function') refreshEtd();
    const v = document.getElementById('view-mapa');
    if(v && v.style.display !== 'none' && typeof renderFleetMap === 'function') renderFleetMap();
  }, 1200);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function cleanLocation(name){
  // "Cajamar - SP" -> "Cajamar, SP" ; remove sufixos de hub comuns
  return String(name||'').replace(/\s*-\s*/g, ', ').replace(/\s+/g,' ').trim();
}

const DIST = {
  geo: {},     // nomeNormalizado -> {lat,lon} | 'FAIL'
  pair: {},    // "o||d" -> km (number) | 'FAIL'
  geom: {},    // "o||d" -> [[lat,lon],...] (geometria da rota OSRM) | 'FAIL'
  queue: [],
  running: false,

  load(){
    try {
      this.geo  = JSON.parse(localStorage.getItem('dhl_geo')  || '{}');
      this.pair = JSON.parse(localStorage.getItem('dhl_pair') || '{}');
      this.geom = JSON.parse(localStorage.getItem('dhl_geom') || '{}');
    } catch(e){ this.geo = {}; this.pair = {}; this.geom = {}; }
  },
  save(){
    try {
      localStorage.setItem('dhl_geo',  JSON.stringify(this.geo));
      localStorage.setItem('dhl_pair', JSON.stringify(this.pair));
      localStorage.setItem('dhl_geom', JSON.stringify(this.geom));
    } catch(e){}
  },
  key(o,d){ return normKey(o) + '||' + normKey(d); },

  // km do par (número) ou null se ainda não resolvido
  get(o,d){
    if(!o || !d) return null;
    const v = this.pair[this.key(o,d)];
    return (typeof v === 'number') ? v : null;
  },
  // 'ok' | 'fail' | 'pending'
  statusOf(o,d){
    if(!o || !d) return 'fail';
    const v = this.pair[this.key(o,d)];
    if(typeof v === 'number') return 'ok';
    if(v === 'FAIL') return 'fail';
    return 'pending';
  },
  geomOf(o,d){
    if(!o || !d) return null;
    const g = this.geom[this.key(o,d)];
    return Array.isArray(g) ? g : null;
  },
  enqueue(o,d){
    if(!o || !d) return;
    const k = this.key(o,d);
    if(this.pair[k] !== undefined && this.geom[k] !== undefined) return; // km + geometria resolvidos
    if(this.queue.some(q => q.k === k)) return;     // já na fila
    this.queue.push({ o, d, k });
    this.run();
  },
  async run(){
    if(this.running) return;
    this.running = true;
    while(this.queue.length){
      const { o, d, k } = this.queue.shift();
      try {
        const a = await this.geocode(o);
        const b = await this.geocode(d);
        if(a && b){
          const rt = await this.route(a, b);
          this.pair[k] = (rt && rt.km != null) ? rt.km : 'FAIL';
          this.geom[k] = (rt && rt.coords) ? rt.coords : 'FAIL';
        } else {
          this.pair[k] = 'FAIL'; this.geom[k] = 'FAIL';
        }
      } catch(e){ this.pair[k] = 'FAIL'; this.geom[k] = 'FAIL'; }
      this.save();
      scheduleDistRender();   // re-render agrupado (evita tempestade de redesenho)
    }
    this.running = false;
  },
  async geocode(name){
    const nk = normKey(name);
    if(this.geo[nk]) return this.geo[nk] === 'FAIL' ? null : this.geo[nk];
    await sleep(1100); // política de uso do Nominatim
    const q = encodeURIComponent(cleanLocation(name) + ', Brasil');
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${q}`;
    const r = await fetch(url, { headers: { 'Accept':'application/json' } });
    const j = await r.json();
    if(j && j[0]){
      const c = { lat: +j[0].lat, lon: +j[0].lon };
      this.geo[nk] = c; this.save(); return c;
    }
    this.geo[nk] = 'FAIL'; this.save(); return null;
  },
  async route(a,b){
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=simplified&geometries=geojson`;
    const r = await fetch(url);
    const j = await r.json();
    if(j && j.routes && j.routes[0]){
      const rt = j.routes[0];
      const coords = (rt.geometry && rt.geometry.coordinates)
        ? rt.geometry.coordinates.map(c => [c[1], c[0]])   // [lon,lat] -> [lat,lon]
        : null;
      return { km: Math.round(rt.distance / 1000), coords };
    }
    return null;
  }
};

// ponto sobre a polilinha da rota a uma fração (0..1) da distância total
function haversineKm(a, b){
  const R = 6371, toRad = x => x * Math.PI / 180;
  const dLat = toRad(b[0]-a[0]), dLon = toRad(b[1]-a[1]);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)**2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function pointAlong(coords, frac){
  if(!coords || coords.length < 2) return coords && coords[0];
  let total = 0; const seg = [];
  for(let i=1;i<coords.length;i++){ const dseg = haversineKm(coords[i-1], coords[i]); seg.push(dseg); total += dseg; }
  let target = Math.max(0, Math.min(1, frac)) * total, acc = 0;
  for(let i=0;i<seg.length;i++){
    if(acc + seg[i] >= target){
      const t = seg[i] ? (target - acc) / seg[i] : 0;
      return [ coords[i][0] + t*(coords[i+1][0]-coords[i][0]), coords[i][1] + t*(coords[i+1][1]-coords[i][1]) ];
    }
    acc += seg[i];
  }
  return coords[coords.length-1];
}
/* fim do app.js — painel de tracking DHL × Mercado Livre */
