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
  var name=file.name.toLowerCase();
  var isXML=name.endsWith('.xml');
  var isXLSX=name.endsWith('.xlsx');

  if(isXLSX){
    parseXLSXRows(file).then(function(rows){
      _handleParsedRows(tipo, rows, file.name);
    }).catch(function(err){
      console.error('Erro ao ler XLSX:', err);
      showImportMsg(0,0,['arquivo'],tipo);
    });
    input.value=''; return;
  }

  var reader=new FileReader();
  reader.onload=function(e){
    var text=e.target.result;

    if(isXML){
      var parsed=[], errors=[];
      var pagMap={};
      CONS.forEach(function(c){if(c.pgto)pagMap[c.doc]=c.pgto;});
      PAG_OJI.forEach(function(p){if(p.data&&p.valor<0)pagMap[p.doc]=p.data;});
      var r=(tipo==='cte')?parseXMLCTe(text):parseXMLNFS(text);
      if(r) parsed.push(r);
      else errors.push('XML inválido ou cancelado/não OJI');
      if(parsed.length>0){
        mostrarConfirmacaoXML(tipo, parsed, errors, pagMap);
      } else {
        showImportMsg(0,0,errors,tipo);
      }
      input.value=''; return;
    }

    _handleParsedRows(tipo, parseCSV(text), file.name);
    input.value='';
  };
  reader.readAsText(file, isXML?'utf-8':'latin-1');
}

// Recebe linhas já tabuladas (de CSV, XLSX ou texto colado) e decide o próximo
// passo: se as colunas não batem com nenhum alias conhecido, abre o mapeamento
// manual (lembrando a escolha pra próxima vez); senão, vai direto pra prévia.
function _handleParsedRows(tipo, rows, sourceLabel){
  var result=_parseRows(tipo, rows);
  if(result.items.length===0 && rows.length>0){
    var headers=Object.keys(rows[0]);
    var remembered=_loadMapping(tipo, headers);
    if(remembered){
      var mapped=_applyMapping(rows, remembered);
      var result2=_parseRows(tipo, mapped);
      mostrarPreviewImportacao(tipo, result2.items, result2.errors, sourceLabel);
      return;
    }
    mostrarMapeamentoColunas(tipo, rows, sourceLabel);
    return;
  }
  mostrarPreviewImportacao(tipo, result.items, result.errors, sourceLabel);
}

// Lê linhas já tabuladas (parseCSV) e devolve os itens prontos para gravar,
// junto com a lista de linhas rejeitadas por formato inválido.
function _parseRows(tipo, rows){
  var items=[], errors=[];
  var pagMap={};
  CONS.forEach(function(c){if(c.pgto)pagMap[c.doc]=c.pgto;});
  PAG_OJI.forEach(function(p){if(p.data&&p.valor<0)pagMap[p.doc]=p.data;});

  if(tipo==='pag'){
    rows.forEach(function(r,i){
      var doc=parseInt(getCol(r,['documento','doc','numero','número','nº','nro']));
      var data=normDate(getCol(r,['data','data pagamento','data_pagamento','datapagamento']));
      var val=parseFloat((getCol(r,['valor'])||'0').replace(',','.'));
      if(!doc||!data||isNaN(val)){errors.push(i+2);return;}
      items.push({doc:doc,data:data,valor:val});
    });
    return {items:items, errors:errors};
  }

  var parsed=[];
  rows.forEach(function(r,i){
    var em,doc,val,vei;
    if(tipo==='cte'){
      em=normDate(getCol(r,['emissao','emissão','data emissao','data_emissao','emissão','data']));
      doc=parseInt(getCol(r,['documento','doc','ct-e','cte','numero','número','nº','nro']));
      val=parseFloat((getCol(r,['valor','frete'])||'0').replace(',','.'));
      vei=(getCol(r,['veiculo','veículo','placa'])||'').toUpperCase();
    } else {
      em=normDate(getCol(r,['emissao','emissão','data emissao','data_emissao','data de emissão','data']));
      doc=parseInt(getCol(r,['documento','doc','número da nota','numero','número','nº','nro']));
      val=parseFloat((getCol(r,['valor','valor do serviço'])||'0').replace(',','.'));
      vei=(getCol(r,['veiculo','veículo','placa'])||'').toUpperCase();
    }
    if(!em||!doc||isNaN(val)){errors.push(i+2);return;}
    parsed.push({doc:doc,em:em,val:val,vei:vei||''});
  });

  parsed.forEach(function(p){
    var venc=calcVenc(p.em), pgto=pagMap[p.doc]||null;
    var st=calcSt(pgto,venc);
    items.push({doc:p.doc,tipo:tipo==='cte'?'CTe':'NFSe',em:p.em,venc:venc,pgto:pgto,val:p.val,vei:p.vei,stKey:st.key,stLbl:st.lbl});
  });
  return {items:items, errors:errors};
}

// ── XLSX (leitura) ─ lê o .xlsx como ZIP nativo do navegador, sem depender
// de biblioteca externa, e devolve linhas no mesmo formato de parseCSV
// (array de objetos, chaves = cabeçalho em minúsculas).
function _xmlDecodeEntities(s){
  return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
}
function _zipFindEntry(bytes, dv, path){
  var eocd=-1;
  for(var i=bytes.length-22;i>=0;i--){ if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;} }
  if(eocd<0) throw new Error('Arquivo ZIP/XLSX inválido');
  var cdOff=dv.getUint32(eocd+16,true), cdCount=dv.getUint16(eocd+10,true);
  var p=cdOff;
  for(var i=0;i<cdCount;i++){
    if(dv.getUint32(p,true)!==0x02014b50) break;
    var method=dv.getUint16(p+10,true);
    var compSize=dv.getUint32(p+20,true);
    var nameLen=dv.getUint16(p+28,true), extraLen=dv.getUint16(p+30,true), commLen=dv.getUint16(p+32,true);
    var lho=dv.getUint32(p+42,true);
    var name='';
    for(var j=0;j<nameLen;j++) name+=String.fromCharCode(bytes[p+46+j]);
    if(name===path){
      var lNameLen=dv.getUint16(lho+26,true), lExtraLen=dv.getUint16(lho+28,true);
      var dataStart=lho+30+lNameLen+lExtraLen;
      return {method:method, data:bytes.slice(dataStart,dataStart+compSize)};
    }
    p+=46+nameLen+extraLen+commLen;
  }
  return null;
}
function _inflateRawBytes(bytes){
  var ds=new DecompressionStream('deflate-raw');
  var stream=new Blob([bytes]).stream().pipeThrough(ds);
  return new Response(stream).arrayBuffer().then(function(buf){return new Uint8Array(buf);});
}
function _readZipXml(bytes, dv, path){
  var entry=_zipFindEntry(bytes, dv, path);
  if(!entry) return Promise.resolve(null);
  var raw = entry.method===0 ? Promise.resolve(entry.data) : _inflateRawBytes(entry.data);
  return raw.then(function(b){ return new TextDecoder('utf-8').decode(b); });
}
function _parseSharedStrings(xml){
  if(!xml) return [];
  var res=[], re=/<si>([\s\S]*?)<\/si>/g, m;
  while((m=re.exec(xml))!==null) res.push(_xmlDecodeEntities(m[1].replace(/<[^>]+>/g,'')));
  return res;
}
// Identifica, por índice de estilo (atributo s="" da célula), se o numFmt aplicado é de data
function _parseDateStyles(xml){
  if(!xml) return [];
  var customFmts={}, re=/<numFmt numFmtId="(\d+)" formatCode="([^"]*)"/g, m;
  while((m=re.exec(xml))!==null) customFmts[m[1]]=_xmlDecodeEntities(m[2]);
  var builtinDateIds={14:1,15:1,16:1,17:1,18:1,19:1,20:1,21:1,22:1,45:1,46:1,47:1};
  var xfsBlock=(xml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)||[])[1]||'';
  var xfs=[], re2=/<xf\b[^>]*\/?>/g, mm;
  while((mm=re2.exec(xfsBlock))!==null){
    var nfMatch=mm[0].match(/numFmtId="(\d+)"/), nf=nfMatch?nfMatch[1]:'0';
    var code=customFmts[nf];
    var isDate = !!builtinDateIds[nf] || (!!code && /[dmy]/i.test(code) && code.indexOf('0')<0);
    xfs.push(isDate);
  }
  return xfs;
}
function _xlsxSerialToDateStr(n){
  var ms=Date.UTC(1899,11,30)+Math.round(n)*86400000;
  var d=new Date(ms);
  return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
}
function _colLettersToIndex(letters){
  var n=0; for(var i=0;i<letters.length;i++) n=n*26+(letters.charCodeAt(i)-64); return n-1;
}
function _parseSheetRows(xml, sst, dateStyles){
  var rows=[], rowRe=/<row[^>]*>([\s\S]*?)<\/row>/g, rm;
  while((rm=rowRe.exec(xml))!==null){
    var cells=[], cellRe=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm;
    while((cm=cellRe.exec(rm[1]))!==null){
      var attrs=cm[1], inner=cm[2]||'';
      var refMatch=attrs.match(/r="([A-Z]+)\d+"/);
      var col=refMatch?_colLettersToIndex(refMatch[1]):cells.length;
      var typeMatch=attrs.match(/t="([^"]+)"/), type=typeMatch?typeMatch[1]:'n';
      var styleMatch=attrs.match(/s="(\d+)"/), styleIdx=styleMatch?parseInt(styleMatch[1],10):0;
      var val='';
      if(type==='s'){
        var vM=inner.match(/<v>([\s\S]*?)<\/v>/);
        val=vM?(sst[parseInt(vM[1],10)]||''):'';
      } else if(type==='inlineStr'){
        var tM=inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        val=tM?_xmlDecodeEntities(tM[1]):'';
      } else {
        var vM2=inner.match(/<v>([\s\S]*?)<\/v>/);
        var raw=vM2?vM2[1]:'';
        val = (raw!=='' && dateStyles[styleIdx]) ? _xlsxSerialToDateStr(parseFloat(raw)) : raw;
      }
      cells[col]=val;
    }
    rows.push(cells);
  }
  return rows;
}
function parseXLSXRows(file){
  return file.arrayBuffer().then(function(buf){
    var bytes=new Uint8Array(buf), dv=new DataView(buf);
    return Promise.all([
      _readZipXml(bytes,dv,'xl/worksheets/sheet1.xml'),
      _readZipXml(bytes,dv,'xl/sharedStrings.xml'),
      _readZipXml(bytes,dv,'xl/styles.xml')
    ]).then(function(res){
      var sheetXml=res[0], sstXml=res[1], stylesXml=res[2];
      if(!sheetXml) return [];
      var sst=_parseSharedStrings(sstXml);
      var dateStyles=_parseDateStyles(stylesXml);
      var rowsRaw=_parseSheetRows(sheetXml, sst, dateStyles);
      if(!rowsRaw.length) return [];
      var header=(rowsRaw[0]||[]).map(function(h){return String(h==null?'':h).trim().toLowerCase();});
      var out=[];
      for(var i=1;i<rowsRaw.length;i++){
        var r=rowsRaw[i];
        if(!r || r.every(function(c){return c===undefined||c==='';})) continue;
        var obj={};
        header.forEach(function(h,j){ obj[h]=r[j]!==undefined?String(r[j]):''; });
        out.push(obj);
      }
      return out;
    });
  });
}

// ── MAPEAMENTO MANUAL DE COLUNAS ──────────────────────────
// Quando nenhum alias conhecido bate com o cabeçalho do arquivo, o usuário
// mapeia manualmente uma vez; a escolha fica salva (por tipo + assinatura do
// cabeçalho) para os próximos arquivos no mesmo formato.
var _mapTipo=null, _mapRows=null, _mapSourceLabel=null;

function _headerSignature(headers){ return headers.slice().sort().join('|'); }
function _mapKey(tipo, headers){ return 'colmap_'+tipo+'_'+_headerSignature(headers); }
function _loadMapping(tipo, headers){
  try{ var raw=localStorage.getItem(_mapKey(tipo,headers)); return raw?JSON.parse(raw):null; }catch(e){ return null; }
}
function _saveMapping(tipo, headers, mapping){
  try{ localStorage.setItem(_mapKey(tipo,headers), JSON.stringify(mapping)); }catch(e){}
}
function _applyMapping(rows, mapping){
  return rows.map(function(r){
    var out={};
    Object.keys(mapping.fields).forEach(function(canonKey){
      var srcHeader=mapping.fields[canonKey];
      if(!srcHeader) return;
      var v=r[srcHeader];
      if(canonKey==='documento' && mapping.stripSuffix && v){ v=String(v).split('-')[0]; }
      out[canonKey]=v;
    });
    return out;
  });
}
function _guessCanonField(tipo, header){
  var aliasMap = tipo==='pag'
    ? {documento:['documento','doc','numero','número','nº','nro'], data:['data','data pagamento','data_pagamento','datapagamento'], valor:['valor']}
    : {documento:['documento','doc','ct-e','cte','numero','número','nº','nro'], emissao:['emissao','emissão','data emissao','data_emissao','data de emissão','data'], valor:['valor','frete','valor do serviço'], veiculo:['veiculo','veículo','placa']};
  for(var k in aliasMap){ if(aliasMap[k].indexOf(header)>=0) return k; }
  return '';
}

function mostrarMapeamentoColunas(tipo, rows, sourceLabel){
  _mapTipo=tipo; _mapRows=rows; _mapSourceLabel=sourceLabel;
  var headers=Object.keys(rows[0]);
  var opts = tipo==='pag'
    ? [['documento','Documento'],['data','Data do pagamento'],['valor','Valor'],['','Ignorar']]
    : [['documento','Documento'],['emissao','Emissão'],['valor','Valor'],['veiculo','Veículo'],['','Ignorar']];

  var rowsHtml='';
  headers.forEach(function(h,i){
    var example=rows[0][h]||'';
    var g=_guessCanonField(tipo,h);
    rowsHtml+='<tr>'
      +'<td style="font-weight:500">'+(h||'(vazio)')+'</td>'
      +'<td class="map-example">'+example+'</td>'
      +'<td><select id="map-col-'+i+'" class="map-select">'
      +opts.map(function(o){return '<option value="'+o[0]+'"'+(o[0]===g?' selected':'')+'>'+o[1]+'</option>';}).join('')
      +'</select></td></tr>';
  });

  var html='<div class="modal-bg" id="modal-mapeamento-bg"><div class="modal" style="max-width:640px">'
    +'<div class="modal-head"><h2>Não reconhecemos todas as colunas</h2>'
    +'<p>Diga o que é cada uma. Da próxima vez que vier nesse formato, o sistema já lembra.</p></div>'
    +'<div class="modal-body">'
    +'<table class="prev-table"><thead><tr><th>Coluna no arquivo</th><th>Exemplo</th><th>É o quê?</th></tr></thead><tbody>'+rowsHtml+'</tbody></table>'
    +'<div class="map-note">'
    +'<label style="display:flex;align-items:center;gap:8px;font-size:13px">'
    +'<input type="checkbox" id="map-strip-suffix"> A coluna Documento tem um sufixo pra remover (ex: "8941-1" → 8941)'
    +'</label></div>'
    +'</div>'
    +'<div class="modal-foot"><span class="modal-foot-info"></span><div class="modal-foot-btns">'
    +'<button class="dup-btn dup-btn-both" onclick="cancelarMapeamento()">Cancelar</button>'
    +'<button class="dup-btn dup-btn-replace" onclick="confirmarMapeamento()">Continuar → ver prévia</button>'
    +'</div></div>'
    +'</div></div>';

  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow='hidden';
}

function cancelarMapeamento(){
  document.getElementById('modal-mapeamento-bg').remove();
  document.body.style.overflow='';
  _mapTipo=null; _mapRows=null; _mapSourceLabel=null;
}

function confirmarMapeamento(){
  var headers=Object.keys(_mapRows[0]);
  var fields={};
  headers.forEach(function(h,i){
    var v=document.getElementById('map-col-'+i).value;
    if(v) fields[v]=h;
  });
  var stripSuffix=document.getElementById('map-strip-suffix').checked;
  var mapping={fields:fields, stripSuffix:stripSuffix};
  _saveMapping(_mapTipo, headers, mapping);

  var mapped=_applyMapping(_mapRows, mapping);
  var result=_parseRows(_mapTipo, mapped);
  var tipo=_mapTipo, sourceLabel=_mapSourceLabel;

  document.getElementById('modal-mapeamento-bg').remove();
  document.body.style.overflow='';
  _mapTipo=null; _mapRows=null; _mapSourceLabel=null;

  mostrarPreviewImportacao(tipo, result.items, result.errors, sourceLabel);
}

// ── COLAR TEXTO (planilha copiada ou e-mail) ──────────────
function abrirColarModal(tipo){
  var t=(tipo==='cte'?'CTe':tipo==='nfs'?'NFS-e':'Pagamento');
  var html='<div class="modal-bg" id="modal-colar-bg"><div class="modal" style="max-width:600px">'
    +'<div class="modal-head"><h2>Colar dados de '+t+'</h2>'
    +'<p>Cole uma planilha copiada (Excel/CSV) ou o texto do e-mail.</p></div>'
    +'<div class="modal-body">'
    +'<textarea id="colar-texto" class="colar-textarea" placeholder="Cole aqui..." oninput="_onColarInput(\''+tipo+'\')"></textarea>'
    +(tipo==='pag'
      ? '<div style="margin-top:12px;display:flex;align-items:center;gap:10px">'
        +'<label style="font-size:12px;color:#78716c">Data do pagamento</label>'
        +'<input type="date" id="colar-data" class="colar-data-input">'
        +'<span id="colar-data-auto" class="prev-badge prev-badge-new" style="display:none">detectada automaticamente</span>'
        +'</div>'
      : '')
    +'</div>'
    +'<div class="modal-foot"><span class="modal-foot-info"></span><div class="modal-foot-btns">'
    +'<button class="dup-btn dup-btn-both" onclick="fecharColarModal()">Cancelar</button>'
    +'<button class="dup-btn dup-btn-replace" onclick="processarColado(\''+tipo+'\')">Processar</button>'
    +'</div></div>'
    +'</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow='hidden';
  document.getElementById('colar-texto').focus();
}

function fecharColarModal(){
  var el=document.getElementById('modal-colar-bg');
  if(el) el.remove();
  document.body.style.overflow='';
}

function _detectarDataNoTexto(txt){
  var m=txt.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if(!m) return null;
  var dd=('0'+m[1]).slice(-2), mm=('0'+m[2]).slice(-2);
  var yyyy = m[3] ? (m[3].length===2?'20'+m[3]:m[3]) : String(getToday().getFullYear());
  return yyyy+'-'+mm+'-'+dd;
}

function _onColarInput(tipo){
  if(tipo!=='pag') return;
  var txt=document.getElementById('colar-texto').value;
  var d=_detectarDataNoTexto(txt);
  var campo=document.getElementById('colar-data'), badge=document.getElementById('colar-data-auto');
  if(d){ campo.value=d; badge.style.display='inline-block'; }
  else { badge.style.display='none'; }
}

// Reconhece linhas do padrão "documento-N  valor,centavos-" usado nos
// e-mails de composição de pagamento da OJI; ignora qualquer linha que não
// bata (saudação, assinatura, linha de total).
function _parseTextoEmailPagamento(txt, dataISO){
  var items=[], errors=[];
  txt.split(/\r?\n/).forEach(function(line){
    var m=line.trim().match(/^(\d+)-\d+\s+([\d.]+,\d{2})(-?)\s*$/);
    if(!m) return;
    var doc=parseInt(m[1],10);
    var raw=parseFloat(m[2].replace(/\./g,'').replace(',','.'));
    var val=m[3]==='-'?-raw:raw;
    if(!doc||isNaN(val)||!dataISO) return;
    items.push({doc:doc, data:dataISO, valor:val});
  });
  return {items:items, errors:errors};
}

function processarColado(tipo){
  var txt=document.getElementById('colar-texto').value;
  var dataISO = tipo==='pag' ? document.getElementById('colar-data').value : null;
  if(!txt.trim()) return;

  // Padrão de e-mail da OJI é bem específico (documento-N  valor,cc-), então
  // testamos ele primeiro — evita confundir vírgulas de texto corrido com
  // separador de tabela.
  if(tipo==='pag'){
    var pareceEmail=/^\s*\d+-\d+\s+[\d.]+,\d{2}-?\s*$/m.test(txt);
    if(pareceEmail && !dataISO){
      alert('Informe a data do pagamento antes de processar.');
      return;
    }
    if(pareceEmail){
      var emailResult=_parseTextoEmailPagamento(txt, dataISO);
      fecharColarModal();
      mostrarPreviewImportacao('pag', emailResult.items, emailResult.errors, 'texto colado (e-mail)');
      return;
    }
  }

  var linhas=txt.trim().split(/\r?\n/).filter(function(l){return l.trim()!=='';});
  var comSeparador=linhas.filter(function(l){return l.indexOf(';')>=0||l.indexOf('\t')>=0||l.indexOf(',')>=0;}).length;
  var temSeparador = linhas.length>0 && (comSeparador/linhas.length)>0.6;

  fecharColarModal();

  if(temSeparador){
    _handleParsedRows(tipo, parseCSV(txt), 'texto colado');
    return;
  }

  alert('Não foi possível reconhecer o formato colado.');
}

// ── PRÉVIA DE IMPORTAÇÃO (lote CSV) ───────────────────────
var _previewTipo=null, _previewItems=null, _previewErrors=null;

function mostrarPreviewImportacao(tipo, items, errors, fileName){
  _previewTipo=tipo; _previewItems=items; _previewErrors=errors;
  var t=(tipo==='cte'?'CTe':tipo==='nfs'?'NFS-e':'Pagamento');

  if(items.length===0){
    showImportMsg(0,0,errors,tipo);
    return;
  }

  var existMap={};
  if(tipo==='pag'){
    PAG_OJI.forEach(function(p){if(!existMap[p.doc])existMap[p.doc]=true;});
  } else {
    CONS.forEach(function(c){existMap[c.doc]=true;});
  }

  var totalVal=0;
  items.forEach(function(it){ totalVal += (tipo==='pag'?it.valor:it.val); });

  var rowsHtml='';
  items.forEach(function(it,i){
    var jaExiste = !!existMap[it.doc];
    var badge = jaExiste
      ? '<span class="prev-badge prev-badge-dup">Já existe no sistema</span>'
      : '<span class="prev-badge prev-badge-new">Novo</span>';
    if(tipo==='pag'){
      rowsHtml+='<tr id="prev-row-'+i+'">'
        +'<td><input type="checkbox" checked onchange="_previewToggle('+i+',this.checked)"></td>'
        +'<td>'+it.doc+'</td>'
        +'<td>'+fD(it.data)+'</td>'
        +'<td style="text-align:right">'+fR(it.valor)+'</td>'
        +'<td>'+badge+'</td>'
        +'</tr>';
    } else {
      rowsHtml+='<tr id="prev-row-'+i+'">'
        +'<td><input type="checkbox" checked onchange="_previewToggle('+i+',this.checked)"></td>'
        +'<td>'+it.doc+'</td>'
        +'<td>'+fD(it.em)+'</td>'
        +'<td>'+(it.vei||'—')+'</td>'
        +'<td style="text-align:right">'+fR(it.val)+'</td>'
        +'<td>'+badge+'</td>'
        +'</tr>';
    }
  });

  errors.forEach(function(linha){
    var cols = tipo==='pag' ? 5 : 6;
    rowsHtml+='<tr class="prev-row-err"><td colspan="'+cols+'">Erro na linha '+linha+' — formato inválido, linha ignorada</td></tr>';
  });

  var headCols = tipo==='pag'
    ? '<th></th><th>Documento</th><th>Data pagamento</th><th style="text-align:right">Valor</th><th>Status</th>'
    : '<th></th><th>Documento</th><th>Emissão</th><th>Veículo</th><th style="text-align:right">Valor</th><th>Status</th>';

  var html = '<div class="modal-bg" id="modal-preview-bg">'
    +'<div class="modal" style="max-width:720px">'
    +'<div class="modal-head">'
    +'<h2>Confirmar importação de '+t+'</h2>'
    +'<p>'+(fileName||'')+' — '+items.length+' registro(s) lido(s)'+(errors.length?', '+errors.length+' com erro':'')+'. Desmarque o que não quer importar.</p>'
    +'</div>'
    +'<div class="modal-body">'
    +'<div class="prev-stats">'
    +'<div class="prev-stat"><div class="prev-stat-lbl">A importar</div><div class="prev-stat-val" id="prev-count-ok">'+items.length+'</div></div>'
    +'<div class="prev-stat"><div class="prev-stat-lbl">Com erro</div><div class="prev-stat-val prev-stat-err">'+errors.length+'</div></div>'
    +'<div class="prev-stat"><div class="prev-stat-lbl">Valor total</div><div class="prev-stat-val" id="prev-total-val">'+fR(totalVal)+'</div></div>'
    +'</div>'
    +'<table class="prev-table"><thead><tr>'+headCols+'</tr></thead><tbody id="prev-tbody">'+rowsHtml+'</tbody></table>'
    +'</div>'
    +'<div class="modal-foot">'
    +'<span class="modal-foot-info" id="prev-foot-info">'+items.length+' selecionado(s)</span>'
    +'<div class="modal-foot-btns">'
    +'<button class="dup-btn dup-btn-both" onclick="cancelarPreviewImportacao()">Cancelar</button>'
    +'<button class="dup-btn dup-btn-replace" id="prev-confirm-btn" onclick="confirmarPreviewImportacao()">Confirmar '+items.length+' registro(s)</button>'
    +'</div></div>'
    +'</div></div>';

  document.body.insertAdjacentHTML('beforeend', html);
  document.body.style.overflow='hidden';
}

function _previewToggle(i, checked){
  document.getElementById('prev-row-'+i).style.opacity = checked?'1':'.4';
  var n = _previewItems.filter(function(it,idx){
    var chk=document.getElementById('prev-row-'+idx).querySelector('input[type=checkbox]');
    return chk && chk.checked;
  }).length;
  document.getElementById('prev-foot-info').textContent=n+' selecionado(s)';
  document.getElementById('prev-confirm-btn').textContent='Confirmar '+n+' registro(s)';
  var totalVal=0;
  _previewItems.forEach(function(it,idx){
    var chk=document.getElementById('prev-row-'+idx).querySelector('input[type=checkbox]');
    if(chk && chk.checked) totalVal += (_previewTipo==='pag'?it.valor:it.val);
  });
  document.getElementById('prev-total-val').textContent=fR(totalVal);
}

function cancelarPreviewImportacao(){
  document.getElementById('modal-preview-bg').remove();
  document.body.style.overflow='';
  _previewTipo=null; _previewItems=null; _previewErrors=null;
}

function confirmarPreviewImportacao(){
  var selecionados=[];
  _previewItems.forEach(function(it,idx){
    var chk=document.getElementById('prev-row-'+idx).querySelector('input[type=checkbox]');
    if(chk && chk.checked) selecionados.push(it);
  });
  var tipo=_previewTipo, errors=_previewErrors;
  document.getElementById('modal-preview-bg').remove();
  document.body.style.overflow='';
  if(selecionados.length===0){
    showImportMsg(0,0,errors,tipo);
    _previewTipo=null; _previewItems=null; _previewErrors=null;
    return;
  }
  if(tipo==='pag') handlePagImport(selecionados, errors);
  else handleConsImport(selecionados, errors, tipo);
  _previewTipo=null; _previewItems=null; _previewErrors=null;
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

