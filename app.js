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
  base:     'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIA0s8fgtB3zxdzJ7xPoWoaVgxO0R7IFDwaVqinmhm0AMDWDLhRXwzFHvNlosniSamBgxokptIS2Ic/pub?gid=1531998180&single=true&output=csv',  // aba Base (central): B=Rostering ID, AM=Estado, T=Origem ATD
  links:    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIA0s8fgtB3zxdzJ7xPoWoaVgxO0R7IFDwaVqinmhm0AMDWDLhRXwzFHvNlosniSamBgxokptIS2Ic/pub?gid=1061780119&single=true&output=csv',  // aba Links: A=cidade/nome, B=sigla, G=endereço
  od:       'https://docs.google.com/spreadsheets/d/e/2PACX-1vQIA0s8fgtB3zxdzJ7xPoWoaVgxO0R7IFDwaVqinmhm0AMDWDLhRXwzFHvNlosniSamBgxokptIS2Ic/pub?gid=386959973&single=true&output=csv',  // aba Origem-destino: F=nomenclatura (chave), B/C=sigla/nome origem, D/E=sigla/nome destino
  acompCpt: ''   // (opcional) URL CSV da aba ACOMP CPT
};

// Supabase (histórico de viagens finalizadas). A chave anon é pública por design
// (só leitura, protegida por RLS). Escrita é feita pelo Apps Script (service_role).
const SUPABASE = {
  url:  'https://dvbezzmfnvbpumnwrqhj.supabase.co',
  anon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR2YmV6em1mbnZicHVtbndycWhqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NzI2NzIsImV4cCI6MjA5ODQ0ODY3Mn0.eNVk3yNMdDmxXFKrlNyg7lE7Zi9Cxxu3QWPzcHA_kqs'
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
    <div class="ms-pop">
      <div class="ms-tools">
        <button class="ms-all" type="button">Marcar todos</button>
        <button class="ms-clear" type="button">Limpar</button>
      </div>
      ${opts || '<div class="empty-state" style="padding:16px">Sem opções</div>'}
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
  container.querySelector('.ms-all').addEventListener('click', e => {
    e.stopPropagation(); filters[tab][key] = [...values]; onFilterChange(tab);
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
  saveView();
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
    if(d.ehXpt) return false;   // XPT é operação à parte — vive só na aba XPT
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
    if(d.ehXpt) return false;        // XPT é operação à parte — concentrada na aba XPT
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

// Índice da aba Base: protocolo (Rostering ID) -> dados centrais (Estado, saída real, causa raiz)
let BASE_INDEX = {};        // por Rostering ID (Protocolo)
let BASE_ROUTE_INDEX = {};  // por Route ID (Travel ID)
function buildBaseIndex(){
  BASE_INDEX = {}; BASE_ROUTE_INDEX = {};
  (DASHBOARD_DATA.base || []).forEach(r => {
    const p = String(r.protocolo || '').trim();
    const rt = String(r.routeId || '').trim();
    if(p && p !== '0') BASE_INDEX[p] = r;
    if(rt && rt !== '0') BASE_ROUTE_INDEX[rt] = r;
  });
}
// "#N/A", vazio ou "0" contam como sem valor
function isNA(v){ const s = String(v == null ? '' : v).trim(); return !s || s === '0' || /^#n\/?a$/i.test(s); }
// Acha a linha da Base por QUALQUER chave e diz o tipo: Protocolo (Rostering) ou Travel ID (Route).
// As faixas de numeração não se sobrepõem, então dá pra confiar em qual índice bateu.
function baseForId(id){
  const s = String(id == null ? '' : id).trim();
  if(!s || s === '0') return null;
  if(BASE_INDEX[s])       return { row: BASE_INDEX[s],       tipo: 'Protocolo' };
  if(BASE_ROUTE_INDEX[s]) return { row: BASE_ROUTE_INDEX[s], tipo: 'Travel ID' };
  return null;
}
// Índice da aba Links: sigla do service center -> { nome, endereço, Maps }
let LINK_INDEX = {};
function buildLinkIndex(){
  LINK_INDEX = {};
  (DASHBOARD_DATA.links || []).forEach(r => {
    const s = normKey(r.sigla);
    if(!s) return;
    LINK_INDEX[s] = { nome: r.nome, endereco: r.endereco, maps: r.maps, lat: r.lat, lon: r.lon };
  });
}
function scInfo(sigla){ return LINK_INDEX[normKey(sigla)] || null; }
// String de geocodificação mais precisa p/ uma sigla + coords exatas (se o link tiver).
// 1) coords embutidas no link do Maps  2) endereço escrito (col E)  3) cidade de fallback
function preciseGeo(sigla, sc, fallback){
  const coords = (sc && sc.lat != null && sc.lon != null) ? { lat: sc.lat, lon: sc.lon } : null;
  const addr = (sc && sc.endereco || '').trim();
  let str;
  if(addr)        str = fallback ? `${addr}, ${fallback}` : addr;   // geocodifica o endereço escrito
  else if(coords) str = `SC ${sigla}`;                              // só coords: chave única p/ semear
  else            str = fallback || '';                             // último caso: cidade+UF
  return { str, coords };
}
// Índice Origem-destino: nomenclatura -> { siglas e nomes de origem/destino }
let OD_INDEX = {};
let TIPO_INDEX = {};   // nomenclatura (col H) -> tipo da rota (col I)
function buildOdIndex(){
  OD_INDEX = {}; TIPO_INDEX = {};
  (DASHBOARD_DATA.od || []).forEach(r => {
    const k = normKey(r.nomenclatura);
    if(k) OD_INDEX[k] = r;
    const kh = normKey(r.rotaH);
    if(kh && (r.tipoI||'').trim()) TIPO_INDEX[kh] = r.tipoI.trim();
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
  buildBaseIndex();
  buildLinkIndex();
  buildOdIndex();
  // ---- ETA: no prazo se G < F ; atrasado se G >= F ; aguardando se G vazio
  DASHBOARD_DATA.eta.forEach(d => {
    // fallback p/ modo sample (sem células posicionais)
    if(d.horarioMax == null && d.etaOrigem)  d.horarioMax  = d.etaOrigem;
    if(d.horarioReal === undefined)          d.horarioReal = d.etaBipagem || null;
    // Enriquece pela BASE: a aba ETA às vezes vem com #N/A (quando a linha só tem Travel ID).
    // Busca na Base por Protocolo OU Travel ID e preenche o que faltar (não fica refém do #N/A).
    const eb = baseForId(d.protocolo);
    if(eb){
      const b = eb.row;
      if(isNA(d.rota))    d.rota    = b.servico || d.rota;
      if(isNA(d.origem))  d.origem  = b.origem  || d.origem;
      if(isNA(d.destino)) d.destino = b.destino || d.destino;
      // horários de chegada na origem: se a aba ETA não trouxe, usa a Base (Origem ETA/ATA)
      if(!d.horarioMax  && b.origemETA) d.horarioMax  = parseDateBR(b.origemETA);
      if(!d.horarioReal && b.origemATA) d.horarioReal = parseDateBR(b.origemATA);
    }
    // limpa "#N/A" das colunas de exibição (mostra vazio em vez do erro)
    ['rota','motorista','placa','origem','destino','status','statusK','statusL','statusViagem','segundaBipagem'].forEach(k => { if(isNA(d[k])) d[k] = ''; });
    let cls = 'cinza', txt = 'Aguardando chegada';
    d.atrasoMin = null;
    if(d.horarioReal && d.horarioMax){
      const diff = (new Date(d.horarioReal) - new Date(d.horarioMax)) / 60000; // minutos
      if(diff < 0){ cls = 'verde'; txt = 'No prazo'; }
      else { cls = 'vermelho'; txt = 'Atrasado'; d.atrasoMin = Math.round(diff); }
    }
    d.classificacao = cls;
    d.classificacaoTexto = txt;
    // XPT é operação à parte — marca pra excluir do ETA (fica só na aba XPT)
    d.ehXpt = /xpt/i.test(`${d.rota||''} ${d.tipoRota||''}`);
    // Ocorrência (motivo em sistema) e causa raiz da Base — pra saber o PORQUÊ do atraso
    const pk = String(d.protocolo || '').trim();
    d.ocorrencia = OCOR_INDEX[pk] || '';
    const b = BASE_INDEX[pk];
    d.causaRaiz = (b && b.causaRaiz ? b.causaRaiz.trim() : '');
  });

  // ---- ETD: faixa pela coluna Q (km/h médio necessário), parados (col L) e prioridade
  DASHBOARD_DATA.etd.forEach(d => {
    // fallback p/ modo sample (sem coluna Q)
    if(d.kmMedio == null){
      d.kmMedio = (d.substatus === 'Atrasado') ? 72 : ((d.kmFaltante || 0) > 500 ? 60 : 48);
    }
    let cls = 'cinza', txt = 'Sem dado';
    const q = d.kmMedio;
    // km/h médio NEGATIVO = o cálculo estourou (já passou do prazo) → já atrasado e piorando.
    // Vai pra "Possível atraso" e fica no topo (máxima prioridade).
    d.kmNegativo = (q != null && q < 0);
    if(q != null){
      if(q < 0)        { cls = 'vermelho'; txt = 'Possível atraso'; }  // cálculo estourou
      else if(q <= 46) { cls = 'verde';    txt = 'No prazo'; }
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
    // XPT é operação à parte — SEMPRE isolada (nunca entra em SLA/KPIs do Line Haul)
    d.ehXpt = /xpt/i.test(`${d.rota||''} ${d.tipoRota||''}`);
    // Não prioritária: XPT e reversas. (reversa COM pacotes é repromovida depois de ler a Base)
    d.naoPrioritaria = d.ehXpt || /rev|revers/i.test(`${d.rota||''} ${d.tipoRota||''}`);
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

    // Base (fonte central): o Estado define se a rota REALMENTE iniciou.
    // Liga por protocolo = Rostering ID. Corrige o falso "parado" de rotas que nem saíram.
    const base = BASE_INDEX[pkey];
    if(base){
      const est = (base.estado || '').trim().toLowerCase();
      d.baseEstado = base.estado || '';
      d.baseSub    = base.substatus || '';
      d.causaRaiz  = (base.causaRaiz || '').trim();
      d.origemATD  = (base.origemATD || '').trim();
      d.routeId    = base.routeId || '';
      d.naoIniciada = (est === 'pendente');
      d.cancelada   = (est === 'cancelado');
      // Base é a fonte central: o status dela MANDA sobre o da SM.
      if(est === 'finalizado' || est === 'cancelado'){
        d.finalizada = true;                 // Base concluiu/cancelou → oculta
      } else if(est === 'em andamento' || est === 'pendente'){
        d.finalizada = false;                // Base diz que ainda está ativa/aguardando → MOSTRA,
                                             // mesmo se a SM finalizou antes (divergência: corre p/ ajustar)
      }
      if(d.naoIniciada){
        d.parado = false;                 // não saiu da origem → não é "parado em viagem"
        d.risco = 'cinza';
        d.riscoTexto = 'Aguardando início';
      }
    }

    // Pacotes da Base (col AK) é a fonte boa — usado pra ordenar as reversas (com pacote primeiro).
    // Reversas ficam agrupadas na tabela delas (não viram prioritárias). XPT segue isolado.
    const basePac = (base && base.pacotes != null) ? base.pacotes : null;
    if(basePac != null && basePac > 0) d.pacotes = basePac;   // não zera ativas

    // Cancelamento/Infrutífera pode ser preenchido na SM (col L) ANTES de a Base atualizar o Estado.
    // Nesse caso vale a SM: a rota sai da operação (Cancelado nunca aparece nas tabelas).
    if(/cancel|infrut/i.test(d.statusSM || '')){ d.finalizada = true; d.canceladaSM = true; }

    // CPT (col D): se já passou do CPT e a rota NÃO saiu, é acionável — ou atraso de
    // carregamento (ver ocorrência), ou cancel/infrutífera ainda não refletido no Estado (ver SM).
    d.cptEstourou = false;
    if(d.cpt && !d.finalizada){
      const partiu = !!(d.origemATD && String(d.origemATD).trim())
                     || /andamento|finaliz/i.test(d.baseEstado || '');
      if(!partiu && new Date(d.cpt) < new Date()) d.cptEstourou = true;
    }

    // Origem-destino: pela NOMENCLATURA (col F da aba) descobre as siglas/nomes;
    // a sigla puxa o endereço do service center na aba Links.
    const od = OD_INDEX[normKey(d.rota)];
    if(od){
      d.odOrigemSigla = od.oSigla || '';
      d.odOrigemNome  = od.oNome || '';
      d.odDestinoSigla = od.dSigla || '';
      d.odDestinoNome  = od.dNome || '';
      // guarda o nome amigável p/ exibição (popup do mapa)
      d.origemDisplay  = d.odOrigemNome || d.origemDisplay || d.origem;
      d.destinoDisplay = d.odDestinoNome || d.destinoDisplay || d.destino;
      const lo = scInfo(od.oSigla), ld = scInfo(od.dSigla);
      if(lo){
        d.origemEndereco = lo.endereco || '';
        d.origemMaps     = lo.maps || '';
        const g = preciseGeo(od.oSigla, lo, d.origemGeo);  // localização precisa do service center
        if(g.str){ d.origemGeo = g.str; if(g.coords) DIST.seed(g.str, g.coords); }
      }
      if(ld){
        d.destinoEndereco = ld.endereco || '';
        d.destinoMaps     = ld.maps || '';
        const g = preciseGeo(od.dSigla, ld, d.destinoGeo);
        if(g.str){ d.destinoGeo = g.str; if(g.coords) DIST.seed(g.str, g.coords); }
      }
    }
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
  const noprazo = prio.filter(d => d.risco === 'verde' && !d.naoIniciada).length;
  const risco   = prio.filter(d => d.risco === 'amarelo' && !d.naoIniciada).length;
  const atraso  = prio.filter(d => d.risco === 'vermelho' && !d.naoIniciada).length;
  const aguard  = prio.filter(d => d.naoIniciada).length;  // Base: Pendente (não saiu)
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
    <div class="ca-row"><span class="ca-dot" style="background:var(--red)"></span><div><b>${atraso}</b> possível atraso (&gt;55 ou negativo)</div></div>
    <div class="ca-row"><span class="ca-dot" style="background:var(--amber)"></span><div><b>${parados}</b> parados</div></div>
    <div class="ca-row"><span class="ca-dot" style="background:var(--grey)"></span><div><b>${aguard}</b> aguardando início (não saíram)</div></div>
    <div class="ca-row"><span class="ca-dot" style="background:var(--grey)"></span><div><b>${naoPrio}</b> não prioritárias</div></div>`;
}

/* ----------------------------------------------------------------------- */
/* Tabelas                                                                  */
/* ----------------------------------------------------------------------- */
// célula da 2ª bipagem (col H): mostra horário se for data, senão o texto; "—" se vazio
function segBipTxt(v){
  if(!v || !String(v).trim()) return '<span class="ocor-empty">—</span>';
  const p = parseDateBR(v);
  return p ? fmtDateTime(p) : escapeHtml(v);
}
function renderEtaTable(rows){
  const tb = $('#eta-tbody');
  if(!rows.length){
    tb.innerHTML = `<tr><td colspan="12"><div class="empty-state">Nenhuma rota corresponde aos filtros.</div></td></tr>`;
  } else {
    const ord = { vermelho:0, cinza:1, verde:2 };  // críticos (atrasados) no topo
    rows = [...rows].sort((a,b) => (ord[a.classificacao]??3) - (ord[b.classificacao]??3));
    tb.innerHTML = rows.map(d => `
      <tr class="${d.classificacao==='vermelho'?'crit':''}">
        ${protoTd(d.protocolo)}
        <td class="mono">${escapeHtml(d.rota)}</td>
        <td>${escapeHtml(d.motorista)}</td>
        <td class="mono">${escapeHtml(d.placa)}</td>
        <td>${fmtDateTime(d.horarioMax)}</td>
        <td>${fmtDateTime(d.horarioReal)}</td>
        <td>${segBipTxt(d.segundaBipagem)}</td>
        <td>${classeBadge(d.classificacao, d.classificacaoTexto)}</td>
        <td>${escapeHtml(d.statusK || d.status || '—')}</td>
        <td>${escapeHtml(d.statusL || '—')}</td>
        <td><span class="resp-pill">${escapeHtml(d.statusViagem||'—')}</span></td>
        <td class="ocor">${motivoInner(d)}</td>
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
  // XPT já sai no getEtdFiltered — aqui é tudo Line Haul
  const prio   = rows.filter(d => !d.naoPrioritaria && !d.naoIniciada);
  const aguard = rows.filter(d => !d.naoPrioritaria &&  d.naoIniciada);
  const nao    = rows.filter(d =>  d.naoPrioritaria);
  const groups = { verde:[], amarelo:[], vermelho:[] };
  prio.forEach(d => { if(groups[d.risco]) groups[d.risco].push(d); });
  fillEtdTable('verde',    groups.verde);
  fillEtdTable('amarelo',  groups.amarelo);
  fillEtdTable('vermelho', groups.vermelho);
  fillEtdAguardando(aguard);
  fillEtdNaoPrio(nao);
  fillEtdPosto(rows.filter(d => d.postoFiscal && !d.naoIniciada));
  $('#etd-count').textContent = rows.length;
}
// XPT — operação à parte (mesma estrutura das não prioritárias)
function fillEtdXpt(rows){
  const c = $('#etd-cnt-xpt'); if(c) c.textContent = rows.length;
  const tb = $('#etd-tbody-xpt'); if(!tb) return;
  if(!rows.length){ tb.innerHTML = `<tr><td colspan="12"><div class="empty-state">Nenhuma rota XPT no momento.</div></td></tr>`; return; }
  tb.innerHTML = rows.map(d => `
    <tr>
      ${protoTd(d.protocolo)}
      <td class="mono">${escapeHtml(d.rota)}</td>
      <td class="mono">${escapeHtml(d.placa)}</td>
      <td>${escapeHtml(d.destino||'—')}</td>
      <td>${fmtDateTime(d.etaDestino)}</td>
      <td class="num">${d.kmFaltante!=null ? d.kmFaltante+' km' : '—'}</td>
      <td class="num">${d.deslocHora!=null ? d.deslocHora+' km' : '—'}</td>
      <td class="num">${d.velocidadeAtual!=null ? d.velocidadeAtual+' km/h' : '—'}</td>
      <td>${escapeHtml(d.statusSM||'—')}</td>
      <td class="num">${d.pacotes!=null ? d.pacotes.toLocaleString('pt-BR') : '—'}</td>
      ${docCell(d)}
      ${ocorCell(d)}
    </tr>`).join('');
}
function fillEtdAguardando(rows){
  const c = $('#etd-cnt-aguard'); if(c) c.textContent = rows.length;
  const tb = $('#etd-tbody-aguard'); if(!tb) return;
  if(!rows.length){
    tb.innerHTML = `<tr><td colspan="10"><div class="empty-state">Nenhuma rota aguardando início.</div></td></tr>`;
    return;
  }
  // CPT estourado primeiro (o carro já deveria ter saído)
  rows = [...rows].sort((a,b) => (b.cptEstourou?1:0) - (a.cptEstourou?1:0));
  tb.innerHTML = rows.map(d => {
    const cptTxt = d.cpt ? fmtDateTime(d.cpt) : '—';
    const cptCell = d.cptEstourou
      ? `<td><span class="ocor-alert" title="Passou do CPT e não saiu — verificar carregamento ou cancelamento/infrutífera">${cptTxt} ⚠</span></td>`
      : `<td>${cptTxt}</td>`;
    return `
    <tr class="${d.cptEstourou?'crit':''}">
      ${protoTd(d.protocolo)}
      <td class="mono">${escapeHtml(d.rota)}</td>
      <td class="mono">${escapeHtml(d.placa)}</td>
      <td>${escapeHtml(d.destino||'—')}</td>
      ${cptCell}
      <td>${fmtDateTime(d.etaDestino)||'—'}</td>
      <td><span class="ocor-info">${escapeHtml(d.baseEstado||'Pendente')}</span></td>
      <td>${escapeHtml(d.statusSM||'—')}</td>
      ${ocorCell(d)}
      <td class="num">${d.pacotes!=null ? d.pacotes.toLocaleString('pt-BR') : '—'}</td>
    </tr>`; }).join('');
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
      ${protoTd(d.protocolo)}
      <td class="mono">${escapeHtml(d.rota)}</td>
      <td class="mono">${escapeHtml(d.placa)}</td>
      <td>${escapeHtml(d.destino||'—')}</td>
      <td>${progressCell(d)}</td>
      <td class="num">${d.kmFaltante!=null ? d.kmFaltante+' km' : '—'}</td>
      <td class="num"><b>${d.kmMedio!=null ? d.kmMedio+' km/h' : '—'}</b></td>
      <td><span class="ocor-info">${escapeHtml(d.postoSituacao||'—')}</span></td>
      <td class="num"><b>${d.postoKm!=null ? d.postoKm+' km' : '—'}</b></td>
      <td>${escapeHtml(d.statusSM||'—')}</td>
    </tr>`).join('');
}

function fillEtdTable(key, rows){
  $('#etd-cnt-'+key).textContent = rows.length;
  const tb = $('#etd-tbody-'+key);
  if(!rows.length){
    tb.innerHTML = `<tr><td colspan="14"><div class="empty-state">Nenhuma rota nesta faixa.</div></td></tr>`;
    return;
  }
  // km/h negativo (cálculo estourou) no topo; depois já iniciados; depois maior km/h necessário
  rows.sort((a,b) => (b.kmNegativo?1:0) - (a.kmNegativo?1:0) || (a.statusRank - b.statusRank) || ((b.kmMedio||0) - (a.kmMedio||0)));
  tb.innerHTML = rows.map(d => `
    <tr class="${d.risco==='vermelho'?'crit':''}">
      ${protoTd(d.protocolo)}
      <td class="mono">${escapeHtml(d.rota)}</td>
      <td class="mono">${escapeHtml(d.placa)}</td>
      <td>${escapeHtml(d.destino||'—')}</td>
      <td>${fmtDateTime(d.etaDestino)}</td>
      <td>${progressCell(d)}</td>
      <td class="num">${d.kmFaltante!=null ? d.kmFaltante+' km' : '—'}</td>
      <td class="num">${d.kmNegativo ? `<b class="ocor-alert" title="Cálculo estourou — já passou do prazo e atrasando">${d.kmMedio} km/h ⚠</b>` : `<b>${d.kmMedio!=null ? d.kmMedio+' km/h' : '—'}</b>`}</td>
      <td class="num">${d.deslocHora!=null ? d.deslocHora+' km' : '—'}</td>
      <td class="num">${d.velocidadeAtual!=null ? d.velocidadeAtual+' km/h' : '—'}</td>
      <td>${escapeHtml(d.statusSM||'—')}</td>
      <td class="num">${d.pacotes!=null ? d.pacotes.toLocaleString('pt-BR') : '—'}</td>
      ${docCell(d)}
      ${ocorCell(d)}
    </tr>`).join('');
}

// célula de documentos (coluna W = DOCS): verde se enviado/ok, neutro caso contrário
function docCell(d){
  const v = (d.docs||'').trim();
  if(!v) return `<td><span class="ocor-empty">—</span></td>`;
  const ok = /enviad|ok|conclu|valid/i.test(v);
  return `<td><span class="doc-badge ${ok?'doc-ok':'doc-pend'}">${escapeHtml(v)}</span></td>`;
}

// célula de identificação nas abas AO VIVO (sempre protocolo/rostering) com selo
function protoTd(proto){
  const p = String(proto||'').trim();
  if(!p || p === '0') return `<td><span class="ocor-empty">—</span></td>`;
  // Descobre o tipo pela Base: Protocolo (Rostering) ou Travel ID (Route). Default = Protocolo.
  const info = baseForId(p);
  const tipo = info ? info.tipo : 'Protocolo';
  const cls  = tipo === 'Travel ID' ? 'id-travel' : 'id-proto';
  return `<td><span class="mono">${escapeHtml(p)}</span> <span class="id-tag ${cls}">${tipo}</span></td>`;
}
// conteúdo do motivo (ocorrência + causa raiz da Base); vermelho se atrasado/possível atraso
function motivoInner(d){
  const parts = [];
  if(d.ocorrencia) parts.push(d.ocorrencia);
  if(d.causaRaiz)  parts.push('Causa: ' + d.causaRaiz);
  if(!parts.length) return `<span class="ocor-empty">—</span>`;
  const crit = d.classificacao === 'vermelho' || d.risco === 'vermelho';
  const txt = parts.join(' · ');
  return `<span class="${crit?'ocor-alert':'ocor-info'}" title="${escapeHtml(txt)}">${escapeHtml(txt)}</span>`;
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
    tb.innerHTML = `<tr><td colspan="12"><div class="empty-state">Nenhuma reversa no momento.</div></td></tr>`;
    return;
  }
  // reversas COM pacote primeiro (prioridade dentro do grupo), depois por qtd de pacotes
  rows = [...rows].sort((a,b) => ((b.pacotes||0)>0?1:0) - ((a.pacotes||0)>0?1:0) || (b.pacotes||0) - (a.pacotes||0));
  tb.innerHTML = rows.map(d => `
    <tr class="${(d.pacotes||0)>0?'row-pac':''}">
      ${protoTd(d.protocolo)}
      <td class="mono">${escapeHtml(d.rota)}</td>
      <td class="mono">${escapeHtml(d.placa)}</td>
      <td>${escapeHtml(d.destino||'—')}</td>
      <td>${fmtDateTime(d.etaDestino)}</td>
      <td class="num">${d.kmFaltante!=null ? d.kmFaltante+' km' : '—'}</td>
      <td class="num">${d.deslocHora!=null ? d.deslocHora+' km' : '—'}</td>
      <td class="num">${d.velocidadeAtual!=null ? d.velocidadeAtual+' km/h' : '—'}</td>
      <td>${escapeHtml(d.statusSM||'—')}</td>
      <td class="num">${d.pacotes!=null ? d.pacotes.toLocaleString('pt-BR') : '—'}</td>
      ${docCell(d)}
      ${ocorCell(d)}
    </tr>`).join('');
}

let _xptSearch = '';
function xptBipOk(d){ return d.bipagemCPT && d.etaOrigem && new Date(d.bipagemCPT) <= new Date(d.etaOrigem); }
function renderXptTable(){
  let rows = DASHBOARD_DATA.xpt;
  const q = _xptSearch.trim().toLowerCase();
  if(q) rows = rows.filter(d => `${d.protocolo} ${d.rota} ${d.placa} ${d.motorista}`.toLowerCase().includes(q));
  const docPend = d => !/enviad|ok|conclu/i.test(d.doc||'');
  $('#xpt-kpi-total').textContent = rows.length;
  $('#xpt-kpi-bip').textContent = rows.filter(xptBipOk).length;
  $('#xpt-kpi-fin').textContent = rows.filter(d=>/finaliz/i.test(d.status)).length;
  $('#xpt-kpi-doc').textContent = rows.filter(docPend).length;
  const cnt = $('#xpt-count'); if(cnt) cnt.textContent = rows.length;
  const tb = $('#xpt-tbody');
  if(tb) tb.innerHTML = rows.length ? rows.map(d=>{
    const ok = xptBipOk(d);
    const bip = d.bipagemCPT ? `<span class="badge ${ok?'b-verde':'b-vermelho'}"><span class="badge-dot"></span>${fmtDateTime(d.bipagemCPT)}</span>` : '<span class="ocor-empty">não bipado</span>';
    const doc = (d.doc||'').trim();
    const docB = doc ? `<span class="doc-badge ${/enviad|ok|conclu/i.test(doc)?'doc-ok':'doc-pend'}">${escapeHtml(doc)}</span>` : '<span class="ocor-empty">—</span>';
    return `<tr class="${ok===false&&d.bipagemCPT?'crit':''}">
      ${protoTd(d.protocolo)}
      <td class="mono">${escapeHtml(d.rota)}</td>
      <td class="mono">${escapeHtml(d.placa)}</td>
      <td>${escapeHtml(d.motorista||'—')}</td>
      <td>${fmtDateTime(d.etaOrigem)||'—'}</td>
      <td>${bip}</td>
      <td>${statusBadge(d.status)}</td>
      <td class="num">${d.pacotes!=null?d.pacotes.toLocaleString('pt-BR'):'—'}</td>
      <td>${docB}</td>
      <td>${escapeHtml(d.performance||'—')}</td>
      <td class="mono num">${d.pontuacao!=null?d.pontuacao:'—'}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="11"><div class="empty-state">Nenhum checkpoint corresponde à busca.</div></td></tr>`;
}

let _valFilter = 'all';
const valIsRec = d => /recus/i.test(d.statusPortal||'');
const valHasDiv = d => (d.divergencia||'').trim() !== '';
function renderValTable(){
  const all = DASHBOARD_DATA.validacao || [];
  const corretos = all.filter(d => !valHasDiv(d) && !valIsRec(d));
  const divs = all.filter(valHasDiv);
  const recs = all.filter(valIsRec);
  $('#val-kpi-total').textContent = all.length;
  $('#val-kpi-ok').textContent    = corretos.length;
  $('#val-kpi-div').textContent   = divs.length;
  const rec = $('#val-kpi-rec'); if(rec) rec.textContent = recs.length;
  // card ativo
  $$('#view-validacao .kpi-card[data-valkpi]').forEach(c => c.classList.toggle('active', c.dataset.valkpi === _valFilter));
  let rows = all;
  if(_valFilter === 'corretos') rows = corretos;
  else if(_valFilter === 'div') rows = divs;
  else if(_valFilter === 'recusado') rows = recs;
  const cnt = $('#val-count'); if(cnt) cnt.textContent = rows.length;
  $('#val-tbody').innerHTML = rows.length ? rows.map(d=>{
    const temDiv = valHasDiv(d), recusado = valIsRec(d);
    const cls = recusado ? 'b-vermelho' : (temDiv ? 'b-amarelo' : 'b-verde');
    const base = BASE_INDEX[String(d.protocolo||'').trim()];
    const saida  = base && base.origemETD ? base.origemETD.trim() : '';
    const estado = base && base.estado ? base.estado.trim() : '';
    const ocor   = OCOR_INDEX[String(d.protocolo||'').trim()] || '';
    return `
    <tr class="${recusado||temDiv?'crit':''}">
      ${protoTd(d.protocolo)}
      <td class="mono">${escapeHtml(d.servico)}</td>
      <td class="mono">${escapeHtml(d.placas)}</td>
      <td>${saida ? escapeHtml(saida) : '<span class="ocor-empty">—</span>'}</td>
      <td>${estado ? `<span class="ocor-info">${escapeHtml(estado)}</span>` : '<span class="ocor-empty">—</span>'}</td>
      <td><span class="badge ${cls}"><span class="badge-dot"></span>${escapeHtml(d.statusPortal||'—')}</span></td>
      <td>${temDiv ? `<span class="ocor-alert">${escapeHtml(d.divergencia)}</span>` : '<span class="ocor-empty">—</span>'}</td>
      <td>${ocor ? `<span class="ocor-info" title="${escapeHtml(ocor)}">${escapeHtml(ocor)}</span>` : '<span class="ocor-empty">—</span>'}</td>
    </tr>`;
  }).join('') : `<tr><td colspan="8"><div class="empty-state">Nenhuma rota nesta categoria.</div></td></tr>`;
}
function bindValidacao(){
  const host = $('#view-validacao');
  if(!host || host._valBound) return; host._valBound = true;
  host.addEventListener('click', e => {
    const card = e.target.closest('.kpi-card[data-valkpi]');
    if(!card) return;
    const v = card.dataset.valkpi;
    _valFilter = (_valFilter === v && v !== 'all') ? 'all' : v;   // reclicar volta pra todos
    renderValTable();
  });
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
  reapplySorts(); markWatched();
}
function refreshEtd(){
  const rows = getEtdFiltered();
  renderEtdKpis(rows);
  renderEtdRibbon(rows);
  renderEtdBuckets(rows.filter(d => !d.naoPrioritaria));
  renderEtdTables(rows);
  reapplySorts(); markWatched();
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
    if(d.ehXpt) return;   // XPT à parte
    if(d.classificacao === 'vermelho')
      A.push({ sev:3, cls:'b-vermelho', origem:'ETA', protocolo:d.protocolo, nomen:d.rota, what:'Chegada atrasada', where:`${d.origem||'?'} → ${d.destino||'?'}`, detail:(d.atrasoMin!=null?d.atrasoMin+' min de atraso':'') });
  });
  (DASHBOARD_DATA.etd || []).forEach(d => {
    if(d.finalizada || d.naoPrioritaria) return;
    if(d.risco === 'vermelho')
      A.push({ sev:3, cls:'b-vermelho', origem:'ETD', protocolo:d.protocolo, nomen:d.rota, what:'Possível atraso', where:d.destino||'?', detail:(d.kmMedio!=null?d.kmMedio+' km/h necessários':'') });
    if(d.parado)
      A.push({ sev:2, cls:'b-amarelo', origem:'ETD', protocolo:d.protocolo, nomen:d.rota, what:'Veículo parado', where:d.destino||'?', detail:d.statusSM||'' });
    if(d.ocorrencia && d.risco === 'vermelho')
      A.push({ sev:2, cls:'b-amarelo', origem:'ETD', protocolo:d.protocolo, nomen:d.rota, what:'Ocorrência em sistema', where:d.destino||'?', detail:d.ocorrencia });
  });
  (DASHBOARD_DATA.validacao || []).forEach(d => {
    if((d.divergencia||'').trim())
      A.push({ sev:1, cls:'b-cinza', origem:'PORTAL', protocolo:d.protocolo, nomen:d.servico, what:'Divergência no portal', where:d.servico||'?', detail:d.divergencia });
  });
  A.sort((a,b) => b.sev - a.sev);
  return A;
}
// Nomenclatura (rota) de um protocolo, buscando em ETD e depois ETA
function nomenFor(proto){
  const p = String(proto).trim();
  const etd = (DASHBOARD_DATA.etd || []).find(d => String(d.protocolo).trim() === p);
  if(etd && etd.rota) return etd.rota;
  const eta = (DASHBOARD_DATA.eta || []).find(d => String(d.protocolo).trim() === p);
  if(eta && eta.rota) return eta.rota;
  return '';
}
// Rótulo padrão de rota: protocolo + nomenclatura
function rotaLabel(proto, nomen){
  const n = (nomen != null && nomen !== '') ? nomen : nomenFor(proto);
  return `<span class="rt-proto mono">${escapeHtml(proto)}</span>${n ? `<span class="rt-nomen">${escapeHtml(n)}</span>` : ''}`;
}
function renderAlertas(){
  const A = buildAlerts();
  const reds = A.filter(a => a.cls === 'b-vermelho');
  const ambs = A.filter(a => a.cls === 'b-amarelo');
  const greys = A.filter(a => a.cls === 'b-cinza');
  const hl = $('#alertas-headline');
  if(hl) hl.innerHTML = A.length ? `<span class="hl-strong">${A.length}</span> ite${A.length>1?'ns':'m'} exige${A.length>1?'m':''} ação agora` : 'Operação sob controle';
  const rib = $('#ribbon-alertas');
  if(rib){ rib.classList.remove('state-verde','state-amarelo','state-vermelho'); rib.classList.add(reds.length?'state-vermelho':(ambs.length?'state-amarelo':'state-verde')); }
  const st = $('#alertas-stats');
  if(st) st.innerHTML = statItem('var(--red)','Críticos',reds.length) + statItem('var(--amber)','Atenção',ambs.length) + statItem('var(--grey)','Portal',greys.length);
  const nb = $('#badgeAlertas');
  if(nb){ nb.textContent = A.length; nb.classList.remove('bad','warn'); if(reds.length) nb.classList.add('bad'); else if(ambs.length) nb.classList.add('warn'); }
  fillLane('crit', reds, 'crit');
  fillLane('warn', ambs, 'warn');
  fillLane('info', greys, 'info');
}
// Risco de justificativa: viagens FINALIZADAS com ATRASO e SEM ocorrência (últimos 3 dias)
let _riscoRows = []; let _riscoSeq = 0; const _riscoRowMap = {};
async function fetchAtrasosSemOcorrencia(){
  const end = new Date(), start = new Date(); start.setDate(end.getDate() - 2);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const res = await fetchHistorico(fmt(start), fmt(end));
  if(!res.ok && !res.rows.length) return;
  _riscoRows = res.rows
    .filter(r => !/xpt/i.test(r.servico||''))   // XPT é operação à parte — fora do risco Line Haul
    .filter(r => /finaliz/i.test(r.estado||'') && /atrasad/i.test(r.resultado||''))
    .filter(r => !relJustificativa(r));   // sem ocorrência em sistema E sem causa raiz
  renderAlertasRisco();
}
function renderAlertasRisco(){
  const cnt = $('#alertas-risco-cnt'); if(cnt) cnt.textContent = _riscoRows.length;
  const tb = $('#alertas-risco-tbody'); if(!tb) return;
  _riscoSeq = 0; for(const k in _riscoRowMap) delete _riscoRowMap[k];
  if(!_riscoRows.length){ tb.innerHTML = `<tr><td colspan="6"><div class="empty-state">Nenhum atraso sem ocorrência nos últimos 3 dias. 👍</div></td></tr>`; return; }
  tb.innerHTML = _riscoRows.map(r => { const rid = _riscoSeq++; _riscoRowMap[rid] = r;
    return `<tr class="rel-click crit" data-rrid="${rid}"><td>${relIdCell(r)}</td><td class="mono">${escapeHtml(r.servico||'—')}</td><td>${escapeHtml(tipoRota(r.servico))}</td><td>${escapeHtml(r.estado||'—')}</td><td>${escapeHtml(r.resultado||'—')}</td><td><span class="ocor-alert">sem ocorrência</span></td></tr>`;
  }).join('');
}
function fillLane(key, arr, cls){
  const el = $('#lane-'+key), cnt = $('#lane-cnt-'+key);
  if(cnt) cnt.textContent = arr.length;
  if(!el) return;
  if(!arr.length){ el.innerHTML = `<div class="lane-empty">Nada por aqui.</div>`; return; }
  el.innerHTML = arr.map(a => `
    <div class="alert-card ac-${cls}" data-proto="${escapeHtml(a.protocolo)}">
      <div class="ac-top"><span class="ac-tag">${escapeHtml(a.origem)}</span><span class="ac-proto mono">${escapeHtml(a.protocolo)}</span></div>
      ${a.nomen ? `<div class="ac-nomen">${escapeHtml(a.nomen)}</div>` : ''}
      <div class="ac-what">${escapeHtml(a.what)}</div>
      <div class="ac-where">${escapeHtml(a.where)}</div>
      ${a.detail ? `<div class="ac-detail">${escapeHtml(a.detail)}</div>` : ''}
    </div>`).join('');
}

/* ---- Histórico leve (localStorage) + tendência de pontualidade ---------- */
function snapshotPcts(){
  const eta = (DASHBOARD_DATA.eta || []).filter(d => !d.ehXpt);
  const np = eta.filter(d => d.classificacao === 'verde').length, at = eta.filter(d => d.classificacao === 'vermelho').length;
  const etaPct = (np + at) ? Math.round(np / (np + at) * 100) : null;
  const prio = (DASHBOARD_DATA.etd || []).filter(d => !d.naoPrioritaria && !d.finalizada && !d.naoIniciada);
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

/* ---- Painel de Gestão (visão executiva) -------------------------------- */
const SLA_META = 90;
function slaStat(label, pct){
  if(pct == null) return `<div class="os"><i style="background:var(--grey)"></i>${label} <b>—</b></div>`;
  const col = pct>=SLA_META ? 'var(--green)' : (pct>=SLA_META-10 ? 'var(--amber)' : 'var(--red)');
  return `<div class="os"><i style="background:${col}"></i>${label} <b style="color:${col}">${pct}%</b></div>`;
}
let gestaoDestSel = null;
function destKey(s){ return (s||'—').split(',')[0].trim() || '—'; }
// Ofensores: toda rota que exige ação, com o MOTIVO do atraso/risco
function buildOfensores(){
  const out = [];
  (DASHBOARD_DATA.eta || []).forEach(d => {
    if(d.ehXpt) return;   // XPT à parte
    if(d.classificacao === 'vermelho')
      out.push({ proto:d.protocolo, nomen:d.rota, origem:d.origem, destino:d.destino, fonte:'ETA', sev:3, cls:'b-vermelho',
        status:'Chegada atrasada', motivo:(d.atrasoMin!=null?`Atrasada ${d.atrasoMin} min na chegada à origem`:'Chegada atrasada na origem') });
  });
  (DASHBOARD_DATA.etd || []).forEach(d => {
    if(d.finalizada || d.naoPrioritaria) return;
    let row = null;
    if(d.risco === 'vermelho')      row = { sev:3, cls:'b-vermelho', status:'Possível atraso', motivo:`Precisa manter ${d.kmMedio} km/h de média p/ chegar no prazo` };
    else if(d.parado)               row = { sev:2, cls:'b-amarelo',  status:'Parado',          motivo:`Veículo parado — ${d.statusSM||'sem status na SM'}` };
    else if(d.risco === 'amarelo')  row = { sev:1, cls:'b-amarelo',  status:'Em risco',        motivo:`Precisa manter ${d.kmMedio} km/h de média` };
    if(!row) return;
    if(d.causaRaiz) row.motivo += ` · Causa raiz: ${d.causaRaiz}`;
    if(d.ocorrencia) row.motivo += ` · Ocorrência: ${d.ocorrencia}`;
    if(d.velocidadeAtual != null) row.motivo += ` · indo a ${d.velocidadeAtual} km/h`;
    out.push(Object.assign({ proto:d.protocolo, nomen:d.rota, origem:d.origem, destino:d.destino, fonte:'ETD' }, row));
  });
  out.sort((a,b) => b.sev - a.sev);
  return out;
}
function gestaoJump(jump){
  const [tab, val] = (jump||'').split('-');
  if(tab === 'etd'){
    filters.etd.banda = []; filters.etd.parados = [];
    if(val === 'vermelho') filters.etd.banda = ['vermelho'];
    else if(val === 'amarelo') filters.etd.banda = ['amarelo'];
    else if(val === 'parados') filters.etd.parados = ['1'];
    activateTab('etd'); refreshEtd(); syncFilterUI('etd');
  } else if(tab === 'eta'){
    const red = (DASHBOARD_DATA.eta || []).find(d => d.classificacao === 'vermelho');
    filters.eta.classe = (val === 'vermelho' && red) ? [red.classificacaoTexto] : [];
    activateTab('eta'); refreshEta(); syncFilterUI('eta');
  }
}
function renderGestao(){
  const etd = (DASHBOARD_DATA.etd || []).filter(d => !d.finalizada && !d.naoPrioritaria);
  const eta = (DASHBOARD_DATA.eta || []).filter(d => !d.ehXpt);
  const { etaPct, etdPct } = snapshotPcts();
  const hl = $('#gestao-headline');
  if(hl) hl.innerHTML = (etdPct != null)
    ? `Pontualidade ETD <span class="hl-strong">${etdPct}%</span> · meta ${SLA_META}%`
    : 'Coletando leituras para o placar…';
  const rib = $('#ribbon-gestao');
  if(rib){ rib.classList.remove('state-verde','state-amarelo','state-vermelho');
    const s = etdPct==null ? 'verde' : (etdPct>=SLA_META?'verde':(etdPct>=SLA_META-10?'amarelo':'vermelho'));
    rib.classList.add('state-'+s); }
  const st = $('#gestao-sla');
  if(st) st.innerHTML = slaStat('ETD no prazo', etdPct) + slaStat('ETA no prazo', etaPct);
  const parados = etd.filter(d=>d.parado).length;
  const risco   = etd.filter(d=>d.risco==='amarelo').length;
  const atraso  = etd.filter(d=>d.risco==='vermelho').length;
  const etaAtr  = eta.filter(d=>d.classificacao==='vermelho').length;
  const rs = $('#gestao-resumo');
  if(rs) rs.innerHTML = [
    ['var(--red)','Possível atraso · ETD', atraso, 'etd-vermelho'],
    ['var(--amber)','Em risco · ETD', risco, 'etd-amarelo'],
    ['var(--amber)','Veículos parados', parados, 'etd-parados'],
    ['var(--red)','Chegada atrasada · ETA', etaAtr, 'eta-vermelho'],
    ['var(--green)','Em viagem (prioritárias)', etd.length, 'etd-todos'],
  ].map(([c,l,v,jump])=>`<div class="ca-row gx-jump" data-jump="${jump}"><span class="ca-dot" style="background:${c}"></span><div style="flex:1">${l}</div><b style="font-family:var(--font-num)">${v}</b><span class="gx-arrow">›</span></div>`).join('');
  renderGestaoTrend();
  renderGestaoDest();
  renderOfensores();
}
function renderOfensores(){
  const all = buildOfensores();
  const sel = gestaoDestSel;
  const rows = sel ? all.filter(o => destKey(o.destino) === sel) : all;
  const hd = $('#gestao-ofen-head');
  if(hd) hd.innerHTML = sel
    ? `Ofensores em <b>${escapeHtml(sel)}</b> <span class="hint">${rows.length} rota(s)</span> <button class="mini-clear" id="ofen-clear">✕ limpar filtro</button>`
    : `Principais ofensores <span class="hint">${rows.length} rota(s) · clique numa rota para abrir o detalhe</span>`;
  const el = $('#gestao-ofen'); if(!el) return;
  if(!rows.length){ el.innerHTML = `<div class="empty-state" style="padding:18px">Nenhuma rota em atraso${sel?' neste destino':''} agora. 👍</div>`; return; }
  el.innerHTML = rows.map(o => `
    <div class="ofen-row" data-proto="${escapeHtml(o.proto)}">
      <span class="ofen-sev ${o.cls}"></span>
      <div class="ofen-main">
        <div class="ofen-id"><span class="mono">${escapeHtml(o.proto)}</span>${o.nomen?`<span class="ofen-nomen">${escapeHtml(o.nomen)}</span>`:''}<span class="ofen-fonte">${escapeHtml(o.fonte)}</span></div>
        <div class="ofen-trajeto">${escapeHtml(o.origem||'?')} <span class="arr">→</span> ${escapeHtml(o.destino||'?')}</div>
        <div class="ofen-motivo">${escapeHtml(o.motivo)}</div>
      </div>
      <span class="badge ${o.cls}"><span class="badge-dot"></span>${escapeHtml(o.status)}</span>
    </div>`).join('');
}
// Atrasos por destino, separados por fonte: ETA (chegada) e ETD (viagem).
// Cada um vira uma tabela clicável (clique num destino filtra os ofensores abaixo).
function renderGestaoDest(){
  const ofen = buildOfensores();
  const fill = (arr, tbodyId) => {
    const tb = $('#'+tbodyId); if(!tb) return;
    const by = {};
    arr.forEach(o => { const k = destKey(o.destino); by[k] = (by[k]||0)+1; });
    const pairs = Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,10);
    tb.innerHTML = pairs.length ? pairs.map(([dest,n])=>`
      <tr class="gx-dest-row${gestaoDestSel===dest?' sel':''}" data-dest="${escapeHtml(dest)}">
        <td>${escapeHtml(dest)}</td>
        <td style="text-align:right"><b class="mono">${n}</b></td>
      </tr>`).join('') : `<tr><td colspan="2"><div class="empty-state" style="padding:14px 8px">Sem atrasos.</div></td></tr>`;
  };
  fill(ofen.filter(o => o.fonte === 'ETA'), 'gestao-dest-eta');
  fill(ofen.filter(o => o.fonte === 'ETD'), 'gestao-dest-etd');
}
// Tendência da GESTÃO agora vem do HISTÓRICO REAL (Supabase): pontualidade por dia,
// últimos 14 dias. Fica em cache; recarrega ao abrir a aba (não a cada renderAll).
let _gestaoTrend = null;
async function fetchGestaoTrend(){
  const end = new Date(), start = new Date(); start.setDate(end.getDate() - 13);
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const res = await fetchHistorico(fmt(start), fmt(end));
  if(!res.ok && !res.rows.length) return;
  const fin = res.rows.filter(r => /finaliz/i.test(r.estado||''));
  const byDay = {};
  fin.forEach(r => { if(!r.data) return; if(!byDay[r.data]) byDay[r.data]={n:0,ok:0}; byDay[r.data].n++; if(/no prazo/i.test(r.resultado||'')) byDay[r.data].ok++; });
  const days = Object.keys(byDay).sort();
  _gestaoTrend = { labels: days.map(d=>d.slice(8,10)+'/'+d.slice(5,7)), data: days.map(d=>Math.round(byDay[d].ok/byDay[d].n*100)) };
  renderGestaoTrend();
}
function renderGestaoTrend(){
  const cv = $('#chart-gestao-trend'); if(!cv || typeof Chart==='undefined') return;
  const t = _gestaoTrend;
  destroyChart('gestaoTrend');
  if(!t || !t.labels.length) return;   // ainda carregando do Supabase
  charts.gestaoTrend = new Chart(cv, {
    type:'line',
    data:{ labels:t.labels, datasets:[{ label:'Pontualidade %', data:t.data, borderColor:PALETTE.green, backgroundColor:'rgba(22,163,74,.08)', borderWidth:2, tension:.3, fill:true, spanGaps:true, pointRadius:2 }] },
    options:{ responsive:true, maintainAspectRatio:false,
      scales:{ y:{ min:0, max:100, ticks:{ callback:v=>v+'%' } } },
      plugins:{ legend:{ display:false } } }
  });
}

/* ---- Aba Relatórios (histórico de viagens via Supabase) ---------------- */
let _relPeriodo = '7d';
let _relTipoOp = 'linehaul';    // Line Haul (padrão) × XPT — separa as duas operações
function relTipoMatch(r){
  const isXpt = /xpt/i.test(r.servico||'');
  return _relTipoOp === 'xpt' ? isXpt : !isXpt;
}
let _relFase = 'etd';           // ETD/viagem (padrão) × ETA/chegada — dentro de LH/XPT
function relFaseMatch(r){
  const f = String(r.fase || 'ETD').toUpperCase();   // registros antigos (sem fase) = ETD
  return _relFase === 'eta' ? (f === 'ETA') : (f !== 'ETA');
}
let _relStart = '', _relEnd = '';
let _relCancMotivo = null;      // filtro do painel de cancelamentos
let _relAtrasoTipo = null;      // filtro de tipo no painel de atrasos
const _relData = { fin: [], canc: [] };  // cache do período (filtros sem refetch)
let _relRowSeq = 0; const _relRowMap = {};   // clique numa linha -> detalhe da viagem
function relRowRef(r){ const id = _relRowSeq++; _relRowMap[id] = r; return id; }
function relRangeEfetivo(){
  if(_relPeriodo === 'custom' && _relStart && _relEnd)
    return _relStart <= _relEnd ? { start:_relStart, end:_relEnd } : { start:_relEnd, end:_relStart };
  return relRange(_relPeriodo);
}
// célula "ID da viagem" com selo Protocolo / Travel ID
function relIdCell(r){
  const isRost = r.rostering_id && r.rostering_id !== '0';
  const id = isRost ? r.rostering_id : (r.route_id || '—');
  const tag = isRost ? '<span class="id-tag id-proto">Protocolo</span>' : '<span class="id-tag id-travel">Travel ID</span>';
  return `<span class="mono">${escapeHtml(id)}</span> ${tag}`;
}
async function fetchHistorico(startISO, endISO){
  if(!SUPABASE.url || !SUPABASE.anon) return { ok:false, rows:[] };
  const cols = 'rostering_id,route_id,servico,estado,resultado,pacotes,chegada,saida_programada,causa_raiz,origem,destino,motivo_cancelamento,trecho,data,fase';
  const q = `${SUPABASE.url}/rest/v1/viagens_historico?select=${cols}&data=gte.${startISO}&data=lte.${endISO}&order=data.asc`;
  const headers = { apikey: SUPABASE.anon, Authorization: 'Bearer ' + SUPABASE.anon };
  let all = [], offset = 0; const page = 1000;
  try {
    for(;;){
      const r = await fetch(`${q}&limit=${page}&offset=${offset}`, { headers });
      if(!r.ok) return { ok:false, rows:all, err:r.status };
      const chunk = await r.json();
      all = all.concat(chunk);
      if(chunk.length < page) break;
      offset += page;
      if(offset > 500000) break;
    }
  } catch(e){ return { ok:false, rows:all, err:'rede' }; }
  return { ok:true, rows:all };
}
function relRange(key){
  const end = new Date(), start = new Date();
  const dias = { hoje:0, '7d':6, mes:29, tri:89, sem:179, ano:364 };
  start.setDate(end.getDate() - (dias[key] != null ? dias[key] : 6));
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start: fmt(start), end: fmt(end) };
}
function _horaDe(s){ const m = String(s||'').match(/[ T](\d{1,2}):(\d{2})/); return m ? +m[1] : null; }
function _minDe(s){ const m = String(s||'').match(/[ T](\d{1,2}):(\d{2})/); return m ? (+m[1]*60 + +m[2]) : null; }

/* ---- Comparativo de período: mesmo intervalo imediatamente anterior ---- */
let _relPrev = null;
function relPrevRange(start, end){
  const s = new Date(start+'T00:00:00'), e = new Date(end+'T00:00:00');
  const dur = Math.max(0, Math.round((e - s)/86400000));   // duração em dias
  const pe = new Date(s); pe.setDate(s.getDate()-1);        // dia anterior ao início
  const ps = new Date(pe); ps.setDate(pe.getDate()-dur);    // recua a mesma duração
  const fmt = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return { start: fmt(ps), end: fmt(pe) };
}
function computeRelKpis(rows){
  const fin  = rows.filter(r => /finaliz/i.test(r.estado||'') && relTipoMatch(r) && relFaseMatch(r));
  const canc = rows.filter(r => /cancel/i.test(r.estado||'') && relTipoMatch(r) && relFaseMatch(r));
  const total = fin.length;
  const noPrazo = fin.filter(r => /no prazo/i.test(r.resultado||'')).length;
  const atraso  = fin.filter(r => /atrasad/i.test(r.resultado||'')).length;
  const pacotes = fin.reduce((s,r)=>s+(parseInt(r.pacotes,10)||0),0);
  const infrut  = canc.filter(r => /infrut/i.test(r.motivo_cancelamento||'')).length;
  return { total, noPrazo, pct: total?Math.round(noPrazo/total*100):0, atraso, pacotes, canc: canc.length, infrut };
}
// Selo ▲▼ do comparativo. opts: pp (pontos %), goodUp (subir é bom), neutral (sem cor de bom/ruim)
function relDelta(cur, prev, opts){
  opts = opts || {};
  if(prev == null) return '';
  let diff, txt;
  if(opts.pp){ diff = cur - prev; txt = Math.abs(diff)+' pp'; }
  else if(prev === 0){ return cur > 0 ? `<span class="rel-delta neu" title="período anterior sem registros">novo</span>` : ''; }
  else { diff = Math.round((cur-prev)/prev*100); txt = Math.abs(diff)+'%'; }
  if(diff === 0) return `<span class="rel-delta flat" title="igual ao período anterior">■ 0</span>`;
  const up = diff > 0;
  const cls = opts.neutral ? 'neu' : ((opts.goodUp ? up : !up) ? 'good' : 'bad');
  return `<span class="rel-delta ${cls}" title="vs período anterior">${up?'▲':'▼'} ${txt}</span>`;
}

async function renderRelatorios(){
  const st = $('#rel-status');
  const { start, end } = relRangeEfetivo();
  const hint = $('#rel-periodo-hint');
  if(hint) hint.textContent = `${start.split('-').reverse().join('/')} — ${end.split('-').reverse().join('/')}`;
  if(st) st.textContent = 'Carregando…';
  const res = await fetchHistorico(start, end);
  if(!res.ok && !res.rows.length){
    if(st) st.textContent = '';
    const k = $('#rel-kpis'); if(k) k.innerHTML = `<div class="empty-state" style="padding:36px;grid-column:1/-1">Não consegui ler o histórico agora${res.err?` (erro ${res.err})`:''}. Recarregue em instantes.</div>`;
    return;
  }
  _relData.fin  = res.rows.filter(r => /finaliz/i.test(r.estado||'') && relTipoMatch(r) && relFaseMatch(r));
  _relData.canc = res.rows.filter(r => /cancel/i.test(r.estado||'') && relTipoMatch(r) && relFaseMatch(r));
  _relCancMotivo = null; _relAtrasoTipo = null;
  _relRowSeq = 0; for(const kk in _relRowMap) delete _relRowMap[kk];
  // período anterior (comparativo ▲▼) — não bloqueia se falhar
  _relPrev = null;
  try { const pr = relPrevRange(start, end); const rp = await fetchHistorico(pr.start, pr.end); if(rp.ok) _relPrev = computeRelKpis(rp.rows); } catch(e){}
  renderRelResumo();
  renderRelCancelamentos();
  renderRelAtrasos();
  renderRelDestinos();
  renderRelRecorrentes();
  renderRelCalendar();
}
// ocorrência em sistema (aba Ocorrências) pelo protocolo; senão a causa raiz do histórico
function relJustificativa(r){
  const o = OCOR_INDEX[String(r.rostering_id||'').trim()];
  if(o) return o;
  const c = (r.causa_raiz||'').trim();
  return c || '';
}
function renderRelResumo(){
  const fin = _relData.fin, canc = _relData.canc;
  const total   = fin.length;
  const noPrazo = fin.filter(r => /no prazo/i.test(r.resultado||'')).length;
  const atraso  = fin.filter(r => /atrasad/i.test(r.resultado||'')).length;
  const pacotes = fin.reduce((s,r) => s + (parseInt(r.pacotes,10)||0), 0);
  const pct = total ? Math.round(noPrazo/total*100) : 0;
  const infrut = canc.filter(r => /infrut/i.test(r.motivo_cancelamento||'')).length;
  const prog = total + canc.length;
  const taxaCanc = prog ? Math.round(canc.length/prog*100) : 0;
  const mediaPac = total ? Math.round(pacotes/total) : 0;
  const st = $('#rel-status'); if(st) st.textContent = `${total.toLocaleString('pt-BR')} finalizadas · ${canc.length.toLocaleString('pt-BR')} canceladas`;
  const P = _relPrev;
  const k = $('#rel-kpis');
  if(k) k.innerHTML = [
    ['k-total','Finalizadas', total.toLocaleString('pt-BR'), '', 'pont', (P&&P.total>0)?relDelta(total, P.total, {neutral:true}):''],
    ['k-green','Pontualidade', pct+'%', `${noPrazo.toLocaleString('pt-BR')} no prazo`, 'pont', (P&&P.total>0)?relDelta(pct, P.pct, {pp:true, goodUp:true}):''],
    ['k-red','Atrasadas', atraso.toLocaleString('pt-BR'), total?Math.round(atraso/total*100)+'% das finalizadas':'', 'atraso', (P&&P.total>0)?relDelta(atraso, P.atraso, {goodUp:false}):''],
    ['k-blue','Pacotes', pacotes.toLocaleString('pt-BR'), `${mediaPac.toLocaleString('pt-BR')}/viagem`, '', (P&&P.total>0)?relDelta(pacotes, P.pacotes, {neutral:true}):''],
    ['k-grey','Canceladas', canc.length.toLocaleString('pt-BR'), taxaCanc+'% do programado', 'canc', (P&&P.total>0)?relDelta(canc.length, P.canc, {goodUp:false}):''],
    ['k-red','Infrutíferas', infrut.toLocaleString('pt-BR'), canc.length?Math.round(infrut/canc.length*100)+'% dos cancelamentos':'', 'infrut', (P&&P.total>0)?relDelta(infrut, P.infrut, {goodUp:false}):''],
  ].map(([c,l,v,s,act,d]) => `<div class="kpi-card ${c} ${act?'clickable':''}"${act?` data-relkpi="${act}"`:''}><div class="kpi-label">${l}</div><div class="kpi-value tabular">${v}</div><div class="kpi-sub">${s}${s&&d?' · ':''}${d||''}</div>${act?'<span class="rel-kpi-go">ver ›</span>':''}</div>`).join('');
  const porHora = new Array(24).fill(0);
  fin.forEach(r => { const h = _horaDe(r.chegada); if(h!=null && h>=0 && h<24) porHora[h]++; });
  let dia=0, noite=0;
  fin.forEach(r => { const m = _minDe(r.saida_programada); if(m==null) return; (m>=390 && m<1110) ? dia++ : noite++; });
  const porDia = {};
  fin.forEach(r => { const d=r.data; if(!d) return; if(!porDia[d]) porDia[d]={n:0,ok:0}; porDia[d].n++; if(/no prazo/i.test(r.resultado||'')) porDia[d].ok++; });
  const dds = Object.keys(porDia).sort();
  const trend = dds.map(d => Math.round(porDia[d].ok/porDia[d].n*100));
  const trendLabels = dds.map(d => d.slice(8,10)+'/'+d.slice(5,7));
  const porTipo = {};
  fin.forEach(r => { const t=tipoRota(r.servico); if(!porTipo[t]) porTipo[t]={n:0,ok:0}; porTipo[t].n++; if(/no prazo/i.test(r.resultado||'')) porTipo[t].ok++; });
  const tipos = Object.entries(porTipo).sort((a,b)=>b[1].n-a[1].n).slice(0,8);
  renderRelCharts({ noPrazo, atraso, porHora, dia, noite, trendLabels, trend, tipos });
}
function renderRelCharts({ noPrazo, atraso, porHora, dia, noite, trendLabels, trend, tipos }){
  if(typeof Chart === 'undefined') return;
  let cv = $('#chart-rel-sla');
  if(cv){ destroyChart('relSla'); charts.relSla = new Chart(cv, { type:'doughnut',
    data:{ labels:['No prazo','Atrasado'], datasets:[{ data:[noPrazo,atraso], backgroundColor:[PALETTE.green,PALETTE.red], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%',
      onClick:(evt,els)=>{ if(els&&els.length&&els[0].index===1) relKpiAction('atraso'); },
      onHover:(evt,els)=>{ if(evt.native&&evt.native.target) evt.native.target.style.cursor = (els.length&&els[0].index===1)?'pointer':'default'; },
      plugins:{ legend:{ position:'bottom', labels:{ padding:12, usePointStyle:true, pointStyle:'circle' } } } } }); }
  cv = $('#chart-rel-trend');
  if(cv){ destroyChart('relTrend'); charts.relTrend = new Chart(cv, { type:'line',
    data:{ labels:trendLabels||[], datasets:[{ label:'Pontualidade %', data:trend||[], borderColor:PALETTE.green, backgroundColor:'rgba(22,163,74,.08)', borderWidth:2, tension:.3, fill:true, spanGaps:true, pointRadius:2 }] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ min:0, max:100, ticks:{ callback:v=>v+'%' } } }, plugins:{ legend:{ display:false } } } }); }
  cv = $('#chart-rel-turno');
  if(cv){ destroyChart('relTurno'); charts.relTurno = new Chart(cv, { type:'doughnut',
    data:{ labels:['Dia · 06:30–18:30','Noite · 18:30–06:30'], datasets:[{ data:[dia,noite], backgroundColor:['#f59e0b','#334155'], borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'62%', plugins:{ legend:{ position:'bottom', labels:{ padding:12, usePointStyle:true, pointStyle:'circle' } } } } }); }
  cv = $('#chart-rel-tipo');
  if(cv){ destroyChart('relTipo'); const T = tipos||[]; charts.relTipo = new Chart(cv, { type:'bar',
    data:{ labels:T.map(t=>t[0]), datasets:[{ data:T.map(t=>Math.round(t[1].ok/t[1].n*100)), backgroundColor:T.map(t=>{const p=t[1].ok/t[1].n; return p>=.9?PALETTE.green:(p>=.8?PALETTE.amber:PALETTE.red);}), borderRadius:4, borderWidth:0 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
      onClick:(evt,els)=>{ if(els&&els.length){ _relAtrasoTipo = T[els[0].index][0]; renderRelAtrasos(); relFlash('#rel-atr-panel'); } },
      onHover:(evt,els)=>{ if(evt.native&&evt.native.target) evt.native.target.style.cursor = els.length?'pointer':'default'; },
      scales:{ x:{ min:0, max:100, ticks:{ callback:v=>v+'%' } } }, plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:(c)=>`${c.parsed.x}% no prazo · ${T[c.dataIndex][1].n} viagens` } } } } }); }
  cv = $('#chart-rel-hora');
  if(cv){ destroyChart('relHora'); charts.relHora = new Chart(cv, { type:'bar',
    data:{ labels:Array.from({length:24}, (_,h)=>String(h).padStart(2,'0')+'h'), datasets:[{ data:porHora, backgroundColor:PALETTE.amber, borderRadius:3, borderWidth:0 }] },
    options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ beginAtZero:true, ticks:{ precision:0 } } }, plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:(c)=>`${c.parsed.y} finalizadas` } } } } }); }
}
function tipoRota(s){
  // tipo oficial da aba Origem-destino (col H → col I)
  const t = TIPO_INDEX[normKey(s)];
  if(t) return t;
  // fallback por palavra-chave (rota nova ainda sem cadastro do tipo)
  const u = String(s||'').toUpperCase();
  if(/XPT/.test(u)) return 'XPT';
  if(/REVERS|\.REV|REV\./.test(u)) return 'Reversa';
  if(/DEV/.test(u)) return 'Devolução';
  if(/VEN/.test(u)) return 'Entrega';
  return '—';
}
// Cancelamentos: lista de motivos clicável ↔ tabela filtrada (voltar pra lista)
function renderRelCancelamentos(){
  const canc = _relData.canc;
  const cnt = $('#rel-canc-cnt'); if(cnt) cnt.textContent = canc.length;
  const head = $('#rel-canc-head'), mv = $('#rel-motivos'), tw = $('#rel-canc-tablewrap');
  if(!_relCancMotivo){
    const motivos = {}; canc.forEach(r => { const m=(r.motivo_cancelamento||'').trim()||'(sem motivo)'; motivos[m]=(motivos[m]||0)+1; });
    const top = Object.entries(motivos).sort((a,b)=>b[1]-a[1]);
    if(head) head.innerHTML = `Cancelamentos por motivo <span class="hint">clique num motivo pra ver as viagens</span>`;
    if(mv){ mv.style.display=''; mv.innerHTML = top.length ? top.map(([m,n])=>{ const inf=/infrut/i.test(m); return `<div class="ca-row rel-motivo-row" data-motivo="${escapeHtml(m)}"><span class="ca-dot" style="background:${inf?'var(--red)':'var(--grey)'}"></span><div style="flex:1">${escapeHtml(m)}</div><b style="font-family:var(--font-num)${inf?';color:var(--red)':''}">${n}</b><span class="gx-arrow">›</span></div>`; }).join('') : `<div class="empty-state" style="padding:14px">Nenhum cancelamento no período. 👍</div>`; }
    if(tw) tw.style.display='none';
  } else {
    const infMode = _relCancMotivo === '__infrut__';
    const rows = infMode ? canc.filter(r => /infrut/i.test(r.motivo_cancelamento||''))
                         : canc.filter(r => ((r.motivo_cancelamento||'').trim()||'(sem motivo)') === _relCancMotivo);
    const titulo = infMode ? 'Infrutíferas' : _relCancMotivo;
    if(head) head.innerHTML = `<button class="rel-back" id="rel-canc-back">‹ voltar aos motivos</button> · <b>${escapeHtml(titulo)}</b> <span class="hint">${rows.length} viagem(ns)</span>`;
    if(mv) mv.style.display='none';
    if(tw){ tw.style.display='';
      const tb = $('#rel-canc-tbody');
      if(tb) tb.innerHTML = rows.map(r=>`<tr class="rel-click ${/infrut/i.test(r.motivo_cancelamento||'')?'crit':''}" data-rid="${relRowRef(r)}"><td>${relIdCell(r)}</td><td class="mono">${escapeHtml(r.servico||'—')}</td><td>${escapeHtml(tipoRota(r.servico))}</td><td>${escapeHtml(r.destino||'—')}</td></tr>`).join('') || `<tr><td colspan="4"><div class="empty-state">Sem viagens.</div></td></tr>`;
    }
  }
}
// Atrasos: tabela das viagens atrasadas, com filtro por tipo e justificativa da ocorrência em sistema
function renderRelAtrasos(){
  let atras = _relData.fin.filter(r => /atrasad/i.test(r.resultado||''));
  const tipos = {}; atras.forEach(r=>{const t=tipoRota(r.servico); tipos[t]=(tipos[t]||0)+1;});
  const chips = $('#rel-atr-chips');
  if(chips){ const tt=Object.entries(tipos).sort((a,b)=>b[1]-a[1]);
    chips.innerHTML = `<button class="rel-chip ${!_relAtrasoTipo?'active':''}" data-tipo="">Todos <b>${atras.length}</b></button>` + tt.map(([t,n])=>`<button class="rel-chip ${_relAtrasoTipo===t?'active':''}" data-tipo="${escapeHtml(t)}">${escapeHtml(t)} <b>${n}</b></button>`).join(''); }
  if(_relAtrasoTipo) atras = atras.filter(r => tipoRota(r.servico) === _relAtrasoTipo);
  const cnt = $('#rel-atr-cnt'); if(cnt) cnt.textContent = atras.length;
  const tb = $('#rel-atr-tbody');
  if(tb) tb.innerHTML = atras.length ? atras.map(r=>{ const j=relJustificativa(r); return `<tr class="rel-click" data-rid="${relRowRef(r)}"><td>${relIdCell(r)}</td><td class="mono">${escapeHtml(r.servico||'—')}</td><td>${escapeHtml(tipoRota(r.servico))}</td><td>${escapeHtml(r.destino||'—')}</td><td>${j?`<span class="ocor-alert">${escapeHtml(j)}</span>`:'<span class="ocor-empty">sem ocorrência em sistema</span>'}</td></tr>`; }).join('') : `<tr><td colspan="5"><div class="empty-state">Nenhuma viagem atrasada no período. 👍</div></td></tr>`;
}
// Destinos: volume + pontualidade por destino (top 10)
function renderRelDestinos(){
  const d = {};
  _relData.fin.forEach(r => { const k=(r.destino||'—'); if(!d[k]) d[k]={n:0,at:0}; d[k].n++; if(/atrasad/i.test(r.resultado||'')) d[k].at++; });
  const top = Object.entries(d).sort((a,b)=>b[1].n-a[1].n).slice(0,10);
  const tb = $('#rel-dest-tbody');
  if(tb) tb.innerHTML = top.length ? top.map(([dest,o])=>{ const p=Math.round((o.n-o.at)/o.n*100); const cls=p>=90?'b-verde':(p>=80?'b-amarelo':'b-vermelho'); return `<tr class="rel-click" data-dest="${escapeHtml(dest)}"><td>${escapeHtml(dest)}</td><td class="mono">${o.n}</td><td class="mono">${o.at}</td><td><span class="badge ${cls}"><span class="badge-dot"></span>${p}%</span></td></tr>`; }).join('') : `<tr><td colspan="4"><div class="empty-state">Sem dados.</div></td></tr>`;
}
// Item de rota atrasada (identificação + trecho + ocorrência) — usado nos detalhes
function relAtrasoItem(r){
  const isRost = r.rostering_id && r.rostering_id !== '0';
  const id  = isRost ? r.rostering_id : (r.route_id || '—');
  const tag = isRost ? 'Protocolo' : 'Travel ID';
  const trecho = (r.trecho||'').trim() || `${r.origem||'?'} → ${r.destino||'?'}`;
  const oc = relJustificativa(r) || 'Sem ocorrência registrada';
  return `<div class="dt-atr">
    <div class="dt-atr-top"><span class="mono">${escapeHtml(id)}</span> <span class="id-tag ${isRost?'id-proto':'id-travel'}">${tag}</span>
      <span class="dt-atr-nom">${escapeHtml(r.servico||'')}</span></div>
    <div class="dt-atr-tr">${escapeHtml(trecho)}</div>
    <div class="dt-atr-oc">${escapeHtml(oc)}</div>
  </div>`;
}
// Calendário de atrasos — navega por mês/ano, cada dia mostra a contagem; clique abre o detalhe do dia
const MES_NOME = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
let _calY = null, _calM = null;
let _calData = { byDay: {} };
function calNav(dir){
  if(_calY == null){ const n = new Date(); _calY = n.getFullYear(); _calM = n.getMonth(); }
  _calM += (dir === 'next' ? 1 : -1);
  if(_calM > 11){ _calM = 0; _calY++; } else if(_calM < 0){ _calM = 11; _calY--; }
  renderRelCalendar();
}
async function renderRelCalendar(){
  const host = $('#rel-calendar'); if(!host) return;
  if(_calY == null){ const n = new Date(); _calY = n.getFullYear(); _calM = n.getMonth(); }
  const mm = String(_calM+1).padStart(2,'0');
  const lastDay = new Date(_calY, _calM+1, 0).getDate();
  const mStart = `${_calY}-${mm}-01`, mEnd = `${_calY}-${mm}-${String(lastDay).padStart(2,'0')}`;
  const navBar = `<div class="cal-head"><button class="cal-nav" data-cal="prev" type="button">‹</button><div class="cal-title">${MES_NOME[_calM]} ${_calY}</div><button class="cal-nav" data-cal="next" type="button">›</button></div>`;
  host.innerHTML = navBar + `<div class="cal-loading">Carregando…</div>`;
  const res = await fetchHistorico(mStart, mEnd);
  const atras = (res.ok ? res.rows : []).filter(r => /finaliz/i.test(r.estado||'') && /atrasad/i.test(r.resultado||'') && relTipoMatch(r) && relFaseMatch(r));
  const byDay = {};
  atras.forEach(r => { const d = r.data; if(!d) return; (byDay[d] = byDay[d] || []).push(r); });
  _calData = { byDay };
  let max = 0; Object.values(byDay).forEach(a => { if(a.length > max) max = a.length; });
  const first = new Date(_calY, _calM, 1).getDay();
  const hoje = new Date(); const isMesAtual = (hoje.getFullYear()===_calY && hoje.getMonth()===_calM);
  let html = navBar + '<div class="cal-grid">';
  ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(d => html += `<div class="cal-dow">${d}</div>`);
  for(let i=0;i<first;i++) html += '<div class="cal-empty"></div>';
  for(let day=1; day<=lastDay; day++){
    const iso = `${_calY}-${mm}-${String(day).padStart(2,'0')}`;
    const n = (byDay[iso]||[]).length;
    const a = n ? (0.15 + 0.85*(n/(max||1))) : 0;
    const strong = n/(max||1) > 0.5;
    const isHoje = isMesAtual && day===hoje.getDate();
    const style = n ? `background:rgba(212,5,17,${a.toFixed(2)});color:${strong?'#fff':'#8a2b2b'}` : '';
    html += `<div class="cal-day${n?' has':''}${isHoje?' hoje':''}" ${n?`data-calday="${iso}" title="${day}/${mm} · ${n} atraso${n!==1?'s':''}"`:''} style="${style}"><span class="cal-num">${day}</span>${n?`<span class="cal-cnt">${n}</span>`:''}</div>`;
  }
  html += '</div><div class="cal-foot">Cada dia mostra os atrasos · clique num dia pra ver as rotas</div>';
  host.innerHTML = html;
}
// Detalhe do dia: rotas atrasadas naquele dia (identificação · trecho · ocorrência)
function openDayDetail(iso){
  const rows = _calData.byDay[iso] || [];
  const dataFmt = iso.split('-').reverse().join('/');
  let html = `<div class="dt-action dt-crit"><span class="dt-action-ttl">Atrasos do dia</span>${rows.length} rota${rows.length!==1?'s':''} atrasada${rows.length!==1?'s':''} em ${dataFmt}</div>`;
  // agrupa por destino (visão rápida) + lista completa
  const byDest = {};
  rows.forEach(r => { const k=(r.destino||'—'); byDest[k]=(byDest[k]||0)+1; });
  const destTop = Object.entries(byDest).sort((a,b)=>b[1]-a[1]);
  if(destTop.length) html += `<div class="dt-sec">Destinos afetados</div>` + destTop.map(([k,v]) => dtField(k, v+' atraso'+(v!==1?'s':''))).join('');
  if(rows.length) html += `<div class="dt-sec">Rotas atrasadas — identificação · trecho · ocorrência</div>` + rows.map(relAtrasoItem).join('');
  else html += `<div class="empty-state" style="padding:16px">Sem atrasos neste dia.</div>`;
  $('#dt-title').textContent = `Atrasos · ${dataFmt}`;
  $('#dt-body').innerHTML = html;
  const ov = $('#detail-overlay'); if(!ov) return;
  ov.style.display = 'flex'; document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => ov.classList.add('open'));
}
// Ofensores recorrentes: destinos com maior TAXA de atraso (mín. de volume), não só volume
function renderRelRecorrentes(){
  const host = $('#rel-recorrentes'); if(!host) return;
  const by = {};
  _relData.fin.forEach(r => { const k=(r.destino||'—'); if(!by[k]) by[k]={n:0,at:0}; by[k].n++; if(/atrasad/i.test(r.resultado||'')) by[k].at++; });
  const MIN = 5;
  const rows = Object.entries(by)
    .filter(([k,o]) => o.n >= MIN && o.at > 0)
    .map(([k,o]) => ({ dest:k, n:o.n, at:o.at, taxa: Math.round(o.at/o.n*100) }))
    .sort((a,b) => b.taxa - a.taxa || b.at - a.at).slice(0,8);
  if(!rows.length){ host.innerHTML = `<div class="empty-state" style="padding:20px">Nenhum ofensor recorrente (mín. ${MIN} viagens no destino).</div>`; return; }
  host.innerHTML = rows.map(r => {
    const cls = r.taxa>=50 ? 'b-vermelho' : (r.taxa>=25 ? 'b-amarelo' : 'b-verde');
    return `<div class="rec-row" data-dest="${escapeHtml(r.dest)}"><div class="rec-dest">${escapeHtml(r.dest)}</div>
      <div class="rec-bar"><div class="rec-fill" style="width:${Math.max(4,r.taxa)}%"></div></div>
      <div class="rec-meta"><span class="badge ${cls}"><span class="badge-dot"></span>${r.taxa}%</span> <span class="rec-vol">${r.at}/${r.n}</span> <span class="rec-go">›</span></div></div>`;
  }).join('');
}
// Resumo do que está acontecendo num destino (clique numa linha da tabela de destinos)
function openDestDetail(dest){
  const fin  = _relData.fin.filter(r => (r.destino||'—') === dest);
  const canc = _relData.canc.filter(r => (r.destino||'—') === dest);
  const n = fin.length;
  const at = fin.filter(r => /atrasad/i.test(r.resultado||'')).length;
  const noPrazo = n - at;
  const pct = n ? Math.round(noPrazo/n*100) : 0;
  const pac = fin.reduce((s,r)=>s+(parseInt(r.pacotes,10)||0),0);
  const mediaPac = n ? Math.round(pac/n) : 0;
  const infrut = canc.filter(r => /infrut/i.test(r.motivo_cancelamento||'')).length;
  // rotas atrasadas: identificação + trecho + ocorrência (o detalhe completo)
  const atrasadas = fin.filter(r => /atrasad/i.test(r.resultado||''));
  // ocorrências das atrasadas, agrupadas (visão rápida do padrão)
  const ocorMap = {};
  atrasadas.forEach(r => { const j = relJustificativa(r) || 'Sem ocorrência registrada'; ocorMap[j] = (ocorMap[j]||0)+1; });
  const ocorTop = Object.entries(ocorMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  // tipos de rota que atendem esse destino
  const tipoMap = {};
  fin.forEach(r => { const t = tipoRota(r.servico) || '—'; tipoMap[t] = (tipoMap[t]||0)+1; });
  const tipoTop = Object.entries(tipoMap).sort((a,b)=>b[1]-a[1]);
  const acls = pct>=90 ? 'dt-ok' : (pct>=80 ? 'dt-warn' : 'dt-crit');
  const op = _relTipoOp === 'xpt' ? 'XPT' : 'Line Haul';
  let html = `<div class="dt-action ${acls}"><span class="dt-action-ttl">Pontualidade no destino (${op})</span>${pct}% no prazo · ${n} viage${n!==1?'ns':'m'} no período</div>`;
  html += `<div class="dt-sec">Volume e prazo</div>`
    + dtField('Viagens finalizadas', n)
    + dtField('No prazo', noPrazo)
    + dtField('Atrasadas', at)
    + dtField('Pontualidade', pct+'%');
  html += `<div class="dt-sec">Pacotes</div>`
    + dtField('Total entregue', pac.toLocaleString('pt-BR'))
    + dtField('Média por viagem', mediaPac.toLocaleString('pt-BR'));
  if(canc.length) html += `<div class="dt-sec">Cancelamentos</div>`
    + dtField('Total cancelado', canc.length)
    + dtField('Infrutíferas', infrut);
  if(ocorTop.length) html += `<div class="dt-sec">Principais ocorrências (nos atrasos)</div>`
    + ocorTop.map(([k,v]) => dtField(k, v+'×')).join('');
  if(atrasadas.length){
    html += `<div class="dt-sec">Rotas atrasadas — identificação · trecho · ocorrência (${atrasadas.length})</div>`;
    html += atrasadas.map(relAtrasoItem).join('');
  }
  if(tipoTop.length) html += `<div class="dt-sec">Tipos de rota</div>`
    + tipoTop.map(([k,v]) => dtField(k, v+'×')).join('');
  $('#dt-title').textContent = `Destino · ${dest}`;
  $('#dt-body').innerHTML = html;
  const ov = $('#detail-overlay'); if(!ov) return;
  ov.style.display = 'flex'; document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => ov.classList.add('open'));
}
// Detalhe completo de uma viagem do histórico (clique numa linha dos Relatórios)
function openHistDetail(r){
  if(!r) return;
  const isRost = r.rostering_id && r.rostering_id !== '0';
  const id = isRost ? r.rostering_id : (r.route_id || '—');
  const tag = isRost ? 'Protocolo' : 'Travel ID';
  const canc = /cancel/i.test(r.estado||''), atr = /atrasad/i.test(r.resultado||'');
  const acls = canc ? 'dt-warn' : (atr ? 'dt-crit' : 'dt-ok');
  const sit = `${escapeHtml(r.estado||'')}${r.resultado?` · ${escapeHtml(r.resultado)}`:''}${canc && r.motivo_cancelamento?` · ${escapeHtml(r.motivo_cancelamento)}`:''}`;
  const just = relJustificativa(r);
  const dataFmt = r.data ? String(r.data).split('-').reverse().join('/') : '';
  let html = `<div class="dt-action ${acls}"><span class="dt-action-ttl">Situação</span>${sit}</div>`;
  html += `<div class="dt-sec">Identificação</div>`
    + `<div class="dt-row"><span class="dt-k">${tag}</span><span class="dt-v"><span class="mono">${escapeHtml(id)}</span> <span class="id-tag ${isRost?'id-proto':'id-travel'}">${tag}</span></span></div>`
    + dtField('Nomenclatura', r.servico) + dtField('Tipo da rota', tipoRota(r.servico)) + dtField('Trecho', r.trecho) + dtField('Data', dataFmt);
  html += `<div class="dt-sec">Rota</div>` + dtField('Origem', r.origem) + dtField('Destino', r.destino);
  html += `<div class="dt-sec">Tempos</div>`
    + dtField('Saída programada', r.saida_programada) + dtField('Saída real', r.saida_real) + dtField('Chegada', r.chegada);
  html += `<div class="dt-sec">Números</div>`
    + dtField('Resultado', r.resultado) + dtField('Pacotes', r.pacotes!=null ? (+r.pacotes).toLocaleString('pt-BR') : '');
  if(canc) html += `<div class="dt-sec">Cancelamento</div>` + dtField('Motivo', r.motivo_cancelamento);
  if(just || (r.causa_raiz||'').trim()) html += `<div class="dt-sec">Ocorrência</div>` + dtField('Ocorrência em sistema', just) + dtField('Causa raiz', r.causa_raiz);
  $('#dt-title').textContent = `Identificação · ${id}`;
  $('#dt-body').innerHTML = html + `<div id="dt-acoes"></div>`;
  renderAcoesInto(id, 'dt-acoes');
  const ov = $('#detail-overlay'); if(!ov) return;
  ov.style.display = 'flex'; document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => ov.classList.add('open'));
}
/* ---- Ações da equipe (marcar ciente / nota / atribuir) — grava no Supabase ---- */
function relUsuario(){
  let u = ''; try { u = localStorage.getItem('dhl_user') || ''; } catch(e){}
  if(!u){ u = (prompt('Seu nome (aparece nas ações da equipe):','') || '').trim(); if(u){ try { localStorage.setItem('dhl_user', u); } catch(e){} } }
  return u || 'Anônimo';
}
async function fetchAcoes(ref){
  if(!SUPABASE.url || !ref) return [];
  try {
    const r = await fetch(`${SUPABASE.url}/rest/v1/acoes?ref=eq.${encodeURIComponent(ref)}&order=criado_em.asc`, { headers:{ apikey:SUPABASE.anon, Authorization:'Bearer '+SUPABASE.anon } });
    return r.ok ? await r.json() : [];
  } catch(e){ return []; }
}
async function postAcao(ref, tipo, texto){
  if(!SUPABASE.url || !ref) return false;
  try {
    const r = await fetch(`${SUPABASE.url}/rest/v1/acoes`, { method:'POST',
      headers:{ apikey:SUPABASE.anon, Authorization:'Bearer '+SUPABASE.anon, 'Content-Type':'application/json', Prefer:'return=minimal' },
      body: JSON.stringify([{ ref:String(ref), tipo, texto:texto||null, autor: relUsuario() }]) });
    return r.ok;
  } catch(e){ return false; }
}
function renderAcoesList(acoes){
  const l = $('#acoes-list'); if(!l) return;
  if(!acoes.length){ l.innerHTML = `<div class="ocor-empty" style="padding:6px 0">Nenhuma ação registrada ainda.</div>`; return; }
  l.innerHTML = acoes.map(a => {
    const icon = a.tipo==='ciente' ? '✓' : (a.tipo==='atribuido' ? '👤' : '📝');
    const label = a.tipo==='ciente' ? 'marcou ciente' : (a.tipo==='atribuido' ? `atribuiu a <b>${escapeHtml(a.texto||'—')}</b>` : `anotou: ${escapeHtml(a.texto||'')}`);
    const when = a.criado_em ? new Date(a.criado_em).toLocaleString('pt-BR') : '';
    return `<div class="acao-item"><span class="acao-ic">${icon}</span><div><b>${escapeHtml(a.autor||'—')}</b> ${label}<div class="acao-when">${when}</div></div></div>`;
  }).join('');
}
async function renderAcoesInto(ref, elId){
  const el = $('#'+elId); if(!el) return;
  el.innerHTML = `<div class="dt-sec">Ações da equipe</div>
    <div id="acoes-list" class="acoes-list">carregando…</div>
    <div class="acoes-form">
      <button class="acao-btn" data-acao="ciente">✓ Marcar ciente</button>
      <div class="acao-row"><input id="acao-nota" class="acao-inp" placeholder="Adicionar nota…"><button class="acao-btn" data-acao="nota">Nota</button></div>
      <div class="acao-row"><input id="acao-resp" class="acao-inp" placeholder="Atribuir a…"><button class="acao-btn" data-acao="atribuido">Atribuir</button></div>
    </div>`;
  renderAcoesList(await fetchAcoes(ref));
  el.querySelectorAll('.acao-btn').forEach(b => b.addEventListener('click', async () => {
    const tipo = b.dataset.acao;
    let texto = '';
    if(tipo==='nota') texto = ($('#acao-nota') ? $('#acao-nota').value : '').trim();
    if(tipo==='atribuido') texto = ($('#acao-resp') ? $('#acao-resp').value : '').trim();
    if((tipo==='nota' || tipo==='atribuido') && !texto) return;
    b.disabled = true;
    await postAcao(ref, tipo, texto);
    renderAcoesList(await fetchAcoes(ref));
    b.disabled = false;
    if($('#acao-nota')) $('#acao-nota').value = '';
    if($('#acao-resp')) $('#acao-resp').value = '';
  }));
}
function relFlash(sel){ const el = $(sel); if(!el) return; el.scrollIntoView({ behavior:'smooth', block:'start' }); el.classList.remove('rel-flash'); void el.offsetWidth; el.classList.add('rel-flash'); }
function relKpiAction(which){
  if(which==='atraso'){ _relAtrasoTipo=null; renderRelAtrasos(); relFlash('#rel-atr-panel'); }
  else if(which==='canc'){ _relCancMotivo=null; renderRelCancelamentos(); relFlash('#rel-canc-panel'); }
  else if(which==='infrut'){ _relCancMotivo='__infrut__'; renderRelCancelamentos(); relFlash('#rel-canc-panel'); }
  else if(which==='pont'){ relFlash('#rel-pont-panel'); }
}
function bindRelatorios(){
  $$('.rel-op-btn').forEach(b => b.addEventListener('click', () => {
    _relTipoOp = b.dataset.op;
    $$('.rel-op-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    _relCancMotivo = null; _relAtrasoTipo = null;
    renderRelatorios();
  }));
  $$('.rel-fase-btn').forEach(b => b.addEventListener('click', () => {
    _relFase = b.dataset.fase;
    $$('.rel-fase-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    _relCancMotivo = null; _relAtrasoTipo = null;
    renderRelatorios();
  }));
  $$('.rel-per-btn').forEach(b => b.addEventListener('click', () => {
    _relPeriodo = b.dataset.per;
    $$('.rel-per-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const cw = $('#rel-custom'); if(cw) cw.style.display='none';
    renderRelatorios();
  }));
  const cb = $('#rel-custom-btn');
  if(cb) cb.addEventListener('click', () => { const cw=$('#rel-custom'); if(cw) cw.style.display = (cw.style.display==='none'||!cw.style.display)?'flex':'none'; });
  const ap = $('#rel-custom-aplicar');
  if(ap) ap.addEventListener('click', () => {
    const s=$('#rel-custom-ini'), e=$('#rel-custom-fim');
    if(s && e && s.value && e.value){ _relStart=s.value; _relEnd=e.value; _relPeriodo='custom'; $$('.rel-per-btn').forEach(x=>x.classList.remove('active')); renderRelatorios(); }
  });
  document.addEventListener('click', e => {
    const kpi = e.target.closest('#rel-kpis .kpi-card[data-relkpi]'); if(kpi){ relKpiAction(kpi.dataset.relkpi); return; }
    const mr = e.target.closest('.rel-motivo-row'); if(mr){ _relCancMotivo = mr.dataset.motivo; renderRelCancelamentos(); return; }
    if(e.target.closest('#rel-canc-back')){ _relCancMotivo = null; renderRelCancelamentos(); return; }
    const chip = e.target.closest('.rel-chip'); if(chip){ _relAtrasoTipo = chip.dataset.tipo || null; renderRelAtrasos(); return; }
    const dtr = e.target.closest('#rel-dest-tbody tr[data-dest]'); if(dtr){ openDestDetail(dtr.dataset.dest); return; }
    const rec = e.target.closest('.rec-row[data-dest]'); if(rec){ openDestDetail(rec.dataset.dest); return; }
    const cnav = e.target.closest('.cal-nav'); if(cnav){ calNav(cnav.dataset.cal); return; }
    const cday = e.target.closest('.cal-day[data-calday]'); if(cday){ openDayDetail(cday.dataset.calday); return; }
    const tr = e.target.closest('#view-relatorios tbody tr[data-rid]'); if(tr){ openHistDetail(_relRowMap[tr.dataset.rid]); return; }
    const rtr = e.target.closest('#view-alertas tbody tr[data-rrid]'); if(rtr){ openHistDetail(_riscoRowMap[rtr.dataset.rrid]); return; }
  });
}

/* ----------------------------------------------------------------------- */
/* Painel de detalhe da rota (clique numa linha)                            */
/* ----------------------------------------------------------------------- */
function dtField(label, value){
  if(value == null || value === '') return '';
  return `<div class="dt-row"><span class="dt-k">${label}</span><span class="dt-v">${escapeHtml(String(value))}</span></div>`;
}
// endereço vira link clicável quando for URL (ex.: link do Maps)
function addrLink(end){
  if(!end) return '';
  return /^https?:\/\//i.test(end)
    ? `<a href="${escapeHtml(end)}" target="_blank" rel="noopener" class="dt-link">Abrir no mapa ↗</a>`
    : escapeHtml(end);
}
// linha de service center: Nome (SIGLA) + endereço escrito + link "Abrir no mapa"
function scRow(label, nome, sigla, endereco, maps){
  if(!nome && !sigla && !endereco && !maps) return '';
  let v = `${escapeHtml(nome||'')}${sigla?` <span class="dt-sigla">${escapeHtml(sigla)}</span>`:''}`;
  if(endereco) v += `<div class="dt-addr">${escapeHtml(endereco)}</div>`;
  if(maps && /^https?:\/\//i.test(maps)) v += `<div>${addrLink(maps)}</div>`;
  return `<div class="dt-row"><span class="dt-k">${label}</span><span class="dt-v">${v}</span></div>`;
}
function openDetail(proto){
  const eta = (DASHBOARD_DATA.eta || []).find(d => String(d.protocolo).trim() === proto);
  const etd = (DASHBOARD_DATA.etd || []).find(d => String(d.protocolo).trim() === proto);
  const val = (DASHBOARD_DATA.validacao || []).find(d => String(d.protocolo).trim() === proto);
  const ocor = OCOR_INDEX[proto];

  let action = 'Sem ação pendente para este protocolo no momento.', acls = 'dt-ok';
  if(etd && etd.naoIniciada){
    action = `Rota ainda não iniciou (Estado na Base: ${etd.baseEstado||'Pendente'}). Não há atraso em trânsito — aguardando a saída da origem.`; acls = 'dt-ok';
  } else if(etd && etd.risco === 'vermelho'){
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

  const watched = isWatched(proto);
  let html = `<button id="dt-watch" class="dt-watch ${watched?'on':''}" data-proto="${escapeHtml(proto)}">${watched?'★ Em observação':'☆ Observar este protocolo'}</button>`
    + `<div class="dt-action ${acls}"><span class="dt-action-ttl">Ação recomendada</span>${escapeHtml(action)}</div>`;
  if(eta){
    html += `<div class="dt-sec">Chegada · ETA</div>`
      + dtField('Resultado', eta.classificacaoTexto) + dtField('Horário máximo', fmtDateTime(eta.horarioMax))
      + dtField('Chegada real', fmtDateTime(eta.horarioReal)) + dtField('Status da rota', eta.statusK)
      + dtField('Status SM', eta.statusL) + dtField('Status da viagem', eta.statusViagem)
      + dtField('Motorista', eta.motorista) + dtField('Placa', eta.placa);
  }
  if(etd){
    html += `<div class="dt-sec">Em viagem · ETD</div>`
      + dtField('Destino', etd.destino) + dtField('Nomenclatura', etd.rota) + dtField('Placa', etd.placa)
      + dtField('ETA destino', fmtDateTime(etd.etaDestino)) + dtField('Faixa', etd.riscoTexto)
      + dtField('Km/h médio necessário', etd.kmMedio!=null ? etd.kmMedio+' km/h' : '')
      + dtField('Km faltante', etd.kmFaltante!=null ? etd.kmFaltante+' km' : '')
      + dtField('Deslocamento na última hora', etd.deslocHora!=null ? etd.deslocHora+' km' : '')
      + dtField('Velocidade', etd.velocidadeAtual!=null ? etd.velocidadeAtual+' km/h' : '')
      + dtField('Status SM', etd.statusSM)
      + dtField('Pacotes', etd.pacotes!=null ? etd.pacotes.toLocaleString('pt-BR') : '')
      + (etd.postoFiscal ? dtField('Posto fiscal', etd.postoSituacao + (etd.postoKm!=null?` · ${etd.postoKm} km`:'')) : '')
      + (etd.ocorrencia ? dtField('Ocorrência', etd.ocorrencia) : '');
    if(etd.baseEstado || etd.origemATD || etd.causaRaiz){
      html += `<div class="dt-sec">Base · fonte central</div>`
        + dtField('Estado', etd.baseEstado) + dtField('Substatus', etd.baseSub)
        + dtField('Saída real da origem', etd.origemATD) + dtField('Causa raiz do incidente', etd.causaRaiz)
        + dtField('Rostering ID', etd.protocolo) + dtField('Route ID', etd.routeId);
    }
    if(etd.odOrigemNome || etd.odDestinoNome || etd.origemEndereco || etd.destinoEndereco){
      html += `<div class="dt-sec">Origem / Destino · service center</div>`
        + scRow('Origem', etd.odOrigemNome, etd.odOrigemSigla, etd.origemEndereco, etd.origemMaps)
        + scRow('Destino', etd.odDestinoNome, etd.odDestinoSigla, etd.destinoEndereco, etd.destinoMaps);
    }
  }
  if(val){
    html += `<div class="dt-sec">Portal · auditoria</div>`
      + dtField('Status portal', val.statusPortal) + dtField('Divergência', val.divergencia) + dtField('Placas', val.placas);
  }
  if(!eta && !etd && !val) html += `<div class="empty-state">Sem dados detalhados para este protocolo.</div>`;

  const _n = (etd && etd.rota) || (eta && eta.rota) || '';
  $('#dt-title').textContent = 'Identificação · ' + proto + (_n ? ' · ' + _n : '');
  $('#dt-body').innerHTML = html + `<div id="dt-acoes"></div>`;
  renderAcoesInto(proto, 'dt-acoes');
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
    const wb = e.target.closest('#dt-watch');
    if(wb){ toggleWatch(wb.dataset.proto); return; }
    const wi = e.target.closest('.watch-item');
    if(wi){ openDetail(wi.dataset.proto); return; }
    const ac = e.target.closest('.alert-card');
    if(ac){ openDetail(ac.dataset.proto); return; }
    const oclr = e.target.closest('#ofen-clear');
    if(oclr){ gestaoDestSel = null; renderGestaoDest(); renderOfensores(); return; }
    const ofr = e.target.closest('.ofen-row');
    if(ofr){ openDetail(ofr.dataset.proto); return; }
    const gdr = e.target.closest('.gx-dest-row');
    if(gdr && gdr.dataset.dest){ gestaoDestSel = (gestaoDestSel===gdr.dataset.dest?null:gdr.dataset.dest); renderGestaoDest(); renderOfensores(); return; }
    const gj = e.target.closest('.gx-jump');
    if(gj){ gestaoJump(gj.dataset.jump); return; }
    const tr = e.target.closest('.table-wrap tbody tr');
    if(tr && !tr.querySelector('.empty-state')){
      const cell = tr.querySelector('.mono');
      const proto = cell ? cell.textContent.trim() : '';
      if(proto) openDetail(proto);
    }
  });
  document.addEventListener('keydown', (e) => { if(e.key === 'Escape') closeDetail(); });
}

/* ----------------------------------------------------------------------- */
/* Toast de novo crítico + Saúde dos dados                                  */
/* ----------------------------------------------------------------------- */
function showToast(msg, cls){
  const wrap = document.getElementById('toast-container');
  if(!wrap) return;
  const t = document.createElement('div');
  t.className = 'toast ' + (cls || '');
  t.innerHTML = msg;
  wrap.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 6500);
}
let _knownCrit = null;
function checkNewCriticals(){
  const crit = buildAlerts().filter(a => a.cls === 'b-vermelho');
  const cur = new Set(crit.map(a => a.origem + ':' + a.protocolo));
  if(_knownCrit !== null){
    crit.forEach(a => {
      const k = a.origem + ':' + a.protocolo;
      if(!_knownCrit.has(k)) showToast(`<b>Novo alerta crítico</b><br>${escapeHtml(a.origem)} · ${escapeHtml(a.protocolo)} — ${escapeHtml(a.what)}`, 'toast-crit');
    });
  }
  _knownCrit = cur;
}
function fmtRelativo(ms){
  const min = Math.round((Date.now() - ms) / 60000);
  if(min < 1) return 'agora mesmo';
  if(min === 1) return 'há 1 min';
  if(min < 60) return `há ${min} min`;
  return `há ${Math.round(min/60)}h`;
}
function updateDataHealth(){
  const dot = document.querySelector('.live-dot'), pill = document.querySelector('.live-pill'), lbl = $('#lastUpdateLabel');
  if(!dot || !lbl) return;
  const errs = DASHBOARD_DATA._loadErrors || [];
  if(errs.length){
    dot.style.background = 'var(--red)';
    if(pill) pill.title = 'Falha ao carregar: ' + errs.join(' · ');
    lbl.textContent = `⚠ ${errs.length} aba(s) com erro`;
    return;
  }
  const ms = DASHBOARD_DATA._lastSyncMs;
  if(!ms){ lbl.textContent = 'Sincronizando…'; return; }
  const ageMin = (Date.now() - ms) / 60000;
  dot.style.background = ageMin > 12 ? 'var(--amber)' : 'var(--green)';
  if(pill) pill.title = ageMin > 12 ? 'Os dados podem estar desatualizados.' : 'Dados atualizados.';
  let txt = `Atualizado ${fmtRelativo(ms)}`;
  if(_nextSyncMs){
    const s = Math.max(0, Math.round((_nextSyncMs - Date.now()) / 1000));
    txt += ` · próx. ${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  }
  lbl.textContent = txt;
}
let _nextSyncMs = null;   // quando dispara a próxima atualização automática
function startHealthMonitor(){ setInterval(updateDataHealth, 1000); }   // 1s p/ a contagem regressiva

// atalhos de teclado: 1-6 trocam de aba, "/" foca a busca global, Esc fecha
function bindKeyboard(){
  document.addEventListener('keydown', (e) => {
    if(e.target.matches && e.target.matches('input, textarea')){
      if(e.key === 'Escape') e.target.blur();
      return;
    }
    if(e.key === '/'){ e.preventDefault(); const s = $('#global-search'); if(s) s.focus(); return; }
    if(/^[1-6]$/.test(e.key)){
      const t = ['alertas','eta','etd','xpt','validacao','mapa'][+e.key - 1];
      if(t) activateTab(t);
    }
  });
}

/* ----------------------------------------------------------------------- */
/* Busca global (protocolo / placa / destino em todas as abas)              */
/* ----------------------------------------------------------------------- */
function bindGlobalSearch(){
  const inp = $('#global-search'), box = $('#global-results');
  if(!inp || !box) return;
  const run = () => {
    const q = inp.value.trim().toLowerCase();
    if(q.length < 2){ box.classList.remove('open'); box.innerHTML = ''; return; }
    const seen = new Set(), hits = [];
    const scan = (arr, getWhere) => (arr || []).forEach(d => {
      const p = String(d.protocolo || '').trim();
      if(!p || seen.has(p)) return;
      const hay = `${p} ${d.placa||''} ${d.destino||''} ${d.origem||''} ${d.rota||''}`.toLowerCase();
      if(hay.includes(q)){ seen.add(p); hits.push({ p, n: d.rota||'', w: getWhere(d) }); }
    });
    scan(DASHBOARD_DATA.etd, d => d.destino || d.placa || '');
    scan(DASHBOARD_DATA.eta, d => `${d.origem||''} → ${d.destino||''}`);
    const top = hits.slice(0, 8);
    box.innerHTML = top.length
      ? top.map(h => `<div class="gs-item" data-proto="${escapeHtml(h.p)}"><span class="gs-p">${escapeHtml(h.p)}${h.n ? ` <span class="gs-n">${escapeHtml(h.n)}</span>` : ''}</span><span class="gs-w">${escapeHtml(h.w)}</span></div>`).join('')
      : `<div class="gs-empty">Nada encontrado para "${escapeHtml(q)}"</div>`;
    box.classList.add('open');
  };
  inp.addEventListener('input', run);
  inp.addEventListener('focus', run);
  box.addEventListener('click', e => {
    const it = e.target.closest('.gs-item'); if(!it) return;
    openDetail(it.dataset.proto); box.classList.remove('open'); inp.value = ''; inp.blur();
  });
  document.addEventListener('click', e => { if(!e.target.closest('.gsearch')) box.classList.remove('open'); });
}

/* ----------------------------------------------------------------------- */
/* Observar protocolo (watch list em localStorage)                          */
/* ----------------------------------------------------------------------- */
function getWatch(){ try { return JSON.parse(localStorage.getItem('dhl_watch') || '[]'); } catch(e){ return []; } }
function isWatched(p){ return getWatch().includes(p); }
function toggleWatch(p){
  let w = getWatch();
  w = w.includes(p) ? w.filter(x => x !== p) : w.concat(p);
  try { localStorage.setItem('dhl_watch', JSON.stringify(w)); } catch(e){}
  renderWatch();
  markWatched();
  const btn = $('#dt-watch');
  if(btn && btn.dataset.proto === p){
    const on = w.includes(p);
    btn.classList.toggle('on', on);
    btn.textContent = on ? '★ Em observação' : '☆ Observar este protocolo';
  }
}
function watchStatus(p){
  const etd = (DASHBOARD_DATA.etd || []).find(d => String(d.protocolo).trim() === p);
  const eta = (DASHBOARD_DATA.eta || []).find(d => String(d.protocolo).trim() === p);
  if(etd){
    if(etd.finalizada) return { txt:'Finalizado', cls:'b-cinza' };
    if(etd.parado) return { txt:'Parado', cls:'b-amarelo' };
    return { txt: etd.riscoTexto || 'Em viagem', cls: etd.risco==='vermelho'?'b-vermelho':(etd.risco==='amarelo'?'b-amarelo':'b-verde') };
  }
  if(eta) return { txt: eta.classificacaoTexto || 'ETA', cls: eta.classificacao==='vermelho'?'b-vermelho':(eta.classificacao==='cinza'?'b-cinza':'b-verde') };
  return { txt:'—', cls:'b-cinza' };
}
function renderWatch(){
  const el = $('#watch-list'); if(!el) return;
  const w = getWatch();
  const cnt = $('#watch-cnt'); if(cnt) cnt.textContent = w.length;
  if(!w.length){
    el.innerHTML = `<div class="empty-state" style="padding:16px 8px">Nenhum protocolo em observação. Abra um protocolo (clique numa linha) e toque em "Observar".</div>`;
    return;
  }
  el.innerHTML = w.map(p => {
    const s = watchStatus(p);
    const n = nomenFor(p);
    return `<div class="watch-item" data-proto="${escapeHtml(p)}"><span class="wi-id"><span class="mono">${escapeHtml(p)}</span>${n ? `<span class="wi-nomen">${escapeHtml(n)}</span>` : ''}</span><span class="badge ${s.cls}"><span class="badge-dot"></span>${escapeHtml(s.txt)}</span></div>`;
  }).join('');
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
  // Line Haul (XPT é operação à parte, contada só na aba XPT)
  const etdAtivos = (DASHBOARD_DATA.etd || []).filter(d => !d.finalizada && !d.ehXpt);
  $('#badgeEta').textContent = (DASHBOARD_DATA.eta || []).filter(d => !d.ehXpt).length;
  $('#badgeEtd').textContent = etdAtivos.length;
  $('#badgeXpt').textContent = DASHBOARD_DATA.xpt.length;
  $('#badgeVal').textContent = DASHBOARD_DATA.validacao.length;
  refreshEta();
  refreshEtd();
  renderXptTable();
  renderValTable();
  $('#badgeMapa').textContent = etdAtivos.filter(d => !d.naoPrioritaria && !d.naoIniciada).length;
  // resumo útil no masthead (substitui o subtítulo decorativo)
  const etaAtras = DASHBOARD_DATA.eta.filter(d => d.classificacao === 'vermelho').length;
  const etdCrit  = etdAtivos.filter(d => !d.naoPrioritaria && (d.risco === 'vermelho' || d.parado)).length;
  const emViagem = etdAtivos.filter(d => !d.naoIniciada).length;
  const aguard   = etdAtivos.filter(d => d.naoIniciada).length;
  const mm = $('#masthead-meta');
  if(mm) mm.textContent = `${emViagem} em viagem${aguard?` · ${aguard} aguardando início`:''} · ${etaAtras + etdCrit} exigindo atenção`;
  renderFleetMap();
  updateNavHealth();
  recordSnapshot();
  renderAlertas();
  renderGestao();
  renderWatch();
  checkNewCriticals();
  renderTrend();
  reapplySorts();
  markWatched();
  animateNumbers();
  updateDataHealth();
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
      ['eta','etd','xpt','validacao','mapa','alertas','gestao','relatorios'].forEach(t=>{
        const v = $('#view-'+t); if(v) v.style.display = (t===tab)?'block':'none';
      });
      // entrada suave da aba ativa (re-dispara a animação)
      const av = $('#view-'+tab);
      if(av){ av.classList.remove('view-anim'); void av.offsetWidth; av.classList.add('view-anim'); }
      // recalcula tamanho dos gráficos da aba aberta
      Object.values(charts).forEach(c=>c.resize());
      // o mapa precisa recalcular tamanho quando a aba fica visível
      if(tab==='mapa') renderFleetMap();
      if(tab==='alertas'){ renderAlertas(); renderTrend(); fetchAtrasosSemOcorrencia(); }
      if(tab==='gestao'){ fetchGestaoTrend(); renderGestao(); Object.values(charts).forEach(c=>c.resize()); }
      if(tab==='relatorios'){ renderRelatorios(); }
      saveView();
    });
  });
}

/* ---- Lembrar a visão: aba ativa + filtros (localStorage) ----------------- */
function saveView(){
  try {
    const btn = document.querySelector('.tab-btn.active');
    localStorage.setItem('dhl_view', JSON.stringify({
      tab: btn ? btn.dataset.tab : 'eta',
      eta: filters.eta, etd: filters.etd
    }));
  } catch(e){}
}
function restoreView(){
  try {
    const v = JSON.parse(localStorage.getItem('dhl_view') || '{}');
    if(v.eta) Object.keys(filters.eta).forEach(k => { if(v.eta[k] !== undefined) filters.eta[k] = v.eta[k]; });
    if(v.etd) Object.keys(filters.etd).forEach(k => { if(v.etd[k] !== undefined) filters.etd[k] = v.etd[k]; });
    return v.tab || 'eta';
  } catch(e){ return 'eta'; }
}
function activateTab(tab){
  const btn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if(btn) btn.click();
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
    {label:'Km/h medio', get:d=>d.kmMedio}, {label:'Faixa', get:d=>d.riscoTexto}, {label:'Desloc 1h', get:d=>d.deslocHora},
    {label:'Velocidade', get:d=>d.velocidadeAtual}, {label:'Status SM', get:d=>d.statusSM}, {label:'Posto fiscal', get:d=>d.postoSituacao},
    {label:'Ocorrencia', get:d=>d.ocorrencia}
  ];
  downloadCsv(`etd_${csvStamp()}.csv`, toCsv(cols, getEtdFiltered()));
}

/* ---- Ordenação por clique no cabeçalho da tabela (A→Z / Z→A) ------------- */
function cmpCell(a, b){
  const ta = (a && a.textContent || '').trim(), tb = (b && b.textContent || '').trim();
  return ta.localeCompare(tb, 'pt-BR', { numeric:true, sensitivity:'base' });
}
let _sortState = {};   // tbodyId -> {idx, dir}, p/ manter ordenação após re-render
function sortTableByHeader(th){
  const table = th.closest('table'), tbody = table && table.querySelector('tbody');
  if(!tbody) return;
  const idx = Array.prototype.indexOf.call(th.parentNode.children, th);
  const dir = th.getAttribute('data-sort') === 'asc' ? -1 : 1;
  th.parentNode.querySelectorAll('th').forEach(h => h.removeAttribute('data-sort'));
  th.setAttribute('data-sort', dir === 1 ? 'asc' : 'desc');
  if(tbody.id) _sortState[tbody.id] = { idx, dir };
  applySortTo(tbody, idx, dir);
}
function applySortTo(tbody, idx, dir){
  const rows = Array.prototype.filter.call(tbody.querySelectorAll('tr'), r => !r.querySelector('.empty-state'));
  if(rows.length < 2) return;
  rows.sort((a, b) => cmpCell(a.children[idx], b.children[idx]) * dir);
  rows.forEach(r => tbody.appendChild(r));
}
// re-aplica a ordenação ativa de cada tabela depois que ela é redesenhada
function reapplySorts(){
  Object.keys(_sortState).forEach(id => {
    const tbody = document.getElementById(id);
    if(tbody) applySortTo(tbody, _sortState[id].idx, _sortState[id].dir);
  });
}
// marca com ★ os protocolos em observação em qualquer tabela
function markWatched(){
  const w = new Set(getWatch());
  document.querySelectorAll('.table-wrap tbody tr').forEach(tr => {
    const cell = tr.querySelector('.mono');
    const p = cell ? cell.textContent.trim() : '';
    tr.classList.toggle('watched', !!(p && w.has(p)));
  });
}
function makeTablesSortable(){
  // todas as tabelas (as em .table-wrap e as novas em .table-scroll dentro de painéis)
  document.querySelectorAll('.table-scroll thead th').forEach(th => {
    if(th.classList.contains('sortable')) return;
    th.classList.add('sortable');
    th.addEventListener('click', () => sortTableByHeader(th));
  });
}

function bindFilters(){
  $('#f-eta-search').addEventListener('input',  e=>{ filters.eta.search=e.target.value; refreshEta(); saveView(); });
  $('#clearEtaFilters').addEventListener('click', ()=>{
    filters.eta = { classe:[], status:[], tipo:[], resp:[], search:'' };
    $('#f-eta-search').value=''; refreshEta(); syncFilterUI('eta');
  });

  $('#f-etd-search').addEventListener('input',   e=>{ filters.etd.search=e.target.value; refreshEtd(); saveView(); });
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
  _nextSyncMs = Date.now() + AUTO_REFRESH_MIN * 60 * 1000;
  autoRefreshTimer = setInterval(()=>{
    loadFromSheets()
      .then(()=>{ initEtaFilters(); initEtdFilters(); renderAll(); })
      .catch(e => setStatus('⚠ ' + e.message))
      .finally(()=>{ _nextSyncMs = Date.now() + AUTO_REFRESH_MIN * 60 * 1000; });
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

/* ---- Modo telão (TV), impressão/PDF e modo compacto --------------------- */
let _tvTimer = null, _tvIdx = 0;
const TV_TABS = ['alertas','gestao','mapa','etd'];
function startTv(){
  document.body.classList.add('tv');
  const el = document.documentElement;
  if(el.requestFullscreen) el.requestFullscreen().catch(()=>{});
  _tvIdx = 0; activateTab(TV_TABS[0]);
  _tvTimer = setInterval(() => { _tvIdx = (_tvIdx + 1) % TV_TABS.length; activateTab(TV_TABS[_tvIdx]); }, 12000);
}
function stopTv(){
  document.body.classList.remove('tv');
  if(_tvTimer){ clearInterval(_tvTimer); _tvTimer = null; }
  if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
}
function applyCompact(on){
  document.body.classList.toggle('compact', !!on);
  const b = $('#compactBtn'); if(b) b.classList.toggle('on', !!on);
  try { localStorage.setItem('dhl_compact', on ? '1' : '0'); } catch(e){}
}
function bindViewTools(){
  const tv = $('#tvBtn'); if(tv) tv.addEventListener('click', () => { _tvTimer ? stopTv() : startTv(); });
  const pr = $('#printBtn'); if(pr) pr.addEventListener('click', () => window.print());
  const cp = $('#compactBtn'); if(cp) cp.addEventListener('click', () => applyCompact(!document.body.classList.contains('compact')));
  document.addEventListener('fullscreenchange', () => { if(!document.fullscreenElement && _tvTimer) stopTv(); });
  let saved = '0'; try { saved = localStorage.getItem('dhl_compact') || '0'; } catch(e){}
  applyCompact(saved === '1');
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
  bindGlobalSearch();
  bindKeyboard();
  bindViewTools();
  bindRelatorios();
  bindValidacao();
  { const xs = $('#f-xpt-search'); if(xs) xs.addEventListener('input', () => { _xptSearch = xs.value; renderXptTable(); }); }
  startHealthMonitor();
  const savedTab = restoreView();   // recupera filtros + aba ativa salvos

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
  fetchGestaoTrend();            // tendência da GESTÃO vem do histórico real (Supabase)
  fetchAtrasosSemOcorrencia();   // risco: atrasos finalizados sem ocorrência (ALERTAS)

  // aplica a visão salva (valores de busca, contadores de filtro, aba ativa)
  if($('#f-eta-search')) $('#f-eta-search').value = filters.eta.search || '';
  if($('#f-etd-search')) $('#f-etd-search').value = filters.etd.search || '';
  syncFilterUI('eta'); syncFilterUI('etd');
  if(savedTab && savedTab !== 'eta') activateTab(savedTab);

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
let _map = null, _fleetLayer = null, _mapFitted = false;
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
  if(reset) reset.addEventListener('click', () => { mapFocus = null; _mapFitted = false; reset.style.display='none'; renderFleetMap(); });
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
    !d.naoPrioritaria && !d.finalizada && !d.naoIniciada &&
    mapBands[d.risco] !== false &&
    (!mapFocus || d.protocolo === mapFocus));
  let plotted = 0, np = 0, ri = 0, at = 0, semLoc = 0;
  rows.forEach(d => {
    const o = DIST.geo[normKey(d.origemGeo)], dst = DIST.geo[normKey(d.destinoGeo)];
    if(o === 'FAIL' || dst === 'FAIL'){ semLoc++; return; }            // sem coordenada (não geocodificou)
    if(!o || !dst){ DIST.enqueue(d.origemGeo, d.destinoGeo); return; }  // ainda resolvendo
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
      .bindPopup(`<b>${escapeHtml(d.protocolo)}</b> <span style="font-size:9px;font-weight:700;color:#6c707a;text-transform:uppercase">Protocolo</span><br>${escapeHtml(d.origemDisplay||d.origemGeo||'?')} → ${escapeHtml(d.destinoDisplay||d.destinoGeo||'?')}<br>${pct}% concluído${d.kmFaltante!=null?' · '+d.kmFaltante+' km restantes':''}<br>${escapeHtml(d.riscoTexto||'')}${d.ocorrencia?'<br>⚠ '+escapeHtml(d.ocorrencia):''}${d.causaRaiz?'<br>Causa: '+escapeHtml(d.causaRaiz):''}<br><a href="#" onclick="mapIsolate('${escapeHtml(d.protocolo)}');return false;" style="color:#b8860b;font-weight:600">🔍 isolar no mapa</a>`)
      .addTo(_fleetLayer);
    plotted++;
    if(d.risco==='verde') np++; else if(d.risco==='amarelo') ri++; else if(d.risco==='vermelho') at++;
  });
  if(mapFocus && plotted > 0){
    try { _map.fitBounds(_fleetLayer.getBounds(), { maxZoom:9, padding:[40,40] }); } catch(e){}
  } else if(!_mapFitted && plotted > 0){
    // primeira carga: enquadra a frota no Brasil (depois respeita o zoom do usuário)
    try { _map.fitBounds(_fleetLayer.getBounds(), { maxZoom:6, padding:[30,30] }); _mapFitted = true; } catch(e){}
  }
  const hl = $('#mapa-ops-headline');
  if(hl){
    const resolvendo = rows.length - plotted - semLoc;
    const extra = [resolvendo>0?`${resolvendo} resolvendo`:'', semLoc>0?`${semLoc} sem localização`:''].filter(Boolean).join(' · ');
    hl.textContent = `${plotted} no mapa${extra?` · ${extra}`:''}`;
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
    protocolo:  cell(row,'A') || pick(x, ['protocolo','protocolo meli','id','tracking id']),   // A = Protocolo (posição)
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
    segundaBipagem: cell(row,'H'),            // H = 2ª bipagem (viagens com 2 pontos de coleta)
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
    postoV:     cell(row,'V'),   // V = posto fiscal (acompanhamento)
    docs:       cell(row,'W'),   // W = DOCS (documentos)
    cpt:        parseDateBR(cell(row,'D')) || parseDateBR(pick(x, ['cpt','cpt previsto','data cpt','horario cpt']))  // D = CPT (checkpoint/saída)
    // origem/destino reais vêm da aba SM (cidade+UF) no enrichData — a coluna O do ETD é o sinal de GPS, não o destino
  };
}

// Aba XPT (acompanhamento de bipagem CPT). Colunas por POSIÇÃO:
// A protocolo · B rota · C motorista · D placa · E veículo · F ETA Origem (CPT previsto) ·
// G Bipagem CPT (real) · H status · J HUs · K Pcts · N DOC · O Performance · T Pontuação · U Obs
function mapXptRow(row){
  return {
    protocolo:  cell(row,'A'),
    rota:       cell(row,'B'),
    motorista:  cell(row,'C'),
    placa:      cell(row,'D'),
    veiculo:    cell(row,'E'),
    etaOrigem:  parseDateBR(cell(row,'F')),   // F = CPT previsto
    bipagemCPT: parseDateBR(cell(row,'G')),   // G = bipagem real
    status:     cell(row,'H'),
    hus:        parseNum(cell(row,'J')),
    pacotes:    parseNum(cell(row,'K')),
    doc:        cell(row,'N'),
    performance:cell(row,'O'),
    pontuacao:  parseNum(cell(row,'T')),
    obs:        cell(row,'U')
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

// Aba Base (fonte central). Chave = Rostering ID (col B). Colunas por POSIÇÃO:
// A = Route ID · B = Rostering ID · C = Serviço · T = Origem ATD (saída real) ·
// AM = Estado (Pendente/Em andamento/Finalizado/Cancelado) · AN = Substatus · AQ = Causa raiz do incidente
function mapBaseRow(row){
  return {
    protocolo: cell(row,'B'),   // Rostering ID — chave de comunicação
    routeId:   cell(row,'A'),   // Route ID — reserva
    servico:   cell(row,'C'),   // nomenclatura
    origem:    cell(row,'O'),   // origem
    destino:   cell(row,'X'),   // destino
    origemETA: cell(row,'P'),   // deveria chegar na origem (ETA)
    origemATA: cell(row,'Q'),   // chegou de verdade na origem (ATA)
    origemETD: cell(row,'S'),   // horário de saída PROGRAMADO da origem (deveria sair)
    origemATD: cell(row,'T'),   // horário real que saiu da origem
    estado:    cell(row,'AM'),  // Pendente = ainda não iniciou
    substatus: cell(row,'AN'),
    pacotes:   parseNum(cell(row,'AK')),  // AK = pacotes (reversa com pacotes vira prioritária)
    causaRaiz: cell(row,'AQ')
  };
}

// Aba Links: A = cidade/nome da sigla · B = sigla · E = endereço escrito · G = link do Maps
// Do link do Maps tentamos extrair as coordenadas exatas (@lat,lon), quando presentes.
function mapLinkRow(row){
  const maps = String(cell(row,'G'));
  let lat = null, lon = null;
  // 1) coluna H = "lat, lon" (preenchida pelo script de coordenadas) — prioridade
  const hm = String(cell(row,'H')).match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if(hm){ lat = +hm[1]; lon = +hm[2]; }
  else {
    // 2) extrai do link do Maps: pin exato (!3d!4d) ou centro do mapa (@lat,lon)
    const m = maps.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || maps.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if(m){ lat = +m[1]; lon = +m[2]; }
  }
  return {
    sigla:    cell(row,'B'),
    nome:     cell(row,'A'),
    endereco: cell(row,'E'),   // endereço escrito (rua, número)
    maps:     maps,            // link do Google Maps
    lat,
    lon
  };
}

// Aba Origem-destino: liga a NOMENCLATURA (F) às siglas/nomes de origem e destino.
// B = sigla origem · C = nome origem · D = sigla destino · E = nome destino · F = nomenclatura (chave)
function mapOdRow(row){
  return {
    oSigla:     cell(row,'B'),
    oNome:      cell(row,'C'),
    dSigla:     cell(row,'D'),
    dNome:      cell(row,'E'),
    nomenclatura: cell(row,'F'),
    rotaH:      cell(row,'H'),   // H = ROTA (nomenclatura que casa com o tipo)
    tipoI:      cell(row,'I')    // I = TIPO da rota (EXPRESSO, REV EXP, URBANO...)
  };
}

/* ---- Carregamento a partir do Sheets ------------------------------------ */
const SHEET_MAP = {
  eta:        { key:'eta',        mapper: mapEtaRow },
  etd:        { key:'etd',        mapper: mapEtdRow },
  xpt:        { key:'xpt',        mapper: mapXptRow },
  validacao:  { key:'validacao',  mapper: mapValRow },
  sm:         { key:'sm',         mapper: mapSmRow },
  ocorrencias:{ key:'ocorrencias',mapper: mapOcorrenciaRow },
  base:       { key:'base',       mapper: mapBaseRow },
  links:      { key:'links',      mapper: mapLinkRow },
  od:         { key:'od',         mapper: mapOdRow },
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
  DASHBOARD_DATA._lastSyncMs = Date.now();
  DASHBOARD_DATA._loadErrors = errors;
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

  // injeta coordenadas exatas (vindas do link do Maps) no cache, sem chamar Nominatim
  seed(name, c){
    if(!name || !c || c.lat == null || c.lon == null) return;
    const nk = normKey(name);
    const cur = this.geo[nk];
    if(cur && cur !== 'FAIL' && Math.abs(cur.lat - c.lat) < 1e-6 && Math.abs(cur.lon - c.lon) < 1e-6) return;
    this.geo[nk] = { lat: +c.lat, lon: +c.lon };
    this.save();
  },

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
