// ── SUPABASE + LOCALSTORAGE ─────────────────────────────
var SB_URL = 'https://dvhtasursksfniybiiiy.supabase.co';
var SB_KEY = 'sb_publishable_ExPE_zDxixTTjYe6H4-17Q_6RYCHoYT';
var LS_KEY = 'pagamentos_nfs_cte_dados';
var _autoSaveTimer = null;
var _sbOnline = false;
var _lastSyncHash = null;

// Sincronização por registro (consolidado/pagamentos_oji): em vez de apagar
// tudo e reinserir a cada autosave, guardamos os ids já conhecidos na nuvem
// (pra detectar exclusões) e um "fingerprint" do último estado enviado de
// cada registro (pra não reenviar o que não mudou).
var _consIdsCarregados = [];
var _pagIdsCarregados = [];
var _consSyncCache = {};
var _pagSyncCache = {};

// ── API Supabase ──
function sbHeaders(){
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': 'Bearer ' + SB_KEY,
    'Prefer': 'return=minimal'
  };
}

function sbFetch(path, opts){
  return fetch(SB_URL + '/rest/v1/' + path, Object.assign({headers: sbHeaders()}, opts));
}

// Busca TODAS as linhas de uma consulta, paginando com o header Range do
// PostgREST. Isso evita que um limite de "Max Rows" configurado no painel
// do Supabase (que trunca silenciosamente qualquer consulta, mesmo com
// ?limit= maior) faça o sistema carregar menos registros do que existem.
function sbFetchAll(path){
  var all = [];
  var TAM_PAGINA = 1000;
  function buscarPagina(offset){
    return sbFetch(path, {
      headers: Object.assign({}, sbHeaders(), {
        'Range-Unit': 'items',
        'Range': offset+'-'+(offset+TAM_PAGINA-1),
        'Prefer': 'count=exact'
      })
    })
    .then(function(r){
      if(!r.ok && r.status!==206) throw new Error('HTTP '+r.status);
      var contentRange = r.headers.get('content-range') || '';
      var total = parseInt(contentRange.split('/')[1], 10);
      return r.json().then(function(rows){
        all = all.concat(rows);
        if(rows.length>0 && !isNaN(total) && all.length<total){
          return buscarPagina(offset+rows.length);
        }
        return all;
      });
    });
  }
  return buscarPagina(0);
}

// Testar conexão ao Supabase
function testarConexao(){
  return sbFetch('consolidado?limit=1')
    .then(function(r){ _sbOnline = r.ok; return r.ok; })
    .catch(function(){ _sbOnline = false; return false; });
}

function setBadge(txt, ok){
  var badge = document.getElementById('autosave-badge');
  badge.textContent = txt;
  badge.style.background = ok ? '#dcfce7' : '#fef3c7';
  badge.style.color      = ok ? '#15803d' : '#92400e';
  badge.style.borderColor= ok ? '#bbf7d0' : '#fde68a';
  badge.style.display = '';

  // Espelhar no dot compacto e no painel de detalhe do mobile
  var dot = document.getElementById('sync-dot-mobile');
  if(dot){
    dot.style.background = ok ? '#dcfce7' : '#fef3c7';
    dot.style.color      = ok ? '#15803d' : '#92400e';
  }
  var detalhe = document.getElementById('sync-detalhe-mobile');
  if(detalhe) detalhe.textContent = txt;
}

function toggleSyncDetalheMobile(){
  var el = document.getElementById('sync-detalhe-mobile');
  el.style.display = (el.style.display === 'none' || !el.style.display) ? '' : 'none';
}

function toggleMenuAcoesMobile(){
  var dd = document.getElementById('dropdown-acoes-mobile');
  dd.style.display = (dd.style.display === 'none' || !dd.style.display) ? '' : 'none';
}
document.addEventListener('click', function(e){
  var menu = document.getElementById('menu-acoes-mobile');
  if(menu && !menu.contains(e.target)){
    var dd = document.getElementById('dropdown-acoes-mobile');
    if(dd) dd.style.display = 'none';
  }
});

function marcarAlteracao(){
  var el = document.getElementById('topbar-count');
  if(el) el.textContent = CONS.length + ' documentos';
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(autoSave, 1500);
}

// ── AUTOSAVE: Supabase + localStorage ──
function autoSave(){
  CONS.forEach(function(r){ var s=calcSt(r.pgto,r.venc); r.stKey=s.key; r.stLbl=s.lbl; });

  // \u2500\u2500 TRAVA DE SEGURAN\u00c7A CONTRA QUEDA SUSPEITA DE DADOS \u2500\u2500
  // sincronizarSupabase() apaga tudo na nuvem e reinsere o que est\u00e1 em
  // mem\u00f3ria. Se por qualquer bug/timing os arrays CONS/PAG_OJI estiverem
  // suspeitosamente menores que o \u00faltimo cache confi\u00e1vel (ex: caiu a zero,
  // ou caiu mais da metade), interrompe ANTES de sobrescrever o cache local
  // e ANTES de sincronizar \u2014 evita repetir a perda de dados dos Pagamentos Oji.
  var cacheAnteriorRaw = localStorage.getItem(LS_KEY);
  var cacheAnterior = null;
  try{ if(cacheAnteriorRaw) cacheAnterior = JSON.parse(cacheAnteriorRaw); }catch(e){}
  if(cacheAnterior){
    var qtdConsAntes = (cacheAnterior.CONS||[]).length;
    var qtdPagAntes  = (cacheAnterior.PAG_OJI||[]).length;
    var quedaCons = qtdConsAntes>=5 && CONS.length    < qtdConsAntes*0.5;
    var quedaPag  = qtdPagAntes>=5  && PAG_OJI.length  < qtdPagAntes*0.5;
    if(quedaCons || quedaPag){
      console.error('autoSave BLOQUEADO \u2014 queda suspeita de dados em mem\u00f3ria:',
        {consAntes:qtdConsAntes, consAgora:CONS.length, pagAntes:qtdPagAntes, pagAgora:PAG_OJI.length});
      setBadge('\u26a0 Sincroniza\u00e7\u00e3o bloqueada \u2014 queda suspeita (Consolidado '+qtdConsAntes+'\u2192'+CONS.length+' \u00b7 Oji '+qtdPagAntes+'\u2192'+PAG_OJI.length+'). Recarregue a p\u00e1gina antes de continuar.', false);
      return;
    }
  }

  // Sempre salvar no localStorage como fallback
  try{
    localStorage.setItem(LS_KEY, JSON.stringify({
      ts: new Date().toISOString(),
      CONS: CONS, PAG_OJI: PAG_OJI, VEICS: VEICS, MC: MC, MO: MO
    }));
  } catch(e){ console.warn('localStorage cheio:', e); }

  if(!_sbOnline){ setBadge('\u2713 Salvo localmente (offline)', false); return; }

  // Sincronizar com Supabase
  sincronizarSupabase();
}

function mapConsParaSupabase(r){
  return {doc:r.doc, tipo:r.tipo, em:r.em||null, venc:r.venc||null, pgto:r.pgto||null, val:r.val, vei:r.vei||null};
}
function mapPagParaSupabase(r){
  return {doc:r.doc, data:r.data||null, valor:r.valor};
}

// Sincroniza uma tabela registro por registro, NUNCA apagando tudo de uma
// vez: exclui só os ids que saíram da lista local, atualiza só os registros
// cujo conteúdo mudou desde a última sincronização (via fingerprint) e
// insere só os que ainda não têm id. Isso elimina o "apaga tudo e
// reinsere" que causava risco de perda de dados em caso de bug/timing.
function sincronizarTabela(nomeTabela, itens, idsCarregados, syncCache, mapParaSupabase){
  var idsAtuais = {};
  itens.forEach(function(r){ if(r.id) idsAtuais[r.id] = true; });
  var idsRemovidos = idsCarregados.filter(function(id){ return !idsAtuais[id]; });

  var reqs = [];

  idsRemovidos.forEach(function(id){
    reqs.push(
      sbFetch(nomeTabela+'?id=eq.'+id, {method:'DELETE', headers:Object.assign({},sbHeaders(),{'Prefer':'return=minimal'})})
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); delete syncCache[id]; })
    );
  });

  itens.forEach(function(r){
    if(!r.id) return; // registros novos são tratados abaixo, em lote
    var payload = mapParaSupabase(r);
    var fingerprint = JSON.stringify(payload);
    if(syncCache[r.id] === fingerprint) return; // nada mudou nesse registro, não reenvia
    reqs.push(
      sbFetch(nomeTabela+'?id=eq.'+r.id, {method:'PATCH', headers:Object.assign({},sbHeaders(),{'Prefer':'return=minimal'}), body:JSON.stringify(payload)})
      .then(function(resp){ if(!resp.ok) throw new Error('HTTP '+resp.status); syncCache[r.id] = fingerprint; })
    );
  });

  var novos = itens.filter(function(r){ return !r.id; });
  if(novos.length){
    var lotes = [];
    for(var i=0; i<novos.length; i+=100) lotes.push(novos.slice(i,i+100));
    var pInsercao = lotes.reduce(function(p, lote){
      return p.then(function(){
        return sbFetch(nomeTabela, {
          method:'POST',
          headers:Object.assign({}, sbHeaders(), {'Prefer':'return=representation'}),
          body:JSON.stringify(lote.map(mapParaSupabase))
        })
        .then(function(resp){ if(!resp.ok) throw new Error('HTTP '+resp.status); return resp.json(); })
        .then(function(salvos){
          lote.forEach(function(item, idx){
            if(salvos[idx]){
              item.id = salvos[idx].id;
              syncCache[item.id] = JSON.stringify(mapParaSupabase(item));
            }
          });
        });
      });
    }, Promise.resolve());
    reqs.push(pInsercao);
  }

  return Promise.all(reqs).then(function(){
    idsCarregados.length = 0;
    itens.forEach(function(r){ if(r.id) idsCarregados.push(r.id); });
  });
}

function sincronizarSupabase(){
  // Evitar sync desnecessário se dados não mudaram
  var currentHash = CONS.length + ':' + PAG_OJI.length + ':' +
    (CONS.reduce(function(a,r){return a+r.val;},0)|0);
  if(currentHash === _lastSyncHash){
    setBadge('\u2713 Sem altera\u00E7\u00F5es para sincronizar', true);
    return;
  }
  setBadge('\u231B Sincronizando...', true);

  Promise.all([
    sincronizarTabela('consolidado', CONS, _consIdsCarregados, _consSyncCache, mapConsParaSupabase),
    sincronizarTabela('pagamentos_oji', PAG_OJI, _pagIdsCarregados, _pagSyncCache, mapPagParaSupabase)
  ])
  .then(function(){
    var hora2 = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    setBadge('\u2713 Sincronizado \u00e0s ' + hora2 + ' \u2014 ' + CONS.length + ' docs', true);
    _lastSyncHash = currentHash;
    var el=document.getElementById('topbar-count');
    if(el) el.textContent=CONS.length+' documentos';
    // Persistir os ids atribuídos aos registros novos também no cache local
    try{ localStorage.setItem(LS_KEY, JSON.stringify({
      ts:new Date().toISOString(), CONS:CONS, PAG_OJI:PAG_OJI, VEICS:VEICS, MC:MC, MO:MO
    })); }catch(e){}
  })
  .catch(function(e){
    console.error('Erro sync Supabase:', e);
    setBadge('\u26A0 Salvo localmente (erro na nuvem)', false);
  });
}

// ── CARREGAR DADOS: Supabase → localStorage → HTML ──
function carregarDados(){
  setBadge('\u231B Carregando dados da nuvem...', true);

  return testarConexao().then(function(online){
    if(!online){
      setBadge('\u26A0 Offline \u2014 usando dados locais', false);
      return restaurarDoLocalStorage();
    }

    // Carregar CONS do Supabase (paginado — traz TODOS os registros, mesmo
    // que o projeto tenha um "Max Rows" configurado abaixo do total real)
    return sbFetchAll('consolidado?select=*&order=em.asc')
    .then(function(cons_data){
      return sbFetchAll('pagamentos_oji?select=*&order=data.desc')
      .then(function(pag_data){
        if(!Array.isArray(cons_data) || !Array.isArray(pag_data)){
          throw new Error('Dados inválidos do Supabase');
        }

        // Se banco vazio, usar dados do HTML (primeira vez)
        if(cons_data.length === 0){
          setBadge('\u2139 Banco vazio \u2014 carregando dados iniciais...', true);
          // Sincronizar dados do HTML para o Supabase
          setTimeout(sincronizarSupabase, 500);
          return false;
        }

        // ── PROTEÇÃO CONTRA PERDA SILENCIOSA DE DADOS ──
        // Se a nuvem trouxer MENOS documentos/lançamentos que o último cache
        // local confiável, avisar e perguntar antes de substituir — pode ser
        // uma sincronização incompleta ou instabilidade do Supabase, não uma
        // exclusão real. Cobre tanto o Consolidado (CONS) quanto os
        // Pagamentos Oji (PAG_OJI).
        try{
          var cacheRaw = localStorage.getItem(LS_KEY);
          if(cacheRaw){
            var cachePayload = JSON.parse(cacheRaw);
            var avisos = [];
            var qtdCacheCons = (cachePayload.CONS||[]).length;
            if(qtdCacheCons > 0 && cons_data.length < qtdCacheCons){
              avisos.push({rotulo:'documentos (Consolidado)', nuvem:cons_data.length, cache:qtdCacheCons});
            }
            var qtdCachePag = (cachePayload.PAG_OJI||[]).length;
            if(qtdCachePag > 0 && pag_data.length < qtdCachePag){
              avisos.push({rotulo:'lan\u00e7amentos (Pagamentos Oji)', nuvem:pag_data.length, cache:qtdCachePag});
            }
            if(avisos.length){
              var aceitar = confirm(
                '\u26A0 ATEN\u00c7\u00c3O \u2014 poss\u00edvel perda de dados detectada!\n\n'
                + avisos.map(function(a){
                    return 'A nuvem (Supabase) tem ' + a.nuvem + ' ' + a.rotulo + ', mas o \u00faltimo cache salvo neste dispositivo tinha ' + a.cache + '.';
                  }).join('\n')
                + '\n\nIsso pode indicar uma falha de sincroniza\u00e7\u00e3o, n\u00e3o uma exclus\u00e3o real.\n\n'
                + 'Clique OK para usar os dados da NUVEM mesmo assim.\n'
                + 'Clique CANCELAR para manter os dados locais e N\u00c3O sincronizar agora.'
              );
              if(!aceitar){
                setBadge('\u26A0 Usando cache local \u2014 nuvem tinha menos registros', false);
                restaurarDoLocalStorage();
                return false;
              }
            }
          }
        }catch(e){ console.warn('Erro na verificação de proteção de dados:', e); }

        // Substituir CONS com dados do Supabase
        CONS.length = 0;
        cons_data.forEach(function(r){
          var venc = r.venc;
          // Corrige vencimentos calculados com o bug do dia 30 em meses curtos
          // (ex: emissão 21-30/jan → venc deveria ser 28/fev, não 02/mar)
          if(r.em && venc){
            var ep=r.em.split('-').map(Number), ed=ep[2];
            if(ed>20){
              var nm=ep[1]<12?ep[1]+1:1, ny=ep[1]<12?ep[0]:ep[0]+1;
              var ultimo=new Date(ny,nm,0).getDate();
              if(ultimo<30){
                var esperado=calcVenc(r.em);
                if(esperado && venc!==esperado) venc=esperado;
              }
            }
          }
          var st = calcSt(r.pgto, venc);
          CONS.push({
            id:r.id, doc:r.doc, tipo:r.tipo, em:r.em, venc:venc,
            pgto:r.pgto, val:parseFloat(r.val)||0, vei:r.vei||'',
            stKey:st.key, stLbl:st.lbl
          });
        });

        // Substituir PAG_OJI
        PAG_OJI.length = 0;
        pag_data.forEach(function(r){
          PAG_OJI.push({id:r.id, doc:r.doc, data:r.data, valor:parseFloat(r.valor)||0});
        });

        // O que acabou de vir da nuvem já está, por definição, em sincronia —
        // guarda os ids e um "fingerprint" de cada um, assim o próximo
        // autosave só envia o que realmente mudar a partir de agora.
        _consIdsCarregados.length = 0;
        _consSyncCache = {};
        CONS.forEach(function(r){
          if(r.id){ _consIdsCarregados.push(r.id); _consSyncCache[r.id] = JSON.stringify(mapConsParaSupabase(r)); }
        });
        _pagIdsCarregados.length = 0;
        _pagSyncCache = {};
        PAG_OJI.forEach(function(r){
          if(r.id){ _pagIdsCarregados.push(r.id); _pagSyncCache[r.id] = JSON.stringify(mapPagParaSupabase(r)); }
        });

        // Recalcular VEICS e MC
        VEICS.length=0;
        var vs={};
        CONS.forEach(function(r){ if(r.vei&&!vs[r.vei]){vs[r.vei]=1;VEICS.push(r.vei);} });
        VEICS.sort();
        MC.length=0;
        var ms={};
        CONS.forEach(function(r){ if(r.em){ var m=r.em.slice(0,7); if(!ms[m]){ms[m]=1;MC.push(m);} } });
        MC.sort();
        if(typeof rebuildConsMesFilter==='function') rebuildConsMesFilter();
        MO.length=0;
        var mo={};
        PAG_OJI.forEach(function(r){ if(r.data){ var m=r.data.slice(0,7); if(!mo[m]){mo[m]=1;MO.push(m);} } });
        MO.sort().reverse();

        // Salvar no localStorage como cache
        try{ localStorage.setItem(LS_KEY, JSON.stringify({
          ts:new Date().toISOString(), CONS:CONS, PAG_OJI:PAG_OJI, VEICS:VEICS, MC:MC, MO:MO
        })); }catch(e){}

        var ts = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
        setBadge('\u2713 '+CONS.length+' docs carregados da nuvem \u00e0s '+ts, true);
        return true;
      });
    });
  })
  .catch(function(e){
    console.error('Erro ao carregar:', e);
    setBadge('\u26A0 Erro na nuvem \u2014 usando cache local', false);
    return restaurarDoLocalStorage();
  });
}

function restaurarDoLocalStorage(){
  try{
    var raw = localStorage.getItem(LS_KEY);
    if(!raw) return false;
    var payload = JSON.parse(raw);
    if(!payload||!payload.CONS||!payload.PAG_OJI||!payload.ts) return false;
    CONS.length=0; payload.CONS.forEach(function(r){
      if(r.em&&r.venc){var ep=r.em.split('-').map(Number),ed=ep[2];if(ed>20){var nm=ep[1]<12?ep[1]+1:1,ny=ep[1]<12?ep[0]:ep[0]+1;var ult=new Date(ny,nm,0).getDate();if(ult<30){var esp=calcVenc(r.em);if(esp&&r.venc!==esp)r.venc=esp;}}}
      CONS.push(r);
    });
    PAG_OJI.length=0; payload.PAG_OJI.forEach(function(r){PAG_OJI.push(r);});
    if(payload.VEICS){VEICS.length=0;payload.VEICS.forEach(function(v){VEICS.push(v);});}
    if(payload.MC){MC.length=0;payload.MC.forEach(function(m){MC.push(m);});}
    if(payload.MO){MO.length=0;payload.MO.forEach(function(m){MO.push(m);});}
    CONS.forEach(function(r){var s=calcSt(r.pgto,r.venc);r.stKey=s.key;r.stLbl=s.lbl;});

    // Registros restaurados do cache que j\u00e1 t\u00eam id foram, em algum momento,
    // sincronizados com esse conte\u00fado \u2014 evita reenviar tudo \u00e0 toa assim que
    // a conex\u00e3o voltar.
    _consIdsCarregados.length = 0;
    _consSyncCache = {};
    CONS.forEach(function(r){
      if(r.id){ _consIdsCarregados.push(r.id); _consSyncCache[r.id] = JSON.stringify(mapConsParaSupabase(r)); }
    });
    _pagIdsCarregados.length = 0;
    _pagSyncCache = {};
    PAG_OJI.forEach(function(r){
      if(r.id){ _pagIdsCarregados.push(r.id); _pagSyncCache[r.id] = JSON.stringify(mapPagParaSupabase(r)); }
    });

    var ts=new Date(payload.ts).toLocaleString('pt-BR');
    setBadge('\u2713 Cache local restaurado ('+ts+')', false);
    return true;
  }catch(e){ return false; }
}

