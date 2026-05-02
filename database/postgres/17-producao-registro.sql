-- ============================================================================
-- Modulo Producao - Registro Historico do Produto
--
-- Substitui o pipe Pipefy "01 | REGISTRO HISTORICO DO PRODUTO".
-- Acompanha o ciclo de vida da OP em 12 etapas: Separacao -> Impressao Rotulo
-- -> Liberacao Inicio -> Montagem -> Insp. Montagem -> Insp. Final ->
-- Embalagem -> Insp. Embalagem -> Liberacao Final -> Apontamento Protheus ->
-- Aguardando Coleta -> Concluido.
--
-- Permissoes:
--   14001 = Producao - Registro Historico do Produto (operar: criar/editar)
--   14002 = Producao - Admin (avancar fase, sync, gerencial)
-- ============================================================================

-- ============== Permissoes ==============
INSERT INTO tab_intranet_permissoes (id_permissao, nome, modulo)
VALUES (14001, 'Producao - Registro Historico do Produto', 'Producao')
ON CONFLICT (id_permissao) DO NOTHING;

INSERT INTO tab_intranet_permissoes (id_permissao, nome, modulo)
VALUES (14002, 'Producao - Admin (avancar fase, sync)', 'Producao')
ON CONFLICT (id_permissao) DO NOTHING;

-- Concede ambas ao admin
INSERT INTO tab_intranet_usr_permissoes (id_user, id_permissao, matricula)
SELECT u.id, 14001, u.matricula FROM tab_intranet_usr u WHERE u.email = 'admin@gnatus.com.br'
ON CONFLICT (id_user, id_permissao) DO NOTHING;
INSERT INTO tab_intranet_usr_permissoes (id_user, id_permissao, matricula)
SELECT u.id, 14002, u.matricula FROM tab_intranet_usr u WHERE u.email = 'admin@gnatus.com.br'
ON CONFLICT (id_user, id_permissao) DO NOTHING;

-- ============== tab_prod_registro: header ==============
-- 1 registro = 1 OP. Pode ter multiplos numeros de serie (array).
-- Quando criado via sync da SC2, fase_atual=1 e numeros_serie=NULL ate user preencher.
CREATE TABLE IF NOT EXISTS tab_prod_registro (
    id                 SERIAL PRIMARY KEY,
    op_protheus        varchar(20) NOT NULL,            -- C2_NUM (numero da OP no Protheus)
    op_filial          varchar(4)  NOT NULL DEFAULT '01',
    produto_codigo     varchar(20) NOT NULL,
    produto_descricao  varchar(200) NOT NULL,
    quantidade         numeric(15,4) NOT NULL DEFAULT 0,
    numeros_serie      text[],                          -- array (pode ter varios)
    data_inicio_prev   date,
    data_termino_prev  date,
    fase_atual         smallint NOT NULL DEFAULT 1,     -- 1..12
    status             varchar(20) NOT NULL DEFAULT 'aberto', -- aberto | concluido | cancelado
    origem             varchar(20) NOT NULL DEFAULT 'manual', -- manual | sync_protheus
    criado_por         int REFERENCES tab_intranet_usr(id) ON DELETE SET NULL,
    criado_em          timestamp NOT NULL DEFAULT NOW(),
    atualizado_em      timestamp NOT NULL DEFAULT NOW(),
    UNIQUE (op_filial, op_protheus)
);
CREATE INDEX IF NOT EXISTS ix_prod_reg_status ON tab_prod_registro (status, fase_atual);
CREATE INDEX IF NOT EXISTS ix_prod_reg_op     ON tab_prod_registro (op_protheus);
CREATE INDEX IF NOT EXISTS ix_prod_reg_prod   ON tab_prod_registro (produto_codigo);

-- ============== tab_prod_registro_etapa: 12 etapas por registro ==============
-- Criadas todas na criacao do registro (estado PENDENTE), preenchidas no decorrer.
-- dados_extras (JSONB) guarda campos especificos da etapa:
--   etapa 1 (Separacao):  { tipo_separacao: 'Total'|'Parcial', materiais_falta: '...' }
--   etapa 3 (Liberacao):  { checklist: [bool,bool,...], justificativa: '...' }
--   etapa 11 (Coleta):    { armazem: '00', localizacao: '...' }
CREATE TABLE IF NOT EXISTS tab_prod_registro_etapa (
    id                 SERIAL PRIMARY KEY,
    registro_id        int NOT NULL REFERENCES tab_prod_registro(id) ON DELETE CASCADE,
    etapa_codigo       smallint NOT NULL,    -- 1..12
    etapa_nome         varchar(80) NOT NULL,
    status             varchar(20) NOT NULL DEFAULT 'pendente', -- pendente | aprovado | reprovado | em_andamento
    responsavel_id     int REFERENCES tab_intranet_usr(id) ON DELETE SET NULL,
    responsavel_nome   varchar(120),         -- snapshot do nome (pra historico se user for deletado)
    data_execucao      date,
    observacao         text,
    rnc_numero         varchar(50),          -- referencia ao numero do RNC (sem tabela propria por enquanto)
    dados_extras       jsonb DEFAULT '{}'::jsonb,
    criado_em          timestamp NOT NULL DEFAULT NOW(),
    atualizado_em      timestamp NOT NULL DEFAULT NOW(),
    UNIQUE (registro_id, etapa_codigo)
);
CREATE INDEX IF NOT EXISTS ix_prod_etapa_status ON tab_prod_registro_etapa (status);
CREATE INDEX IF NOT EXISTS ix_prod_etapa_resp   ON tab_prod_registro_etapa (responsavel_id);

-- ============== tab_prod_registro_anexo: URLs do SharePoint ==============
-- Por enquanto so guarda URL (nao faz upload pra storage proprio).
-- Anexos podem ser do registro inteiro (etapa_codigo NULL) ou de uma etapa especifica.
CREATE TABLE IF NOT EXISTS tab_prod_registro_anexo (
    id                 SERIAL PRIMARY KEY,
    registro_id        int NOT NULL REFERENCES tab_prod_registro(id) ON DELETE CASCADE,
    etapa_codigo       smallint,             -- NULL = anexo do registro/global
    titulo             varchar(200) NOT NULL,
    url                text NOT NULL,
    tipo               varchar(50),          -- ordem_producao | rotulagem_anvisa | relatorio_montagem | outros
    enviado_por        int REFERENCES tab_intranet_usr(id) ON DELETE SET NULL,
    enviado_em         timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_prod_anexo_reg ON tab_prod_registro_anexo (registro_id, etapa_codigo);
