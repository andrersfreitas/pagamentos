// ── PAGAMENTOS OJI ──
var oS={fil:[],pg:0,sk:'data',sd:-1};

function afOji(){
  var meses=getChk('ojimes'), tipos=getChk('ojitipo'), anos=getChk('ojiano');
  var q=document.getElementById('fOD').value.trim().toLowerCase();
  var de=document.getElementById('oji-de').value, ate=document.getElementById('oji-ate').value;
  oS.fil=PAG_OJI.filter(function(r){
    if(meses.length&&meses.indexOf(r.data?r.data.slice(0,7):'')<0) return false;
    if(anos.length&&anos.indexOf(r.data?r.data.slice(0,4):'')<0) return false;
    if(tipos.length){
      var tp=r.valor<0?'pag':'cred';
      if(tipos.indexOf(tp)<0) return false;
    }
    if(de&&r.data&&r.data<de) return false;
    if(ate&&r.data&&r.data>ate) return false;
    if(q&&String(r.doc).indexOf(q)<0) return false;
    return true;
  });
  oS.fil.sort(function(a,b){
    var sk=oS.sk,sd=oS.sd,av=a[sk]||'',bv=b[sk]||'';
    if(sk==='valor'){av=a.valor;bv=b.valor;}
    return sd*(av>bv?1:av<bv?-1:0);
  });
  oS.pg=0; renderO();
}

function soO(k){
  if(oS.sk===k) oS.sd*=-1; else{oS.sk=k;oS.sd=1;}
  document.querySelectorAll('#page-oji thead th').forEach(function(t){t.className='';});
  var el=document.getElementById('oth-'+k); if(el) el.className=oS.sd===1?'asc':'desc';
  afOji();
}

function renderO(){
  var sl=oS.fil.slice(oS.pg*PER,(oS.pg+1)*PER);
  var tb=document.getElementById('tbody-oji'), em=document.getElementById('empty-oji');
  if(!sl.length){tb.innerHTML='';em.style.display='';}
  else{
    em.style.display='none';
    tb.innerHTML=sl.map(function(r){
      var neg=r.valor<0;
      var idxO=PAG_OJI.indexOf(r);
      return '<tr><td class="dc">'+r.doc+'</td><td>'+fD(r.data)+'</td>'+
        '<td class="nc" style="color:'+(neg?'#dc2626':'#16a34a')+'">'+(neg?'- ':'+ ')+fR(r.valor)+'</td>'+
        '<td><button class="btn-del" onclick="excluirPag('+idxO+')" title="Excluir lan\u00e7amento">&#x2715;</button></td></tr>';
    }).join('');
  }
  var total=oS.fil.reduce(function(a,r){return a+r.valor;},0);
  document.getElementById('oji-lbl').textContent='Total ('+oS.fil.length+' registros)';
  document.getElementById('oji-tot').textContent=(total<0?'- ':'')+fR(total);
  document.getElementById('oji-tot').style.color=total<0?'#dc2626':'#16a34a';
  updPag('oji',oS);
  // Cards OJI: Faturado / Pago / Saldo / Pendente
  var hoje=new Date(); hoje.setHours(0,0,0,0);
  var _kFat={},_kPago={};
  CONS.forEach(function(r){
    var d=normVenc(r.venc||''); if(!d) return;
    _kFat[d]=(_kFat[d]||0)+r.val;
  });
  PAG_OJI.forEach(function(r){
    if(r.valor>=0) return;
    var d=normVenc(r.data||''); if(!d) return;
    _kPago[d]=(_kPago[d]||0)+Math.abs(r.valor);
  });
  var kFat=Object.values(_kFat).reduce(function(a,v){return a+v;},0);
  var kPago=Object.values(_kPago).reduce(function(a,v){return a+v;},0);
  var kSaldo=kFat-kPago;
  var _kAccum=0;
  Object.keys(_kFat).sort().forEach(function(d){
    var vd=new Date(d+'T00:00:00');
    if(vd<hoje) _kAccum=Math.max(0,_kAccum+((_kFat[d]||0)-(_kPago[d]||0)));
  });
  var kPend=_kAccum;
  function ojiCard(cls,icon,label,val,valCls,sub,desc){
    return '<div class="card oji-kpi '+cls+'">'
      +'<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
        +'<div class="oji-kpi-icon">'+icon+'</div>'
        +'<span class="oji-kpi-lbl">'+label+'</span>'
      +'</div>'
      +'<div style="font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2;margin-bottom:3px" class="card-val '+valCls+'">'+val+'</div>'
      +'<div class="card-sub" style="margin-bottom:10px">'+sub+'</div>'
      +'<div class="oji-kpi-divider"></div>'
      +'<div class="oji-kpi-desc">'+desc+'</div>'
    +'</div>';
  }
  var kSaldoAbs=fR(Math.abs(kSaldo));
  var saldoSub=kSaldo<0?'pagou mais que o faturado':'a receber no total';
  var nDocsPend=CONS.filter(function(r){ return r.stKey==='due'; }).length;
  var nDocsSaldo=CONS.filter(function(r){ return r.stKey==='due'||r.stKey==='open'; }).length;
  document.getElementById('cards-oji').innerHTML=
    ojiCard('oji-kpi-fat','\ud83d\udcc4','Faturado',fR(kFat),'accent',CONS.length+' documentos','Valor total faturado por data can\u00f4nica de vencimento, independente da data de pagamento.')+
    ojiCard('oji-kpi-pago','\u2713','Pago',fR(kPago),'ok',PAG_OJI.filter(function(r){return r.valor<0;}).length+' pagamentos','Valor total efetivamente recebido no per\u00edodo, normalizado para a data can\u00f4nica correspondente.')+
    ojiCard('oji-kpi-saldo','\u23f1','Saldo',kSaldoAbs,'late',nDocsSaldo+' doc(s) em aberto','<span class="oji-kpi-lbl" style="display:inline">SALDO = FATURADO \u2013 PAGO</span><br>'+fR(kFat)+' \u2013 '+fR(kPago))+
    ojiCard('oji-kpi-pend','\u26a0','Pendente',fR(kPend),'danger',nDocsPend+' documento(s) vencido(s)','Saldo n\u00e3o pago de cada vencimento passado, acumulado e rolante.');
  renderOjiResumoDatas();
}

// Normaliza uma data YYYY-MM-DD para a data can\u00f4nica mais pr\u00f3xima (10, 20 ou \u00faltimo dia do m\u00eas \u226430)
// Faixas: dia 1-4 \u2192 30 do m\u00eas anterior; dia 6-14 \u2192 10; dia 15-24 \u2192 20; dia \u226525 \u2192 30 (ou \u00faltimo dia)
function normVenc(d){
  if(!d) return d;
  var p=d.split('-'),y=parseInt(p[0]),mo=parseInt(p[1]),dy=parseInt(p[2]);
  var pad=function(n){return n<10?'0'+n:''+n;};
  var lastDay=function(yy,mm){return new Date(yy,mm,0).getDate();};
  if(dy>=6&&dy<=14) return y+'-'+pad(mo)+'-10';
  if(dy>=15&&dy<=24) return y+'-'+pad(mo)+'-20';
  if(dy>=25){ var c=Math.min(30,lastDay(y,mo)); return y+'-'+pad(mo)+'-'+pad(c); }
  // dia 1-4: m\u00eas anterior
  var pm=mo-1,py=y; if(pm===0){pm=12;py--;}
  var c2=Math.min(30,lastDay(py,pm));
  return py+'-'+pad(pm)+'-'+pad(c2);
}

var _ojiAccOpen=null;
function renderOjiResumoDatas(){
  var el=document.getElementById('oji-resumo-datas');
  if(!el) return;
  var hoje=new Date(); hoje.setHours(0,0,0,0);
  // Faturado por data can\u00f4nica de vencimento
  var fatData={},nDocsData={};
  CONS.forEach(function(r){
    var d=normVenc(r.venc||''); if(!d) return;
    fatData[d]=(fatData[d]||0)+r.val;
    nDocsData[d]=(nDocsData[d]||0)+1;
  });
  // Pago por data can\u00f4nica do pagamento OJI
  var pagoData={};
  PAG_OJI.forEach(function(r){
    if(r.valor>=0) return;
    var d=normVenc(r.data||''); if(!d) return;
    pagoData[d]=(pagoData[d]||0)+Math.abs(r.valor);
  });
  // Uni\u00e3o de datas can\u00f4nicas
  var todasDatas={};
  Object.keys(fatData).forEach(function(d){todasDatas[d]=true;});
  Object.keys(pagoData).forEach(function(d){todasDatas[d]=true;});
  var datas=Object.keys(todasDatas).sort();
  if(!datas.length){el.innerHTML='<p style="font-size:13px;color:#a8a29e;padding:4px 0">Nenhum dado registrado.</p>';return;}
  // Pendente acumulado (ordem cronol\u00f3gica, s\u00f3 datas vencidas)
  var pendData={},accum=0;
  datas.forEach(function(d){
    var vd=new Date(d+'T00:00:00');
    if(vd<hoje){ accum=Math.max(0,accum+((fatData[d]||0)-(pagoData[d]||0))); pendData[d]=accum; }
  });
  // Agrupar por m\u00eas
  var meses={};
  datas.forEach(function(d){var m=d.slice(0,7);if(!meses[m])meses[m]=[];meses[m].push(d);});
  var mesKeys=Object.keys(meses).sort().reverse();
  if(_ojiAccOpen===null){_ojiAccOpen={};}
  var G='display:grid;grid-template-columns:160px 1fr 1fr 1fr 1fr 44px 20px;align-items:center;';
  var TH='font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;text-align:right;padding:6px 14px 6px 0;';
  var TD='font-size:13px;font-variant-numeric:tabular-nums;text-align:right;padding:10px 14px 10px 0;';
  var MESES_PT=['Janeiro','Fevereiro','Mar\u00e7o','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  function mesLbl(m){var p=m.split('-');return MESES_PT[parseInt(p[1],10)-1]+' '+p[0];}
  function saldoCor(s){return s<-0.005?'#16a34a':Math.abs(s)<=0.005?'#a8a29e':'#d97706';}
  function saldoFmt(s){return (s<0?'\u2212':'')+fR(Math.abs(s));}
  var html='';
  // Cabe\u00e7alho fixo de colunas
  html+='<div style="'+G+'padding:7px 16px;background:#f5f5f4;border:1px solid #e7e5e4;border-radius:8px 8px 0 0;margin-bottom:-1px">'
    +'<span style="'+TH+'color:#a8a29e;text-align:left;padding-left:0;padding-right:0">M\u00eas / Data</span>'
    +'<span style="'+TH+'color:#2563eb">Faturado</span>'
    +'<span style="'+TH+'color:#16a34a">Pago</span>'
    +'<span style="'+TH+'color:#d97706">Saldo \u24d8</span>'
    +'<span style="'+TH+'color:#dc2626">Pendente \u24d8</span>'
    +'<span style="'+TH+'color:#a8a29e;text-align:right;padding-right:0">Docs</span>'
    +'<span></span>'
  +'</div>';
  mesKeys.forEach(function(m){
    var open=!!_ojiAccOpen[m];
    var mFat=meses[m].reduce(function(a,d){return a+(fatData[d]||0);},0);
    var mPago=meses[m].reduce(function(a,d){return a+(pagoData[d]||0);},0);
    var mSaldo=mFat-mPago;
    var mPend=0;
    meses[m].forEach(function(d){if(pendData[d]!==undefined)mPend=pendData[d];});
    var nDocs=meses[m].reduce(function(a,d){return a+(nDocsData[d]||0);},0);
    html+='<div style="border:1px solid #e7e5e4;border-radius:8px;overflow:hidden;margin-bottom:6px" class="oji-acc-bloco">';
    html+='<div onclick="toggleOjiAcc(\''+m+'\')" style="'+G+'padding:11px 16px;cursor:pointer;background:#fafaf9" class="oji-acc-hdr">'
      +'<div style="display:flex;align-items:center;gap:8px">'
        +'<span style="font-size:13px;font-weight:600;color:#1c1917">'+mesLbl(m)+'</span>'
        +'<span style="font-size:11px;color:#a8a29e">'+nDocs+' doc(s)</span>'
      +'</div>'
      +'<span style="'+TD+'color:#2563eb;font-weight:600">'+fR(mFat)+'</span>'
      +'<span style="'+TD+'color:#16a34a;font-weight:600">'+fR(mPago)+'</span>'
      +'<span style="'+TD+'font-weight:600;color:'+saldoCor(mSaldo)+'">'+saldoFmt(mSaldo)+'</span>'
      +'<span style="'+TD+'font-weight:600;color:#dc2626">'+(mPend>0?fR(mPend):'\u2014')+'</span>'
      +'<span style="font-size:13px;font-weight:600;color:#a8a29e;text-align:right;padding-right:4px">'+nDocs+'</span>'
      +'<span style="font-size:10px;color:#a8a29e;text-align:right;transition:transform .15s;display:inline-block;transform:'+(open?'rotate(180deg)':'rotate(0deg)')+'">\u25bc</span>'
    +'</div>';
    if(open){
      html+='<div style="'+G+'padding:5px 16px;background:#f5f5f4;border-top:1px solid #e7e5e4">'
        +'<span style="'+TH+'color:#a8a29e;text-align:left;padding-left:18px;padding-right:0">Data</span>'
        +'<span style="'+TH+'color:#2563eb">Faturado</span>'
        +'<span style="'+TH+'color:#16a34a">Pago</span>'
        +'<span style="'+TH+'color:#d97706">Saldo</span>'
        +'<span style="'+TH+'color:#dc2626">Pendente acum.</span>'
        +'<span style="'+TH+'color:#a8a29e;text-align:right;padding-right:0">Docs</span>'
        +'<span></span>'
      +'</div>';
      meses[m].forEach(function(d){
        var fat=fatData[d]||0,pago=pagoData[d]||0,saldo=fat-pago;
        var pend=pendData[d];
        var nd=nDocsData[d]||0;
        html+='<div style="'+G+'padding:9px 16px;border-top:1px solid #f0efee" class="oji-acc-row">'
          +'<div style="padding-left:18px">'
            +'<span style="font-size:13px;color:#78716c">'+fD(d)+'</span>'
          +'</div>'
          +'<span style="'+TD+'color:#2563eb">'+fR(fat)+'</span>'
          +'<span style="'+TD+'color:#16a34a">'+fR(pago)+'</span>'
          +'<span style="'+TD+'color:'+saldoCor(saldo)+'">'+saldoFmt(saldo)+'</span>'
          +'<span style="'+TD+'color:#dc2626">'+(pend!==undefined?fR(pend):'\u2014')+'</span>'
          +'<span style="font-size:13px;color:#a8a29e;text-align:right;padding-right:4px">'+(nd||'\u2014')+'</span>'
          +'<span></span>'
        +'</div>';
      });
      html+='<div style="'+G+'padding:9px 16px;border-top:1px solid #e7e5e4;background:#fafaf9">'
        +'<span style="font-size:11px;font-weight:700;color:#a8a29e;text-transform:uppercase;letter-spacing:.05em;padding-left:18px">Total do m\u00eas</span>'
        +'<span style="'+TD+'font-weight:700;color:#2563eb">'+fR(mFat)+'</span>'
        +'<span style="'+TD+'font-weight:700;color:#16a34a">'+fR(mPago)+'</span>'
        +'<span style="'+TD+'font-weight:700;color:'+saldoCor(mSaldo)+'">'+saldoFmt(mSaldo)+'</span>'
        +'<span style="'+TD+'font-weight:700;color:#dc2626">'+(mPend>0?fR(mPend):'\u2014')+'</span>'
        +'<span style="font-size:13px;font-weight:700;color:#a8a29e;text-align:right;padding-right:4px">'+nDocs+'</span>'
        +'<span></span>'
      +'</div>';
    }
    html+='</div>';
  });
  // Legenda
  function legItem(cor,icon,lbl,desc){
    return '<div class="card" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px">'
      +'<div class="oji-leg-icon">'+icon+'</div>'
      +'<div><div class="oji-leg-lbl" style="color:'+cor+'">'+lbl+'</div>'
      +'<div class="oji-leg-desc">'+desc+'</div></div></div>';
  }
  html+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px">'
    +legItem('#2563eb','\ud83d\udcc4','Faturado','Total faturado por data can\u00f4nica de vencimento (10, 20 ou \u00faltimo dia do m\u00eas \u226430).')
    +legItem('#16a34a','\u2713','Pago','Total pago via OJI, normalizado para a mesma data can\u00f4nica.')
    +legItem('#d97706','\u23f1','Saldo','Faturado \u2212 Pago. Verde = pagou mais que o faturado.')
    +legItem('#dc2626','\u26a0','Pendente','Saldo de vencimentos passados acumulado e rolante.')
  +'</div>';
  el.innerHTML=html;
}
function toggleOjiAcc(m){
  if(_ojiAccOpen[m]) delete _ojiAccOpen[m]; else _ojiAccOpen[m]=true;
  renderOjiResumoDatas();
}

