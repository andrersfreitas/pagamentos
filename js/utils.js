// ── UTILS ──
function getToday(){ var d=new Date(); d.setHours(0,0,0,0); return d; }
var PER = 20;

function fD(s){ if(!s)return'—'; var p=s.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function fR(v){ return Math.abs(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function stCls(k){ return k==='ok'?'b-ok':k==='late'?'b-late':k==='due'?'b-due':'b-open'; }
function stColors(k){
  return {
    sc:k==='ok'?'#15803d':k==='late'?'#92400e':k==='due'?'#991b1b':'#1d4ed8',
    bg:k==='ok'?'#dcfce7':k==='late'?'#fef3c7':k==='due'?'#fee2e2':'#dbeafe'
  };
}
// Estatísticas agregadas de CONS — usado pelo Dashboard e pela exportação Excel,
// para garantir que os dois sempre mostrem os mesmos números.
function computeConsStats(data){
  var tval=0,pval=0,tok=0,tlate=0,tdue=0,topen=0,pmrSoma=0,pmrN=0;
  var vOk=0,vLate=0,vDue=0,vOpen=0,tickCte=0,nCte=0,tickNfs=0,nNfs=0;
  data.forEach(function(r){
    tval+=r.val;
    if(r.pgto){ pval+=r.val; }
    if(r.tipo==='CTe'){tickCte+=r.val;nCte++;}else{tickNfs+=r.val;nNfs++;}
    if(r.stKey==='ok'){ tok++; vOk+=r.val;
      if(r.em&&r.pgto){ var d=Math.round((new Date(r.pgto+'T00:00:00')-new Date(r.em+'T00:00:00'))/86400000); if(d>=0){pmrSoma+=d;pmrN++;} }
    } else if(r.stKey==='late'){ tlate++; vLate+=r.val;
      if(r.em&&r.pgto){ var d=Math.round((new Date(r.pgto+'T00:00:00')-new Date(r.em+'T00:00:00'))/86400000); if(d>=0){pmrSoma+=d;pmrN++;} }
    } else if(r.stKey==='due'){ tdue++; vDue+=r.val; }
    else{ topen++; vOpen+=r.val; }
  });
  return {
    tval:tval, pval:pval, tok:tok, tlate:tlate, tdue:tdue, topen:topen,
    vOk:vOk, vLate:vLate, vDue:vDue, vOpen:vOpen,
    tickCte:tickCte, nCte:nCte, tickNfs:tickNfs, nNfs:nNfs,
    pmr: pmrN>0 ? Math.round(pmrSoma/pmrN) : 0,
    txInadPct: data.length>0 ? (tdue/data.length*100) : 0
  };
}
function bCls(t){ return t==='CTe'?'b-cte':'b-nfs'; }

var TOLERANCIA_ATRASO_DIAS = 5; // pagamentos até N dias depois do vencimento contam como "Pago em dia"
function calcSt(pgto,venc){
  if(!venc) return {key:'open',lbl:'Sem vencimento'};
  var v=new Date(venc+'T00:00:00');
  if(pgto){
    var p=new Date(pgto+'T00:00:00');
    if(p<=v) return {key:'ok',lbl:'Pago em dia'};
    var d=Math.round((p-v)/86400000);
    if(d<=TOLERANCIA_ATRASO_DIAS) return {key:'ok',lbl:'Pago em dia (tol. '+d+'d)'};
    return {key:'late',lbl:'Pago c/ atraso ('+d+'d)'};
  }
  var TODAY=getToday();
  if(TODAY>v){ var d=Math.round((TODAY-v)/86400000); return {key:'due',lbl:'Vencido ('+d+'d)'}; }
  var d=Math.round((v-TODAY)/86400000);
  return {key:'open',lbl:'A vencer ('+d+'d)'};
}

function normDate(s){
  if(!s) return null; s=s.trim();
  if(/^\d{2}\/\d{2}\/\d{4}$/.test(s)){ var p=s.split('/'); return p[2]+'-'+p[1]+'-'+p[0]; }
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}
function calcVenc(em){
  if(!em) return null;
  var p=em.split('-').map(Number),y=p[0],m=p[1],d=p[2];
  var nm=m<12?m+1:1,ny=m<12?y:y+1;
  if(d<=10) return ny+'-'+String(nm).padStart(2,'0')+'-10';
  if(d<=20) return ny+'-'+String(nm).padStart(2,'0')+'-20';
  // dia 21-fim: usa o menor entre 30 e o último dia do mês seguinte (ex: fev→28)
  var ultimo=new Date(ny,nm,0).getDate();
  var dia30=Math.min(30,ultimo);
  return ny+'-'+String(nm).padStart(2,'0')+'-'+String(dia30).padStart(2,'0');
}

// Recalcular status com hoje real
CONS.forEach(function(r){ var s=calcSt(r.pgto,r.venc); r.stKey=s.key; r.stLbl=s.lbl; });

