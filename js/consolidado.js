// ── CONSOLIDADO ──
var cS={fil:[],pg:0,sk:'em',sd:1};

function af(){
  var tipos=getChk('tipo'), stats=getChk('status'), veics=getChk('veiculo'), meses=getChk('mes');
  var q=document.getElementById('fD').value.trim().toLowerCase();
  cS.fil=CONS.filter(function(r){
    if(tipos.length&&tipos.indexOf(r.tipo)<0) return false;
    if(stats.length&&stats.indexOf(r.stKey)<0) return false;
    if(veics.length&&veics.indexOf(r.vei)<0) return false;
    if(meses.length&&meses.indexOf(r.em?r.em.slice(0,7):'')<0) return false;
    if(q&&String(r.doc).indexOf(q)<0) return false;
    return true;
  });
  sortC(); cS.pg=0; renderC(); renderCards(cS.fil);
}

function sortC(){
  var sk=cS.sk,sd=cS.sd;
  cS.fil.sort(function(a,b){
    var av,bv;
    if(sk==='val'){av=a.val;bv=b.val;}
    else if(sk==='doc'){av=a.doc;bv=b.doc;}
    else{av=a[sk]||'';bv=b[sk]||'';}
    return sd*(av>bv?1:av<bv?-1:0);
  });
}

function so(k){
  if(cS.sk===k) cS.sd*=-1; else{cS.sk=k;cS.sd=1;}
  document.querySelectorAll('#page-consolidado thead th').forEach(function(t){
    if(!t.classList.contains('ns'))t.className='';
  });
  var el=document.getElementById('th-'+k);
  if(el) el.className=cS.sd===1?'asc':'desc';
  sortC(); cS.pg=0; renderC();
}

function renderC(){
  var sl=cS.fil.slice(cS.pg*PER,(cS.pg+1)*PER);
  var tb=document.getElementById('tbody-cons'), em=document.getElementById('empty-cons');
  if(!sl.length){tb.innerHTML='';em.style.display='';}
  else{
    em.style.display='none';
    tb.innerHTML=sl.map(function(r){
      var idx=CONS.indexOf(r);
      var veiCell='<div class="vei-cell">'
        +'<input class="vei-inp" id="vi'+idx+'" value="'+(r.vei||'')+'" placeholder="\u2014" oninput="this.value=this.value.toUpperCase()" onkeydown="if(event.key===\'Enter\')saveVei('+idx+')">'
        +'<button class="vei-ok" onclick="saveVei('+idx+')" title="Salvar placa">&#10003;</button>'
        +'</div>';
      return '<tr><td class="dc">'+r.doc+'</td>'+
        '<td><span class="badge '+bCls(r.tipo)+'">'+r.tipo+'</span></td>'+
        '<td>'+fD(r.em)+'</td><td>'+fD(r.venc)+'</td>'+
        '<td>'+(r.pgto?fD(r.pgto):'<span class="muted">\u2014</span>')+'</td>'+
        '<td class="nc">'+fR(r.val)+'</td>'+
        '<td>'+veiCell+'</td>'+
        '<td><span class="badge '+stCls(r.stKey)+'">'+r.stLbl+'</span></td>'+
        '<td><button class="btn-del" onclick="excluirDoc('+idx+')" title="Excluir documento">&#x2715;</button></td></tr>';
    }).join('');
  }
  updPag('cons',cS);
}

function saveVei(idx){
  var inp=document.getElementById('vi'+idx); if(!inp)return;
  var val=inp.value.trim().toUpperCase();
  CONS[idx].vei=val;
  if(val && VEICS.indexOf(val)<0){ VEICS.push(val); VEICS.sort(); rebuildVeicFilter(); }
  inp.style.borderColor='#16a34a';
  setTimeout(function(){inp.style.borderColor='';},1200);
  marcarAlteracao();
}

function excluirDoc(idx){
  var r=CONS[idx];
  if(!r) return;
  if(!confirm('Excluir '+r.tipo+' n\u00ba '+r.doc+' ('+fD(r.em)+' \u2014 '+fR(r.val)+')?\n\nEsta a\u00e7\u00e3o n\u00e3o pode ser desfeita.')) return;
  CONS.splice(idx,1);
  marcarAlteracao();
  af();
}

function excluirPag(idx){
  var r=PAG_OJI[idx];
  if(!r) return;
  if(!confirm('Excluir pagamento do doc '+r.doc+' ('+fD(r.data)+' \u2014 '+fR(r.valor)+')?\n\nEsta a\u00e7\u00e3o n\u00e3o pode ser desfeita.')) return;
  PAG_OJI.splice(idx,1);
  // Recalcular status do documento no CONS (pode ter voltado a em aberto)
  CONS.forEach(function(c){
    if(c.doc===r.doc){
      // Verificar se ainda existe outro pagamento para esse doc
      var outroPag=PAG_OJI.find(function(p){return p.doc===r.doc && p.valor<0;});
      c.pgto = outroPag ? outroPag.data : null;
      var s=calcSt(c.pgto,c.venc); c.stKey=s.key; c.stLbl=s.lbl;
    }
  });
  marcarAlteracao();
  afOji();
  af();
}

function renderCards(data){
  var tok=0,tlate=0,tdue=0,topen=0,tval=0,pval=0;
  data.forEach(function(r){
    tval+=r.val;
    if(r.stKey==='ok'){tok++;pval+=r.val;}
    else if(r.stKey==='late'){tlate++;pval+=r.val;}
    else if(r.stKey==='due') tdue++;
    else topen++;
  });
  var filt=data.length<CONS.length;
  document.getElementById('cards-cons').innerHTML=
    mkC('','Total',data.length+(filt?' / '+CONS.length:''),'CTe + NFS-e'+(filt?' (filtrado)':''))+
    mkC('ok','Pagos em dia',tok,fR(pval))+
    mkC('late','Pago c/ atraso',tlate,'do total pago')+
    mkC('danger','Vencidos',tdue,'sem pagamento')+
    mkC('accent','A vencer',topen,'dentro do prazo')+
    mkC('','Volume',fR(tval),'selecionado');
}
function mkC(cls,lbl,val,sub){
  return '<div class="card '+cls+'"><div class="card-lbl">'+lbl+'</div><div class="card-val">'+val+'</div><div class="card-sub">'+sub+'</div></div>';
}

