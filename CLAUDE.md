# Sistema de Pagamentos NFS-e & CTe — Novatrans Logística

Controle de pagamentos de notas fiscais. HTML/CSS/JS puro, sem build, sem
dependências. Scripts globais carregados por `<script src>` na ordem definida no
fim do `index.html`. Dados no Supabase (API REST), com `localStorage` como cache.
Publicado pelo GitHub Pages a partir da branch `main`.

## Os números de pagamento são o produto

Este sistema existe para dizer quanto a OJI deve e quanto já pagou. Um número
errado aqui não é um bug de interface: é uma cobrança errada. Antes de publicar
qualquer alteração que toque em valor, status ou vencimento:

```
node testes/testes.js
```

Se houver falha, não publique.

## Regras que não podem ser reinventadas

**Nunca agregue `CONS` direto.** Documento cancelado não pode entrar em nenhuma
soma ou contagem de negócio. Use sempre:

- `consAtivos()` — a lista sem os cancelados;
- `computeConsStats(dados)` — totais por status;
- `agregarPorVencimento()` — faturado, pago, saldo e pendente por data canônica.

Uma tela que refaz esse cálculo por conta própria vai divergir das outras. Foi
exatamente isso que fez documentos cancelados continuarem somando no Pendente da
tela de Pagamentos Oji depois de já terem sido removidos de todo o resto.

**Status nunca é calculado direto com `calcSt()` sobre um registro do `CONS`.**
Use `recalcStatus(r)`, que trata o cancelado antes de cair no cálculo por datas.

**Pendente carrega crédito adiante.** Quando a OJI paga a mais numa data, a
sobra abate os vencimentos seguintes. Zerar o acumulado a cada data descarta esse
crédito e infla o pendente.

**Vencimento (dekádio), em `calcVenc()`:** emissão até o dia 10 → dia 10 do mês
seguinte; até o dia 20 → dia 20; dia 21 a 30 → dia 30 (ou o último dia, se o mês
seguinte for mais curto); dia 31 → conta como dia 1 do mês seguinte, vencendo dia
10 dois meses depois. As mesmas regras estão replicadas como fórmula de Excel em
`js/export.js` — alterar uma exige alterar a outra.

**Importação de XML verifica o tomador do serviço.** No CT-e pelo código
`<toma>` (0=rem, 1=exped, 2=receb, 3=dest) ou pelo bloco `<toma4>`; na NFS-e pelo
bloco `<toma>`. Compara por CNPJ contra `TOMADORES_ACEITOS`, nunca por nome.

## Alterações no banco

A chave publicável do Supabase não cria nem altera colunas. Quando uma alteração
precisar de coluna nova, o comando SQL é executado pelo usuário no painel do
Supabase, e o código só é publicado **depois** — publicar antes quebra a
sincronização.

## Cache do GitHub Pages

`max-age=600`. Depois de publicar, conferir com Ctrl+Shift+R; sem isso a versão
antiga continua aparecendo por até 10 minutos.
