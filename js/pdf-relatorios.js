// ── PAGINAÇÃO ──
function pp(t){ var s=t==='cons'?cS:oS; if(s.pg>0){s.pg--;t==='cons'?renderC():renderO();} }
function np(t){ var s=t==='cons'?cS:oS; if((s.pg+1)*PER<s.fil.length){s.pg++;t==='cons'?renderC():renderO();} }
function updPag(t,s){
  var tot=s.fil.length,pgs=Math.max(1,Math.ceil(tot/PER));
  document.getElementById('pi-'+t).textContent=tot.toLocaleString('pt-BR')+' registros \u00b7 p\u00e1gina '+(s.pg+1)+' de '+pgs;
  var bp=document.getElementById('btnP-'+t),bn=document.getElementById('btnN-'+t);
  if(bp)bp.disabled=s.pg===0;
  if(bn)bn.disabled=(s.pg+1)*PER>=tot;
}

// ── PDF ──
function getPDFData(){
  var ok=document.getElementById('pdf-ok').checked,
      late=document.getElementById('pdf-late').checked,
      due=document.getElementById('pdf-due').checked,
      open=document.getElementById('pdf-open').checked,
      cte=document.getElementById('pdf-cte').checked,
      nfs=document.getElementById('pdf-nfs').checked,
      de=document.getElementById('pdf-de').value,
      ate=document.getElementById('pdf-ate').value,
      veics=getChk('pdfveic');
  var data=CONS.filter(function(r){
    if(r.stKey==='ok'&&!ok)return false;
    if(r.stKey==='late'&&!late)return false;
    if(r.stKey==='due'&&!due)return false;
    if(r.stKey==='open'&&!open)return false;
    if(r.tipo==='CTe'&&!cte)return false;
    if(r.tipo==='NFSe'&&!nfs)return false;
    if(veics.length&&veics.indexOf(r.vei)<0)return false;
    if(de&&r.em&&r.em<de)return false;
    if(ate&&r.em&&r.em>ate)return false;
    return true;
  });
  // Ordenar: vencidos primeiro se opção ativa
  if(document.getElementById('pdf-vencidos-top').checked){
    var ordem={due:0,late:1,open:2,ok:3};
    data.sort(function(a,b){return (ordem[a.stKey]||0)-(ordem[b.stKey]||0);});
  }
  return data;
}

function getPDFResumo(data){
  var total=data.reduce(function(a,r){return a+r.val;},0);
  var tok=data.filter(function(r){return r.stKey==='ok';});
  var tlate=data.filter(function(r){return r.stKey==='late';});
  var tdue=data.filter(function(r){return r.stKey==='due';});
  var topen=data.filter(function(r){return r.stKey==='open';});
  return {total:total,tok:tok,tlate:tlate,tdue:tdue,topen:topen,n:data.length};
}

function buildCardsResumo(s, cardFn){
  // Mostrar APENAS os cards dos grupos que existem nos dados filtrados
  var cards='';
  // Só mostra o card Total quando há mais de um grupo de status presente —
  // com um único grupo (ex: só "Vencido"), o Total seria idêntico e redundante.
  var gruposComDados=[s.tok.length,s.tlate.length,s.tdue.length,s.topen.length].filter(function(n){return n>0;}).length;
  if(gruposComDados>1)
    cards+=cardFn('#1c1917','Total',fR(s.total),s.n+' documentos');
  // Só mostra cada status se tiver pelo menos 1 documento
  if(s.tok.length)
    cards+=cardFn('#16a34a','Pago em dia',fR(s.tok.reduce(function(a,r){return a+r.val;},0)),s.tok.length+' doc(s)');
  if(s.tlate.length)
    cards+=cardFn('#d97706','Pago c/ atraso',fR(s.tlate.reduce(function(a,r){return a+r.val;},0)),s.tlate.length+' doc(s)');
  if(s.tdue.length)
    cards+=cardFn('#dc2626','Vencidos',fR(s.tdue.reduce(function(a,r){return a+r.val;},0)),s.tdue.length+' doc(s)');
  if(s.topen.length)
    cards+=cardFn('#2563eb','A vencer',fR(s.topen.reduce(function(a,r){return a+r.val;},0)),s.topen.length+' doc(s)');
  return cards;
}

function atualizarResumo(){
  var data=getPDFData();
  var div=document.getElementById('pdf-resumo');
  if(!data.length){div.style.display='none';return;}
  var s=getPDFResumo(data);
  div.style.display='';

  var filtros=[];
  var de=document.getElementById('pdf-de').value, ate=document.getElementById('pdf-ate').value;
  if(de||ate) filtros.push('Emiss\u00e3o: '+(de?fD(de):'in\u00edcio')+' \u2014 '+(ate?fD(ate):'hoje'));
  var tipos=[];
  if(document.getElementById('pdf-cte').checked) tipos.push('CTe');
  if(document.getElementById('pdf-nfs').checked) tipos.push('NFS-e');
  if(tipos.length<2) filtros.push('Tipo: '+tipos.join(', '));
  var sts=[];
  if(document.getElementById('pdf-ok').checked) sts.push('Pago em dia');
  if(document.getElementById('pdf-late').checked) sts.push('Pago c/ atraso');
  if(document.getElementById('pdf-due').checked) sts.push('Vencido');
  if(document.getElementById('pdf-open').checked) sts.push('A vencer');
  if(sts.length<4) filtros.push('Status: '+sts.join(', '));
  var veics=getChk('pdfveic');
  if(veics.length) filtros.push('Placa: '+veics.join(', '));

  var dk=document.documentElement.getAttribute('data-theme')==='dark';
  div.innerHTML=
    '<div style="display:flex;flex-direction:column;gap:10px">'
    +(filtros.length?'<div style="font-size:11px;color:'+(dk?'#a8a29e':'#78716c')+'">&#x1F50D; Filtros ativos: <strong>'+filtros.join(' &middot; ')+'</strong></div>':'')
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
    +buildCardsResumo(s, function(cor,lbl,sub,val){return rcard(cor,lbl,sub,val,dk);})
    +'</div></div>';
}

function rcard(cor,lbl,sub,val,dk){
  var cBg=dk?'#292524':'#fff', cText=dk?'#fafaf9':'#1c1917', cMuted=dk?'#a8a29e':'#78716c';
  return '<div style="border-left:3px solid '+cor+';padding:6px 12px;background:'+cBg+';border-radius:0 6px 6px 0">'
    +'<div style="font-size:10px;font-weight:600;color:'+cor+';text-transform:uppercase;letter-spacing:.04em">'+lbl+'</div>'
    +'<div style="font-size:16px;font-weight:700;color:'+cText+';margin:2px 0">'+val+'</div>'
    +'<div style="font-size:11px;color:'+cMuted+'">'+sub+'</div>'
    +'</div>';
}

// Aging de recebíveis (só documentos vencidos) — mesmas faixas/cores do
// Dashboard. Reaproveitado tanto no PDF gerado quanto na prévia em tela.
function buildAgingHTML(data, dk){
  var hoje=getToday();
  var cBg=dk?'#292524':'#fff', cBorder=dk?'#44403c':'#e7e5e4', cText=dk?'#fafaf9':'#1c1917',
      cMuted=dk?'#a8a29e':'#78716c', cTrack=dk?'#1c1917':'#f5f5f4';
  var faixas=[
    {lbl:'1 – 15 dias',min:1,max:15,col:'#f59e0b'},
    {lbl:'16 – 30 dias',min:16,max:30,col:'#ef4444'},
    {lbl:'31 – 60 dias',min:31,max:60,col:'#dc2626'},
    {lbl:'+ 60 dias',min:61,max:99999,col:'#991b1b'}
  ];
  var vencidos=data.filter(function(r){return r.stKey==='due'&&r.venc;});
  if(!vencidos.length) return '';
  var agingData=faixas.map(function(f){
    var docs=vencidos.filter(function(r){
      var dias=Math.round((hoje-new Date(r.venc+'T00:00:00'))/86400000);
      return dias>=f.min&&dias<=f.max;
    });
    return {lbl:f.lbl,col:f.col,n:docs.length,val:docs.reduce(function(a,r){return a+r.val;},0)};
  }).filter(function(f){return f.n>0;});
  if(!agingData.length) return '';
  var maxAging=Math.max.apply(null,agingData.map(function(f){return f.val;}))||1;
  var rows=agingData.map(function(f){
    var pct=Math.round(f.val/maxAging*100);
    return '<div style="margin-bottom:8px">'
      +'<div style="display:flex;justify-content:space-between;margin-bottom:3px">'
      +'<span style="font-size:11px;font-weight:600;color:'+f.col+'">'+f.lbl+'</span>'
      +'<span style="font-size:11px;color:'+cMuted+'">'+f.n+' doc(s) · '+fR(f.val)+'</span>'
      +'</div>'
      +'<div style="height:8px;background:'+cTrack+';border-radius:4px;overflow:hidden">'
      +'<div style="height:100%;width:'+pct+'%;background:'+f.col+'"></div>'
      +'</div></div>';
  }).join('');
  return '<div style="padding:12px 14px;background:'+cBg+';border:1px solid '+cBorder+';border-radius:8px;margin-bottom:20px">'
    +'<h2 style="font-size:13px;font-weight:700;margin:0 0 10px;color:'+cText+';border-bottom:1px solid '+cBorder+';padding-bottom:6px">Aging de Recebíveis</h2>'
    +rows+'</div>';
}

function buildPDFHTML(data){
  var s=getPDFResumo(data);
  var comGraf=document.getElementById('pdf-graficos').checked;
  var porVei=document.getElementById('pdf-por-veiculo').checked;
  var gerado=new Date().toLocaleDateString('pt-BR')+' \u00e0s '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

  // Resumo por veículo
  var veiHTML='';
  if(porVei){
    var veis={};
    data.forEach(function(r){
      var v=r.vei||'Sem placa';
      if(!veis[v])veis[v]={n:0,val:0,pval:0,due:0};
      veis[v].n++; veis[v].val+=r.val;
      if(r.pgto)veis[v].pval+=r.val;
      if(r.stKey==='due')veis[v].due++;
    });
    var vRows=Object.keys(veis).sort(function(a,b){return veis[b].val-veis[a].val;}).map(function(v){
      var d=veis[v],pct=d.val>0?Math.round(d.pval/d.val*100):0;
      return '<tr><td style="padding:5px 8px;font-weight:600">'+v+'</td>'
        +'<td style="padding:5px 8px;text-align:center">'+d.n+'</td>'
        +'<td style="padding:5px 8px;text-align:right">'+fR(d.val)+'</td>'
        +'<td style="padding:5px 8px;text-align:right;color:#16a34a">'+fR(d.pval)+'</td>'
        +'<td style="padding:5px 8px;text-align:right;color:'+(d.val-d.pval>0?'#dc2626':'#a8a29e')+'">'+fR(d.val-d.pval)+'</td>'
        +'<td style="padding:5px 8px;text-align:center;color:'+(d.due>0?'#dc2626':'#78716c')+'">'+d.due+'</td>'
        +'<td style="padding:5px 8px"><div style="display:flex;align-items:center;gap:6px">'
        +'<div style="flex:1;height:6px;background:#f5f5f4;border-radius:3px"><div style="width:'+pct+'%;height:6px;background:'+(pct>=80?'#16a34a':pct>=50?'#d97706':'#dc2626')+';border-radius:3px"></div></div>'
        +'<span style="font-size:10px;color:#78716c;min-width:28px">'+pct+'%</span></div></td></tr>';
    }).join('');
    veiHTML='<h2 style="font-size:13px;font-weight:700;margin:20px 0 8px;color:#1c1917;border-bottom:1px solid #e7e5e4;padding-bottom:6px">Resumo por Ve\u00edculo</h2>'
      +'<table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px">'
      +'<thead><tr style="background:#f5f5f4">'
      +'<th style="padding:5px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Placa</th>'
      +'<th style="padding:5px 8px;text-align:center;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Docs</th>'
      +'<th style="padding:5px 8px;text-align:right;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Emitido</th>'
      +'<th style="padding:5px 8px;text-align:right;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Pago</th>'
      +'<th style="padding:5px 8px;text-align:right;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">A receber</th>'
      +'<th style="padding:5px 8px;text-align:center;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Vencidos</th>'
      +'<th style="padding:5px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">% Pago</th>'
      +'</tr></thead><tbody>'+vRows+'</tbody></table>';
  }

  // Aging de recebíveis (só vencidos) — mesmas faixas do Dashboard
  var comAging=document.getElementById('pdf-aging').checked;
  var agingHTML=comAging?buildAgingHTML(data):'';

  // Gráfico SVG donut (inline, sem dependências)
  var grafHTML='';
  if(comGraf){
    // Usar apenas status com documentos presentes nos dados filtrados
    var stAll=[
      {lbl:'Pago em dia', val:s.tok.length, vval:s.tok.reduce(function(a,r){return a+r.val;},0), col:'#16a34a', bg:'#dcfce7'},
      {lbl:'Pago c/ atraso', val:s.tlate.length, vval:s.tlate.reduce(function(a,r){return a+r.val;},0), col:'#d97706', bg:'#fef3c7'},
      {lbl:'Vencido', val:s.tdue.length, vval:s.tdue.reduce(function(a,r){return a+r.val;},0), col:'#dc2626', bg:'#fee2e2'},
      {lbl:'A vencer', val:s.topen.length, vval:s.topen.reduce(function(a,r){return a+r.val;},0), col:'#2563eb', bg:'#dbeafe'}
    ].filter(function(st){return st.val>0;});  // ← só os que têm dados

    var tot2=stAll.reduce(function(a,st){return a+st.val;},0)||1;
    var cx=80,cy=80,ro=65,ri=40,ang=-Math.PI/2;
    var svgPaths='';
    stAll.forEach(function(st){
      if(!st.val)return;
      var sweep=2*Math.PI*(st.val/tot2);
      if(sweep>2*Math.PI-0.001)sweep=2*Math.PI-0.001;
      var x1=cx+ro*Math.cos(ang),y1=cy+ro*Math.sin(ang);
      var x2=cx+ro*Math.cos(ang+sweep),y2=cy+ro*Math.sin(ang+sweep);
      var xi1=cx+ri*Math.cos(ang),yi1=cy+ri*Math.sin(ang);
      var xi2=cx+ri*Math.cos(ang+sweep),yi2=cy+ri*Math.sin(ang+sweep);
      var lg=sweep>Math.PI?1:0;
      svgPaths+='<path d="M'+x1+' '+y1+' A'+ro+' '+ro+' 0 '+lg+' 1 '+x2+' '+y2
        +' L'+xi2+' '+yi2+' A'+ri+' '+ri+' 0 '+lg+' 0 '+xi1+' '+yi1+' Z"'
        +' fill="'+st.bg+'" stroke="'+st.col+'" stroke-width="1.5"/>';
      ang+=sweep;
    });

    // Barras — apenas status com valor
    var maxVal=Math.max.apply(null,stAll.map(function(st){return st.vval;}))||1;
    var barW=70,barH=60,barGap=12;
    var svgW=stAll.length*(barW+barGap);
    var barSVG='<svg width="'+svgW+'" height="'+(barH+30)+'" xmlns="http://www.w3.org/2000/svg">';
    stAll.forEach(function(st,i){
      var h=Math.max(2,Math.round(barH*(st.vval/maxVal)));
      var x=i*(barW+barGap);
      barSVG+='<rect x="'+x+'" y="'+(barH-h)+'" width="'+barW+'" height="'+h+'" fill="'+st.bg+'" stroke="'+st.col+'" stroke-width="1" rx="3"/>';
      barSVG+='<text x="'+(x+barW/2)+'" y="'+(barH+14)+'" text-anchor="middle" font-size="9" fill="'+st.col+'" font-weight="600">'+st.lbl+'</text>';
      barSVG+='<text x="'+(x+barW/2)+'" y="'+(barH-h-4)+'" text-anchor="middle" font-size="9" fill="#78716c">'+fR(st.vval)+'</text>';
    });
    barSVG+='</svg>';

    var legend=stAll.map(function(st){
      return '<div style="display:flex;align-items:center;gap:5px;font-size:10px;color:#78716c;margin-bottom:3px">'
        +'<span style="width:8px;height:8px;border-radius:50%;background:'+st.col+';display:inline-block;flex-shrink:0"></span>'
        +st.lbl+': <strong style="color:'+st.col+'">'+st.val+'</strong></div>';
    }).join('');

    grafHTML='<div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap">'
      +'<div><div style="font-size:11px;font-weight:600;color:#78716c;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Status dos documentos</div>'
      +'<div style="display:flex;gap:12px;align-items:center">'
      +'<svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">'+svgPaths
      +'<text x="80" y="76" text-anchor="middle" font-size="20" font-weight="700" fill="#1c1917">'+s.n+'</text>'
      +'<text x="80" y="91" text-anchor="middle" font-size="9" fill="#78716c">documentos</text>'
      +'</svg>'
      +'<div>'+legend+'</div>'
      +'</div></div>'
      +'<div><div style="font-size:11px;font-weight:600;color:#78716c;text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">Volume por status (R$)</div>'
      +barSVG+'</div>'
      +'</div>';
  }

  // Tabela de documentos
  var rows=data.map(function(r){
    var _stc=stColors(r.stKey), sc=_stc.sc, bg=_stc.bg;
    var rowBg=r.stKey==='due'?'#fff5f5':'';
    return '<tr style="border-bottom:1px solid #f5f5f4'+(rowBg?';background:'+rowBg:'')+'">'
      +(r.stKey==='due'?'<td style="padding:5px 8px;font-weight:700;color:#dc2626">'+r.doc+'</td>':'<td style="padding:5px 8px;font-weight:600">'+r.doc+'</td>')
      +'<td style="padding:5px 8px;color:'+(r.tipo==='CTe'?'#5b21b6':'#065f46')+';font-weight:600">'+r.tipo+'</td>'
      +'<td style="padding:5px 8px">'+fD(r.em)+'</td>'
      +'<td style="padding:5px 8px'+(r.stKey==='due'?';color:#dc2626;font-weight:600':'')+'">'+fD(r.venc)+'</td>'
      +'<td style="padding:5px 8px">'+(r.pgto?fD(r.pgto):'\u2014')+'</td>'
      +'<td style="padding:5px 8px;text-align:right;font-variant-numeric:tabular-nums">'+fR(r.val)+'</td>'
      +'<td style="padding:5px 8px">'+(r.vei||'\u2014')+'</td>'
      +'<td style="padding:5px 8px"><span style="background:'+bg+';color:'+sc+';padding:2px 8px;border-radius:20px;font-size:10px;font-weight:600;white-space:nowrap">'+r.stLbl+'</span></td>'
      +'</tr>';
  }).join('');

  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">'
    +'<title>Relat\u00f3rio de Pagamentos \u2014 NFS-e &amp; CTe</title>'
    +'<style>'
    +'*{box-sizing:border-box;margin:0;padding:0}'
    +'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12px;color:#1c1917;padding:24px}'
    +'@media print{body{padding:0}@page{margin:14mm}}'
    +'</style></head><body>'

    // Cabeçalho
    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #1c1917">'
    +'<div>'
    +'<div style="font-size:20px;font-weight:700;color:#1c1917">Relat\u00f3rio de Pagamentos</div>'
    +'<div style="font-size:12px;color:#78716c;margin-top:3px">NFS-e &amp; CTe &mdash; Novatrans Log\u00edstica</div>'
    +'</div>'
    +'<div style="text-align:right">'
    +'<div style="font-size:11px;color:#78716c">Gerado em</div>'
    +'<div style="font-size:12px;font-weight:600;color:#1c1917">'+gerado+'</div>'
    +'<div style="font-size:11px;color:#78716c;margin-top:2px">'+s.n+' documentos selecionados</div>'
    +'</div></div>'

    // Cards de resumo — apenas os status presentes nos dados filtrados
    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">'
    +buildCardsResumo(s, pdfCard)
    +'</div>'

    // Gráficos
    +grafHTML

    // Resumo por veículo
    +veiHTML

    // Aging de recebíveis
    +agingHTML

    // Alerta vencidos
    +(s.tdue.length>0
      ?'<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:12px;color:#991b1b">'
        +'<strong>&#x26A0; '+s.tdue.length+' documento(s) vencido(s)</strong> &mdash; '
        +fR(s.tdue.reduce(function(a,r){return a+r.val;},0))+' aguardando pagamento'
        +'</div>'
      :'')

    // Tabela
    +'<h2 style="font-size:13px;font-weight:700;margin-bottom:8px;color:#1c1917;border-bottom:1px solid #e7e5e4;padding-bottom:6px">Documentos</h2>'
    +'<table style="width:100%;border-collapse:collapse;font-size:11px">'
    +'<thead><tr style="background:#f5f5f4">'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Doc</th>'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Tipo</th>'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Emiss\u00e3o</th>'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Vencimento</th>'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Pagamento</th>'
    +'<th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Valor</th>'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Ve\u00edculo</th>'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Status</th>'
    +'</tr></thead>'
    +'<tbody>'+rows+'</tbody>'
    +'<tfoot><tr style="border-top:2px solid #e7e5e4;background:#f5f5f4">'
    +'<td colspan="5" style="padding:7px 8px;font-weight:700">Total</td>'
    +'<td style="padding:7px 8px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums">'+fR(s.total)+'</td>'
    +'<td colspan="2" style="padding:7px 8px;font-weight:600;color:#78716c">'+s.n+' documentos</td>'
    +'</tr></tfoot>'
    +'</table>'
    +'<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e7e5e4;font-size:10px;color:#a8a29e;display:flex;justify-content:space-between">'
    +'<span>Sistema de Pagamentos NFS-e &amp; CTe &mdash; Novatrans Log\u00edstica</span>'
    +'<span>'+gerado+'</span>'
    +'</div>'
    +'</body></html>';
}

function pdfCard(cor,lbl,val,sub){
  return '<div style="border-left:3px solid '+cor+';padding:8px 14px;background:#fff;border:1px solid #e7e5e4;border-left:4px solid '+cor+';border-radius:0 8px 8px 0;min-width:130px">'
    +'<div style="font-size:9px;font-weight:600;color:'+cor+';text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">'+lbl+'</div>'
    +'<div style="font-size:16px;font-weight:700;color:#1c1917;margin-bottom:2px;font-variant-numeric:tabular-nums">'+val+'</div>'
    +'<div style="font-size:10px;color:#78716c">'+sub+'</div>'
    +'</div>';
}

function gerarPDF(){
  var data=getPDFData();
  if(!data.length){alert('Nenhum documento com os filtros selecionados.');return;}
  var w=window.open('','_blank');
  if(!w){alert('Pop-up bloqueado. Permita pop-ups para este site.');return;}
  w.document.write(buildPDFHTML(data));
  w.document.close();
  w.onload=function(){w.print();};
}

// ── RELATÓRIO — CONSOLIDADO (usa os filtros já aplicados na aba) ──
function gerarPDFConsolidado(){
  if(!cS.fil.length){alert('Nenhum documento encontrado com os filtros atuais.');return;}
  var w=window.open('','_blank');
  if(!w){alert('Pop-up bloqueado. Permita pop-ups para este site.');return;}
  w.document.write(buildPDFHTML(cS.fil));
  w.document.close();
  w.onload=function(){w.print();};
}

// ── RELATÓRIO — PAGAMENTOS OJI (usa os filtros já aplicados na aba) ──
function gerarPDFOji(){
  if(!oS.fil.length){alert('Nenhum lan\u00e7amento encontrado com os filtros atuais.');return;}
  var w=window.open('','_blank');
  if(!w){alert('Pop-up bloqueado. Permita pop-ups para este site.');return;}
  w.document.write(buildPDFHTMLOji(oS.fil));
  w.document.close();
  w.onload=function(){w.print();};
}

function buildPDFHTMLOji(data){
  var gerado=new Date().toLocaleDateString('pt-BR')+' \u00e0s '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  var pagos=data.filter(function(r){return r.valor<0;});
  var creds=data.filter(function(r){return r.valor>0;});
  var tP=pagos.reduce(function(a,r){return a+Math.abs(r.valor);},0);
  var tC=creds.reduce(function(a,r){return a+r.valor;},0);

  var rows=data.slice().sort(function(a,b){return a.data<b.data?-1:a.data>b.data?1:0;}).map(function(r){
    var neg=r.valor<0;
    return '<tr style="border-bottom:1px solid #f5f5f4">'
      +'<td style="padding:5px 8px;font-weight:600">'+r.doc+'</td>'
      +'<td style="padding:5px 8px">'+fD(r.data)+'</td>'
      +'<td style="padding:5px 8px">'+(neg?'Pagamento':'Cr\u00e9dito / Estorno')+'</td>'
      +'<td style="padding:5px 8px;text-align:right;font-variant-numeric:tabular-nums;color:'+(neg?'#dc2626':'#16a34a')+'">'+(neg?'- ':'+ ')+fR(Math.abs(r.valor))+'</td>'
      +'</tr>';
  }).join('');

  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">'
    +'<title>Relat\u00f3rio de Pagamentos Oji</title>'
    +'<style>'
    +'*{box-sizing:border-box;margin:0;padding:0}'
    +'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:12px;color:#1c1917;padding:24px}'
    +'@media print{body{padding:0}@page{margin:14mm}}'
    +'</style></head><body>'

    +'<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #1c1917">'
    +'<div>'
    +'<div style="font-size:20px;font-weight:700;color:#1c1917">Relat\u00f3rio de Pagamentos Oji</div>'
    +'<div style="font-size:12px;color:#78716c;margin-top:3px">Novatrans Log\u00edstica</div>'
    +'</div>'
    +'<div style="text-align:right">'
    +'<div style="font-size:11px;color:#78716c">Gerado em</div>'
    +'<div style="font-size:12px;font-weight:600;color:#1c1917">'+gerado+'</div>'
    +'<div style="font-size:11px;color:#78716c;margin-top:2px">'+data.length+' lan\u00e7amentos selecionados</div>'
    +'</div></div>'

    +'<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">'
    +pdfCard('#1c1917','Lan\u00e7amentos',data.length,'total no filtro')
    +pdfCard('#dc2626','Total pago',fR(tP),pagos.length+' pagamento(s)')
    +pdfCard('#16a34a','Cr\u00e9ditos / estornos',fR(tC),creds.length+' lan\u00e7amento(s)')
    +pdfCard('#2563eb','Saldo l\u00edquido',fR(tP-tC),'sa\u00edda efetiva')
    +'</div>'

    +'<h2 style="font-size:13px;font-weight:700;margin-bottom:8px;color:#1c1917;border-bottom:1px solid #e7e5e4;padding-bottom:6px">Lan\u00e7amentos</h2>'
    +'<table style="width:100%;border-collapse:collapse;font-size:11px">'
    +'<thead><tr style="background:#f5f5f4">'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Doc</th>'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Data</th>'
    +'<th style="padding:6px 8px;text-align:left;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Tipo</th>'
    +'<th style="padding:6px 8px;text-align:right;font-size:10px;font-weight:600;color:#78716c;text-transform:uppercase;border-bottom:1px solid #e7e5e4">Valor</th>'
    +'</tr></thead>'
    +'<tbody>'+rows+'</tbody>'
    +'<tfoot><tr style="border-top:2px solid #e7e5e4;background:#f5f5f4">'
    +'<td colspan="3" style="padding:7px 8px;font-weight:700">Saldo l\u00edquido</td>'
    +'<td style="padding:7px 8px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;color:'+(tP-tC>0?'#dc2626':'#16a34a')+'">'+fR(tP-tC)+'</td>'
    +'</tr></tfoot>'
    +'</table>'
    +'<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e7e5e4;font-size:10px;color:#a8a29e;display:flex;justify-content:space-between">'
    +'<span>Sistema de Pagamentos NFS-e &amp; CTe &mdash; Novatrans Log\u00edstica</span>'
    +'<span>'+gerado+'</span>'
    +'</div>'
    +'</body></html>';
}

function previewPDF(){
  var data=getPDFData();
  var div=document.getElementById('pdf-preview');
  if(!data.length){div.style.display='none';return;}
  var s=getPDFResumo(data);
  div.style.display='block';

  // Pr\u00e9via em tela segue o tema atual do site (ao contr\u00e1rio do PDF impresso,
  // que \u00e9 sempre em papel branco) \u2014 evita a "tela branca" em modo escuro.
  var dk=document.documentElement.getAttribute('data-theme')==='dark';
  var cBorder=dk?'#44403c':'#e7e5e4', cBg=dk?'#1c1917':'#fff', cBgAlt=dk?'#292524':'#fafaf9',
      cBgHead=dk?'#292524':'#f5f5f4', cText=dk?'#fafaf9':'#1c1917', cMuted=dk?'#a8a29e':'#78716c',
      cDueRowBg=dk?'#3a1a1a':'#fff5f5', cRowBorder=dk?'#292524':'#f5f5f4';

  div.innerHTML='<div style="border:1px solid '+cBorder+';border-radius:10px;overflow:hidden">'
    +'<div style="background:'+cBgAlt+';padding:10px 16px;border-bottom:1px solid '+cBorder+';display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">'
    +'<span style="font-size:13px;font-weight:600;color:'+cText+'">Pr\u00e9-visualiza\u00e7\u00e3o &mdash; '+data.length+' documentos &mdash; '+fR(s.total)+'</span>'
    +'<div style="display:flex;gap:8px;font-size:12px">'
    +'<span style="color:#16a34a">&#x2713; '+( s.tok.length+s.tlate.length)+' pagos</span>'
    +(s.tdue.length?'<span style="color:#dc2626;font-weight:600">&#x26A0; '+s.tdue.length+' vencidos</span>':'')
    +(s.topen.length?'<span style="color:#2563eb">&#x25CB; '+s.topen.length+' a vencer</span>':'')
    +'</div></div>'
    +'<div style="overflow:auto;max-height:440px;background:'+cBg+'">'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<thead><tr style="background:'+cBgHead+';position:sticky;top:0">'
    +['Doc','Tipo','Emiss\u00e3o','Vencimento','Pagamento','Valor','Ve\u00edculo','Status'].map(function(h,i){
      return '<th style="padding:7px 10px;border-bottom:1px solid '+cBorder+';font-size:10px;font-weight:600;color:'+cMuted+';text-align:'+(i===5?'right':'left')+';text-transform:uppercase;white-space:nowrap">'+h+'</th>';
    }).join('')+'</tr></thead><tbody>'
    +data.slice(0,200).map(function(r){
      var _stc=stColors(r.stKey), sc=_stc.sc, bg=_stc.bg;
      var rowBg=r.stKey==='due'?cDueRowBg:cBg;
      return '<tr style="border-bottom:1px solid '+cRowBorder+';background:'+rowBg+';">'
        +'<td style="padding:6px 10px;font-weight:'+(r.stKey==='due'?'700':'600')+';color:'+(r.stKey==='due'?'#dc2626':cText)+'">'+r.doc+'</td>'
        +'<td style="padding:6px 10px;color:'+cText+'">'+r.tipo+'</td>'
        +'<td style="padding:6px 10px;color:'+cText+'">'+fD(r.em)+'</td>'
        +'<td style="padding:6px 10px;color:'+(r.stKey==='due'?'#dc2626':cText)+';font-weight:'+(r.stKey==='due'?'600':'400')+'">'+fD(r.venc)+'</td>'
        +'<td style="padding:6px 10px;color:'+cText+'">'+(r.pgto?fD(r.pgto):'\u2014')+'</td>'
        +'<td style="padding:6px 10px;text-align:right;color:'+cText+'">'+fR(r.val)+'</td>'
        +'<td style="padding:6px 10px;color:'+cText+'">'+(r.vei||'\u2014')+'</td>'
        +'<td style="padding:6px 10px"><span style="background:'+bg+';color:'+sc+';padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap">'+r.stLbl+'</span></td>'
        +'</tr>';
    }).join('')
    +(data.length>200?'<tr><td colspan="8" style="padding:10px;text-align:center;color:'+cMuted+';font-size:12px">\u2026 mais '+(data.length-200)+' documentos no PDF completo</td></tr>':'')
    +'</tbody></table></div></div>'
    +(document.getElementById('pdf-aging').checked ? buildAgingHTML(data, dk) : '');
}

