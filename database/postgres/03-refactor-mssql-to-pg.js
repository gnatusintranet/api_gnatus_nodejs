// Refatora os arquivos resources/* e middlewares/* trocando Mssql por Pg
// (mantendo Protheus intacto). Faz find/replace mecânico — depois ainda
// precisa ajustar manualmente OUTPUT INSERTED / MERGE / TOP N.
//
// Uso (do raiz do backend):
//   node database/postgres/03-refactor-mssql-to-pg.js              # dry-run
//   node database/postgres/03-refactor-mssql-to-pg.js --apply      # aplica
//
// Faz backup .mssql.bak de cada arquivo alterado.

const fs   = require('fs');
const path = require('path');

const DRY = !process.argv.includes('--apply');
const ROOT = path.resolve(__dirname, '..', '..');

const ARQUIVOS = [
    // resources/users/
    'resources/users/users.update.js',
    'resources/users/users.create.js',
    'resources/users/users.me.js',
    'resources/users/users.toggle-active.js',
    'resources/users/users.all.js',
    'resources/users/users.login.js',
    'resources/users/users.buscarNome.js',
    'resources/users/user.alter.password.js',
    'resources/users/redefinir-senha-com-codigo.js',
    'resources/users/enviar-codigo-reset.js',
    // resources/cofre/
    'resources/cofre/cofre.admin-recovery.js',
    'resources/cofre/cofre.reset-password.js',
    'resources/cofre/cofre.setup.js',
    'resources/cofre/cofre.item-delete.js',
    'resources/cofre/cofre.item-update.js',
    'resources/cofre/cofre.item-create.js',
    'resources/cofre/cofre.items.js',
    'resources/cofre/cofre.recovery.js',
    'resources/cofre/cofre.status.js',
    // resources/cobranca/
    'resources/cobranca/cobranca.painel.js',
    'resources/cobranca/cobranca.cliente.js',
    'resources/cobranca/cobranca.acao-create.js',
    'resources/cobranca/cobranca.acao-update.js',
    'resources/cobranca/cobranca.acao-delete.js',
    'resources/cobranca/cobranca.minhas-acoes.js',
    'resources/cobranca/cobranca.comentario-create.js',
    'resources/cobranca/cobranca.comentario-delete.js',
    'resources/cobranca/cobranca.status.js',
    // resources/expedicao/
    'resources/expedicao/expedicao.notas.js',
    'resources/expedicao/expedicao.bordero-list.js',
    'resources/expedicao/expedicao.bordero-add.js',
    'resources/expedicao/expedicao.bordero-delete-nf.js',
    'resources/expedicao/expedicao.bordero-delete-linha.js',
    'resources/expedicao/expedicao.bordero-clear.js',
    // resources/aprovacoes/
    'resources/aprovacoes/aprovacoes.aprovar.js',
    'resources/aprovacoes/aprovacoes.rejeitar.js',
    // resources/permissoes/
    'resources/permissoes/permissoes.all.js',
    'resources/permissoes/permissoes.update.perm.js',
    'resources/permissoes/permissoes.post.delete.js',
    'resources/permissoes/permissoes.post.perm.js',
    'resources/permissoes/permissoes.post.perm.user.js',
    'resources/permissoes/permissoes.get.perm.usr.js',
    // middleware
    'middlewares/authentication.js'
];

// Tabelas Intranet — uppercase no MSSQL → lowercase no Postgres.
// Para evitar match em strings desnecessárias (ex: comentários), trocamos
// só com word-boundary.
const TABELAS = [
    'TAB_INTRANET_USR_PERMISSOES',
    'TAB_INTRANET_USR_FRANQUEADO',
    'TAB_INTRANET_PERMISSOES',
    'TAB_INTRANET_USR',
    'TAB_VERIFICACAO_INTRANET',
    'TAB_COFRE_ITEM',
    'TAB_SYS_AUDIT_META',
    'TAB_COBRANCA_ACAO',
    'TAB_COBRANCA_COMENTARIO',
    'TAB_COBRANCA_STATUS_CLIENTE',
    'TAB_EXP_BORDERO',
    'TAB_APROVACAO_LOG'
];

// Colunas mais usadas que precisam virar lowercase nos SELECTs
// (em Postgres, sem aspas, os identifiers são case-insensitive — mas se
// houvesse alguma com aspas duplas, seria sensitive. Aqui sempre uso sem aspas).
// Não vou converter coluna por coluna — Postgres aceita tudo upper/lower
// quando sem aspas, então mantenho os nomes do código.

const transformar = (texto) => {
    let t = texto;

    // 1) Destructuring: { Mssql } → { Pg }, mas { Mssql, Protheus } → { Pg, Protheus }
    //    e { Protheus, Mssql } → { Protheus, Pg }
    t = t.replace(/\bMssql\b/g, 'Pg');

    // 2) Tabelas em uppercase → lowercase (em SQL strings)
    for (const tab of TABELAS) {
        const re = new RegExp(`\\b${tab}\\b`, 'g');
        t = t.replace(re, tab.toLowerCase());
    }

    // 3) ATIVO = 1 → ATIVO = true (em queries Postgres) — só trocamos quando
    //    está em string SQL antes/depois de palavras-chave (heurística simples)
    //    Casos comuns:
    //      WHERE ATIVO = 1    →  WHERE ativo = true
    //      AND ATIVO = 1      →  AND ativo = true
    //      ATIVO = @ativo     →  ativo = @ativo  (já tratado pela tabela acima)
    t = t.replace(/\bATIVO\s*=\s*1\b/g, 'ativo = true');
    t = t.replace(/\bATIVO\s*=\s*0\b/g, 'ativo = false');

    return t;
};

let alterados = 0;
let semChange = 0;
const naoEncontrados = [];
const issuesManuais = [];

for (const rel of ARQUIVOS) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
        naoEncontrados.push(rel);
        continue;
    }
    const orig = fs.readFileSync(abs, 'utf8');
    const novo = transformar(orig);

    // Detecta padrões que precisam ajuste manual depois
    const issues = [];
    if (/OUTPUT\s+INSERTED/i.test(novo)) issues.push('OUTPUT INSERTED → RETURNING');
    if (/\bMERGE\s+/i.test(novo)) issues.push('MERGE → INSERT ON CONFLICT');
    if (/\bSELECT\s+TOP\b/i.test(novo)) issues.push('SELECT TOP N → LIMIT N');
    if (issues.length) issuesManuais.push({ rel, issues });

    if (novo === orig) {
        semChange++;
        continue;
    }
    alterados++;
    if (DRY) {
        console.log(`[dry] ${rel}`);
    } else {
        fs.writeFileSync(abs + '.mssql.bak', orig, 'utf8');
        fs.writeFileSync(abs, novo, 'utf8');
        console.log(`[ok]  ${rel}`);
    }
}

console.log();
console.log(`Total: ${ARQUIVOS.length}  | alterados: ${alterados}  | sem mudança: ${semChange}  | não encontrados: ${naoEncontrados.length}`);
if (naoEncontrados.length) console.log('Não encontrados:', naoEncontrados);
if (issuesManuais.length) {
    console.log();
    console.log('⚠️  Arquivos que precisam ajuste manual após o replace mecânico:');
    issuesManuais.forEach(i => console.log(`  - ${i.rel}: ${i.issues.join(', ')}`));
}
if (DRY) console.log('\n(dry-run: rode com --apply para aplicar)');
