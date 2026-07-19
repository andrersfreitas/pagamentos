// ── LOGIN ──────────────────────────────────────────────────
var SENHA_ADM  = 'af690ee094002a0381f590a8bb47cd124f49f33c94f788c318dfe0b5de8e3a22';
var SENHA_CONS = '8f59a2c272172215c2fd8ed2d25fe776810f18dae2ddfe65a2502999f255b3d2';
var SENHA_HASH = SENHA_ADM; // compatibilidade
var _perfilAtual = ''; // 'adm' ou 'consulta'

function hashStr(str){
  // SHA-256 via SubtleCrypto (async)
  var buf = new TextEncoder().encode(str);
  return crypto.subtle.digest('SHA-256', buf).then(function(hash){
    return Array.from(new Uint8Array(hash)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  });
}

function fazerLogin(){
  var inp = document.getElementById('login-input');
  var senha = inp.value;
  if(!senha){ inp.focus(); return; }
  hashStr(senha).then(function(hash){
    if(hash === SENHA_ADM){
      _perfilAtual = 'adm';
      sessionStorage.setItem('auth', hash);
      sessionStorage.setItem('perfil', 'adm');
      aplicarPerfil('adm');
      document.getElementById('login-bg').style.display = 'none';
      inp.value = '';
      _iniciarApp();
    } else if(hash === SENHA_CONS){
      _perfilAtual = 'consulta';
      sessionStorage.setItem('auth', hash);
      sessionStorage.setItem('perfil', 'consulta');
      aplicarPerfil('consulta');
      document.getElementById('login-bg').style.display = 'none';
      inp.value = '';
      _iniciarApp();
    } else {
      var err = document.getElementById('login-err');
      err.style.display = 'block';
      inp.value = '';
      inp.focus();
      setTimeout(function(){ err.style.display='none'; }, 3000);
    }
  });
}

function aplicarPerfil(perfil){
  _perfilAtual = perfil;
  var badge = document.getElementById('perfil-badge');
  if(perfil === 'adm'){
    document.body.classList.remove('modo-consulta');
    if(badge){ badge.textContent = '\uD83D\uDD11 ADM'; badge.className='perfil-badge perfil-adm'; badge.style.display=''; }
  } else {
    document.body.classList.add('modo-consulta');
    if(badge){ badge.textContent = '\uD83D\uDC41 Consulta'; badge.className='perfil-badge perfil-cons'; badge.style.display=''; }
    // Esconder aba Importar no menu
    document.querySelectorAll('.tab').forEach(function(t){
      if(t.textContent.indexOf('Importar')>=0) t.style.display='none';
    });
  }
}

function verificarLogin(){
  var auth = sessionStorage.getItem('auth');
  var perfil = sessionStorage.getItem('perfil');
  if(auth === SENHA_ADM || auth === SENHA_CONS){
    document.getElementById('login-bg').style.display = 'none';
    aplicarPerfil(perfil === 'consulta' ? 'consulta' : 'adm');
    return true;
  }
  document.getElementById('login-bg').style.display = 'flex';
  setTimeout(function(){ document.getElementById('login-input').focus(); }, 100);
  return false;
}

// ── INIT ──
// Interceptar push/splice em CONS e PAG_OJI para autosave automático
(function(){
  function interceptArray(arr){
    var origPush=Array.prototype.push, origSplice=Array.prototype.splice;
    arr.push=function(){ var r=origPush.apply(this,arguments); marcarAlteracao(); return r; };
    arr.splice=function(){ var r=origSplice.apply(this,arguments); marcarAlteracao(); return r; };
  }
  interceptArray(CONS);
  interceptArray(PAG_OJI);
})();

// Correção pontual: 10 registros com valor divergente entre CONS e PAG_OJI
var _FIXES_OJI=[
  {id:'cc02ccd5-6b97-4ada-86ee-1bdfa831f790',doc:8802,valor:-1694.61},
  {id:'b127c08b-5b0b-4fc8-b07f-eab8bd667aac',doc:8806,valor:-1108.93},
  {id:'8f4630e6-20ab-4e71-a1d6-1a62a940300f',doc:8820,valor:-1694.61},
  {id:'03e8dd42-886f-4978-bcea-b5ecb19b6d92',doc:8823,valor:-1219.4},
  {id:'4f0b23ca-7021-4365-8c47-3d320ab4733e',doc:2,valor:-150.86},
  {id:'7e6a5907-542c-49c8-8f51-337f2e693bfe',doc:3,valor:-150.86},
  {id:'ebf1ebc4-2ca1-4751-b884-88170bc88c01',doc:4,valor:-150.86},
  {id:'04a577cf-9386-4143-9df2-8ef6d2374c80',doc:9,valor:-150.86},
  {id:'fd0202cb-beed-4bb4-857c-fe998f29ad14',doc:10,valor:-150.86},
  {id:'d9e9841a-a594-4f84-afd5-e0551ce6f175',doc:16,valor:-150.86}
];
function corrigirDivergenciasOji(){
  if(!_sbOnline) return;
  var promises=[];
  _FIXES_OJI.forEach(function(fix){
    var reg=PAG_OJI.find(function(r){return r.id===fix.id;});
    if(!reg || Math.abs(reg.valor - fix.valor) < 0.01) return; // já correto
    promises.push(
      sbFetch('pagamentos_oji?id=eq.'+fix.id,{
        method:'PATCH',
        headers:Object.assign({},sbHeaders(),{'Prefer':'return=minimal'}),
        body:JSON.stringify({valor:fix.valor})
      }).then(function(){
        reg.valor=fix.valor;
      })
    );
  });
  if(promises.length){
    Promise.all(promises).then(function(){
      afOji();
      renderDashboard();
      console.log('Divergências OJI corrigidas ('+promises.length+' registros).');
    });
  }
}

function _iniciarApp(){
  carregarDados().then(function(){
    if(typeof rebuildConsMesFilter==='function') rebuildConsMesFilter();
    af();
    if(typeof rebuildVeicFilter==='function') rebuildVeicFilter();
    if(typeof rebuildOjiMesFilter==='function') rebuildOjiMesFilter();
    if(typeof rebuildOjiAnoFilter==='function') rebuildOjiAnoFilter();
    afOji();
    corrigirDivergenciasOji();
    carregarFrotas().then(function(){
      renderDashboard();
      updateHomeCards();
    });
  });
}

// ── TEMA ──
var _temaSysMq = window.matchMedia('(prefers-color-scheme: dark)');
function _aplicarTema(t){
  if(t==='dark') document.documentElement.setAttribute('data-theme','dark');
  else if(t==='light') document.documentElement.setAttribute('data-theme','light');
  else document.documentElement.setAttribute('data-theme', _temaSysMq.matches?'dark':'light');
}
function setTema(t){
  localStorage.setItem('tema_pref',t);
  _aplicarTema(t);
  _atualizarBtnsTema(t);
}
function _atualizarBtnsTema(t){
  ['light','dark','system'].forEach(function(k){
    var btn=document.getElementById('tema-btn-'+k);
    if(!btn) return;
    var ativo=k===t;
    btn.style.background=ativo?'#1c1917':'';
    btn.style.color=ativo?'#fff':'';
    btn.style.borderColor=ativo?'#1c1917':'#d6d3d1';
  });
  var box=document.getElementById('tema-box');
  if(box){
    box.style.background=t==='dark'?'#1c1917':'';
    box.style.borderColor=t==='dark'?'#44403c':'#e7e5e4';
  }
}
(function(){
  var saved=localStorage.getItem('tema_pref')||'system';
  _aplicarTema(saved);
  _temaSysMq.addEventListener('change',function(){
    if((localStorage.getItem('tema_pref')||'system')==='system') _aplicarTema('system');
  });
  window.addEventListener('DOMContentLoaded',function(){ _atualizarBtnsTema(saved); });
})();

// Carregar dados do Supabase (nuvem) ou localStorage (cache)
verificarLogin();
if(document.getElementById('login-bg').style.display === 'none'){
  _iniciarApp();
}
// Caso não logado: _iniciarApp() é chamado dentro de fazerLogin() após autenticar

// ═══════════════════════════════════════════════════════════════
// TABELA DE FRETE — módulo isolado, consulta + cadastro
// Não toca em CONS, PAG_OJI, nem em nenhuma função do sistema de
// pagamentos. Usa sua própria variável (FRETE) e sua própria tabela
// no Supabase (tabela_frete). Estratégia de salvamento SEGURA:
// nunca apaga antes de confirmar que o novo dado foi inserido.
// ═══════════════════════════════════════════════════════════════
var FRETE = [];
var _freteFiltrado = [];
var _freteSort = {k:'rota', d:1};
var _rotaEditId = null; // uuid da rota em edição, null = nova

function fmtRota(r){ return (r.origem||'')+' \u21c4 '+(r.destino||''); }

// Texto combinado do ped\u00e1gio (ida/volta podem ter valores diferentes).
// Retorna null se nenhum dos dois estiver cadastrado.
function pedagioTxt(r){
  var partes = [];
  if(r.pedagio_ida!=null)  partes.push('Ida '+fR(r.pedagio_ida));
  if(r.pedagio_volta!=null) partes.push('Volta '+fR(r.pedagio_volta));
  return partes.length ? partes.join(' \u00b7 ') : null;
}

function initFrete(){
  Promise.all([carregarCoefPiso(), carregarFrete()]).then(function(){
    filtrarFrete();
    renderCardsFrete();
  });
  carregarColetas().then(function(){
    renderColetasPainel();
  });
  var isADM = !document.body.classList.contains('modo-consulta');
  var btnNova = document.getElementById('btn-nova-rota');
  if(btnNova) btnNova.style.display = isADM ? '' : 'none';
}

function carregarFrete(){
  if(!_sbOnline){
    try{
      var cached = localStorage.getItem('tabela_frete_cache');
      if(cached) FRETE = JSON.parse(cached);
    }catch(e){}
    return Promise.resolve();
  }
  return sbFetch('tabela_frete?select=*&order=origem.asc,destino.asc')
  .then(function(r){
    if(!r.ok) throw new Error('Falha ao buscar tabela_frete (HTTP '+r.status+')');
    return r.json();
  })
  .then(function(rows){
    FRETE = rows.map(function(r){
      return {id:r.id, origem:r.origem, destino:r.destino, km:r.km,
              pedagio_ida:(r.pedagio_ida!=null ? parseFloat(r.pedagio_ida) : null),
              pedagio_volta:(r.pedagio_volta!=null ? parseFloat(r.pedagio_volta) : null),
              pickup:parseFloat(r.pickup)||0, truck:parseFloat(r.truck)||0, carreta:parseFloat(r.carreta)||0};
    });
    try{ localStorage.setItem('tabela_frete_cache', JSON.stringify(FRETE)); }catch(e){}
  })
  .catch(function(e){
    console.warn('Erro ao carregar tabela_frete, usando cache:', e);
    try{
      var cached = localStorage.getItem('tabela_frete_cache');
      if(cached) FRETE = JSON.parse(cached);
    }catch(e2){}
  });
}

function renderCardsFrete(){
  document.getElementById('cards-frete').innerHTML =
    '<div class="card"><div class="card-lbl">Total de rotas cadastradas</div><div class="card-val">'+FRETE.length+'</div><div class="card-sub">consulta de tarifas</div></div>';
}

// Validação da tarifa cadastrada contra o piso mínimo ANTT (aba "Piso ANTT").
// Faixas por margem acima do piso: ≤0% roxo (no piso ou abaixo) · <5% vermelho ·
// 5–15% amarelo · 15–25% azul · ≥25% verde.
function margemPisoCor(margem){
  if(margem<=0) return {cor:'#7c3aed', bg:'#ede9fe'};
  if(margem<5)  return {cor:'#dc2626', bg:'#fee2e2'};
  if(margem<15) return {cor:'#b45309', bg:'#fef9c3'};
  if(margem<25) return {cor:'#2563eb', bg:'#dbeafe'};
  return {cor:'#16a34a', bg:'#dcfce7'};
}

// Piso mínimo da rota = km×CCD + CC, sem pedágio. Decisão do usuário: o
// pedágio cadastrado por rota é só informativo (exibido ao lado da rota) e
// NÃO deve entrar nesse cálculo — não adicionar pedágio aqui.
function pisoMinimoRota(v, km){
  var coef = PISO_COEF[v];
  if(!coef || coef.cc==null || coef.ccd==null || km==null || km==='' || isNaN(km)) return null;
  var piso = km*coef.ccd + coef.cc;
  return piso>0 ? piso : null;
}

function pisoValidacaoRota(v, km, valor){
  var piso = pisoMinimoRota(v, km);
  if(piso==null) return null;
  var margem = (valor-piso)/piso*100;
  var c = margemPisoCor(margem);
  return {piso:piso, margem:margem, cor:c.cor, bg:c.bg};
}

function valorFreteBadge(v, km, valor){
  var val = pisoValidacaoRota(v, km, valor);
  if(!val){
    return '<span style="color:#78716c" title="Cadastre o CC/CCD deste veículo em \'Piso ANTT\' para validar esta tarifa">'+fR(valor)+'</span>';
  }
  var sinal = val.margem>=0 ? '+' : '';
  var titulo = 'Piso ANTT: '+fR(val.piso)+' · '+sinal+val.margem.toFixed(1)+'% sobre o piso';
  return '<span title="'+titulo+'" style="color:'+val.cor+';background:'+val.bg+';padding:2px 7px;border-radius:5px;font-weight:600">'+fR(valor)+'</span>';
}

function pisoMinimoTxt(v, km){
  var piso = pisoMinimoRota(v, km);
  return piso==null ? '—' : fR(piso);
}

// Bloco de um veículo (tarifa + piso mínimo embaixo) usado na linha
// expandida da Tabela de Frete (desktop).
function blocoVeiculoResumo(v, lbl, r){
  return '<div style="background:#fff;border:1px solid #e7e5e4;border-radius:8px;padding:12px;text-align:center">'
    +'<div style="font-size:11px;color:#a8a29e;text-transform:uppercase;letter-spacing:.03em;margin-bottom:6px">'+lbl+'</div>'
    +'<div style="font-size:16px">'+valorFreteBadge(v, r.km, r[v])+'</div>'
    +'<div style="font-size:11px;color:#78716c;margin-top:8px;padding-top:8px;border-top:1px dashed #e7e5e4">Piso mín: <b style="color:#44403c">'+pisoMinimoTxt(v, r.km)+'</b></div>'
    +'</div>';
}

function filtrarFrete(){
  var q = (document.getElementById('frete-busca').value||'').toLowerCase();
  _freteFiltrado = FRETE.filter(function(r){
    var texto = fmtRota(r).toLowerCase();
    return !q || texto.indexOf(q)>=0;
  });
  sortFreteArr();
  renderFrete();
}

function sortFrete(k){
  if(_freteSort.k===k) _freteSort.d*=-1; else {_freteSort.k=k;_freteSort.d=1;}
  document.querySelectorAll('#frete-table thead th').forEach(function(t){ if(!t.classList.contains('ns')) t.className=''; });
  var el=document.getElementById('fth-'+k);
  if(el) el.className = _freteSort.d===1 ? 'asc' : 'desc';
  sortFreteArr();
  renderFrete();
}

function sortFreteArr(){
  var k=_freteSort.k, d=_freteSort.d;
  _freteFiltrado.sort(function(a,b){
    var av = k==='rota' ? fmtRota(a) : a[k];
    var bv = k==='rota' ? fmtRota(b) : b[k];
    if(av===null||av===undefined) return 1;
    if(bv===null||bv===undefined) return -1;
    if(typeof av==='string') return d*av.localeCompare(bv,'pt-BR');
    return d*(av-bv);
  });
}

var _rotaExpandidaId = null; // qual rota está com o resumo aberto no momento

function renderFrete(){
  var tb=document.getElementById('tbody-frete');
  var em=document.getElementById('empty-frete');
  var cardsMobile=document.getElementById('frete-cards-lista');
  var emMobile=document.getElementById('empty-frete-mobile');
  var veiculo = document.getElementById('frete-veiculo-filtro').value;

  // Esconder/mostrar colunas de veículo de acordo com o filtro selecionado
  ['pickup','truck','carreta'].forEach(function(v){
    var th = document.getElementById('fth-'+v);
    var mostrar = !veiculo || veiculo===v;
    if(th) th.style.display = mostrar ? '' : 'none';
  });

  if(!_freteFiltrado.length){
    tb.innerHTML=''; em.style.display='';
    cardsMobile.innerHTML=''; emMobile.style.display='';
  }
  else{
    em.style.display='none';
    emMobile.style.display='none';
    var linhas = '';
    var cardsHtml = '';
    _freteFiltrado.forEach(function(r){
      function celulaVeiculo(v){
        var mostrar = !veiculo || veiculo===v;
        return mostrar ? '<td style="text-align:right;font-weight:500">'+valorFreteBadge(v, r.km, r[v])+'</td>' : '';
      }
      linhas += '<tr class="frete-row" onclick="toggleResumoRota(\''+r.id+'\')" style="cursor:pointer">'
        +'<td style="max-width:280px">'
        +'<div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+fmtRota(r)+'">'+fmtRota(r)+'</div>'
        +'<div style="font-size:11px;margin-top:2px;color:'+(pedagioTxt(r)?'#78716c':'#a8a29e')+'">&#x1F6E3;&#xFE0F; '+(pedagioTxt(r) ? 'Pedágio: '+pedagioTxt(r) : 'Sem pedágio cadastrado')+'</div>'
        +'</td>'
        +celulaVeiculo('pickup')
        +celulaVeiculo('truck')
        +celulaVeiculo('carreta')
        +'</tr>';

      // Linha de resumo expandido, só aparece se esta rota estiver selecionada
      // (desktop). Cada veículo vira um bloco com tarifa + piso mínimo embaixo
      // (igual ao padrão já usado no card mobile), em vez de tudo espremido
      // numa linha só, e o pedágio deixa de aparecer duplicado.
      if(_rotaExpandidaId === r.id){
        var colspan = veiculo ? 2 : 4;
        linhas += '<tr class="frete-resumo-row"><td colspan="'+colspan+'" style="padding:0">'
          +'<div style="background:#fafaf9;border-top:1px solid #e7e5e4;border-bottom:1px solid #e7e5e4;padding:16px">'
          +'<div style="display:flex;gap:20px;font-size:11px;color:#78716c;margin-bottom:14px;padding-bottom:12px;border-bottom:1px dashed #d6d3d1">'
          +'<div><strong style="color:#1c1917">KM:</strong> '+(r.km||'\u2014')+'</div>'
          +'<div><strong style="color:#1c1917">Ped\u00e1gio:</strong> '+(pedagioTxt(r) || '\u2014')+'</div>'
          +'</div>'
          +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">'
          +blocoVeiculoResumo('pickup','Pick-up',r)
          +blocoVeiculoResumo('truck','Truck',r)
          +blocoVeiculoResumo('carreta','Carreta',r)
          +'</div>'
          +'<div style="margin-top:14px;text-align:right">'
          +'<span onclick="abrirModalRota(\''+r.id+'\')" style="font-size:12px;color:#2563eb;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px">Ver detalhes e editar <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>'
          +'</div>'
          +'</div></td></tr>';
      }


      // Card mobile equivalente — acordeão: fechado mostra só rota/km/tarifas;
      // ao tocar, expande (fecha qualquer outra) e mostra o piso mínimo ANTT
      // empilhado embaixo de cada tarifa (usa o mesmo _rotaExpandidaId do
      // resumo do desktop, para manter os dois em sincronia).
      var abertoMobile = _rotaExpandidaId === r.id;

      function valorMobile(v, lbl){
        if(veiculo && veiculo!==v) return '';
        var piso = abertoMobile
          ? '<div class="frete-card-mobile-piso">Piso mín: <b>'+pisoMinimoTxt(v, r.km)+'</b></div>'
          : '';
        return '<div class="frete-card-mobile-valor"><div class="frete-card-mobile-lbl">'+lbl+'</div><div class="frete-card-mobile-num">'+valorFreteBadge(v, r.km, r[v])+'</div>'+piso+'</div>';
      }
      var valoresMobile = valorMobile('pickup','Pick-up') + valorMobile('truck','Truck') + valorMobile('carreta','Carreta');

      cardsHtml += '<div class="frete-card-mobile'+(abertoMobile?' aberto':'')+'">'
        +'<div class="frete-card-mobile-head" onclick="toggleResumoRota(\''+r.id+'\')">'
        +'<div class="frete-card-mobile-rota">'+fmtRota(r)+'</div>'
        +'<div class="frete-card-mobile-km">Km '+(r.km||'\u2014')+'<br><span style="color:'+(pedagioTxt(r)?'#78716c':'#a8a29e')+'">'+(pedagioTxt(r) ? 'Ped\u00e1gio '+pedagioTxt(r) : 'Sem ped\u00e1gio') +'</span></div>'
        +'</div>'
        +'<div class="frete-card-mobile-valores">'+valoresMobile+'</div>'
        + (abertoMobile
            ? '<div class="frete-card-mobile-detalhe" onclick="abrirModalRota(\''+r.id+'\')">Ver detalhes e editar <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></div>'
            : '')
        +'</div>';


    });
    tb.innerHTML = linhas;
    cardsMobile.innerHTML = cardsHtml;
  }
  document.getElementById('frete-count').textContent = _freteFiltrado.length+' de '+FRETE.length+' rotas';
}

function toggleResumoRota(id){
  _rotaExpandidaId = (_rotaExpandidaId === id) ? null : id;
  renderFrete();
}

// Sugere Pick-up/Truck/Carreta a partir do piso ANTT + margem informada.
// Só se aplica ao cadastro de rota NOVA (não mexe em rota em edição) e não
// é persistido — é só um atalho de preenchimento, o usuário confere e salva
// os valores finais como sempre.
function recalcularTarifasSugeridas(){
  if(_rotaEditId) return;
  var km = parseInt(document.getElementById('rota-km').value, 10);
  if(isNaN(km) || km<0) return;
  var margemStr = document.getElementById('rota-margem').value;
  var margem = margemStr==='' ? 0 : parseFloat(String(margemStr).replace(',','.'));
  if(isNaN(margem)) return;
  var fator = 1 + margem/100;
  ['pickup','truck','carreta'].forEach(function(v){
    var piso = pisoMinimoRota(v, km);
    if(piso!=null) document.getElementById('rota-'+v).value = fmtMoedaPiso(piso*fator, 2);
  });
}

function abrirModalRota(id){
  _rotaEditId = id;
  var r = id ? FRETE.find(function(x){return x.id===id;}) : null;
  var isADM = !document.body.classList.contains('modo-consulta');
  document.getElementById('modal-rota-title').textContent = r ? 'Editar rota' : 'Nova rota';
  document.getElementById('rota-origem').value  = r ? r.origem  : 'Piracicaba';
  document.getElementById('rota-destino').value = r ? r.destino : '';
  document.getElementById('rota-km').value      = r ? (r.km||'') : '';
  document.getElementById('rota-pedagio-ida').value   = (r && r.pedagio_ida!=null)   ? 'R$ '+r.pedagio_ida.toFixed(2).replace('.',',')   : '';
  document.getElementById('rota-pedagio-volta').value = (r && r.pedagio_volta!=null) ? 'R$ '+r.pedagio_volta.toFixed(2).replace('.',',') : '';
  document.getElementById('rota-pickup').value  = r ? 'R$ '+r.pickup.toFixed(2).replace('.',',')  : '';
  document.getElementById('rota-truck').value   = r ? 'R$ '+r.truck.toFixed(2).replace('.',',')   : '';
  document.getElementById('rota-carreta').value = r ? 'R$ '+r.carreta.toFixed(2).replace('.',',') : '';
  document.getElementById('rota-margem').value = '';
  document.getElementById('rota-margem-wrap').style.display = r ? 'none' : '';
  document.getElementById('msg-rota').style.display='none';
  var btnExcluir = document.getElementById('btn-excluir-rota-modal');
  btnExcluir.style.display = (r && isADM) ? '' : 'none';
  document.getElementById('modal-rota-bg').style.display='flex';
  document.body.style.overflow='hidden';
  setTimeout(function(){ document.getElementById('rota-destino').focus(); }, 100);
}

function excluirRotaModal(){
  if(_rotaEditId) excluirRota(_rotaEditId, true);
}

function fecharModalRota(){
  document.getElementById('modal-rota-bg').style.display='none';
  document.body.style.overflow='';
}

function parseValFrete(s){
  if(!s) return null;
  var digits = s.replace('R$','').trim();
  if(!digits) return null;
  var n = parseFloat(digits.replace(/\./g,'').replace(',','.'));
  return isNaN(n) ? null : n;
}

// Máscara de moeda para os campos de tarifa do modal
(function(){
  function aplicarMascara(input){
    input.addEventListener('input', function(){
      var digits = input.value.replace(/\D/g,'');
      if(!digits){ input.value=''; return; }
      var num = (parseInt(digits,10)/100).toFixed(2);
      input.value = 'R$ ' + num.replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.');
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    ['rota-pedagio-ida','rota-pedagio-volta','rota-pickup','rota-truck','rota-carreta'].forEach(function(id){
      var el = document.getElementById(id);
      if(el) aplicarMascara(el);
    });
  });
  setTimeout(function(){
    ['rota-pedagio-ida','rota-pedagio-volta','rota-pickup','rota-truck','rota-carreta'].forEach(function(id){
      var el = document.getElementById(id);
      if(el) aplicarMascara(el);
    });
  }, 0);
})();

function salvarRota(){
  var origem  = document.getElementById('rota-origem').value.trim();
  var destino = document.getElementById('rota-destino').value.trim();
  var km      = parseInt(document.getElementById('rota-km').value) || null;
  var pedagioIda   = parseValFrete(document.getElementById('rota-pedagio-ida').value);
  var pedagioVolta = parseValFrete(document.getElementById('rota-pedagio-volta').value);
  var pickup  = parseValFrete(document.getElementById('rota-pickup').value);
  var truck   = parseValFrete(document.getElementById('rota-truck').value);
  var carreta = parseValFrete(document.getElementById('rota-carreta').value);
  var msg = document.getElementById('msg-rota');

  if(!origem || !destino || pickup===null || truck===null || carreta===null){
    msg.className='smsg msg-err';
    msg.textContent='Preencha origem, destino e todas as tarifas corretamente.';
    msg.style.display='block';
    return;
  }

  var payload = {origem:origem, destino:destino, km:km, pedagio_ida:pedagioIda, pedagio_volta:pedagioVolta, pickup:pickup, truck:truck, carreta:carreta};
  var btn = document.querySelector('#modal-rota-bg .btn-apply-all');
  if(btn){ btn.textContent='Salvando...'; btn.disabled=true; }

  var requisicao;
  if(_rotaEditId){
    // Editar: UPDATE direto pelo id, nunca apaga nada
    requisicao = sbFetch('tabela_frete?id=eq.'+_rotaEditId, {
      method:'PATCH',
      headers: Object.assign({}, sbHeaders(), {'Prefer':'return=representation'}),
      body: JSON.stringify(payload)
    });
  } else {
    // Nova: INSERT simples
    requisicao = sbFetch('tabela_frete', {
      method:'POST',
      headers: Object.assign({}, sbHeaders(), {'Prefer':'return=representation'}),
      body: JSON.stringify([payload])
    });
  }

  requisicao.then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  })
  .then(function(resultado){
    var salvo = Array.isArray(resultado) ? resultado[0] : resultado;
    var item = {id:salvo.id, origem:salvo.origem, destino:salvo.destino, km:salvo.km,
                pedagio_ida:(salvo.pedagio_ida!=null ? parseFloat(salvo.pedagio_ida) : null),
                pedagio_volta:(salvo.pedagio_volta!=null ? parseFloat(salvo.pedagio_volta) : null),
                pickup:parseFloat(salvo.pickup), truck:parseFloat(salvo.truck), carreta:parseFloat(salvo.carreta)};
    if(_rotaEditId){
      var idx = FRETE.findIndex(function(x){return x.id===_rotaEditId;});
      if(idx>=0) FRETE[idx]=item;
    } else {
      FRETE.push(item);
    }
    try{ localStorage.setItem('tabela_frete_cache', JSON.stringify(FRETE)); }catch(e){}
    fecharModalRota();
    filtrarFrete();
    renderCardsFrete();
  })
  .catch(function(e){
    console.error('Erro ao salvar rota:', e);
    msg.className='smsg msg-err';
    msg.textContent='Erro ao salvar no servidor. Verifique sua conex\u00e3o e tente novamente.';
    msg.style.display='block';
  })
  .finally(function(){
    if(btn){ btn.innerHTML='&#x2713; Salvar rota'; btn.disabled=false; }
  });
}

function excluirRota(id, fecharModal){
  var r = FRETE.find(function(x){return x.id===id;});
  if(!r) return;
  if(!confirm('Excluir a rota '+fmtRota(r)+'?\n\nEsta a\u00e7\u00e3o n\u00e3o pode ser desfeita.')) return;

  var delHeaders = Object.assign({}, sbHeaders(), {'Prefer':'return=minimal'});
  sbFetch('tabela_frete?id=eq.'+id, {method:'DELETE', headers: delHeaders})
  .then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status);
    FRETE = FRETE.filter(function(x){return x.id!==id;});
    try{ localStorage.setItem('tabela_frete_cache', JSON.stringify(FRETE)); }catch(e){}
    if(_rotaExpandidaId === id) _rotaExpandidaId = null;
    if(fecharModal) fecharModalRota();
    filtrarFrete();
    renderCardsFrete();
  })
  .catch(function(e){
    console.error('Erro ao excluir rota:', e);
    alert('Erro ao excluir a rota no servidor. Tente novamente.');
  });
}

// ═══════════════════════════════════════════════════════════════
// COLETAS ADICIONAIS — painel editável, totalmente isolado.
// Não toca em CONS, PAG_OJI, nem em FRETE (tabela_frete). Usa sua
// própria variável (COLETAS) e sua própria tabela no Supabase
// (coletas_adicionais). Estratégia segura: UPDATE direto pelo
// "grupo" (chave única), nunca apaga/recria a tabela inteira.
// ═══════════════════════════════════════════════════════════════
var COLETAS = {fora:null, piracicaba:null};
var _coletaEditGrupo = null;

function carregarColetas(){
  if(!_sbOnline){
    try{
      var cached = localStorage.getItem('coletas_adicionais_cache');
      if(cached) COLETAS = JSON.parse(cached);
    }catch(e){}
    return Promise.resolve();
  }
  return sbFetch('coletas_adicionais?select=*')
  .then(function(r){
    if(!r.ok) throw new Error('Falha ao buscar coletas_adicionais (HTTP '+r.status+')');
    return r.json();
  })
  .then(function(rows){
    rows.forEach(function(r){
      COLETAS[r.grupo] = {pickup:r.pickup, truck:r.truck, carreta:r.carreta};
    });
    try{ localStorage.setItem('coletas_adicionais_cache', JSON.stringify(COLETAS)); }catch(e){}
  })
  .catch(function(e){
    console.warn('Erro ao carregar coletas_adicionais, usando cache:', e);
    try{
      var cached = localStorage.getItem('coletas_adicionais_cache');
      if(cached) COLETAS = JSON.parse(cached);
    }catch(e2){}
  });
}

function fmtColeta(v){
  if(!v) return '\u2014';
  var s = String(v).trim();
  if(s.toLowerCase()==='spot') return 'Spot (negociado)';
  var n = parseFloat(s.replace(',','.'));
  return isNaN(n) ? s : fR(n);
}

function renderColetasPainel(){
  var painel = document.getElementById('coletas-painel');
  var isADM = !document.body.classList.contains('modo-consulta');

  function card(grupo, titulo){
    var d = COLETAS[grupo] || {pickup:null, truck:null, carreta:null};
    var btnEdit = isADM
      ? '<button class="vei-ok" onclick="editarColeta(\''+grupo+'\')" title="Editar" style="margin-left:8px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>'
      : '';
    return '<div class="card" id="coleta-card-'+grupo+'">'
      +'<div class="card-lbl">'+titulo+btnEdit+'</div>'
      +'<div id="coleta-view-'+grupo+'">'
      +'<div style="font-size:13px;margin-top:8px"><strong>Pick-up:</strong> '+fmtColeta(d.pickup)+'</div>'
      +'<div style="font-size:13px;margin-top:4px"><strong>Truck:</strong> '+fmtColeta(d.truck)+'</div>'
      +'<div style="font-size:13px;margin-top:4px"><strong>Carreta:</strong> '+fmtColeta(d.carreta)+'</div>'
      +'</div>'
      +'</div>';
  }

  painel.innerHTML = card('fora','Coleta Adicional Fora de Piracicaba') + card('piracicaba','Coleta Adicional em Piracicaba');
}

function editarColeta(grupo){
  _coletaEditGrupo = grupo;
  var d = COLETAS[grupo] || {pickup:null, truck:null, carreta:null};
  var view = document.getElementById('coleta-view-'+grupo);

  function campo(label, id, valor){
    return '<div style="margin-top:8px">'
      +'<label style="font-size:11px;color:#78716c;display:block;margin-bottom:3px">'+label+' <span style="font-size:10px">(deixe "Spot" se n\u00e3o tiver valor fixo)</span></label>'
      +'<input type="text" id="'+id+'" value="'+(valor||'')+'" placeholder="Ex: 135,00 ou Spot" '
      +'style="height:32px;padding:0 8px;border:1px solid #d6d3d1;border-radius:6px;font-size:13px;width:100%;outline:none">'
      +'</div>';
  }

  view.innerHTML =
    campo('Pick-up','coleta-edit-'+grupo+'-pickup', d.pickup)
    + campo('Truck','coleta-edit-'+grupo+'-truck', d.truck)
    + campo('Carreta','coleta-edit-'+grupo+'-carreta', d.carreta)
    + '<div style="display:flex;gap:6px;margin-top:10px">'
    + '<button class="btn btn-ghost" style="height:28px;padding:0 10px;font-size:12px" onclick="cancelarEdicaoColeta(\''+grupo+'\')">Cancelar</button>'
    + '<button class="btn btn-dark" style="height:28px;padding:0 10px;font-size:12px" onclick="salvarColeta(\''+grupo+'\')">&#x2713; Salvar</button>'
    + '</div>';
}

function cancelarEdicaoColeta(grupo){
  renderColetasPainel();
}

function salvarColeta(grupo){
  var pickup  = document.getElementById('coleta-edit-'+grupo+'-pickup').value.trim();
  var truck   = document.getElementById('coleta-edit-'+grupo+'-truck').value.trim();
  var carreta = document.getElementById('coleta-edit-'+grupo+'-carreta').value.trim();

  var payload = {pickup:pickup||null, truck:truck||null, carreta:carreta||null};

  sbFetch('coletas_adicionais?grupo=eq.'+grupo, {
    method:'PATCH',
    headers: Object.assign({}, sbHeaders(), {'Prefer':'return=representation'}),
    body: JSON.stringify(payload)
  })
  .then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  })
  .then(function(resultado){
    var salvo = Array.isArray(resultado) ? resultado[0] : resultado;
    COLETAS[grupo] = {pickup:salvo.pickup, truck:salvo.truck, carreta:salvo.carreta};
    try{ localStorage.setItem('coletas_adicionais_cache', JSON.stringify(COLETAS)); }catch(e){}
    renderColetasPainel();
  })
  .catch(function(e){
    console.error('Erro ao salvar coleta adicional:', e);
    alert('Erro ao salvar no servidor. Verifique sua conex\u00e3o e tente novamente.');
  });
}

function imprimirRotasFrete(){
  var veiculo = document.getElementById('frete-veiculo-filtro').value;
  var veiculoLabel = veiculo === 'pickup' ? 'Pick-up' : veiculo === 'truck' ? 'Truck' : veiculo === 'carreta' ? 'Carreta' : 'Todos os ve\u00edculos';
  var gerado = new Date().toLocaleDateString('pt-BR')+' \u00e0s '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  var incluirPedagio = document.getElementById('rel-incluir-pedagio').checked;
  var incluirPiso = document.getElementById('rel-incluir-piso').checked;

  function celVeiculoImpressa(v, r){
    return '<td class="num"><div class="cel-tarifa">'+fR(r[v])+'</div>'
      +(incluirPiso ? '<div class="cel-piso">Piso: '+pisoMinimoTxt(v, r.km)+'</div>' : '')
      +'</td>';
  }

  var colunas = veiculo ? [veiculoLabel] : ['Pick-up','Truck','Carreta'];

  var linhas = _freteFiltrado.map(function(r){
    var celulasHtml = veiculo
      ? celVeiculoImpressa(veiculo, r)
      : celVeiculoImpressa('pickup',r) + celVeiculoImpressa('truck',r) + celVeiculoImpressa('carreta',r);

    var metaPartes = ['KM '+(r.km||'\u2014')];
    if(incluirPedagio) metaPartes.push(pedagioTxt(r) || 'Sem ped\u00e1gio cadastrado');

    return '<tr><td><div class="cel-rota">'+fmtRota(r)+'</div><div class="cel-meta">'+metaPartes.join(' &middot; ')+'</div></td>'+celulasHtml+'</tr>';
  }).join('');

  var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">'
    +'<title>Tabela de Frete</title>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0}'
    +'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12px;color:#1c1917;padding:24px}'
    +'@media print{body{padding:0}@page{margin:14mm}}'
    +'table{width:100%;border-collapse:collapse;font-size:11px}'
    +'thead th{background:#f5f5f4;padding:6px 10px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4}'
    +'tbody tr:nth-child(even){background:#fafaf9}'
    +'td{border-bottom:1px solid #f5f5f4}'
    +'.rel-tabela td.num,.rel-tabela th.num{text-align:right}'
    +'.rel-tabela td{vertical-align:top;padding:5px 8px}'
    +'.rel-tabela th{padding:5px 8px}'
    +'.cel-rota{font-weight:600}'
    +'.cel-meta{font-size:9px;color:#a8a29e;margin-top:1px}'
    +'.cel-tarifa{font-weight:700;font-size:11px}'
    +'.cel-piso{font-size:8.5px;color:#78716c;margin-top:1px}'
    +'</style></head><body>'
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #1c1917">'
    +'<div><div style="font-size:20px;font-weight:700">Tabela de Frete</div>'
    +'<div style="font-size:12px;color:#78716c;margin-top:3px">Filtro: '+veiculoLabel+'</div></div>'
    +'<div style="text-align:right"><div style="font-size:11px;color:#78716c">Gerado em</div>'
    +'<div style="font-size:12px;font-weight:600">'+gerado+'</div>'
    +'<div style="font-size:11px;color:#78716c;margin-top:2px">'+_freteFiltrado.length+' rotas</div></div>'
    +'</div>'
    +'<table class="rel-tabela"><thead><tr><th>Rota</th>'+colunas.map(function(c){return '<th class="num">'+c+'</th>';}).join('')+'</tr></thead>'
    +'<tbody>'+linhas+'</tbody></table>'
    +'<div style="margin-top:24px;padding-top:14px;border-top:2px solid #1c1917">'
    +'<div style="font-size:14px;font-weight:700;margin-bottom:10px">Coletas Adicionais</div>'
    +'<table><thead><tr>'
    +'<th>Grupo</th><th style="text-align:right">Pick-up</th><th style="text-align:right">Truck</th><th style="text-align:right">Carreta</th>'
    +'</tr></thead><tbody>'
    +'<tr><td style="padding:6px 10px;font-weight:600">Coleta Adicional Fora de Piracicaba</td>'
    +'<td style="padding:6px 10px;text-align:right">'+fmtColeta((COLETAS.fora||{}).pickup)+'</td>'
    +'<td style="padding:6px 10px;text-align:right">'+fmtColeta((COLETAS.fora||{}).truck)+'</td>'
    +'<td style="padding:6px 10px;text-align:right">'+fmtColeta((COLETAS.fora||{}).carreta)+'</td></tr>'
    +'<tr><td style="padding:6px 10px;font-weight:600">Coleta Adicional em Piracicaba</td>'
    +'<td style="padding:6px 10px;text-align:right">'+fmtColeta((COLETAS.piracicaba||{}).pickup)+'</td>'
    +'<td style="padding:6px 10px;text-align:right">'+fmtColeta((COLETAS.piracicaba||{}).truck)+'</td>'
    +'<td style="padding:6px 10px;text-align:right">'+fmtColeta((COLETAS.piracicaba||{}).carreta)+'</td></tr>'
    +'</tbody></table>'
    +'</div>'
    +'</body></html>';

  var w = window.open('','_blank');
  if(!w){ alert('Pop-up bloqueado. Permita pop-ups para este site.'); return; }
  w.document.write(html);
  w.document.close();
  w.onload = function(){ w.print(); };
}
// ═══════════════════════════════════════════════════════════════
// PISO MÍNIMO ANTT — módulo isolado, cadastro de coeficientes
// (CC/CCD por veículo) + calculadora de piso mínimo de frete.
// Guarda os coeficientes em localStorage porque são reajustados
// por resolução da ANTT: quem mantém o valor correto é o usuário.
// ═══════════════════════════════════════════════════════════════
var PISO_COEF = {truck:{cc:null,ccd:null}, carreta:{cc:null,ccd:null}, pickup:{cc:null,ccd:null}};
var PISO_TABELA = {truck:'A', carreta:'A', pickup:'C'};
var PISO_EIXOS  = {truck:3, carreta:5, pickup:2};
var FROTAS = [];

function initPiso(){
  carregarCoefPiso();
  carregarFrotas();
  var isADM = !document.body.classList.contains('modo-consulta');
  var btn = document.getElementById('btn-salvar-coef-piso');
  if(btn) btn.style.display = isADM ? '' : 'none';
  var pf = document.getElementById('frotas-form');
  if(pf) pf.style.display = isADM ? '' : 'none';
}

