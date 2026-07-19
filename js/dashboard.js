// ── DASHBOARD (SVG puro, sem dependências externas) ───────
function renderDashboard(){
  var data=CONS;
  var hoje=getToday();

  var _st=computeConsStats(data);
  var tval=_st.tval, pval=_st.pval, tok=_st.tok, tlate=_st.tlate, tdue=_st.tdue, topen=_st.topen;
  var pmr=_st.pmr;
  var txInad=_st.txInadPct.toFixed(1);
  var aval=_st.vOpen;
  var dueVal=_st.vDue;
  var tickCte=_st.tickCte, nCte=_st.nCte, tickNfs=_st.tickNfs, nNfs=_st.nNfs;

  // próximo vencimento
  var proxDocs=data.filter(function(r){return r.stKey==='open'&&r.venc;}).sort(function(a,b){return a.venc<b.venc?-1:1;});
  var proxNext=proxDocs[0];
  // soma todos os docs com o mesmo vencimento mais próximo
  var proxValTotal=proxNext?proxDocs.filter(function(r){return r.venc===proxNext.venc;}).reduce(function(a,r){return a+r.val;},0):0;
  var proxN=proxNext?proxDocs.filter(function(r){return r.venc===proxNext.venc;}).length:0;
  var proxLbl=proxNext?(fD(proxNext.venc)+' · '+proxN+' doc(s)'):'Nenhum';

  // ── KPIs linha 1 ──
  document.getElementById('dash-kpis').innerHTML=
    dkpi('','Total emitido',fR(tval),data.length+' documentos')+
    dkpi('ok','Total recebido',fR(pval),(tok+tlate)+' documentos')+
    dkpi('danger','Em atraso',fR(dueVal),tdue+' vencido(s)','irParaConsolidado([\'due\'])')+
    dkpi('accent','Próx. vencimento',proxNext?fR(proxValTotal):'—',proxLbl,'irParaConsolidado([\'open\'])')+
    dkpi('late','Pago c/ atraso',tlate,'de '+(tok+tlate)+' pagos')+
    dkpi('','% Recebido',tval>0?Math.round(pval/tval*100)+'%':'0%','do volume total');

  // ── KPIs linha 2 — métricas avançadas ──
  document.getElementById('dash-kpis2').innerHTML=
    dkpi('','PMR',pmr+' dias','prazo médio de recebimento')+
    dkpi(txInad>10?'danger':txInad>5?'late':'ok','Inadimplência',txInad+'%',tdue+' doc(s) vencido(s)')+
    dkpi('','Ticket médio CTe',nCte?fR(tickCte/nCte):'—',nCte+' CTe')+
    dkpi('','Ticket médio NFS-e',nNfs?fR(tickNfs/nNfs):'—',nNfs+' NFS-e');

  // ── Gráfico mensal ──
  var meses={};
  data.forEach(function(r){
    var m=r.em?r.em.slice(0,7):'?';
    if(!meses[m])meses[m]={em:0,pago:0};
    meses[m].em+=r.val; if(r.pgto)meses[m].pago+=r.val;
  });
  var mKeys=Object.keys(meses).sort();
  var maxM=Math.max.apply(null,mKeys.map(function(m){return meses[m].em;}))||1;
  var W=600,H=200,PL=60,PR=10,PT=20,PB=40;
  var bw=Math.max(8,Math.floor((W-PL-PR)/mKeys.length/2-4));
  var gap=Math.floor((W-PL-PR)/mKeys.length);
  var svgM='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:100%" xmlns="http://www.w3.org/2000/svg">';
  [0,0.25,0.5,0.75,1].forEach(function(f){
    var y=PT+(H-PT-PB)*(1-f);
    svgM+='<line class="dash-svg-grid" x1="'+PL+'" y1="'+y+'" x2="'+(W-PR)+'" y2="'+y+'" stroke="#f5f5f4" stroke-width="1"/>';
    svgM+='<text class="dash-svg-lbl2" x="'+(PL-6)+'" y="'+(y+4)+'" text-anchor="end" font-size="9" fill="#a8a29e">R$'+((maxM*f/1000).toFixed(0))+'k</text>';
  });
  mKeys.forEach(function(m,i){
    var x=PL+i*gap+gap/2;
    var hEm=(H-PT-PB)*(meses[m].em/maxM);
    var hPg=(H-PT-PB)*(meses[m].pago/maxM);
    var yEm=PT+(H-PT-PB)-hEm, yPg=PT+(H-PT-PB)-hPg;
    var lblFull=new Date(m.split('-')[0],m.split('-')[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    svgM+='<rect x="'+(x-bw-2)+'" y="'+yEm+'" width="'+bw+'" height="'+hEm+'" fill="#e0e7ff" stroke="#6366f1" stroke-width="1" rx="2"><title>'+lblFull+'\nEmitido: '+fR(meses[m].em)+'</title></rect>';
    svgM+='<rect x="'+(x+2)+'" y="'+yPg+'" width="'+bw+'" height="'+hPg+'" fill="#bbf7d0" stroke="#16a34a" stroke-width="1" rx="2"><title>'+lblFull+'\nRecebido: '+fR(meses[m].pago)+'</title></rect>';
    svgM+='<text class="dash-svg-lbl" x="'+x+'" y="'+(H-PB+14)+'" text-anchor="middle" font-size="10" fill="#78716c">'+new Date(m.split('-')[0],m.split('-')[1]-1,1).toLocaleDateString('pt-BR',{month:'short'})+'</text>';
  });
  svgM+='<rect x="'+PL+'" y="4" width="10" height="10" fill="#e0e7ff" stroke="#6366f1" stroke-width="1" rx="2"/><text class="dash-svg-lbl" x="'+(PL+14)+'" y="13" font-size="10" fill="#78716c">Emitido</text>';
  svgM+='<rect x="'+(PL+70)+'" y="4" width="10" height="10" fill="#bbf7d0" stroke="#16a34a" stroke-width="1" rx="2"/><text class="dash-svg-lbl" x="'+(PL+84)+'" y="13" font-size="10" fill="#78716c">Recebido</text>';
  svgM+='</svg>';
  document.getElementById('chart-mensal').innerHTML=svgM;

  // ── Aging de recebíveis ──
  var agingFaixas=[
    {lbl:'1 – 15 dias',min:1,max:15,col:'#f59e0b',bg:'#fef3c7'},
    {lbl:'16 – 30 dias',min:16,max:30,col:'#ef4444',bg:'#fee2e2'},
    {lbl:'31 – 60 dias',min:31,max:60,col:'#dc2626',bg:'#fecaca'},
    {lbl:'+ 60 dias',min:61,max:99999,col:'#991b1b',bg:'#fca5a5'}
  ];
  var agingData=agingFaixas.map(function(f){
    var docs=data.filter(function(r){
      if(r.stKey!=='due'||!r.venc) return false;
      var dias=Math.round((hoje-new Date(r.venc+'T00:00:00'))/86400000);
      return dias>=f.min&&dias<=f.max;
    });
    return {lbl:f.lbl,col:f.col,bg:f.bg,n:docs.length,val:docs.reduce(function(a,r){return a+r.val;},0)};
  });
  var maxAging=Math.max.apply(null,agingData.map(function(f){return f.val;}))||1;
  var agHTML='';
  if(tdue===0){
    agHTML='<div style="padding:24px;text-align:center;color:#16a34a;font-size:13px;font-weight:600">✓ Sem recebíveis vencidos</div>';
  } else {
    agHTML='<div style="display:flex;flex-direction:column;gap:12px">';
    agingData.forEach(function(f){
      if(!f.n) return;
      var pct=Math.round(f.val/maxAging*100);
      agHTML+='<div>'
        +'<div style="display:flex;justify-content:space-between;margin-bottom:4px">'
        +'<span style="font-size:12px;font-weight:600;color:'+f.col+'">'+f.lbl+'</span>'
        +'<span style="font-size:12px;color:#78716c">'+f.n+' doc(s) · '+fR(f.val)+'</span>'
        +'</div>'
        +'<div style="height:10px;background:#f5f5f4;border-radius:5px;overflow:hidden">'
        +'<div style="height:100%;width:'+pct+'%;background:'+f.col+';border-radius:5px;transition:width .5s ease"></div>'
        +'</div></div>';
    });
    agHTML+='</div>';
  }
  document.getElementById('chart-aging').innerHTML=agHTML;

  // ── Funil de recebimento ──
  var funilEtapas=[
    {lbl:'Emitido',n:data.length,val:tval,col:'#6366f1',bg:'#ede9fe'},
    {lbl:'Recebido (total)',n:tok+tlate,val:pval,col:'#16a34a',bg:'#dcfce7'},
    {lbl:'Pago em dia',n:tok,val:data.filter(function(r){return r.stKey==='ok';}).reduce(function(a,r){return a+r.val;},0),col:'#15803d',bg:'#bbf7d0'},
    {lbl:'Pago c/ atraso',n:tlate,val:data.filter(function(r){return r.stKey==='late';}).reduce(function(a,r){return a+r.val;},0),col:'#d97706',bg:'#fef3c7'},
    {lbl:'Vencido',n:tdue,val:data.filter(function(r){return r.stKey==='due';}).reduce(function(a,r){return a+r.val;},0),col:'#dc2626',bg:'#fee2e2'},
    {lbl:'A vencer',n:topen,val:aval,col:'#2563eb',bg:'#dbeafe'}
  ];
  var maxFunil=tval||1;
  var funHTML='<div style="display:flex;flex-direction:column;gap:2px">';
  funilEtapas.forEach(function(e){
    if(!e.n) return;
    var pct=Math.round(e.val/maxFunil*100);
    var barW=Math.max(2,pct);
    var fmtVal=fR(e.val).replace('R$','').trim();
    var parts=fmtVal.split(',');
    var intPart=parts[0]||'0';
    var decPart=parts[1]||'00';
    funHTML+='<div class="funil-row" style="padding:4px 0">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">'
        +'<div style="font-size:12px;color:#a8a29e">'+e.lbl+'</div>'
        +'<div style="display:flex;align-items:baseline;gap:6px">'
          +'<span style="font-size:11px;color:#a8a29e">R$</span>'
          +'<span style="font-size:12px;font-weight:600;color:#1c1917;font-variant-numeric:tabular-nums">'+intPart+','+decPart+'</span>'
          +'<span style="font-size:11px;color:#a8a29e;font-variant-numeric:tabular-nums">'+e.n+' doc</span>'
          +'<span style="font-size:11px;color:#a8a29e;font-variant-numeric:tabular-nums;min-width:28px;text-align:right">'+pct+'%</span>'
        +'</div>'
      +'</div>'
      +'<div style="background:#f5f5f4;border-radius:100px;height:7px;overflow:hidden">'
        +'<div style="height:7px;width:'+barW+'%;background:'+e.col+';border-radius:100px;transition:width .5s ease"></div>'
      +'</div>'
    +'</div>';
  });
  funHTML+='</div>';
  document.getElementById('chart-funil').innerHTML=funHTML;

  // ── Próximos vencimentos (3 datas únicas agrupadas) ──
  var proxPorData={};
  proxDocs.forEach(function(r){
    if(!proxPorData[r.venc])proxPorData[r.venc]=0;
    proxPorData[r.venc]+=r.val;
  });
  var proxDatas=Object.keys(proxPorData).sort().slice(0,3);
  var proxHTML='';
  if(!proxDatas.length){
    proxHTML='<div style="padding:24px;text-align:center;color:#a8a29e;font-size:13px">Nenhum documento a vencer</div>';
  } else {
    proxHTML='<div style="display:flex;flex-direction:column">';
    proxDatas.forEach(function(venc){
      var diasR=Math.round((new Date(venc+'T00:00:00')-hoje)/86400000);
      var urgCol=diasR<=7?'#dc2626':diasR<=15?'#d97706':'#2563eb';
      proxHTML+='<div style="display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid #f5f5f4">'
        +'<span style="font-size:14px;font-weight:600;color:#1c1917">'+fD(venc)+'</span>'
        +'<span style="font-size:14px;font-weight:700;color:'+urgCol+';font-variant-numeric:tabular-nums">'+fR(proxPorData[venc])+'</span>'
        +'</div>';
    });
    proxHTML+='</div>';
    var totalDatas=Object.keys(proxPorData).length;
    if(totalDatas>3){
      proxHTML+='<div style="text-align:center;margin-top:10px;padding-top:10px;border-top:1px solid #f5f5f4">'
        +'<span style="font-size:11px;color:#2563eb;font-weight:600;cursor:pointer" onclick="irParaConsolidado([\'open\'])">Ver todos ('+totalDatas+' datas) &#x2192;</span>'
        +'</div>';
    }
  }
  document.getElementById('dash-proximos').innerHTML=proxHTML;

  // ── Ticket médio por tipo ──
  var tickHTML='<div style="display:flex;flex-direction:column;gap:16px;padding-top:8px">';
  [{tipo:'CTe',n:nCte,tick:nCte?tickCte/nCte:0,tot:tickCte,col:'#5b21b6',bg:'#ede9fe'},
   {tipo:'NFS-e',n:nNfs,tick:nNfs?tickNfs/nNfs:0,tot:tickNfs,col:'#065f46',bg:'#d1fae5'}
  ].forEach(function(t){
    tickHTML+='<div>'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
      +'<span style="background:'+t.bg+';color:'+t.col+';font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px">'+t.tipo+'</span>'
      +'<span style="font-size:12px;color:#78716c">'+t.n+' documentos</span>'
      +'</div>'
      +'<div style="font-size:22px;font-weight:700;color:#1c1917;margin-bottom:2px">'+fR(t.tick)+'</div>'
      +'<div style="font-size:11px;color:#78716c">Total: '+fR(t.tot)+'</div>'
      +'</div>';
  });
  tickHTML+='</div>';
  if(document.getElementById('chart-ticket')) document.getElementById('chart-ticket').innerHTML=tickHTML;

  // ── Donut status ──
  var stData=[tok,tlate,tdue,topen];
  var stCols=['#16a34a','#d97706','#dc2626','#2563eb'];
  var stBg=['#dcfce7','#fef3c7','#fee2e2','#dbeafe'];
  var stLbls=['Pago em dia','C/ atraso','Vencido','A vencer'];
  var total2=stData.reduce(function(a,b){return a+b;},0)||1;
  var cx=90,cy=90,ro=75,ri=48;
  var svgS='<svg viewBox="0 0 180 180" style="width:100%;height:100%" xmlns="http://www.w3.org/2000/svg">';
  var ang=-Math.PI/2;
  stData.forEach(function(v,i){
    var sweep=2*Math.PI*(v/total2);
    if(sweep===0)return;
    var x1=cx+ro*Math.cos(ang),y1=cy+ro*Math.sin(ang);
    var x2=cx+ro*Math.cos(ang+sweep),y2=cy+ro*Math.sin(ang+sweep);
    var xi1=cx+ri*Math.cos(ang),yi1=cy+ri*Math.sin(ang);
    var xi2=cx+ri*Math.cos(ang+sweep),yi2=cy+ri*Math.sin(ang+sweep);
    var lg=sweep>Math.PI?1:0;
    svgS+='<path d="M'+x1+' '+y1+' A'+ro+' '+ro+' 0 '+lg+' 1 '+x2+' '+y2
      +' L'+xi2+' '+yi2+' A'+ri+' '+ri+' 0 '+lg+' 0 '+xi1+' '+yi1+' Z"'
      +' fill="'+stBg[i]+'" stroke="'+stCols[i]+'" stroke-width="2" style="cursor:pointer">'
      +'<title>'+stLbls[i]+': '+v+' doc(s) — '+Math.round(v/total2*100)+'%</title></path>';
    ang+=sweep;
  });
  svgS+='<text x="'+cx+'" y="'+(cy-6)+'" text-anchor="middle" font-size="20" font-weight="700" fill="#1c1917">'+total2+'</text>';
  svgS+='<text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" font-size="9" fill="#78716c">documentos</text>';
  svgS+='</svg>';
  if(document.getElementById('chart-status')) document.getElementById('chart-status').innerHTML=svgS;
  var leg='';
  stLbls.forEach(function(l,i){
    leg+='<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#78716c">'
      +'<span style="width:10px;height:10px;border-radius:50%;background:'+stCols[i]+';flex-shrink:0;display:inline-block"></span>'
      +l+': <strong>'+stData[i]+'</strong></div>';
  });
  if(document.getElementById('dash-legend')) document.getElementById('dash-legend').innerHTML=leg;

  // ── Tabela por tipo de veículo ──
  var tipoMap={};
  FROTAS.forEach(function(f){ tipoMap[f.placa]=f.tipo; });

  var mesAtual=hoje.getFullYear()+'-'+(hoje.getMonth()<9?'0':'')+(hoje.getMonth()+1);
  var d1=new Date(hoje.getFullYear(),hoje.getMonth()-1,1);
  var mesAnt=d1.getFullYear()+'-'+(d1.getMonth()<9?'0':'')+(d1.getMonth()+1);

  var tipoNomes=['pickup','truck','carreta'];
  var tipoLabels={pickup:'PICKUP',truck:'TRUCK',carreta:'CARRETA'};
  var tipoChips={pickup:'background:#ede9fe;color:#5b21b6',truck:'background:#dbeafe;color:#1d4ed8',carreta:'background:#fef3c7;color:#92400e'};
  var tiposData={};
  tipoNomes.forEach(function(t){ tiposData[t]={val:0,pval:0,cur:0,ant:0,placas:[]}; });
  tiposData['outros']={val:0,pval:0,cur:0,ant:0,placas:[]};

  data.forEach(function(r){
    var tipo=r.vei?(tipoMap[r.vei]||'outros'):'outros';
    if(!tiposData[tipo])tipo='outros';
    tiposData[tipo].val+=r.val;
    if(r.pgto)tiposData[tipo].pval+=r.val;
    var m=r.em?r.em.slice(0,7):null;
    if(m===mesAtual)tiposData[tipo].cur+=r.val;
    if(m===mesAnt)tiposData[tipo].ant+=r.val;
    if(r.vei&&tiposData[tipo].placas.indexOf(r.vei)<0)tiposData[tipo].placas.push(r.vei);
  });

  // Tabela por tipo
  var thSt='padding:9px 14px;text-align:right;font-size:11px;font-weight:600;color:#78716c;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e7e5e4';
  var thStL='padding:9px 14px;text-align:left;font-size:11px;font-weight:600;color:#78716c;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e7e5e4';
  var tHtml='<table style="width:100%;border-collapse:collapse;font-size:13px">'
    +'<thead><tr>'
    +'<th style="'+thStL+'">Tipo</th>'
    +'<th style="'+thSt+'">Total emitido</th>'
    +'<th style="'+thSt+'">Total pago</th>'
    +'<th style="'+thSt+'">A receber</th>'
    +'</tr></thead><tbody>';
  var totV=0,totP=0;
  tipoNomes.forEach(function(t){
    var d=tiposData[t];
    if(!d.val)return;
    totV+=d.val;totP+=d.pval;
    var arec=d.val-d.pval;
    var placasStr=JSON.stringify(d.placas);
    tHtml+='<tr style="border-bottom:1px solid #f5f5f4;cursor:pointer" onclick="irParaConsolidado(null,'+placasStr+')" title="Ver '+tipoLabels[t]+' no Consolidado">'
      +'<td style="padding:10px 14px"><span style="display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;'+tipoChips[t]+'">'+tipoLabels[t]+'</span></td>'
      +'<td style="padding:10px 14px;text-align:right;font-variant-numeric:tabular-nums">'+fR(d.val)+'</td>'
      +'<td style="padding:10px 14px;text-align:right;color:#16a34a;font-variant-numeric:tabular-nums">'+fR(d.pval)+'</td>'
      +'<td style="padding:10px 14px;text-align:right;color:'+(arec>0?'#dc2626':'#a8a29e')+';font-variant-numeric:tabular-nums">'+fR(arec)+'</td>'
      +'</tr>';
  });
  tHtml+='</tbody><tfoot><tr style="border-top:2px solid #e7e5e4;background:#fafaf9;font-weight:700">'
    +'<td style="padding:10px 14px">Total</td>'
    +'<td style="padding:10px 14px;text-align:right;font-variant-numeric:tabular-nums">'+fR(totV)+'</td>'
    +'<td style="padding:10px 14px;text-align:right;color:#16a34a;font-variant-numeric:tabular-nums">'+fR(totP)+'</td>'
    +'<td style="padding:10px 14px;text-align:right;color:#dc2626;font-variant-numeric:tabular-nums">'+fR(totV-totP)+'</td>'
    +'</tr></tfoot></table>';
  document.getElementById('dash-tipo-wrap').innerHTML=tHtml;

  // ── Faturamento mês atual vs anterior por tipo ──
  var mesLabel=function(m){ var p=m.split('-'); return new Date(p[0],p[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}); };
  var maxFat=0;
  tipoNomes.forEach(function(t){ var d=tiposData[t]; if(d.cur>maxFat)maxFat=d.cur; if(d.ant>maxFat)maxFat=d.ant; });
  if(!maxFat)maxFat=1;

  // Update titulo
  document.getElementById('dash-fat-titulo').innerHTML='Faturamento por tipo &mdash; <span style="color:#4f46e5">'+mesLabel(mesAnt)+'</span> vs <span style="color:#16a34a">'+mesLabel(mesAtual)+'</span>';

  var fatHTML='<div style="display:flex;gap:16px;margin-bottom:16px">'
    +'<span style="font-size:11px;color:#78716c;display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;background:#e0e7ff;border:1px solid #6366f1;border-radius:2px;display:inline-block"></span>'+mesLabel(mesAnt)+'</span>'
    +'<span style="font-size:11px;color:#78716c;display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;background:#bbf7d0;border:1px solid #16a34a;border-radius:2px;display:inline-block"></span>'+mesLabel(mesAtual)+' (parcial)</span>'
    +'</div><div style="display:flex;flex-direction:column;gap:18px">';

  tipoNomes.forEach(function(t){
    var d=tiposData[t];
    if(!d.val)return;
    var wAnt=Math.round((d.ant/maxFat)*100);
    var wCur=Math.round((d.cur/maxFat)*100);
    var delta=d.ant>0?Math.round((d.cur-d.ant)/d.ant*100):null;
    var deltaHtml=delta!==null?(' <span style="font-size:10px;color:'+(delta>=0?'#16a34a':'#dc2626')+'">'+(delta>=0?'↑':'↓')+Math.abs(delta)+'%</span>'):'';
    fatHTML+='<div>'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
      +'<span style="display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;'+tipoChips[t]+'">'+tipoLabels[t]+'</span>'
      +'<div style="display:flex;gap:20px;align-items:baseline">'
      +'<div style="text-align:right"><div style="font-size:10px;color:#a8a29e;margin-bottom:1px">Ant.</div><div style="font-size:13px;font-weight:600;color:#78716c;font-variant-numeric:tabular-nums">'+fR(d.ant)+'</div></div>'
      +'<div style="text-align:right"><div style="font-size:10px;color:#a8a29e;margin-bottom:1px">Atual'+deltaHtml+'</div><div style="font-size:15px;font-weight:700;font-variant-numeric:tabular-nums">'+fR(d.cur)+'</div></div>'
      +'</div></div>'
      +'<div style="display:flex;flex-direction:column;gap:4px">'
      +'<div style="display:flex;align-items:center;gap:8px"><span style="font-size:9px;color:#a8a29e;width:26px;text-align:right;flex-shrink:0">Ant.</span><div style="flex:'+wAnt+';height:8px;background:#e0e7ff;border:1px solid #6366f1;border-radius:2px"></div>'+(wAnt<100?'<div style="flex:'+(100-wAnt)+'"></div>':'')+'</div>'
      +'<div style="display:flex;align-items:center;gap:8px"><span style="font-size:9px;color:#a8a29e;width:26px;text-align:right;flex-shrink:0">Atual</span><div style="flex:'+wCur+';height:8px;background:#bbf7d0;border:1px solid #16a34a;border-radius:2px"></div>'+(wCur<100?'<div style="flex:'+(100-wCur)+'"></div>':'')+'</div>'
      +'</div></div>';
  });
  fatHTML+='</div>';
  document.getElementById('dash-fat-tipo').innerHTML=fatHTML;
}

function dkpi(cls,lbl,val,sub,oc){
  var extra=oc?' onclick="'+oc+'" style="cursor:pointer" title="Ver no Consolidado"':'';
  return '<div class="card '+cls+'"'+extra+'><div class="card-lbl">'+lbl+(oc?' &#x2197;':'')+'</div><div class="card-val" style="font-size:20px">'+val+'</div><div class="card-sub">'+sub+'</div></div>';
}

function irParaConsolidado(statusKeys,veicKeys){
  // aplica filtros antes de navegar
  ['status','veiculo','tipo','mes'].forEach(function(id){
    document.querySelectorAll('#ms-'+id+' input').forEach(function(c){c.checked=false;});
    msChecked[id]=[];updLbl(id);
  });
  if(statusKeys){
    document.querySelectorAll('#ms-status input').forEach(function(c){
      if(statusKeys.indexOf(c.value)>=0){c.checked=true;}
    });
    msChecked['status']=statusKeys;updLbl('status');
  }
  if(veicKeys&&veicKeys.length){
    document.querySelectorAll('#ms-veiculo input').forEach(function(c){
      if(veicKeys.indexOf(c.value)>=0){c.checked=true;}
    });
    msChecked['veiculo']=veicKeys;updLbl('veiculo');
  }
  af();
  showTab('consolidado');
}

function updateHomeCards(){
  var tdue=0,topen=0,tok=0,tlate=0;
  CONS.forEach(function(r){
    if(r.stKey==='due') tdue++;
    else if(r.stKey==='open') topen++;
    else if(r.stKey==='ok') tok++;
    else if(r.stKey==='late') tlate++;
  });
  var el;
  el=document.getElementById('home-sub-consolidado');
  if(el) el.textContent=CONS.length+' documentos'+(tdue?' · '+tdue+' vencido(s)':'');
  el=document.getElementById('home-sub-dashboard');
  if(el) el.textContent=(tdue?'⚠ '+tdue+' vencido(s)':tok+tlate+' pagos · '+topen+' a vencer');
  el=document.getElementById('home-sub-oji');
  if(el) el.textContent=PAG_OJI.length+' lançamentos';
  el=document.getElementById('home-sub-pdf');
  if(el) el.textContent=CONS.length+' documentos disponíveis';
}


