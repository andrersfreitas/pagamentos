// ── TABS ──
function showTab(name){
  var names=['home','dashboard','consolidado','oji','pdf','upload','frete','piso'];
  document.querySelectorAll('.tab').forEach(function(t,i){ t.classList.toggle('active',names[i]===name); });
  document.querySelectorAll('.page').forEach(function(p){ p.classList.remove('active'); });
  var pagina = document.getElementById('page-'+name);
  pagina.classList.add('active');
  if(name==='oji') afOji();
  if(name==='dashboard') renderDashboard();
  if(name==='frete') initFrete();
  if(name==='piso') initPiso();
  closeAllMS();

  // Injetar botão "Voltar à Home" no topo de qualquer página que não seja a própria Home
  if(name!=='home'){
    var jaTem = pagina.querySelector('.btn-voltar-home');
    if(!jaTem){
      var btn = document.createElement('button');
      btn.className = 'btn-voltar-home';
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg> Voltar \u00e0 Home';
      btn.onclick = function(){ showTab('home'); };
      pagina.insertBefore(btn, pagina.firstChild);
    }
  }
}

// ── MULTISELECT ──
var msChecked={};

function buildMS(id, items, cb){
  msChecked[id]=[];
  var dd=document.getElementById('ms-'+id);
  items.forEach(function(item){
    var lbl=document.createElement('label');
    lbl.className='msitem';
    var chk=document.createElement('input');
    chk.type='checkbox'; chk.value=item.v;
    chk.onchange=function(){ msChecked[id]=getChk(id); updLbl(id); cb(); };
    lbl.appendChild(chk);
    lbl.appendChild(document.createTextNode(' '+item.l));
    dd.appendChild(lbl);
  });
  var clr=document.createElement('button');
  clr.className='msclr'; clr.textContent='Limpar selec\u0327a\u0303o';
  clr.onclick=function(e){ e.stopPropagation(); clrMS(id,cb); };
  dd.appendChild(clr);
  var close=document.createElement('button');
  close.className='msclr'; close.textContent='\u2715 Fechar';
  close.style.borderTop='none'; close.style.color='#1c1917'; close.style.fontWeight='600';
  close.onclick=function(e){ e.stopPropagation(); closeAllMS(); };
  dd.appendChild(close);
}

function getChk(id){
  return Array.from(document.querySelectorAll('#ms-'+id+' input:checked')).map(function(c){return c.value;});
}
function updLbl(id){
  var c=getChk(id), el=document.getElementById('ms-lbl-'+id);
  if(!c.length){ el.innerHTML='Todos'; return; }
  el.innerHTML='<span class="mstag">'+c.length+'</span> selecionado'+(c.length>1?'s':'');
}
function clrMS(id,cb){
  document.querySelectorAll('#ms-'+id+' input').forEach(function(c){c.checked=false;});
  msChecked[id]=[]; updLbl(id); if(cb)cb();
}
function toggleMS(id){
  var dd=document.getElementById('ms-'+id);
  var btn=dd.previousElementSibling;
  var wasOpen=dd.classList.contains('open');
  closeAllMS();
  if(!wasOpen){ dd.classList.add('open'); btn.classList.add('open'); }
}
function closeAllMS(){
  document.querySelectorAll('.msdd').forEach(function(d){d.classList.remove('open');});
  document.querySelectorAll('.msb').forEach(function(b){b.classList.remove('open');});
}
document.addEventListener('click',function(e){ if(!e.target.closest('.fg'))closeAllMS(); });

// Build dropdowns
buildMS('tipo',[{v:'CTe',l:'CTe'},{v:'NFSe',l:'NFS-e'}],af);
buildMS('status',[
  {v:'ok',l:'Pago em dia'},{v:'late',l:'Pago c/ atraso'},
  {v:'due',l:'Vencido'},{v:'open',l:'A vencer'}
],af);

(function(){
  buildMS('veiculo',VEICS.map(function(v){return {v:v,l:v};}),af);
  buildMS('pdfveic',VEICS.map(function(v){return {v:v,l:v};}),atualizarResumo);

function rebuildVeicFilter(){
  [{id:'veiculo',cb:af},{id:'pdfveic',cb:atualizarResumo}].forEach(function(cfg){
  var id=cfg.id;
  var dd=document.getElementById('ms-'+id);
  if(!dd) return;
  // Guardar seleção atual
  var checked=getChk(id);
  dd.innerHTML='';
  msChecked[id]=[];
  VEICS.forEach(function(v){
    var lbl=document.createElement('label');
    lbl.className='msitem';
    var chk=document.createElement('input');
    chk.type='checkbox'; chk.value=v;
    if(checked.indexOf(v)>=0) chk.checked=true;
    chk.onchange=function(){ msChecked[id]=getChk(id); updLbl(id); cfg.cb(); };
    lbl.appendChild(chk);
    lbl.appendChild(document.createTextNode(' '+v));
    dd.appendChild(lbl);
  });
  var clr=document.createElement('button');
  clr.className='msclr'; clr.textContent='Limpar sele\u00e7\u00e3o';
  clr.onclick=function(e){ e.stopPropagation(); clrMS(id,cfg.cb); };
  dd.appendChild(clr);
  updLbl(id);
  });
}
})();
(function(){
  buildMS('mes',MC.map(function(m){
    var p=m.split('-');
    return {v:m,l:new Date(p[0],p[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})};
  }),af);
})();
(function(){
  buildMS('ojimes',MO.map(function(m){
    var p=m.split('-');
    return {v:m,l:new Date(p[0],p[1]-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'})};
  }),afOji);
})();
(function(){
  buildMS('ojitipo',[{v:'pag',l:'Pagamento'},{v:'cred',l:'Cr\u00e9dito / Estorno'}],afOji);
})();
(function(){
  rebuildOjiAnoFilter();
  // Selecionar o ano atual por padrão na primeira carga
  var anoAtual=String(new Date().getFullYear());
  var chk=document.querySelector('#ms-ojiano input[value="'+anoAtual+'"]');
  if(chk){ chk.checked=true; msChecked['ojiano']=[anoAtual]; updLbl('ojiano'); }
})();

