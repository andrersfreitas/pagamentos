// ── FROTAS ────────────────────────────────────────────────
function carregarFrotas(){
  if(!_sbOnline){
    try{ FROTAS = JSON.parse(localStorage.getItem('frotas_cache')) || []; }catch(e){ FROTAS=[]; }
    renderFrotas();
    return Promise.resolve();
  }
  return sbFetch('frotas?select=*&order=placa.asc')
  .then(function(r){ return r.ok ? r.json() : []; })
  .then(function(rows){
    FROTAS = rows;
    try{ localStorage.setItem('frotas_cache', JSON.stringify(FROTAS)); }catch(e){}
    renderFrotas();
  })
  .catch(function(e){
    console.warn('Erro ao carregar frotas, usando cache:', e);
    try{ FROTAS = JSON.parse(localStorage.getItem('frotas_cache')) || []; }catch(e2){ FROTAS=[]; }
    renderFrotas();
  });
}

function renderFrotas(){
  var tbody = document.getElementById('frotas-tbody');
  var resumo = document.getElementById('frotas-resumo');
  if(!tbody) return;

  var cores = {pickup:'#5b21b6;background:#ede9fe', truck:'#1d4ed8;background:#dbeafe', carreta:'#92400e;background:#fef3c7'};
  var nomes = {pickup:'Pickup', truck:'Truck', carreta:'Carreta'};

  // Resumo por tipo
  var contagem = {pickup:0, truck:0, carreta:0};
  FROTAS.forEach(function(f){ if(contagem[f.tipo]!==undefined) contagem[f.tipo]++; });
  resumo.innerHTML = ['pickup','truck','carreta'].map(function(t){
    if(!contagem[t]) return '';
    var s=cores[t].split(';background:');
    return '<span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:100px;font-size:12px;color:'+s[0]+';background:'+s[1]+'">'
      +'<strong>'+contagem[t]+'</strong> '+nomes[t]+(contagem[t]>1?'s':'')+'</span>';
  }).join('');

  if(!FROTAS.length){
    tbody.innerHTML = '<tr><td colspan="4" style="padding:16px 0;color:#78716c;font-size:13px">Nenhum ve&#xED;culo cadastrado ainda.</td></tr>';
    return;
  }
  tbody.innerHTML = FROTAS.map(function(f){
    var s=cores[f.tipo]?cores[f.tipo].split(';background:'):['#78716c','#f5f5f4'];
    return '<tr>'
      +'<td style="padding:10px 12px 10px 0;border-bottom:1px solid #f5f5f4;font-weight:600;white-space:nowrap">'+esc(f.placa)+'</td>'
      +'<td style="padding:10px 12px 10px 0;border-bottom:1px solid #f5f5f4"><span style="padding:2px 10px;border-radius:100px;font-size:12px;font-weight:500;color:'+(s[0]||'#444')+';background:'+(s[1]||'#eee')+'">'+(nomes[f.tipo]||f.tipo)+'</span></td>'
      +'<td style="padding:10px 12px 10px 0;border-bottom:1px solid #f5f5f4;color:#78716c">'+esc(f.descricao||'')+'</td>'
      +'<td style="padding:10px 0;border-bottom:1px solid #f5f5f4"><button onclick="removerFrota(\''+esc(f.placa)+'\')" style="height:26px;padding:0 10px;border-radius:6px;border:1px solid #fca5a5;background:#fee2e2;color:#991b1b;font-size:11px;cursor:pointer">Remover</button></td>'
      +'</tr>';
  }).join('');
}

function adicionarFrota(){
  var placa = (document.getElementById('frota-placa').value||'').trim().toUpperCase();
  var tipo  = document.getElementById('frota-tipo').value;
  var desc  = (document.getElementById('frota-desc').value||'').trim();
  var msg   = document.getElementById('msg-frotas');
  if(!placa){ msg.textContent='Informe a placa.'; msg.style.color='#dc2626'; return; }
  if(!tipo){  msg.textContent='Selecione o tipo.'; msg.style.color='#dc2626'; return; }
  if(FROTAS.some(function(f){ return f.placa===placa; })){
    msg.textContent='Placa '+placa+' já cadastrada.'; msg.style.color='#dc2626'; return;
  }
  msg.textContent='Salvando...'; msg.style.color='#78716c';
  var nova = {placa:placa, tipo:tipo, descricao:desc};
  if(!_sbOnline){
    FROTAS.push(nova);
    try{ localStorage.setItem('frotas_cache', JSON.stringify(FROTAS)); }catch(e){}
    renderFrotas();
    document.getElementById('frota-placa').value='';
    document.getElementById('frota-tipo').value='';
    document.getElementById('frota-desc').value='';
    msg.textContent='✓ '+placa+' adicionado (offline — sincronizará ao conectar).'; msg.style.color='#16a34a';
    return;
  }
  sbFetch('frotas', {
    method:'POST',
    headers: Object.assign({}, sbHeaders(), {'Prefer':'resolution=merge-duplicates,return=representation'}),
    body: JSON.stringify(nova)
  })
  .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
  .then(function(){
    FROTAS.push(nova);
    try{ localStorage.setItem('frotas_cache', JSON.stringify(FROTAS)); }catch(e){}
    renderFrotas();
    document.getElementById('frota-placa').value='';
    document.getElementById('frota-tipo').value='';
    document.getElementById('frota-desc').value='';
    msg.textContent='✓ '+placa+' adicionado!'; msg.style.color='#16a34a';
    setTimeout(function(){ msg.textContent=''; },3000);
  })
  .catch(function(e){ msg.textContent='Erro: '+e.message; msg.style.color='#dc2626'; });
}

function removerFrota(placa){
  if(!confirm('Remover a placa '+placa+'?')) return;
  if(!_sbOnline){
    FROTAS = FROTAS.filter(function(f){ return f.placa!==placa; });
    try{ localStorage.setItem('frotas_cache', JSON.stringify(FROTAS)); }catch(e){}
    renderFrotas();
    return;
  }
  sbFetch('frotas?placa=eq.'+encodeURIComponent(placa), {method:'DELETE', headers:sbHeaders()})
  .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); })
  .then(function(){
    FROTAS = FROTAS.filter(function(f){ return f.placa!==placa; });
    try{ localStorage.setItem('frotas_cache', JSON.stringify(FROTAS)); }catch(e){}
    renderFrotas();
  })
  .catch(function(e){ alert('Erro ao remover: '+e.message); });
}

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Coeficientes ANTT — sincronizados com o Supabase (tabela antt_coeficientes)
// para funcionar igual em qualquer dispositivo, com fallback em cache local
// quando estiver offline. Mesma estratégia segura da tabela_frete/coletas_adicionais.
function carregarCoefPiso(){
  if(!_sbOnline){
    try{
      var cached = localStorage.getItem('antt_coef_cache');
      if(cached) PISO_COEF = JSON.parse(cached);
    }catch(e){}
    preencherCamposCoefPiso();
    return Promise.resolve();
  }
  return sbFetch('antt_coeficientes?select=*')
  .then(function(r){
    if(!r.ok) throw new Error('Falha ao buscar antt_coeficientes (HTTP '+r.status+')');
    return r.json();
  })
  .then(function(rows){
    var daNuvem = {};
    rows.forEach(function(r){ daNuvem[r.veiculo] = {cc:parseFloat(r.cc), ccd:parseFloat(r.ccd)}; });

    var cacheLocal = {};
    try{ cacheLocal = JSON.parse(localStorage.getItem('antt_coef_cache')) || {}; }catch(e){}

    // Se algum veículo ainda não está na nuvem (ex: foi salvo antes de a
    // sincronização com o Supabase existir), usa o valor do cache local
    // deste navegador em vez de sobrescrever com vazio, e migra esse valor
    // para a nuvem automaticamente — assim nada que já estava salvo se perde.
    var novo = {truck:{cc:null,ccd:null}, carreta:{cc:null,ccd:null}, pickup:{cc:null,ccd:null}};
    var faltamNaNuvem = [];
    ['truck','carreta','pickup'].forEach(function(v){
      if(daNuvem[v]){
        novo[v] = daNuvem[v];
      } else if(cacheLocal[v] && cacheLocal[v].cc!=null && cacheLocal[v].ccd!=null){
        novo[v] = cacheLocal[v];
        faltamNaNuvem.push(v);
      }
    });

    PISO_COEF = novo;
    try{ localStorage.setItem('antt_coef_cache', JSON.stringify(PISO_COEF)); }catch(e){}

    if(faltamNaNuvem.length){
      upsertCoefPisoSupabase(novo).catch(function(e){
        console.warn('Erro ao migrar coeficientes ANTT do cache local para o Supabase:', e);
      });
    }
  })
  .catch(function(e){
    console.warn('Erro ao carregar antt_coeficientes, usando cache:', e);
    try{
      var cached = localStorage.getItem('antt_coef_cache');
      if(cached) PISO_COEF = JSON.parse(cached);
    }catch(e2){}
  })
  .then(preencherCamposCoefPiso);
}

function upsertCoefPisoSupabase(coef){
  var payload = ['truck','carreta','pickup'].map(function(v){
    return {veiculo:v, cc:coef[v].cc, ccd:coef[v].ccd};
  });
  return sbFetch('antt_coeficientes', {
    method:'POST',
    headers: Object.assign({}, sbHeaders(), {'Prefer':'resolution=merge-duplicates,return=representation'}),
    body: JSON.stringify(payload)
  })
  .then(function(r){
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.json();
  });
}

function preencherCamposCoefPiso(){
  ['truck','carreta','pickup'].forEach(function(v){
    var coef = PISO_COEF[v] || {};
    document.getElementById('piso-cc-'+v).value  = (coef.cc!=null)  ? fmtMoedaPiso(coef.cc, 4)  : '';
    document.getElementById('piso-ccd-'+v).value = (coef.ccd!=null) ? fmtMoedaPiso(coef.ccd, 4) : '';
  });
}

function fmtMoedaPiso(n, casas){
  casas = casas || 2;
  return 'R$ '+n.toFixed(casas).replace('.',',').replace(/(\d)(?=(\d{3})+,)/g, '$1.');
}

function salvarCoefPiso(){
  var msg = document.getElementById('msg-piso-coef');
  var novo = {};
  var ok = true;
  ['truck','carreta','pickup'].forEach(function(v){
    var cc  = parseValFrete(document.getElementById('piso-cc-'+v).value);
    var ccd = parseValFrete(document.getElementById('piso-ccd-'+v).value);
    if(cc===null || ccd===null) ok=false;
    novo[v] = {cc:cc, ccd:ccd};
  });
  if(!ok){
    msg.className='smsg msg-err'; msg.style.display='block';
    msg.textContent='Preencha o CC e o CCD de todos os veículos antes de salvar.';
    return;
  }

  var btn = document.getElementById('btn-salvar-coef-piso');
  if(btn){ btn.textContent='Salvando...'; btn.disabled=true; }

  upsertCoefPisoSupabase(novo)
  .then(function(){
    PISO_COEF = novo;
    try{ localStorage.setItem('antt_coef_cache', JSON.stringify(PISO_COEF)); }catch(e){}
    msg.className='smsg msg-ok'; msg.style.display='block';
    msg.textContent='Coeficientes salvos. Já disponíveis em qualquer dispositivo.';
  })
  .catch(function(e){
    console.error('Erro ao salvar antt_coeficientes:', e);
    msg.className='smsg msg-err'; msg.style.display='block';
    msg.textContent='Erro ao salvar no servidor. Verifique sua conexão e tente novamente.';
  })
  .then(function(){
    if(btn){ btn.textContent='✓ Salvar coeficientes'; btn.disabled=false; }
  });
}

function calcularPiso(){
  var veiculo  = document.getElementById('piso-veiculo').value;
  var km       = parseFloat(document.getElementById('piso-km').value);
  var pedagio  = parseValFrete(document.getElementById('piso-pedagio').value) || 0;
  var cobrado  = parseValFrete(document.getElementById('piso-cobrado').value);
  var coef     = PISO_COEF[veiculo];
  var resultado = document.getElementById('piso-resultado');
  var cards     = document.getElementById('piso-resultado-cards');
  var msg       = document.getElementById('piso-resultado-msg');

  resultado.style.display='block';
  cards.innerHTML='';

  if(!coef || coef.cc==null || coef.ccd==null){
    msg.className='smsg msg-err'; msg.style.display='block';
    msg.textContent='Cadastre o CC e o CCD deste veículo em "Coeficientes ANTT" antes de calcular.';
    return;
  }
  if(isNaN(km) || km<0){
    msg.className='smsg msg-err'; msg.style.display='block';
    msg.textContent='Informe uma distância (km) válida.';
    return;
  }

  var pisoSemPedagio = km*coef.ccd + coef.cc;
  var pisoTotal = pisoSemPedagio + pedagio;

  cards.innerHTML =
    mkC('accent','Tabela usada','Tabela '+PISO_TABELA[veiculo], PISO_EIXOS[veiculo]+' eixos')
    + mkC('','Piso sem pedágio', fR(pisoSemPedagio), 'distância × CCD + CC')
    + mkC('','Piso mínimo total', fR(pisoTotal), 'piso + pedágio ('+fR(pedagio)+')');

  if(cobrado===null){
    msg.className='smsg'; msg.style.cssText='display:block;background:#f5f5f4;color:#57534e;margin-top:14px';
    msg.textContent='Informe o valor do frete cobrado para comparar com o piso mínimo.';
  } else if(cobrado + 1e-9 >= pisoTotal){
    msg.className='smsg msg-ok'; msg.style.cssText='display:block;margin-top:14px';
    msg.textContent='Frete cobrado ('+fR(cobrado)+') está ACIMA ou igual ao piso mínimo ('+fR(pisoTotal)+'). Diferença: +'+fR(cobrado-pisoTotal)+'.';
  } else {
    msg.className='smsg msg-err'; msg.style.cssText='display:block;margin-top:14px';
    msg.textContent='Frete cobrado ('+fR(cobrado)+') está ABAIXO do piso mínimo ('+fR(pisoTotal)+'). Faltam '+fR(pisoTotal-cobrado)+' para atingir o piso.';
  }
}

// Máscara de moeda para os campos de coeficientes (4 casas decimais, conforme
// publicado nas resoluções da ANTT) e da calculadora de piso (2 casas, R$).
(function(){
  function aplicarMascara(input, casas){
    input.addEventListener('input', function(){
      var digits = input.value.replace(/\D/g,'');
      if(!digits){ input.value=''; return; }
      var num = (parseInt(digits,10)/Math.pow(10,casas)).toFixed(casas);
      input.value = 'R$ ' + num.replace('.', ',').replace(/(\d)(?=(\d{3})+,)/g, '$1.');
    });
  }
  var idsCoef  = ['piso-cc-truck','piso-ccd-truck','piso-cc-carreta','piso-ccd-carreta','piso-cc-pickup','piso-ccd-pickup'];
  var idsValor = ['piso-pedagio','piso-cobrado'];
  function iniciar(){
    idsCoef.forEach(function(id){
      var el = document.getElementById(id);
      if(el) aplicarMascara(el, 4);
    });
    idsValor.forEach(function(id){
      var el = document.getElementById(id);
      if(el) aplicarMascara(el, 2);
    });
  }
  document.addEventListener('DOMContentLoaded', iniciar);
  setTimeout(iniciar, 0);
})();
