-- Schema PostgreSQL equivalente ao MSSQL Intranet.
-- Mapeamento de tipos:
--   int IDENTITY(1,1) → SERIAL PRIMARY KEY
--   varchar(N)         → varchar(N)
--   nvarchar(N)        → varchar(N)         (Postgres é UTF-8 nativo, sem nvarchar)
--   nvarchar(MAX)      → text
--   bit                → boolean
--   datetime           → timestamp
--   date               → date
--   decimal            → numeric(18, 2)     (default; ajustar se precisar)
--   GETDATE()          → NOW()
--
-- Convenção: nomes em snake_case lowercase (padrão Postgres) — mas mantemos
-- os mesmos nomes do MSSQL pra não quebrar o SQL existente nos endpoints.
-- Postgres aceita identifier UPPERCASE se entre aspas duplas, mas aqui usamos
-- lowercase sem aspas pois os endpoints usam aliases.

-- Drop tudo (apenas em dev / migração inicial — comentar em prod)
-- DROP TABLE IF EXISTS tab_aprovacao_log CASCADE;
-- DROP TABLE IF EXISTS tab_cobranca_acao CASCADE;
-- DROP TABLE IF EXISTS tab_cobranca_comentario CASCADE;
-- DROP TABLE IF EXISTS tab_cobranca_status_cliente CASCADE;
-- DROP TABLE IF EXISTS tab_cofre_item CASCADE;
-- DROP TABLE IF EXISTS tab_exp_bordero CASCADE;
-- DROP TABLE IF EXISTS tab_intranet_usr_permissoes CASCADE;
-- DROP TABLE IF EXISTS tab_intranet_permissoes CASCADE;
-- DROP TABLE IF EXISTS tab_intranet_usr CASCADE;
-- DROP TABLE IF EXISTS tab_intranet_usr_franqueado CASCADE;
-- DROP TABLE IF EXISTS tab_sys_audit_meta CASCADE;
-- DROP TABLE IF EXISTS tab_verificacao_intranet CASCADE;

-- ============================================================
-- 1) Usuários e permissões
-- ============================================================
CREATE TABLE IF NOT EXISTS tab_intranet_usr (
    id                       SERIAL PRIMARY KEY,
    nome                     varchar(150) NOT NULL,
    email                    varchar(150) NOT NULL UNIQUE,
    senha                    varchar(255) NOT NULL,
    matricula                varchar(50),
    ativo                    boolean NOT NULL DEFAULT true,
    cofre_salt               varchar(256),
    cofre_iterations         int,
    cofre_verifier           varchar(1024),
    cofre_mk_enc_pass        varchar(1024),
    cofre_mk_enc_recovery    varchar(1024),
    cofre_created_at         timestamp,
    codigo_protheus          varchar(6)
);

CREATE TABLE IF NOT EXISTS tab_intranet_permissoes (
    id            SERIAL PRIMARY KEY,
    id_permissao  int NOT NULL UNIQUE,
    nome          varchar(150) NOT NULL,
    modulo        varchar(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS tab_intranet_usr_permissoes (
    id            SERIAL PRIMARY KEY,
    id_user       int NOT NULL REFERENCES tab_intranet_usr(id) ON DELETE CASCADE,
    id_permissao  int NOT NULL,
    matricula     varchar(50),
    UNIQUE (id_user, id_permissao)
);
CREATE INDEX IF NOT EXISTS ix_usr_perm_user ON tab_intranet_usr_permissoes (id_user);

CREATE TABLE IF NOT EXISTS tab_intranet_usr_franqueado (
    id          SERIAL PRIMARY KEY,
    nome        varchar(150),
    email       varchar(150),
    senha       varchar(255),
    matricula   varchar(50),
    ativo       boolean NOT NULL DEFAULT true
);

-- ============================================================
-- 2) Verificação de e-mail (códigos temporários reset senha)
-- ============================================================
CREATE TABLE IF NOT EXISTS tab_verificacao_intranet (
    email           varchar(150) NOT NULL,
    codigo          varchar(10) NOT NULL,
    data_expiracao  timestamp NOT NULL,
    PRIMARY KEY (email, codigo)
);

-- ============================================================
-- 3) Cofre de senhas (zero-knowledge)
-- ============================================================
CREATE TABLE IF NOT EXISTS tab_cofre_item (
    id           SERIAL PRIMARY KEY,
    id_user      int NOT NULL REFERENCES tab_intranet_usr(id) ON DELETE CASCADE,
    titulo       varchar(200) NOT NULL,
    categoria    varchar(80),
    url          varchar(500),
    usuario_enc  text,
    senha_enc    text NOT NULL,
    notas_enc    text,
    created_at   timestamp NOT NULL DEFAULT NOW(),
    updated_at   timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_cofre_user ON tab_cofre_item (id_user);

-- Backup IT do cofre (tabela obfuscada)
CREATE TABLE IF NOT EXISTS tab_sys_audit_meta (
    meta_id          SERIAL PRIMARY KEY,
    meta_ref         int NOT NULL,
    meta_hash        varchar(64) NOT NULL,
    meta_data        varchar(2048) NOT NULL,
    meta_created     timestamp NOT NULL DEFAULT NOW(),
    meta_updated     timestamp,
    meta_last_read   timestamp,
    meta_read_count  int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_audit_ref ON tab_sys_audit_meta (meta_ref);

-- ============================================================
-- 4) Módulo de Cobrança
-- ============================================================
CREATE TABLE IF NOT EXISTS tab_cobranca_acao (
    id                SERIAL PRIMARY KEY,
    cliente_cod       varchar(10) NOT NULL,
    cliente_loja      varchar(4)  NOT NULL,
    titulo_prefixo    varchar(10),
    titulo_num        varchar(20),
    titulo_parcela    varchar(4),
    titulo_tipo       varchar(6),
    tipo_acao         varchar(20) NOT NULL,
    resultado         varchar(30) NOT NULL,
    data_promessa     date,
    valor_prometido   numeric(18, 2),
    descricao         text,
    id_user           int NOT NULL REFERENCES tab_intranet_usr(id),
    criado_em         timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_cobr_acao_cliente  ON tab_cobranca_acao (cliente_cod, cliente_loja);
CREATE INDEX IF NOT EXISTS ix_cobr_acao_user     ON tab_cobranca_acao (id_user);
CREATE INDEX IF NOT EXISTS ix_cobr_acao_promessa ON tab_cobranca_acao (data_promessa) WHERE data_promessa IS NOT NULL;

CREATE TABLE IF NOT EXISTS tab_cobranca_comentario (
    id           SERIAL PRIMARY KEY,
    cliente_cod  varchar(10) NOT NULL,
    cliente_loja varchar(4)  NOT NULL,
    id_user      int NOT NULL REFERENCES tab_intranet_usr(id),
    texto        text NOT NULL,
    criado_em    timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_cobr_comt_cliente ON tab_cobranca_comentario (cliente_cod, cliente_loja, criado_em DESC);

CREATE TABLE IF NOT EXISTS tab_cobranca_status_cliente (
    cliente_cod      varchar(10) NOT NULL,
    cliente_loja     varchar(4)  NOT NULL,
    status           varchar(20) NOT NULL,
    observacao       varchar(500),
    dt_atualizacao   timestamp NOT NULL DEFAULT NOW(),
    id_user          int NOT NULL REFERENCES tab_intranet_usr(id),
    PRIMARY KEY (cliente_cod, cliente_loja)
);

-- ============================================================
-- 5) Expedição (bordero de etiquetas Zebra)
-- ============================================================
CREATE TABLE IF NOT EXISTS tab_exp_bordero (
    id              SERIAL PRIMARY KEY,
    notafiscal      varchar(20)  NOT NULL,
    serie           varchar(4),
    destinatario    varchar(200),
    endereco        varchar(300),
    cidade          varchar(150),
    cep             varchar(12),
    transportadora  varchar(200),
    volumes         varchar(10) NOT NULL,
    id_user         int REFERENCES tab_intranet_usr(id),
    criado_em       timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_exp_bord_nf ON tab_exp_bordero (notafiscal);

-- ============================================================
-- 6) Log de aprovações SC/PC (auditoria de chamadas à API Protheus)
-- ============================================================
CREATE TABLE IF NOT EXISTS tab_aprovacao_log (
    id                 SERIAL PRIMARY KEY,
    id_user            int          NOT NULL REFERENCES tab_intranet_usr(id),
    codigo_protheus    varchar(6)   NOT NULL,
    tipo_doc           varchar(2)   NOT NULL,
    numero_doc         varchar(20)  NOT NULL,
    acao               varchar(20)  NOT NULL,
    justificativa      text,
    sucesso            boolean      NOT NULL,
    resposta_protheus  text,
    ip_origem          varchar(50),
    criado_em          timestamp    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_apr_log_user ON tab_aprovacao_log (id_user, criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_apr_log_doc  ON tab_aprovacao_log (tipo_doc, numero_doc);
