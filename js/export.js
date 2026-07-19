// ── ZIP / XLSX ────────────────────────────────────────────
function _zipFiles(files){
  var cT=[];for(var i=0;i<256;i++){var c=i;for(var j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);cT[i]=c;}
  function crc32(b){var c=0xFFFFFFFF;for(var i=0;i<b.length;i++)c=cT[(c^b[i])&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}
  function u8(str){var b=[];for(var i=0;i<str.length;i++){var code=str.charCodeAt(i);if(code<0x80)b.push(code);else if(code<0x800){b.push(0xC0|(code>>6));b.push(0x80|(code&0x3F));}else{b.push(0xE0|(code>>12));b.push(0x80|((code>>6)&0x3F));b.push(0x80|(code&0x3F));}}return b;}
  function u16(n){return[n&0xFF,(n>>8)&0xFF];}
  function u32(n){n=n>>>0;return[n&0xFF,(n>>8)&0xFF,(n>>16)&0xFF,(n>>24)&0xFF];}
  var lp=[],cp=[],off=0;
  files.forEach(function(f){
    var nb=u8(f.name),db=u8(f.data),crc=crc32(db),sz=db.length;
    var loc=[0x50,0x4B,0x03,0x04,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00].concat(u32(crc)).concat(u32(sz)).concat(u32(sz)).concat(u16(nb.length)).concat([0x00,0x00]).concat(nb).concat(db);
    var cen=[0x50,0x4B,0x01,0x02,0x14,0x00,0x14,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00].concat(u32(crc)).concat(u32(sz)).concat(u32(sz)).concat(u16(nb.length)).concat([0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]).concat(u32(off)).concat(nb);
    lp.push(loc); cp.push(cen); off+=loc.length;
  });
  var cs=off,cl=cp.reduce(function(a,b){return a+b.length;},0);
  var end=[0x50,0x4B,0x05,0x06,0x00,0x00,0x00,0x00].concat(u16(files.length)).concat(u16(files.length)).concat(u32(cl)).concat(u32(cs)).concat([0x00,0x00]);
  var all=[];lp.forEach(function(p){all=all.concat(p);});cp.forEach(function(p){all=all.concat(p);});all=all.concat(end);
  return new Uint8Array(all);
}

function _buildXLSX(sheets){
  function xe(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function xc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function col(i){var s='';i++;while(i>0){s=String.fromCharCode(64+(i%26||26))+s;i=Math.floor((i-(i%26||26))/26);}return s;}

  function wsXml(sh){
    var x='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
    sh.rows.forEach(function(row,ri){
      x+='<row r="'+(ri+1)+'">';
      row.forEach(function(c,ci){
        var ref=col(ci)+(ri+1),sa=c.s?' s="'+c.s+'"':'';
        if(c.f){if(c.t==='n')x+='<c r="'+ref+'"'+sa+'><f>'+xc(c.f)+'</f><v>'+(c.v||0)+'</v></c>';else x+='<c r="'+ref+'" t="str"'+sa+'><f>'+xc(c.f)+'</f><v>'+xe(c.v||'')+'</v></c>';}
        else if(c.t==='n')x+='<c r="'+ref+'"'+sa+'><v>'+c.v+'</v></c>';
        else x+='<c r="'+ref+'" t="inlineStr"'+sa+'><is><t>'+xe(c.v||'')+'</t></is></c>';
      });
      x+='</row>';
    });
    x+='</sheetData>';
    if(sh.cfs){sh.cfs.forEach(function(cf){x+=cf;});}
    if(sh.dvs&&sh.dvs.length){
      x+='<dataValidations count="'+sh.dvs.length+'">';
      sh.dvs.forEach(function(dv){x+='<dataValidation type="list" sqref="'+dv.sqref+'" showDropDown="0" allowBlank="1"><formula1>"'+dv.list+'"</formula1></dataValidation>';});
      x+='</dataValidations>';
    }
    return x+'</worksheet>';
  }

  var n=sheets.length;
  var ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map(function(_,i){return'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';}).join('')+'</Types>';
  var rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  var wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map(function(s,i){return'<sheet name="'+xe(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>';}).join('')+'</sheets></workbook>';
  var wbr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map(function(_,i){return'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>';}).join('')+'<Relationship Id="rId'+(n+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  // Styles:
  // fonts: 0=default 1=header-white-bold 2=bold-large 3=green-bold 4=red-bold 5=blue-bold 6=orange-bold 7=small-gray
  // fills: 0=none 1=gray125 2=header-dark 3=pickup-yellow 4=truck-orange 5=carreta-blue 6=pos-green 7=neg-red
  // cellXfs: 0=default 1=header 2=num 3=date 4=num+pickup 5=num+truck 6=num+carreta 7=bold-large 8=bold-green 9=bold-red 10=bold-blue 11=bold-orange 12=small-gray 13=num+pos 14=num+neg
  // dxfs: 0=status-ok 1=status-late 2=status-due 3=status-open 4=diff-pos 5=diff-neg
  var st='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    +'<numFmts count="1"><numFmt numFmtId="164" formatCode="DD/MM/YYYY"/></numFmts>'
    +'<fonts count="8">'
      +'<font><sz val="11"/><name val="Calibri"/></font>'
      +'<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>'
      +'<font><b/><sz val="14"/><name val="Calibri"/></font>'
      +'<font><b/><sz val="14"/><name val="Calibri"/><color rgb="FF15803D"/></font>'
      +'<font><b/><sz val="14"/><name val="Calibri"/><color rgb="FFDC2626"/></font>'
      +'<font><b/><sz val="14"/><name val="Calibri"/><color rgb="FF2563EB"/></font>'
      +'<font><b/><sz val="14"/><name val="Calibri"/><color rgb="FFEA580C"/></font>'
      +'<font><sz val="9"/><name val="Calibri"/><color rgb="FF78716C"/></font>'
    +'</fonts>'
    +'<fills count="8">'
      +'<fill><patternFill patternType="none"/></fill>'
      +'<fill><patternFill patternType="gray125"/></fill>'
      +'<fill><patternFill patternType="solid"><fgColor rgb="FF1C1917"/></patternFill></fill>'
      +'<fill><patternFill patternType="solid"><fgColor rgb="FFFEF9C3"/></patternFill></fill>'
      +'<fill><patternFill patternType="solid"><fgColor rgb="FFFFEDD5"/></patternFill></fill>'
      +'<fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/></patternFill></fill>'
      +'<fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/></patternFill></fill>'
      +'<fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/></patternFill></fill>'
    +'</fills>'
    +'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    +'<cellXfs count="15">'
      +'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
      +'<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
      +'<xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
      +'<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
      +'<xf numFmtId="4" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'
      +'<xf numFmtId="4" fontId="0" fillId="4" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'
      +'<xf numFmtId="4" fontId="0" fillId="5" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'
      +'<xf numFmtId="4" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>'
      +'<xf numFmtId="4" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>'
      +'<xf numFmtId="4" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>'
      +'<xf numFmtId="4" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>'
      +'<xf numFmtId="4" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>'
      +'<xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
      +'<xf numFmtId="4" fontId="0" fillId="6" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'
      +'<xf numFmtId="4" fontId="0" fillId="7" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'
    +'</cellXfs>'
    +'<dxfs count="6">'
      +'<dxf><font><color rgb="FF065F46"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFD1FAE5"/></patternFill></fill></dxf>'
      +'<dxf><font><color rgb="FF92400E"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFFFF3C7"/></patternFill></fill></dxf>'
      +'<dxf><font><color rgb="FF991B1B"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFFEE2E2"/></patternFill></fill></dxf>'
      +'<dxf><font><color rgb="FF1E40AF"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFDBEAFE"/></patternFill></fill></dxf>'
      +'<dxf><font><color rgb="FF15803D"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFDCFCE7"/></patternFill></fill></dxf>'
      +'<dxf><font><color rgb="FFDC2626"/></font><fill><patternFill patternType="solid"><bgColor rgb="FFFEE2E2"/></patternFill></fill></dxf>'
    +'</dxfs>'
    +'</styleSheet>';

  var files=[{name:'[Content_Types].xml',data:ct},{name:'_rels/.rels',data:rels},{name:'xl/workbook.xml',data:wb},{name:'xl/_rels/workbook.xml.rels',data:wbr},{name:'xl/styles.xml',data:st}];
  sheets.forEach(function(s,i){files.push({name:'xl/worksheets/sheet'+(i+1)+'.xml',data:wsXml(s)});});
  return _zipFiles(files);
}

// ── EXPORTAR EXCEL ───────────────────────────────────────
function exportarExcel(){
  var promFrete = (typeof carregarFrete==='function') ? carregarFrete() : Promise.resolve();
  var promPiso  = (typeof carregarCoefPiso==='function') ? carregarCoefPiso() : Promise.resolve();
  Promise.all([promFrete, promPiso]).then(function(){
    try{
      function fV(v){var n=parseFloat(v);return isNaN(n)?0:n;}
      function S(v,s){return{v:String(v==null?'':v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,''),t:'s',s:s||0};}
      function N(v,s){return{v:fV(v),t:'n',s:s||0};}
      function D(d,s){if(!d)return S('');var dt=new Date(d+'T00:00:00'),ep=new Date('1899-12-30T00:00:00');return{v:Math.round((dt-ep)/86400000),t:'n',s:s||3};}
      function F(f,v,s,t){return{f:f,v:(t==='n'?(v||0):String(v||'')),t:t||'str',s:s||0};}
      function H(v){return S(v,1);}
      var _ep=new Date('1899-12-30T00:00:00');
      function _ser(d){return d?Math.round((new Date(d+'T00:00:00')-_ep)/86400000):0;}

      // ── STATS — mesma função usada pelo Dashboard (computeConsStats) ──
      var todayMs=new Date().setHours(0,0,0,0);
      var hojeD=new Date(todayMs);
      var _st=computeConsStats(CONS);
      var tval=_st.tval, pval=_st.pval, tok=_st.tok, tlate=_st.tlate, tdue=_st.tdue, topen=_st.topen;
      var vOpen=_st.vOpen;
      var tickCte=_st.tickCte, nCte=_st.nCte, tickNfs=_st.tickNfs, nNfs=_st.nNfs;
      var pmr=_st.pmr;
      var txInad=(_st.txInadPct.toFixed(1))+'%';
      var pctRec=tval>0?Math.round(pval/tval*100)+'%':'0%';
      var avgCte=nCte?tickCte/nCte:0;
      var avgNfs=nNfs?tickNfs/nNfs:0;
      // Vence em 30d: stKey==='open' e venc entre 0 e 30 dias a partir de hoje
      var v30=CONS.filter(function(r){
        if(r.stKey!=='open'||!r.venc)return false;
        var dias=Math.round((new Date(r.venc+'T00:00:00')-hojeD)/86400000);
        return dias>=0&&dias<=30;
      });
      var v30val=v30.reduce(function(a,r){return a+fV(r.val);},0);
      // Aging: docs vencidos (stKey==='due')
      var aging=[{l:'1 - 15 dias',mn:1,mx:15,d:0,v:0},{l:'16 - 30 dias',mn:16,mx:30,d:0,v:0},{l:'31 - 60 dias',mn:31,mx:60,d:0,v:0},{l:'+ 60 dias',mn:61,mx:9999,d:0,v:0}];
      CONS.forEach(function(r){if(r.stKey!=='due'||!r.venc)return;var dias=Math.round((todayMs-new Date(r.venc+'T00:00:00'))/86400000);aging.forEach(function(a){if(dias>=a.mn&&dias<=a.mx){a.d++;a.v+=fV(r.val);}});});
      var totOji=PAG_OJI.reduce(function(a,r){return a+fV(r.valor);},0);

      // ── ABA 1: CONSOLIDADO ──
      var c1=[[H('Nº Doc'),H('Tipo'),H('Emissão'),H('Vencimento'),H('Pagamento'),H('Valor R$'),H('Veículo'),H('Status')]];
      var rn=2;
      CONS.forEach(function(r){
        // Vencimento: regra dekadio igual ao sistema (dia<=10→10, <=20→20, >20→30 do mes seguinte)
        var vencF='IF(C'+rn+'="","",IF(DAY(C'+rn+')<=10,DATE(YEAR(C'+rn+'),MONTH(C'+rn+')+1,10),IF(DAY(C'+rn+')<=20,DATE(YEAR(C'+rn+'),MONTH(C'+rn+')+1,20),DATE(YEAR(C'+rn+'),MONTH(C'+rn+')+1,30))))';
        // Pagamento: busca data em Pagamentos OJI pelo numero do documento
        var pgtoF="IFERROR(VLOOKUP(A"+rn+",'Pagamentos OJI'!A:B,2,0),\"\")";
        // Status: igual ao sistema com tolerancia de 5 dias
        var stF='IF(D'+rn+'="","Sem vencimento",IF(E'+rn+'="",IF(D'+rn+'<TODAY(),"Vencido ("&INT(TODAY()-D'+rn+')&"d)","A vencer ("&INT(D'+rn+'-TODAY())&"d)"),IF(E'+rn+'<=D'+rn+',"Pago em dia",IF(E'+rn+'<=D'+rn+'+5,"Pago em dia (tol. "&INT(E'+rn+'-D'+rn+')&"d)","Pago c/ atraso ("&INT(E'+rn+'-D'+rn+')&"d)"))))';
        c1.push([S(r.doc),S(r.tipo),D(r.em,3),F(vencF,_ser(r.venc),3,'n'),F(pgtoF,_ser(r.pgto),3,r.pgto?'n':'str'),N(r.val,2),S(r.vei||''),F(stF,r.stLbl||'')]);
        rn++;
      });
      var lr=rn-1;
      c1.push([H('TOTAL'),S(''),S(''),S(''),S(''),N(tval,2),S(''),S('')]);
      // CF: cores de status na coluna H
      var cf1='<conditionalFormatting sqref="H2:H'+lr+'">'
        +'<cfRule type="containsText" operator="containsText" text="Pago em dia" priority="4" dxfId="0"><formula>NOT(ISERROR(SEARCH(&quot;Pago em dia&quot;,H2)))</formula></cfRule>'
        +'<cfRule type="containsText" operator="containsText" text="Pago c/ atraso" priority="3" dxfId="1"><formula>NOT(ISERROR(SEARCH(&quot;Pago c/ atraso&quot;,H2)))</formula></cfRule>'
        +'<cfRule type="containsText" operator="containsText" text="Vencido" priority="2" dxfId="2"><formula>NOT(ISERROR(SEARCH(&quot;Vencido&quot;,H2)))</formula></cfRule>'
        +'<cfRule type="containsText" operator="containsText" text="A vencer" priority="1" dxfId="3"><formula>NOT(ISERROR(SEARCH(&quot;A vencer&quot;,H2)))</formula></cfRule>'
        +'</conditionalFormatting>';

      // ── ABA 2: PAGAMENTOS OJI ──
      var c2=[[H('Documento'),H('Data'),H('Valor R$')]];
      PAG_OJI.forEach(function(r){c2.push([S(r.doc),D(r.data,3),N(r.valor,2)]);});
      c2.push([H('TOTAL'),S(''),N(totOji,2)]);
      c2.push([S(''),S(''),S('')]);
      c2.push([H('Mês'),H('Valor R$'),S('')]);
      var meses={};
      PAG_OJI.forEach(function(r){if(r.data){var m=r.data.slice(0,7);meses[m]=(meses[m]||0)+fV(r.valor);}});
      Object.keys(meses).sort().forEach(function(m){c2.push([S(m.split('-')[1]+'/'+m.split('-')[0]),N(meses[m],2),S('')]);});

      // ── ABA 3: TABELA DE FRETE ──
      var coef=(typeof PISO_COEF!=='undefined')?PISO_COEF:{pickup:{cc:0,ccd:0},truck:{cc:0,ccd:0},carreta:{cc:0,ccd:0}};
      var c3=[[
        H('Origem'),H('Destino'),H('KM'),H('Ped. Ida R$'),H('Ped. Volta R$'),
        H('Pick-up R$'),H('Piso Pick-up'),H('Dif Pick-up'),
        H('Truck R$'),H('Piso Truck'),H('Dif Truck'),
        H('Carreta R$'),H('Piso Carreta'),H('Dif Carreta')
      ]];
      var frn=2;
      (FRETE||[]).forEach(function(r){
        var km=fV(r.km),pu=fV(r.pickup),tr=fV(r.truck),ca=fV(r.carreta);
        var pid=r.pedagio_ida!=null?fV(r.pedagio_ida):0;
        var pvol=r.pedagio_volta!=null?fV(r.pedagio_volta):0;
        var cp=coef.pickup||{},ct_=coef.truck||{},cc_=coef.carreta||{};
        var pp=km*(cp.ccd||0)+(cp.cc||0),pt=km*(ct_.ccd||0)+(ct_.cc||0),pc=km*(cc_.ccd||0)+(cc_.cc||0);
        var pisoP="'Piso ANTT'!$C$2*C"+frn+"+'Piso ANTT'!$B$2";
        var pisoT="'Piso ANTT'!$C$3*C"+frn+"+'Piso ANTT'!$B$3";
        var pisoC="'Piso ANTT'!$C$4*C"+frn+"+'Piso ANTT'!$B$4";
        c3.push([
          S(r.origem),S(r.destino),N(km),N(pid,2),N(pvol,2),
          N(pu,4),F(pisoP,pp,4,'n'),F("F"+frn+"-G"+frn,pu-pp,pu-pp>=0?13:14,'n'),
          N(tr,5),F(pisoT,pt,5,'n'),F("I"+frn+"-J"+frn,tr-pt,tr-pt>=0?13:14,'n'),
          N(ca,6),F(pisoC,pc,6,'n'),F("L"+frn+"-M"+frn,ca-pc,ca-pc>=0?13:14,'n')
        ]);
        frn++;
      });
      var fmax=Math.max(frn,3);
      var cf3='<conditionalFormatting sqref="H2:H'+fmax+'">'
        +'<cfRule type="cellIs" operator="greaterThanOrEqual" priority="2" dxfId="4"><formula>0</formula></cfRule>'
        +'<cfRule type="cellIs" operator="lessThan" priority="1" dxfId="5"><formula>0</formula></cfRule>'
        +'</conditionalFormatting>'
        +'<conditionalFormatting sqref="K2:K'+fmax+'">'
        +'<cfRule type="cellIs" operator="greaterThanOrEqual" priority="2" dxfId="4"><formula>0</formula></cfRule>'
        +'<cfRule type="cellIs" operator="lessThan" priority="1" dxfId="5"><formula>0</formula></cfRule>'
        +'</conditionalFormatting>'
        +'<conditionalFormatting sqref="N2:N'+fmax+'">'
        +'<cfRule type="cellIs" operator="greaterThanOrEqual" priority="2" dxfId="4"><formula>0</formula></cfRule>'
        +'<cfRule type="cellIs" operator="lessThan" priority="1" dxfId="5"><formula>0</formula></cfRule>'
        +'</conditionalFormatting>';

      // ── ABA 4: DASHBOARD — mesma lógica do renderDashboard() ──
      var c4=[];
      c4.push([H('TOTAL EMITIDO'),H('TOTAL RECEBIDO'),H('A RECEBER'),H('A VENCER'),H('PAGO C/ ATRASO'),H('% RECEBIDO')]);
      c4.push([N(tval,7),N(pval,8),N(tval-pval,9),N(vOpen,10),S(String(tlate),11),S(pctRec,7)]);
      c4.push([S(CONS.length+' documentos',12),S((tok+tlate)+' documentos',12),S(tdue+' vencido(s)',12),S(topen+' doc(s)',12),S('de '+(tok+tlate)+' pagos',12),S('do volume total',12)]);
      c4.push([S(''),S(''),S(''),S(''),S(''),S('')]);
      c4.push([H('PMR'),H('INADIMPLÊNCIA'),H('VENCE EM 30D'),H('TICKET MÉDIO CTe'),H('TICKET MÉDIO NFS-e'),H('TOTAL OJI')]);
      c4.push([S(pmr+' dias',7),S(txInad,9),N(v30val,10),N(avgCte,8),N(avgNfs,8),N(totOji,8)]);
      c4.push([S('prazo médio',12),S(tdue+' doc(s)',12),S(v30.length+' doc(s)',12),S(nCte+' CTe',12),S(nNfs+' NFS-e',12),S(PAG_OJI.length+' lançamentos',12)]);
      c4.push([S(''),S(''),S(''),S(''),S(''),S('')]);
      c4.push([H('AGING DE RECEBÍVEIS'),H('Docs'),H('Valor R$'),S(''),S(''),S('')]);
      aging.forEach(function(a){c4.push([S(a.l),N(a.d),N(a.v,2),S(''),S(''),S('')]);});

      // ── ABA 5: PISO ANTT ──
      var c5=[[H('Veiculo'),H('CC R$'),H('CCD R$/km')]];
      ['pickup','truck','carreta'].forEach(function(v){var c=coef[v]||{cc:0,ccd:0};c5.push([S(v),N(c.cc||0,2),N(c.ccd||0,2)]);});

      // ── ABA 6: LANÇAMENTOS (FORMULÁRIO) ──
      // Formulário vertical: campo por linha, calculados automáticos
      // + tabela acumuladora abaixo onde o usuário cola os lançamentos confirmados
      // Estilos de entrada: s=4 (amarelo) para campos editáveis
      //                     s=12 (cinza) para campos calculados / read-only
      // Linha de tabela: começa em tblStart (após formulário + separador)
      var NTBL=100; // linhas disponíveis na tabela acumuladora
      // Fórmulas do formulário referenciam B3..B7 (campos de entrada)
      // B3=Nº Doc, B4=Tipo, B5=Emissão, B6=Valor R$, B7=Veículo
      // B9=Vencimento(calc), B10=Pagamento(calc), B11=Status(calc)
      var vencFrm='IF(B5="","",IF(DAY(B5)<=10,DATE(YEAR(B5),MONTH(B5)+1,10),IF(DAY(B5)<=20,DATE(YEAR(B5),MONTH(B5)+1,20),DATE(YEAR(B5),MONTH(B5)+1,30))))';
      var pgtoFrm="IF(B3=\"\",\"\",IFERROR(VLOOKUP(B3,'Pagamentos OJI'!A:B,2,0),\"\"))";
      var stFrm='IF(B9="","",IF(B10="",IF(B9<TODAY(),"Vencido ("&INT(TODAY()-B9)&"d)","A vencer ("&INT(B9-TODAY())&"d)"),IF(B10<=B9,"Pago em dia",IF(B10<=B9+5,"Pago em dia (tol. "&INT(B10-B9)&"d)","Pago c/ atraso ("&INT(B10-B9)&"d)"))))';
      // Fórmulas da tabela acumuladora (col A=doc, B=tipo, C=emissão, D=valor, E=veículo, F=venc, G=pgto, H=status)
      var tblStart=16; // primeira linha de dados da tabela (linha 16)
      var tblEnd=tblStart+NTBL-1;
      var c6=[];
      // Linha 1: título
      c6.push([S('FORMULÁRIO DE LANÇAMENTO',1),S(''),S('')]);
      // Linha 2: instrução
      c6.push([S('Preencha os campos em amarelo. Os campos cinza são calculados automaticamente.',12),S(''),S('')]);
      // Linha 3: Nº Documento
      c6.push([S('Nº Documento',0),S('',4),S('')]);
      // Linha 4: Tipo
      c6.push([S('Tipo',0),S('',4),S('← CTe ou NFSe')]);
      // Linha 5: Data Emissão
      c6.push([S('Data Emissão',0),S('',4),S('← formato DD/MM/AAAA')]);
      // Linha 6: Valor R$
      c6.push([S('Valor R$',0),S('',4),S('')]);
      // Linha 7: Veículo
      c6.push([S('Veículo',0),S('',4),S('← pickup, truck ou carreta')]);
      // Linha 8: separador
      c6.push([S(''),S(''),S('')]);
      // Linha 9: Vencimento (calculado)
      c6.push([S('Vencimento',0),F(vencFrm,0,3,'n'),S('← calculado pelo sistema (regra dekádio)')]);
      // Linha 10: Pagamento OJI (calculado)
      c6.push([S('Pagamento OJI',0),F(pgtoFrm,0,3,'n'),S('← busca data paga em Pagamentos OJI')]);
      // Linha 11: Status (calculado)
      c6.push([S('Status',0),F(stFrm,'','str'),S('← calculado igual ao sistema')]);
      // Linha 12: separador
      c6.push([S(''),S(''),S('')]);
      // Linha 13: instrução tabela
      c6.push([S('Após conferir os dados acima, copie a linha B3:B11 e cole como VALORES na tabela abaixo (Ctrl+C → colar especial → Valores).',12),S(''),S('')]);
      // Linha 14: separador
      c6.push([S(''),S(''),S('')]);
      // Linha 15: cabeçalho da tabela acumuladora
      c6.push([H('Nº Doc'),H('Tipo'),H('Emissão'),H('Valor R$'),H('Veículo'),H('Vencimento'),H('Pagamento OJI'),H('Status')]);
      // Linhas da tabela (tblStart=16 .. tblEnd)
      for(var ti=0;ti<NTBL;ti++){
        var tr=tblStart+ti;
        var vTbl='IF(C'+tr+'="","",IF(DAY(C'+tr+')<=10,DATE(YEAR(C'+tr+'),MONTH(C'+tr+')+1,10),IF(DAY(C'+tr+')<=20,DATE(YEAR(C'+tr+'),MONTH(C'+tr+')+1,20),DATE(YEAR(C'+tr+'),MONTH(C'+tr+')+1,30))))';
        var gTbl="IF(A"+tr+"=\"\",\"\",IFERROR(VLOOKUP(A"+tr+",'Pagamentos OJI'!A:B,2,0),\"\"))";
        var hTbl='IF(AND(A'+tr+'="",C'+tr+'=""),"",IF(F'+tr+'="","Sem vencimento",IF(G'+tr+'="",IF(F'+tr+'<TODAY(),"Vencido ("&INT(TODAY()-F'+tr+')&"d)","A vencer ("&INT(F'+tr+'-TODAY())&"d)"),IF(G'+tr+'<=F'+tr+',"Pago em dia",IF(G'+tr+'<=F'+tr+'+5,"Pago em dia (tol. "&INT(G'+tr+'-F'+tr+')&"d)","Pago c/ atraso ("&INT(G'+tr+'-F'+tr+')&"d)"))))))';
        c6.push([S(''),S(''),S(''),S(''),S(''),F(vTbl,0,3,'n'),F(gTbl,0,3,'n'),F(hTbl,'','str')]);
      }
      // Data validations: Tipo e Veículo no formulário e na tabela
      var c6dvs=[
        {sqref:'B4',             list:'CTe,NFSe'},
        {sqref:'B7',             list:'pickup,truck,carreta'},
        {sqref:'B'+tblStart+':B'+tblEnd, list:'CTe,NFSe'},
        {sqref:'E'+tblStart+':E'+tblEnd, list:'pickup,truck,carreta'}
      ];

      var xlsx=_buildXLSX([
        {name:'Consolidado',rows:c1,cfs:[cf1]},
        {name:'Pagamentos OJI',rows:c2},
        {name:'Tabela de Frete',rows:c3,cfs:[cf3]},
        {name:'Dashboard',rows:c4},
        {name:'Piso ANTT',rows:c5},
        {name:'Lancamentos',rows:c6,dvs:c6dvs}
      ]);
      var agora=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'-');
      var blob=new Blob([xlsx],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');a.href=url;a.download='pagamentos_'+agora+'.xlsx';
      document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    }catch(e){alert('Erro ao exportar: '+e.message+'\n'+e.stack);}
  });
}

// ── BACKUP JSON + RESTAURAÇÃO ────────────────────────────
function _buildBackupPayload(){
  CONS.forEach(function(r){ var s=calcSt(r.pgto,r.venc); r.stKey=s.key; r.stLbl=s.lbl; });
  return { versao:2, ts:new Date().toISOString(), gerado:new Date().toLocaleString('pt-BR'),
    totais:{cons:CONS.length,pag:PAG_OJI.length,frete:FRETE.length},
    CONS:CONS, PAG_OJI:PAG_OJI, VEICS:VEICS, MC:MC, MO:MO, FRETE:FRETE, COLETAS:COLETAS };
}

function fazerBackup(){
  var promFrete=(typeof carregarFrete==='function')?carregarFrete():Promise.resolve();
  var promColetas=(typeof carregarColetas==='function')?carregarColetas():Promise.resolve();
  Promise.all([promFrete,promColetas]).then(function(){
    try{
      _buildBackupPayload();
      var el=document.getElementById('modal-backup');
      if(!el){el=document.createElement('div');el.id='modal-backup';el.className='modal-overlay';document.body.appendChild(el);}
      el.innerHTML=
        '<div class="modal-box">'
        +'<div class="modal-title">\uD83D\uDCE6 Confirmar Backup</div>'
        +'<div class="modal-row"><span>Documentos (Consolidado)</span><span class="modal-val">'+CONS.length+'</span></div>'
        +'<div class="modal-row"><span>Pagamentos OJI</span><span class="modal-val">'+PAG_OJI.length+'</span></div>'
        +'<div class="modal-row"><span>Fretes</span><span class="modal-val">'+FRETE.length+'</span></div>'
        +'<div class="modal-row"><span>Data</span><span class="modal-val">'+new Date().toLocaleString('pt-BR')+'</span></div>'
        +'<div class="modal-footer">'
        +'<button class="modal-btn modal-btn-cancel" onclick="document.getElementById(\'modal-backup\').style.display=\'none\'">Cancelar</button>'
        +'<button class="modal-btn modal-btn-confirm" onclick="confirmarBackup()">Baixar Backup</button>'
        +'</div></div>';
      el.style.display='flex';
    }catch(e){alert('Erro: '+e.message);}
  });
}

function confirmarBackup(){
  document.getElementById('modal-backup').style.display='none';
  var btn=document.getElementById('btn-backup');
  btn.textContent='\u231B Gerando...'; btn.disabled=true;
  try{
    var payload=_buildBackupPayload();
    var ts=new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})
          +'_'+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}).replace(':','-');
    var blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a'); a.href=url; a.download='backup_pagamentos_'+ts+'.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    var ico='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    btn.innerHTML='\u2713 Backup salvo!'; btn.style.background='#16a34a';
    setTimeout(function(){btn.innerHTML=ico+' Backup';btn.style.background='#2563eb';btn.disabled=false;},3000);
  }catch(e){alert('Erro ao gerar backup: '+e.message);btn.innerHTML='Backup';btn.disabled=false;}
}

// \u2500\u2500 BACKUP GOOGLE DRIVE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
var _driveToken=null;

function backupDrive(){
  var btn=document.getElementById('btn-drive');
  var clientId=localStorage.getItem('goog_client_id')||'';
  if(!clientId){
    clientId=prompt('Para usar o backup no Google Drive, informe o Client ID do seu projeto Google Cloud.\n\n'
      +'(console.cloud.google.com \u2192 APIs e servi\u00E7os \u2192 Credenciais \u2192 Criar credencial OAuth 2.0 \u2192 Aplicativo da Web)\n\nClient ID:');
    if(!clientId)return;
    localStorage.setItem('goog_client_id',clientId.trim());
  }
  btn.textContent='\u231B Conectando...'; btn.disabled=true;
  _carregarGIS(function(){
    google.accounts.oauth2.initTokenClient({
      client_id:localStorage.getItem('goog_client_id'),
      scope:'https://www.googleapis.com/auth/drive.file',
      callback:function(resp){
        if(resp.error){alert('Erro ao autenticar com Google: '+resp.error);btn.textContent='Drive';btn.style.background='#1a73e8';btn.disabled=false;return;}
        _driveToken=resp.access_token;
        _executarBackupDrive(btn);
      }
    }).requestAccessToken();
  });
}

function _carregarGIS(cb){
  if(window.google&&window.google.accounts){cb();return;}
  var s=document.createElement('script');
  s.src='https://accounts.google.com/gsi/client';
  s.onload=cb;
  s.onerror=function(){alert('N\u00E3o foi poss\u00EDvel carregar o servi\u00E7o Google. Verifique a conex\u00E3o com a internet.');};
  document.head.appendChild(s);
}

function _executarBackupDrive(btn){
  var promFrete=(typeof carregarFrete==='function')?carregarFrete():Promise.resolve();
  var promColetas=(typeof carregarColetas==='function')?carregarColetas():Promise.resolve();
  Promise.all([promFrete,promColetas]).then(function(){
    try{
      var payload=JSON.stringify(_buildBackupPayload(),null,2);
      btn.textContent='\u231B Enviando...';
      fetch("https://www.googleapis.com/drive/v3/files?q=name%3D'backup_pagamentos_atual.json'+and+trashed%3Dfalse&fields=files(id)",
        {headers:{Authorization:'Bearer '+_driveToken}})
      .then(function(r){return r.json();})
      .then(function(lista){
        var atualId=lista.files&&lista.files[0]?lista.files[0].id:null;
        var p=Promise.resolve();
        if(atualId){
          p=fetch("https://www.googleapis.com/drive/v3/files?q=name%3D'backup_pagamentos_anterior.json'+and+trashed%3Dfalse&fields=files(id)",
            {headers:{Authorization:'Bearer '+_driveToken}})
          .then(function(r){return r.json();})
          .then(function(ant){
            var antId=ant.files&&ant.files[0]?ant.files[0].id:null;
            if(antId)return fetch('https://www.googleapis.com/drive/v3/files/'+antId,{method:'DELETE',headers:{Authorization:'Bearer '+_driveToken}});
          })
          .then(function(){
            return fetch('https://www.googleapis.com/drive/v3/files/'+atualId,
              {method:'PATCH',headers:{Authorization:'Bearer '+_driveToken,'Content-Type':'application/json'},
               body:JSON.stringify({name:'backup_pagamentos_anterior.json'})});
          });
        }
        return p.then(function(){
          var boundary='bk'+Date.now();
          var meta=JSON.stringify({name:'backup_pagamentos_atual.json',mimeType:'application/json'});
          var body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta
                  +'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+payload
                  +'\r\n--'+boundary+'--';
          return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {method:'POST',headers:{Authorization:'Bearer '+_driveToken,'Content-Type':'multipart/related; boundary='+boundary},body:body});
        });
      })
      .then(function(r){return r.json();})
      .then(function(){
        btn.textContent='\u2713 Drive salvo!'; btn.style.background='#16a34a';
        setTimeout(function(){btn.textContent='Drive';btn.style.background='#1a73e8';btn.disabled=false;},3000);
      })
      .catch(function(e){alert('Erro no backup Drive: '+e.message);btn.textContent='Drive';btn.style.background='#1a73e8';btn.disabled=false;});
    }catch(e){alert('Erro: '+e.message);btn.textContent='Drive';btn.disabled=false;}
  });
}

function restaurarBackup(input){
  var file = input.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var payload = JSON.parse(e.target.result);
      if(!payload.CONS || !payload.PAG_OJI){
        alert('Arquivo inv\u00e1lido: n\u00e3o \u00e9 um backup gerado por este sistema.');
        input.value=''; return;
      }
      var temFrete = Array.isArray(payload.FRETE);
      var msg = 'Restaurar backup de ' + (payload.gerado||'data desconhecida') + '?\n\n'
        + '\u2022 ' + payload.CONS.length + ' documentos (CTe + NFS-e)\n'
        + '\u2022 ' + payload.PAG_OJI.length + ' lan\u00e7amentos de pagamento\n'
        + (temFrete ? '\u2022 ' + payload.FRETE.length + ' rotas de frete\n' : '\u2022 (backup antigo, sem dados de frete)\n')
        + '\nOs dados atuais ser\u00e3o substitu\u00eddos.';
      if(!confirm(msg)){ input.value=''; return; }

      // Restaurar dados do sistema de pagamentos
      CONS.length=0; payload.CONS.forEach(function(r){CONS.push(r);});
      PAG_OJI.length=0; payload.PAG_OJI.forEach(function(r){PAG_OJI.push(r);});
      if(payload.VEICS){VEICS.length=0; payload.VEICS.forEach(function(v){VEICS.push(v);});}
      if(payload.MC){MC.length=0; payload.MC.forEach(function(m){MC.push(m);});}
      if(payload.MO){MO.length=0; payload.MO.forEach(function(m){MO.push(m);});}

      // Recalcular status com hoje
      CONS.forEach(function(r){ var s=calcSt(r.pgto,r.venc); r.stKey=s.key; r.stLbl=s.lbl; });

      // Salvar no localStorage imediatamente
      autoSave();

      // Reconstruir filtro de veículos com novos dados
      VEICS.length=0;
      var veicSet={};
      CONS.forEach(function(r){ if(r.vei && !veicSet[r.vei]){ veicSet[r.vei]=1; VEICS.push(r.vei); }});
      VEICS.sort();
      if(typeof rebuildVeicFilter==='function') rebuildVeicFilter();

      // Reconstruir filtro de mês (Consolidado) com os dados restaurados
      MC.length=0;
      var mesSet={};
      CONS.forEach(function(r){ if(r.em){ var m=r.em.slice(0,7); if(!mesSet[m]){mesSet[m]=1; MC.push(m);} } });
      MC.sort();
      if(typeof rebuildConsMesFilter==='function') rebuildConsMesFilter();

      if(typeof rebuildOjiMesFilter==='function') rebuildOjiMesFilter();
      if(typeof rebuildOjiAnoFilter==='function') rebuildOjiAnoFilter();
      if(typeof afOji==='function') afOji();

      // Restaurar Tabela de Frete e Coletas Adicionais (se o backup tiver)
      if(temFrete){
        FRETE.length=0; payload.FRETE.forEach(function(r){FRETE.push(r);});
        try{ localStorage.setItem('tabela_frete_cache', JSON.stringify(FRETE)); }catch(e){}
        if(typeof filtrarFrete==='function') filtrarFrete();
        if(typeof renderCardsFrete==='function') renderCardsFrete();
        // Re-sincronizar cada rota individualmente no Supabase (upsert seguro, sem apagar em massa)
        if(_sbOnline){
          FRETE.forEach(function(r){
            var corpo = {origem:r.origem, destino:r.destino, km:r.km, pickup:r.pickup, truck:r.truck, carreta:r.carreta};
            if(r.id){
              sbFetch('tabela_frete?id=eq.'+r.id, {method:'PATCH', headers:Object.assign({},sbHeaders(),{'Prefer':'return=minimal'}), body:JSON.stringify(corpo)})
              .catch(function(e){ console.warn('Falha ao re-sincronizar rota', r.id, e); });
            }
          });
        }
      }
      if(payload.COLETAS){
        COLETAS.fora = payload.COLETAS.fora || COLETAS.fora;
        COLETAS.piracicaba = payload.COLETAS.piracicaba || COLETAS.piracicaba;
        try{ localStorage.setItem('coletas_adicionais_cache', JSON.stringify(COLETAS)); }catch(e){}
        if(typeof renderColetasPainel==='function') renderColetasPainel();
        if(_sbOnline){
          ['fora','piracicaba'].forEach(function(grupo){
            var d = COLETAS[grupo]; if(!d) return;
            sbFetch('coletas_adicionais?grupo=eq.'+grupo, {method:'PATCH', headers:Object.assign({},sbHeaders(),{'Prefer':'return=minimal'}), body:JSON.stringify({pickup:d.pickup,truck:d.truck,carreta:d.carreta})})
            .catch(function(e){ console.warn('Falha ao re-sincronizar coleta', grupo, e); });
          });
        }
      }

      // Atualizar interface
      af();
      renderDashboard();

      var badge = document.getElementById('autosave-badge');
      badge.textContent = '\u2713 Backup restaurado: ' + payload.CONS.length + ' docs \u00b7 ' + payload.PAG_OJI.length + ' pagamentos' + (temFrete ? ' \u00b7 ' + payload.FRETE.length + ' rotas' : '');
      badge.style.background = '#dbeafe';
      badge.style.color = '#1d4ed8';
      badge.style.borderColor = '#93c5fd';
      badge.style.display = '';
      input.value='';
    } catch(err){
      alert('Erro ao ler o arquivo de backup:\n' + err.message);
      input.value='';
    }
  };
  reader.readAsText(file, 'utf-8');
}

// Atalho Ctrl+S → backup
document.addEventListener('keydown', function(e){
  if((e.ctrlKey||e.metaKey) && e.key==='s'){ e.preventDefault(); fazerBackup(); }
});


