// ── UTILS ──
function getToday(){ var d=new Date(); d.setHours(0,0,0,0); return d; }
var PER = 20;

function fD(s){ if(!s)return'—'; var p=s.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }
function fR(v){ return Math.abs(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function stCls(k){ return k==='canc'?'b-canc':k==='ok'?'b-ok':k==='late'?'b-late':k==='due'?'b-due':'b-open'; }
function stColors(k){
  return {
    sc:k==='canc'?'#57534e':k==='ok'?'#15803d':k==='late'?'#92400e':k==='due'?'#991b1b':'#1d4ed8',
    bg:k==='canc'?'#e7e5e4':k==='ok'?'#dcfce7':k==='late'?'#fef3c7':k==='due'?'#fee2e2':'#dbeafe'
  };
}
// Status exibido de um documento. 'cancelado' é decisão manual e passa por cima
// do cálculo por datas — por isso todo recálculo de status deve passar por aqui,
// nunca chamar calcSt() direto sobre um registro do CONS.
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

function consAtivos(){
  return CONS.filter(function(r){ return !r.cancelado; });
}

function recalcStatus(r){
  if(r.cancelado){ r.stKey='canc'; r.stLbl='Cancelado'; return r; }
  var s=calcSt(r.pgto,r.venc); r.stKey=s.key; r.stLbl=s.lbl; return r;
}

// Agregacao por data canonica de vencimento — FONTE UNICA dos numeros de
// pagamento (cards do Pagamentos Oji e tabela "Pagamentos por data"). Nenhuma
// tela deve refazer essa conta por conta propria: foi a duplicacao dessa logica
// que fez documentos cancelados continuarem somando no Pendente.
function agregarPorVencimento(){
  var hoje=getToday();
  var fatData={},nDocsData={},pagoData={};
  consAtivos().forEach(function(r){
    var d=normVenc(r.venc||''); if(!d) return;
    fatData[d]=(fatData[d]||0)+r.val;
    nDocsData[d]=(nDocsData[d]||0)+1;
  });
  PAG_OJI.forEach(function(r){
    if(r.valor>=0) return;
    var d=normVenc(r.data||''); if(!d) return;
    pagoData[d]=(pagoData[d]||0)+Math.abs(r.valor);
  });
  var todas={};
  Object.keys(fatData).forEach(function(d){todas[d]=true;});
  Object.keys(pagoData).forEach(function(d){todas[d]=true;});
  var datas=Object.keys(todas).sort();
  // Pendente: saldo nao pago de cada vencimento ja passado, acumulado e rolante.
  // O saldo corrente NAO e zerado a cada data: quando a OJI paga a mais numa
  // data, o credito segue adiante e abate os vencimentos seguintes. Zerar a cada
  // passo descartava esse credito e inflava o pendente — era por isso que tirar
  // um documento da conta nao reduzia o pendente no mesmo valor.
  var pendData={},saldoCorrente=0;
  datas.forEach(function(d){
    if(new Date(d+'T00:00:00')<hoje){
      saldoCorrente+=((fatData[d]||0)-(pagoData[d]||0));
      pendData[d]=Math.max(0,saldoCorrente);
    }
  });
  var accum=Math.max(0,saldoCorrente);
  var fat=Object.keys(fatData).reduce(function(a,d){return a+fatData[d];},0);
  var pago=Object.keys(pagoData).reduce(function(a,d){return a+pagoData[d];},0);
  return {fatData:fatData,pagoData:pagoData,pendData:pendData,nDocsData:nDocsData,
          datas:datas,fat:fat,pago:pago,saldo:fat-pago,pend:accum};
}

// Estatísticas agregadas de CONS — usado pelo Dashboard e pela exportação Excel,
// para garantir que os dois sempre mostrem os mesmos números.
function computeConsStats(data){
  var tval=0,pval=0,tok=0,tlate=0,tdue=0,topen=0,pmrSoma=0,pmrN=0;
  var vOk=0,vLate=0,vDue=0,vOpen=0,tickCte=0,nCte=0,tickNfs=0,nNfs=0;
  data.forEach(function(r){
    if(r.cancelado) return; // cancelado nao entra em nenhum total
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
  if(d===31){
    // dia 31 não cabe na 3ª dezena (que vai até o dia 30) — conta como se já
    // fosse o dia 1 do mês seguinte, empurrando o vencimento mais um mês.
    var total2=m+2, ny2=y+Math.floor((total2-1)/12), nm2=((total2-1)%12)+1;
    return ny2+'-'+String(nm2).padStart(2,'0')+'-10';
  }
  var nm=m<12?m+1:1,ny=m<12?y:y+1;
  if(d<=10) return ny+'-'+String(nm).padStart(2,'0')+'-10';
  if(d<=20) return ny+'-'+String(nm).padStart(2,'0')+'-20';
  // dia 21-30: usa o menor entre 30 e o último dia do mês seguinte (ex: fev→28)
  var ultimo=new Date(ny,nm,0).getDate();
  var dia30=Math.min(30,ultimo);
  return ny+'-'+String(nm).padStart(2,'0')+'-'+String(dia30).padStart(2,'0');
}

// Recalcular status com hoje real
CONS.forEach(recalcStatus);

