// ── IMPORT (CSV + XML) ──────────────────────────────────
function parseCSV(text){
  var lines=text.trim().split(/\r?\n/); if(!lines.length)return[];
  var sep=lines[0].indexOf(';')>=0?';':lines[0].indexOf('\t')>=0?'\t':',';
  var header=lines[0].split(sep).map(function(h){return h.trim().toLowerCase().replace(/["\u201c\u201d]/g,'');});
  var rows=[];
  for(var i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;
    var cols=lines[i].split(sep).map(function(c){return c.trim().replace(/["\u201c\u201d]/g,'');});
    var obj={};
    header.forEach(function(h,j){obj[h]=cols[j]||'';});
    rows.push(obj);
  }
  return rows;
}
function getCol(row,keys){
  for(var i=0;i<keys.length;i++){if(row[keys[i]]!==undefined&&row[keys[i]]!=='')return row[keys[i]];}
  return '';
}
// Remove namespaces do XML para facilitar parse
function stripNS(xml){
  xml=xml.replace(/<\?[^>]*\?>/g,'');
  xml=xml.replace(/\s+xmlns(?::\w+)?="[^"]*"/g,'');
  xml=xml.replace(/<(\/?)\w+:/g,'<$1');
  return xml;
}
function xmlText(root,tag){
  var re=new RegExp('<'+tag+'[^>]*>([^<]*)<\/'+tag+'>');
  var m=root.match(re);
  return m?m[1].trim():null;
}
function xmlAttr(root,tag,attr){
  var re=new RegExp('<'+tag+'\\s[^>]*'+attr+'="([^"]*)"');
  var m=root.match(re);
  return m?m[1].trim():null;
}
// Extrair todos valores de uma tag (para pegar o 2º xNome = OJI)
function xmlAll(root,tag){
  var re=new RegExp('<'+tag+'[^>]*>([^<]*)<\/'+tag+'>','g');
  var m,res=[];
  while((m=re.exec(root))!==null) res.push(m[1].trim());
  return res;
}
function parseDateISO(s){
  if(!s)return null;
  // 2026-06-24T16:02:02-03:00 ou 2026-06-24
  return s.slice(0,10);
}
function parsePlaca(txt){
  if(!txt)return'';
  var m=txt.match(/[A-Z]{2,3}\d[A-Z0-9]\d{2}/i);
  return m?m[0].toUpperCase():'';
}

function parseXMLCTe(xml){
  var x=stripNS(xml);
  var sit=xmlText(x,'cStat')||xmlText(x,'Situacao')||'100';
  // Cancelado se tpEvento 110111 ou cStat 101
  if(sit==='101') return null; // cancelado
  var nCT=xmlText(x,'nCT');
  var dhEmi=parseDateISO(xmlText(x,'dhEmi'));
  var vTPrest=xmlText(x,'vTPrest')||xmlText(x,'vRec');
  var xObs=xmlText(x,'xObs')||'';
  var placa=parsePlaca(xObs);
  // tomador = dest xNome (3º xNome geralmente)
  var nomes=xmlAll(x,'xNome');
  var tomador=nomes.find(function(n){return n.toUpperCase().indexOf('OJI')>=0;})||'';
  if(!nCT||!dhEmi||!vTPrest) return null;
  if(tomador&&tomador.toUpperCase().indexOf('OJI')<0) return null; // não é OJI
  return {doc:parseInt(nCT), em:dhEmi, val:parseFloat(vTPrest), vei:placa};
}

function parseXMLNFS(xml){
  var x=stripNS(xml);
  // cStat 100 = autorizado
  var cStat=xmlText(x,'cStat')||'100';
  if(cStat!=='100') return null;
  var nNFSe=xmlText(x,'nNFSe');
  var dCompet=xmlText(x,'dCompet')||parseDateISO(xmlText(x,'dhEmi'));
  var vLiq=xmlText(x,'vLiq')||xmlText(x,'vServ');
  var nomes=xmlAll(x,'xNome');
  var tomador=nomes.find(function(n){return n.toUpperCase().indexOf('OJI')>=0;})||'';
  if(!nNFSe||!dCompet||!vLiq) return null;
  if(tomador&&tomador.toUpperCase().indexOf('OJI')<0) return null;
  return {doc:parseInt(nNFSe), em:dCompet, val:parseFloat(vLiq), vei:''};
}

function processFile(tipo,input){
  var file=input.files[0]; if(!file)return;
  var isXML=file.name.toLowerCase().endsWith('.xml');
  var reader=new FileReader();
  reader.onload=function(e){
    var text=e.target.result;
    var newItems=[], errors=[];
    var pagMap={};
    CONS.forEach(function(c){if(c.pgto)pagMap[c.doc]=c.pgto;});
    PAG_OJI.forEach(function(p){if(p.data&&p.valor<0)pagMap[p.doc]=p.data;});

    if(tipo==='pag'){
      var rows=parseCSV(text);
      rows.forEach(function(r,i){
        var doc=parseInt(getCol(r,['documento','doc','numero','n\u00famero','n\u00ba','nro']));
        var data=normDate(getCol(r,['data','data pagamento','data_pagamento','datapagamento']));
        var val=parseFloat((getCol(r,['valor'])||'0').replace(',','.'));
        if(!doc||!data||isNaN(val)){errors.push(i+2);return;}
        newItems.push({doc:doc,data:data,valor:val});
      });
      handlePagImport(newItems,errors);
      input.value=''; return;
    }

    // CTe ou NFS — CSV ou XML
    var parsed=[];
    if(isXML){
      var r=(tipo==='cte')?parseXMLCTe(text):parseXMLNFS(text);
      if(r) parsed.push(r);
      else errors.push('XML inv\u00e1lido ou cancelado/n\u00e3o OJI');
      // XML: mostrar tela de confirmação/resumo antes de importar
      if(parsed.length>0){
        mostrarConfirmacaoXML(tipo, parsed, errors, pagMap);
        input.value=''; return;
      } else {
        showImportMsg(0,0,errors,tipo);
        input.value=''; return;
      }
    } else {
      var rows=parseCSV(text);
      rows.forEach(function(r,i){
        var em,doc,val,vei;
        if(tipo==='cte'){
          em=normDate(getCol(r,['emissao','emiss\u00e3o','data emissao','data_emissao','emiss\u00e3o','data']));
          doc=parseInt(getCol(r,['documento','doc','ct-e','cte','numero','n\u00famero','n\u00ba','nro']));
          val=parseFloat((getCol(r,['valor','frete'])||'0').replace(',','.'));
          vei=(getCol(r,['veiculo','ve\u00edculo','placa'])||'').toUpperCase();
        } else {
          em=normDate(getCol(r,['emissao','emiss\u00e3o','data emissao','data_emissao','data de emiss\u00e3o','data']));
          doc=parseInt(getCol(r,['documento','doc','n\u00famero da nota','numero','n\u00famero','n\u00ba','nro']));
          val=parseFloat((getCol(r,['valor','valor do servi\u00e7o'])||'0').replace(',','.'));
          vei=(getCol(r,['veiculo','ve\u00edculo','placa'])||'').toUpperCase();
        }
        if(!em||!doc||isNaN(val)){errors.push(i+2);return;}
        parsed.push({doc:doc,em:em,val:val,vei:vei||''});
      });
    }

    parsed.forEach(function(p){
      var venc=calcVenc(p.em), pgto=pagMap[p.doc]||null;
      var st=calcSt(pgto,venc);
      newItems.push({doc:p.doc,tipo:tipo==='cte'?'CTe':'NFSe',em:p.em,venc:venc,pgto:pgto,val:p.val,vei:p.vei,stKey:st.key,stLbl:st.lbl});
    });
    handleConsImport(newItems,errors,tipo);
    input.value='';
  };
  reader.readAsText(file, isXML?'utf-8':'latin-1');
}

// ── TELA DE CONFIRMAÇÃO XML ───────────────────────────────
function mostrarConfirmacaoXML(tipo, parsed, errors, pagMap){
  var isCTe = tipo==='cte';
  var p = parsed[0]; // sempre 1 por XML
  var venc = calcVenc(p.em);
  var pgto = pagMap[p.doc]||null;
  var st = calcSt(pgto, venc);
  var stCls = st.key==='ok'?'#15803d':st.key==='late'?'#92400e':st.key==='due'?'#991b1b':'#1d4ed8';
  var stBg  = st.key==='ok'?'#dcfce7':st.key==='late'?'#fef3c7':st.key==='due'?'#fee2e2':'#dbeafe';

  // Verificar se já existe no sistema
  var existente = CONS.find(function(c){return c.doc===p.doc;});
  var jaExiste = !!existente;

  var placaField = isCTe
    ? '<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #f5f5f4">'
      +'<span style="font-size:12px;color:#78716c;min-width:90px">Ve\u00edculo</span>'
      +'<span style="font-size:13px;font-weight:600">'+(p.vei||'<span style="color:#a8a29e">N\u00e3o informado</span>')+'</span>'
      +'</div>'
    : '<div style="padding:10px 0;border-bottom:1px solid #f5f5f4">'
      +'<div style="font-size:12px;color:#78716c;margin-bottom:6px">Placa do ve\u00edculo <span style="color:#dc2626">(obrigat\u00f3rio)</span></div>'
      +'<input id="xml-placa" type="text" placeholder="Ex: GAI3G17" maxlength="8" oninput="this.value=this.value.toUpperCase()"'
      +' style="height:38px;padding:0 12px;border:1px solid #d6d3d1;border-radius:8px;font-size:14px;font-weight:600;'
      +'letter-spacing:.05em;width:100%;outline:none;color:#1c1917;transition:border-color .15s">'
      +'</div>';

  var alertaExiste = jaExiste
    ? '<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#92400e">'
      +'<strong>\u26A0 Documento j\u00e1 existe no sistema!</strong> Ao confirmar, voc\u00ea decidir\u00e1 se mant\u00e9m o original ou substitui.'
      +'</div>'
    : '';

  var html = '<div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2000;display:flex;'
    +'align-items:center;justify-content:center;padding:16px" id="modal-xml-confirm">'
    +'<div style="background:#fff;border-radius:16px;width:100%;max-width:480px;'
    +'box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden">'

    // Header
    +'<div style="padding:20px 24px 16px;border-bottom:1px solid #e7e5e4;display:flex;align-items:center;gap:12px">'
    +'<div style="width:40px;height:40px;border-radius:10px;background:'+(isCTe?'#ede9fe':'#d1fae5')
    +';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">'
    +(isCTe?'&#x1F4E6;':'&#x1F9FE;')+'</div>'
    +'<div><div style="font-size:15px;font-weight:700;color:#1c1917">Confirmar importa\u00e7\u00e3o de '+(isCTe?'CTe':'NFS-e')+'</div>'
    +'<div style="font-size:12px;color:#78716c">Revise os dados antes de importar</div>'
    +'</div></div>'

    // Body
    +'<div style="padding:20px 24px">'
    +alertaExiste

    // Dados do documento
    +'<div style="background:#fafaf9;border:1px solid #e7e5e4;border-radius:10px;padding:14px 16px;margin-bottom:16px">'

    +'<div style="display:flex;align-items:center;gap:8px;padding:0 0 10px;border-bottom:1px solid #f5f5f4;margin-bottom:4px">'
    +'<span style="background:'+(isCTe?'#ede9fe':'#d1fae5')+';color:'+(isCTe?'#5b21b6':'#065f46')
    +';font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px">'+(isCTe?'CTe':'NFS-e')+'</span>'
    +'<span style="font-size:18px;font-weight:700;color:#1c1917">N\u00ba '+p.doc+'</span>'
    +'<span style="margin-left:auto;background:'+stBg+';color:'+stCls+';font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px">'+st.lbl+'</span>'
    +'</div>'

    +'<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #f5f5f4">'
    +'<span style="font-size:12px;color:#78716c;min-width:90px">Emiss\u00e3o</span>'
    +'<span style="font-size:13px;font-weight:600">'+fD(p.em)+'</span>'
    +'</div>'

    +'<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #f5f5f4">'
    +'<span style="font-size:12px;color:#78716c;min-width:90px">Vencimento</span>'
    +'<span style="font-size:13px;font-weight:600">'+fD(venc)+'</span>'
    +'</div>'

    +'<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid #f5f5f4">'
    +'<span style="font-size:12px;color:#78716c;min-width:90px">Valor</span>'
    +'<span style="font-size:15px;font-weight:700;color:#1c1917">'+fR(p.val)+'</span>'
    +'</div>'

    +placaField
    +'</div>'
    +'</div>'

    // Footer
    +'<div style="padding:14px 24px;border-top:1px solid #e7e5e4;display:flex;gap:8px;justify-content:flex-end;background:#fafaf9">'
    +'<button onclick="document.getElementById(\'modal-xml-confirm\').remove()" '
    +'style="height:38px;padding:0 18px;border-radius:8px;border:1px solid #d6d3d1;background:#fff;font-size:13px;cursor:pointer;color:#1c1917">Cancelar</button>'
    +'<button onclick="confirmarXML()" '
    +'style="height:38px;padding:0 20px;border-radius:8px;border:none;background:#1c1917;color:#fff;font-size:13px;font-weight:600;cursor:pointer">'
    +'\u2713 Confirmar importa\u00e7\u00e3o</button>'
    +'</div>'
    +'</div></div>';

  document.body.insertAdjacentHTML('beforeend', html);
  if(!isCTe) setTimeout(function(){ var inp=document.getElementById('xml-placa'); if(inp)inp.focus(); }, 150);

  // Guardar contexto
  window._xmlTipo   = tipo;
  window._xmlParsed = parsed;
  window._xmlErrors = errors;
  window._xmlPagMap = pagMap;
}

function confirmarXML(){
  var tipo   = window._xmlTipo;
  var parsed = window._xmlParsed;
  var errors = window._xmlErrors;
  var pagMap = window._xmlPagMap;
  var p = parsed[0];

  // Pegar placa (NFS pede no campo, CTe já vem do XML)
  var vei = p.vei || '';
  if(tipo==='nfs'){
    var inp = document.getElementById('xml-placa');
    vei = inp ? inp.value.trim().toUpperCase() : '';
  }

  document.getElementById('modal-xml-confirm').remove();

  var venc = calcVenc(p.em), pgto = pagMap[p.doc]||null;
  var st = calcSt(pgto, venc);
  var item = {doc:p.doc, tipo:tipo==='cte'?'CTe':'NFSe', em:p.em, venc:venc,
              pgto:pgto, val:p.val, vei:vei, stKey:st.key, stLbl:st.lbl};

  handleConsImport([item], errors, tipo);
  marcarAlteracao();
}

function pedirPlacaNFS(parsed, errors, pagMap){
  // Mantido por compatibilidade — agora usa mostrarConfirmacaoXML
  mostrarConfirmacaoXML('nfs', parsed, errors, pagMap);
}

function handleConsImport(newItems,errors,tipo){
  var existIdx={};
  CONS.forEach(function(c,i){existIdx[c.doc]=i;});
  var duplicatas=[], semDup=[];
  newItems.forEach(function(item){
    if(existIdx[item.doc]!==undefined){
      duplicatas.push({novo:item,existente:CONS[existIdx[item.doc]],idx:existIdx[item.doc]});
    } else { semDup.push(item); }
  });
  semDup.forEach(function(item){CONS.push(item);});
  syncMC();
  if(duplicatas.length>0){
    _modalTipo=tipo; _modalQueue=duplicatas; _modalErrors=errors;
    duplicatas.forEach(function(d){d.decisao=null;});
    openModal();
  } else {
    showImportMsg(semDup.length,0,errors,tipo);
    af();
  }
}

function handlePagImport(newItems,errors){
  var pagExistMap={};
  PAG_OJI.forEach(function(p){
    if(!pagExistMap[p.doc])pagExistMap[p.doc]=p;
  });
  var duplicatas=[], semDup=[];
  newItems.forEach(function(item){
    if(pagExistMap[item.doc]){
      duplicatas.push({novo:item,existente:pagExistMap[item.doc],decisao:null});
    } else { semDup.push(item); }
  });
  semDup.forEach(function(item){
    PAG_OJI.push(item);
    CONS.forEach(function(c){if(c.doc===item.doc){c.pgto=item.data;var s=calcSt(item.data,c.venc);c.stKey=s.key;c.stLbl=s.lbl;}});
  });
  syncMO();
  if(duplicatas.length>0){
    _modalTipo='pag'; _modalQueue=duplicatas; _modalErrors=errors;
    openModal();
  } else {
    showImportMsg(semDup.length,0,errors,'pag');
    af();
  }
}

function syncMO(){
  var moSet={}, novos=[];
  PAG_OJI.forEach(function(r){ if(r.data){ var m=r.data.slice(0,7); if(!moSet[m]){moSet[m]=1; novos.push(m);} } });
  novos.sort().reverse();
  var mudou = novos.length!==MO.length || novos.some(function(m,i){return MO[i]!==m;});
  if(mudou){
    MO.length=0;
    novos.forEach(function(m){MO.push(m);});
    rebuildOjiMesFilter();
    rebuildOjiAnoFilter();
  }
}

function rebuildOjiAnoFilter(){
  var dd=document.getElementById('ms-ojiano');
  if(!dd) return;
  var checked=getChk('ojiano');
  var anos={};
  MO.forEach(function(m){anos[m.slice(0,4)]=1;});
  anos[String(new Date().getFullYear())]=1; // garante que o ano atual sempre apareça
  var lista=Object.keys(anos).sort().reverse();
  dd.innerHTML='';
  msChecked['ojiano']=[];
  lista.forEach(function(a){
    var lbl=document.createElement('label');
    lbl.className='msitem';
    var chk=document.createElement('input');
    chk.type='checkbox'; chk.value=a;
    if(checked.indexOf(a)>=0) chk.checked=true;
    chk.onchange=function(){ msChecked['ojiano']=getChk('ojiano'); updLbl('ojiano'); afOji(); };
    lbl.appendChild(chk);
    lbl.appendChild(document.createTextNode(' '+a));
    dd.appendChild(lbl);
  });
  var clr=document.createElement('button');
  clr.className='msclr'; clr.textContent='Limpar sele\u00e7\u00e3o';
  clr.onclick=function(e){ e.stopPropagation(); clrMS('ojiano',afOji); };
  dd.appendChild(clr);
  updLbl('ojiano');
}

function rebuildOjiMesFilter(){
  var dd=document.getElementById('ms-ojimes');
  if(!dd) return;
  var checked=getChk('ojimes');
  dd.innerHTML='';
  msChecked['ojimes']=[];
  MO.forEach(function(m){
    var p=m.split('-');
    var lbl=document.createElement('label');
    lbl.className='msitem';
    var chk=document.createElement('input');
    chk.type='checkbox'; chk.value=m;
    if(checked.indexOf(m)>=0) chk.checked=true;
    chk.onchange=function(){ msChecked['ojimes']=getChk('ojimes'); updLbl('ojimes'); afOji(); };
    lbl.appendChild(chk);
    lbl.appendChild(document.createTextNode(' '+new Date(p[0],p[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})));
    dd.appendChild(lbl);
  });
  var clr=document.createElement('button');
  clr.className='msclr'; clr.textContent='Limpar sele\u00e7\u00e3o';
  clr.onclick=function(e){ e.stopPropagation(); clrMS('ojimes',afOji); };
  dd.appendChild(clr);
  updLbl('ojimes');
}

function syncMC(){
  var mcSet={}, novos=[];
  CONS.forEach(function(r){ if(r.em){ var m=r.em.slice(0,7); if(!mcSet[m]){mcSet[m]=1; novos.push(m);} } });
  novos.sort();
  var mudou = novos.length!==MC.length || novos.some(function(m,i){return MC[i]!==m;});
  if(mudou){
    MC.length=0;
    novos.forEach(function(m){MC.push(m);});
    rebuildConsMesFilter();
  }
}

function rebuildConsMesFilter(){
  var dd=document.getElementById('ms-mes');
  if(!dd) return;
  var checked=getChk('mes');
  dd.innerHTML='';
  msChecked['mes']=[];
  MC.forEach(function(m){
    var p=m.split('-');
    var lbl=document.createElement('label');
    lbl.className='msitem';
    var chk=document.createElement('input');
    chk.type='checkbox'; chk.value=m;
    if(checked.indexOf(m)>=0) chk.checked=true;
    chk.onchange=function(){ msChecked['mes']=getChk('mes'); updLbl('mes'); af(); };
    lbl.appendChild(chk);
    lbl.appendChild(document.createTextNode(' '+new Date(p[0],p[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})));
    dd.appendChild(lbl);
  });
  var clr=document.createElement('button');
  clr.className='msclr'; clr.textContent='Limpar seleção';
  clr.onclick=function(e){ e.stopPropagation(); clrMS('mes',af); };
  dd.appendChild(clr);
  updLbl('mes');
}

// ── LANÇAMENTO MANUAL ────────────────────────────────────
function showMtab(t){
  ['cte','nfs','pag'].forEach(function(x){
    document.getElementById('mtab-'+x).classList.toggle('active',x===t);
    document.getElementById('mform-'+x).style.display=x===t?'':'none';
  });
}

function parseBRL(s){
  if(!s)return NaN;
  // aceita 1.017,47 ou 1017.47 ou 1017,47
  s=s.trim().replace(/\s/g,'');
  if(s.indexOf(',')>s.indexOf('.')){
    s=s.replace(/\./g,'').replace(',','.');
  }
  return parseFloat(s);
}

function manualAdd(tipo){
  var msgId='msg-m'+tipo;
  var msg=document.getElementById(msgId);
  msg.style.display='none';

  var pagMap={};
  CONS.forEach(function(c){if(c.pgto)pagMap[c.doc]=c.pgto;});
  PAG_OJI.forEach(function(p){if(p.data&&p.valor<0)pagMap[p.doc]=p.data;});

  if(tipo==='cte'||tipo==='nfs'){
    var doc=parseInt(document.getElementById('m-'+tipo+'-doc').value);
    var em=document.getElementById('m-'+tipo+'-em').value;
    var valRaw=document.getElementById('m-'+tipo+'-val').value;
    var val=parseBRL(valRaw);
    var vei=document.getElementById('m-'+tipo+'-vei').value.trim().toUpperCase();

    if(!doc||!em||isNaN(val)||val<=0){
      msg.className='smsg msg-err'; msg.textContent='\u2717 Preencha os campos obrigat\u00f3rios (N\u00BA, Data, Valor).'; msg.style.display='block'; return;
    }
    var venc=calcVenc(em), pgto=pagMap[doc]||null;
    var st=calcSt(pgto,venc);
    var obj={doc:doc,tipo:tipo==='cte'?'CTe':'NFSe',em:em,venc:venc,pgto:pgto,val:val,vei:vei,stKey:st.key,stLbl:st.lbl};

    // Verificar duplicata
    var existing=CONS.find(function(c){return c.doc===doc;});
    if(existing){
      _modalTipo=tipo; _modalQueue=[{novo:obj,existente:existing,decisao:null}]; _modalErrors=[];
      openModal(); return;
    }
    CONS.push(obj);
    syncMC();
    msg.className='smsg msg-ok';
    msg.textContent='\u2713 '+(tipo==='cte'?'CTe':'NFS-e')+' '+doc+' adicionado com sucesso!';
    msg.style.display='block';
    ['doc','em','val','vei'].forEach(function(f){document.getElementById('m-'+tipo+'-'+f).value='';});
    marcarAlteracao();
    af();

  } else if(tipo==='pag'){
    var doc=parseInt(document.getElementById('m-pag-doc').value);
    var data=document.getElementById('m-pag-data').value;
    var valRaw=document.getElementById('m-pag-val').value;
    var val=parseBRL(valRaw);

    if(!doc||!data||isNaN(val)||val<=0){
      msg.className='smsg msg-err'; msg.textContent='\u2717 Preencha os campos obrigat\u00f3rios (N\u00BA Doc, Data, Valor).'; msg.style.display='block'; return;
    }
    var existing=PAG_OJI.find(function(p){return p.doc===doc;});
    var obj={doc:doc,data:data,valor:-Math.abs(val)};
    if(existing){
      _modalTipo='pag'; _modalQueue=[{novo:obj,existente:existing,decisao:null}]; _modalErrors=[];
      openModal(); return;
    }
    PAG_OJI.push(obj);
    CONS.forEach(function(c){if(c.doc===doc){c.pgto=data;var s=calcSt(data,c.venc);c.stKey=s.key;c.stLbl=s.lbl;}});
    syncMO();
    msg.className='smsg msg-ok';
    msg.textContent='\u2713 Pagamento do doc '+doc+' registrado com sucesso!';
    msg.style.display='block';
    ['doc','data','val'].forEach(function(f){document.getElementById('m-pag-'+f).value='';});
    marcarAlteracao();
    af();
  }
}
// ── MODAL ──
function openModal(){
  var tipo=_modalTipo, q=_modalQueue;
  var title = (tipo==='pag')
    ? q.length+' pagamento(s) duplicado(s) encontrado(s)'
    : q.length+' documento(s) j\u00e1 existente(s) encontrado(s)';
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-sub').textContent=
    tipo==='pag'
      ? 'Estes documentos j\u00e1 possuem pagamento registrado. Escolha o que fazer com cada um.'
      : 'Estes documentos j\u00e1 existem no sistema. Escolha o que fazer com cada um.';

  var html='';
  q.forEach(function(d,i){
    var ex=d.existente, nv=d.novo;
    if(tipo==='pag'){
      html+='<div class="dup-item" id="dup-'+i+'">'
        +'<div class="dup-header"><span class="dup-doc">Doc '+nv.doc+'</span></div>'
        +'<div class="dup-rows">'
        +'<div class="dup-col existing"><div class="dup-col-title">&#x26A0;&#xFE0F; J\u00e1 registrado</div>'
        +'<div class="dup-field">Data: <span>'+fD(ex.data)+'</span></div>'
        +'<div class="dup-field">Valor: <span>'+fR(ex.valor)+'</span></div>'
        +'</div>'
        +'<div class="dup-col incoming"><div class="dup-col-title">&#x1F4E5; Novo lançamento</div>'
        +'<div class="dup-field">Data: <span>'+fD(nv.data)+'</span></div>'
        +'<div class="dup-field">Valor: <span>'+fR(nv.valor)+'</span></div>'
        +'</div></div>'
        +'<div class="dup-actions">'
        +'<button class="dup-btn dup-btn-keep" onclick="setDecisao('+i+',\'keep\')">&#x2705; Manter original</button>'
        +'<button class="dup-btn dup-btn-replace" onclick="setDecisao('+i+',\'replace\')">&#x1F504; Substituir pelo novo</button>'
        +'<button class="dup-btn dup-btn-both" onclick="setDecisao('+i+',\'both\')">&#x2795; Adicionar os dois</button>'
        +'</div></div>';
    } else {
      html+='<div class="dup-item" id="dup-'+i+'">'
        +'<div class="dup-header"><span class="dup-doc">'+nv.tipo+' '+nv.doc+'</span></div>'
        +'<div class="dup-rows">'
        +'<div class="dup-col existing"><div class="dup-col-title">&#x26A0;&#xFE0F; J\u00e1 no sistema</div>'
        +'<div class="dup-field">Emiss\u00e3o: <span>'+fD(ex.em)+'</span></div>'
        +'<div class="dup-field">Valor: <span>'+fR(ex.val)+'</span></div>'
        +'<div class="dup-field">Ve\u00edculo: <span>'+(ex.vei||'—')+'</span></div>'
        +'<div class="dup-field">Status: <span>'+ex.stLbl+'</span></div>'
        +'</div>'
        +'<div class="dup-col incoming"><div class="dup-col-title">&#x1F4E5; Novo arquivo</div>'
        +'<div class="dup-field">Emiss\u00e3o: <span>'+fD(nv.em)+'</span></div>'
        +'<div class="dup-field">Valor: <span>'+fR(nv.val)+'</span></div>'
        +'<div class="dup-field">Ve\u00edculo: <span>'+(nv.vei||'—')+'</span></div>'
        +'<div class="dup-field">Status: <span>'+nv.stLbl+'</span></div>'
        +'</div></div>'
        +'<div class="dup-actions">'
        +'<button class="dup-btn dup-btn-keep" onclick="setDecisao('+i+',\'keep\')">&#x2705; Manter original</button>'
        +'<button class="dup-btn dup-btn-replace" onclick="setDecisao('+i+',\'replace\')">&#x1F504; Substituir pelo novo</button>'
        +'</div></div>';
    }
  });
  document.getElementById('modal-body').innerHTML=html;
  updModalFoot();
  document.getElementById('modal-bg').style.display='flex';
  document.body.style.overflow='hidden';
}

function setDecisao(i, dec){
  _modalQueue[i].decisao=dec;
  var item=document.getElementById('dup-'+i);
  item.style.borderColor=dec==='keep'?'#d97706':dec==='replace'?'#2563eb':'#78716c';
  item.style.boxShadow=dec==='keep'?'0 0 0 2px #fef3c7':dec==='replace'?'0 0 0 2px #dbeafe':'0 0 0 2px #f5f5f4';
  // marcar botão ativo
  item.querySelectorAll('.dup-btn').forEach(function(b){b.style.fontWeight='500';});
  var btns=item.querySelectorAll('.dup-btn');
  var map={'keep':0,'replace':1,'both':2};
  if(btns[map[dec]]) btns[map[dec]].style.fontWeight='800';
  updModalFoot();
}

function updModalFoot(){
  var total=_modalQueue.length;
  var decididos=_modalQueue.filter(function(d){return d.decisao!==null;}).length;
  document.getElementById('modal-foot-info').textContent=
    decididos+' de '+total+' decid'+(decididos===1?'ido':'idos');
}

function applyAll(dec){
  _modalQueue.forEach(function(d,i){setDecisao(i,dec);});
}

function cancelModal(){
  document.getElementById('modal-bg').style.display='none';
  document.body.style.overflow='';
  showImportMsg(0,0,[],'');
}

function confirmModal(){
  var pendentes=_modalQueue.filter(function(d){return d.decisao===null;});
  if(pendentes.length>0){
    alert('Ainda h\u00e1 '+pendentes.length+' documento(s) sem decis\u00e3o. Por favor escolha o que fazer com cada um, ou use os bot\u00f5es "Manter todos" / "Substituir todos".');
    return;
  }
  var added=0, replaced=0;
  if(_modalTipo==='pag'){
    _modalQueue.forEach(function(d){
      if(d.decisao==='keep') return;
      if(d.decisao==='replace'){
        // remover o original do PAG_OJI
        for(var i=PAG_OJI.length-1;i>=0;i--){
          if(PAG_OJI[i].doc===d.novo.doc){PAG_OJI.splice(i,1);break;}
        }
        replaced++;
      }
      // 'both' ou 'replace' → adicionar novo
      PAG_OJI.push(d.novo);
      CONS.forEach(function(c){
        if(c.doc===d.novo.doc){c.pgto=d.novo.data;var s=calcSt(d.novo.data,c.venc);c.stKey=s.key;c.stLbl=s.lbl;}
      });
      added++;
    });
    syncMO();
  } else {
    _modalQueue.forEach(function(d){
      if(d.decisao==='keep') return;
      if(d.decisao==='replace'){
        // remover o original do CONS
        var idx=CONS.indexOf(d.existente);
        if(idx>=0) CONS.splice(idx,1);
        replaced++;
      }
      CONS.push(d.novo);
      added++;
    });
    syncMC();
  }
  document.getElementById('modal-bg').style.display='none';
  document.body.style.overflow='';
  showImportMsg(added, replaced, _modalErrors, _modalTipo);
  marcarAlteracao();
  af();
}

function showImportMsg(added, replaced, errors, tipo){
  var msg=document.getElementById('msg-import');
  var t=(tipo==='cte'?'CTe':tipo==='nfs'?'NFS':tipo==='pag'?'Pagamento':'');
  if(added>0||replaced>0){
    msg.className='smsg msg-ok';
    var txt='\u2713 ';
    if(added>0) txt+=added+' registro(s) de '+t+' adicionado(s)';
    if(replaced>0) txt+=(added>0?' · ':'')+replaced+' substitu\u00eddo(s)';
    if(errors.length) txt+=' · '+errors.length+' linha(s) ignorada(s) por formato inv\u00e1lido';
    msg.textContent=txt;
  } else if(errors.length){
    msg.className='smsg msg-err';
    msg.textContent='\u2717 Nenhum registro importado de '+t+'. Verifique o arquivo.';
  }
  if(added>0||replaced>0||errors.length) msg.style.display='block';
  if(added>0||replaced>0) marcarAlteracao();
}

// Drag & drop
['cte','nfs','pag'].forEach(function(t){
  var el=document.getElementById('drop-'+t);
  el.addEventListener('dragover',function(e){e.preventDefault();el.classList.add('drag');});
  el.addEventListener('dragleave',function(){el.classList.remove('drag');});
  el.addEventListener('drop',function(e){
    e.preventDefault();el.classList.remove('drag');
    var file=e.dataTransfer.files[0]; if(!file)return;
    var inp=el.querySelector('input[type=file]');
    try{var dt=new DataTransfer();dt.items.add(file);inp.files=dt.files;}catch(ex){}
    processFile(t,inp);
  });
});

