// Testes das regras de cálculo do sistema — rode com:  node testes/testes.js
//
// Não precisa instalar nada: carrega js/utils.js num ambiente isolado e verifica
// as regras que não podem quebrar. Toda alteração que mexa em vencimento,
// status ou soma de valores deve passar por aqui ANTES de ser publicada.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
let falhas = 0, passou = 0;

function ok(cond, descricao, detalhe) {
  if (cond) { passou++; console.log('  ✓ ' + descricao); }
  else { falhas++; console.log('  ✗ ' + descricao + (detalhe ? '\n      ' + detalhe : '')); }
}
function igual(obtido, esperado, descricao) {
  ok(obtido === esperado, descricao, 'obtido: ' + JSON.stringify(obtido) + ' | esperado: ' + JSON.stringify(esperado));
}
function quase(obtido, esperado, descricao) {
  ok(Math.abs(obtido - esperado) < 0.005, descricao, 'obtido: ' + obtido + ' | esperado: ' + esperado);
}
function secao(t) { console.log('\n' + t); }

// ── carrega utils.js com os globais que ele espera ──
function carregar(CONS, PAG_OJI) {
  const ctx = { console, CONS, PAG_OJI, TOLERANCIA_ATRASO_DIAS: 5 };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'js/utils.js'), 'utf8'), ctx);
  return ctx;
}

// ────────────────────────────────────────────────────────────
secao('Regra de vencimento (dekádio)');
{
  const u = carregar([], []);
  igual(u.calcVenc('2026-05-03'), '2026-06-10', 'dia 3 vence no dia 10 do mês seguinte');
  igual(u.calcVenc('2026-05-10'), '2026-06-10', 'dia 10 ainda cai na 1ª dezena');
  igual(u.calcVenc('2026-05-11'), '2026-06-20', 'dia 11 vai para o dia 20');
  igual(u.calcVenc('2026-05-20'), '2026-06-20', 'dia 20 ainda cai na 2ª dezena');
  igual(u.calcVenc('2026-05-21'), '2026-06-30', 'dia 21 vai para o dia 30');
  igual(u.calcVenc('2026-05-30'), '2026-06-30', 'dia 30 vence no dia 30');
  igual(u.calcVenc('2026-01-25'), '2026-02-28', 'fevereiro não tem dia 30 — usa o último dia');
  igual(u.calcVenc('2026-05-31'), '2026-07-10', 'dia 31 conta como dia 1 do mês seguinte');
  igual(u.calcVenc('2026-01-31'), '2026-03-10', 'dia 31 de janeiro vence em março');
  igual(u.calcVenc('2026-12-31'), '2027-02-10', 'dia 31 de dezembro vira o ano');
  igual(u.calcVenc('2026-12-05'), '2027-01-10', 'dezembro vira o ano normalmente');
  igual(u.calcVenc(''), null, 'sem emissão não há vencimento');
}

// ────────────────────────────────────────────────────────────
secao('Data canônica de pagamento (normVenc)');
{
  const u = carregar([], []);
  igual(u.normVenc('2026-06-10'), '2026-06-10', 'dia 10 é canônico');
  igual(u.normVenc('2026-06-14'), '2026-06-10', 'dia 14 pertence ao vencimento do dia 10');
  igual(u.normVenc('2026-06-15'), '2026-06-20', 'dia 15 já pertence ao dia 20');
  igual(u.normVenc('2026-06-25'), '2026-06-30', 'dia 25 pertence ao dia 30');
  igual(u.normVenc('2026-02-26'), '2026-02-28', 'fevereiro fecha no último dia');
  igual(u.normVenc('2026-07-02'), '2026-06-30', 'início do mês pertence ao fechamento anterior');
}

// ────────────────────────────────────────────────────────────
secao('Status: cancelado passa por cima do cálculo por datas');
{
  const u = carregar([], []);
  const venc = '2020-01-10'; // bem no passado: seria "Vencido"
  const r = { doc: 1, tipo: 'CTe', venc: venc, pgto: null, val: 100, cancelado: true };
  u.recalcStatus(r);
  igual(r.stKey, 'canc', 'documento cancelado tem status canc');
  igual(r.stLbl, 'Cancelado', 'e rótulo "Cancelado"');
  igual(u.stCls('canc'), 'b-canc', 'a tarja usa a classe cinza');
  r.cancelado = false; u.recalcStatus(r);
  igual(r.stKey, 'due', 'ao reverter, volta a ser calculado pelas datas');
}

// ────────────────────────────────────────────────────────────
// A REGRA QUE NÃO PODE QUEBRAR: um documento cancelado não pode influenciar
// nenhum número de dinheiro em nenhuma tela. Em vez de conferir tela por tela,
// o teste insere um cancelado absurdo e exige que TODOS os números fiquem iguais.
secao('Documento cancelado não altera nenhum total');
{
  const base = [
    { doc: 1, tipo: 'CTe',  em: '2026-01-05', venc: '2026-02-10', pgto: '2026-02-10', val: 1000, cancelado: false },
    { doc: 2, tipo: 'NFSe', em: '2026-02-03', venc: '2026-03-10', pgto: null,         val: 500,  cancelado: false },
    { doc: 3, tipo: 'CTe',  em: '2026-03-12', venc: '2026-04-20', pgto: null,         val: 250,  cancelado: false }
  ];
  const pagos = [{ doc: 1, data: '2026-02-10', valor: -1000 }];

  const semCancelado = JSON.parse(JSON.stringify(base));
  const comCancelado = JSON.parse(JSON.stringify(base));
  comCancelado.push({ doc: 99, tipo: 'CTe', em: '2026-01-05', venc: '2026-02-10', pgto: null, val: 999999.99, cancelado: true });

  const a = carregar(semCancelado, JSON.parse(JSON.stringify(pagos)));
  const b = carregar(comCancelado, JSON.parse(JSON.stringify(pagos)));
  a.CONS.forEach(a.recalcStatus); b.CONS.forEach(b.recalcStatus);

  const sa = a.computeConsStats(a.CONS), sb = b.computeConsStats(b.CONS);
  quase(sb.tval, sa.tval, 'valor total ignora o cancelado');
  igual(sb.tdue, sa.tdue, 'contagem de vencidos ignora o cancelado');
  quase(sb.vDue, sa.vDue, 'valor vencido ignora o cancelado');
  quase(sb.vOpen, sa.vOpen, 'valor a vencer ignora o cancelado');

  const ga = a.agregarPorVencimento(), gb = b.agregarPorVencimento();
  quase(gb.fat, ga.fat, 'Faturado ignora o cancelado');
  quase(gb.pago, ga.pago, 'Pago ignora o cancelado');
  quase(gb.saldo, ga.saldo, 'Saldo ignora o cancelado');
  quase(gb.pend, ga.pend, 'Pendente ignora o cancelado');
  igual(b.consAtivos().length, a.consAtivos().length, 'contagem de documentos ignora o cancelado');

  const datasIguais = JSON.stringify(gb.fatData) === JSON.stringify(ga.fatData);
  ok(datasIguais, 'a tabela por data também ignora o cancelado');
}

// ────────────────────────────────────────────────────────────
secao('Pendente: acumulado e rolante, só de vencimentos passados');
{
  const CONS = [
    { doc: 1, tipo: 'CTe', em: '2020-01-05', venc: '2020-02-10', pgto: null, val: 1000, cancelado: false },
    { doc: 2, tipo: 'CTe', em: '2020-02-05', venc: '2020-03-10', pgto: null, val: 300,  cancelado: false },
    { doc: 3, tipo: 'CTe', em: '2090-01-05', venc: '2090-02-10', pgto: null, val: 7777, cancelado: false }
  ];
  const PAG = [{ doc: 1, data: '2020-02-10', valor: -400 }];
  const u = carregar(CONS, PAG);
  const g = u.agregarPorVencimento();
  quase(g.pend, 900, 'sobra 600 de fevereiro + 300 de março');
  ok(g.pend < g.fat, 'vencimento futuro (2090) não entra no pendente');

  const CONS2 = [
    { doc: 1, tipo: 'CTe', em: '2020-01-05', venc: '2020-02-10', pgto: null, val: 100, cancelado: false },
    { doc: 2, tipo: 'CTe', em: '2020-02-05', venc: '2020-03-10', pgto: null, val: 100, cancelado: false }
  ];
  const PAG2 = [{ doc: 1, data: '2020-02-10', valor: -500 }];
  const u2 = carregar(CONS2, PAG2);
  quase(u2.agregarPorVencimento().pend, 0, 'pagamento a maior não vira pendente negativo');
}

// ────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(52));
console.log(passou + ' verificações passaram, ' + falhas + ' falharam');
if (falhas) { console.log('NÃO PUBLIQUE enquanto houver falha.'); process.exit(1); }
console.log('Tudo certo.');
