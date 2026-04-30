-- MCL Fase 2 - Standard Cost (snapshot anual congelado)
--
-- Cada snapshot copia o B1_CUSTD vigente do SB1 + B1_CM1 (refencia) + grupo,
-- pra um momento (ano, versao). Permite comparar com MCL atual e custo real
-- (B1_CUSTD ou B2_CM1 atualizados depois).
--
-- Pode haver varias versoes por ano (ex: snapshot inicial em janeiro + revisao
-- em junho). A versao "ativa" pra comparacao eh a maior versao do ano.

CREATE TABLE IF NOT EXISTS tab_mcl_standard_cost (
    id              SERIAL PRIMARY KEY,
    ano             int          NOT NULL,
    versao          int          NOT NULL DEFAULT 1,
    material        varchar(15)  NOT NULL,            -- B1_COD
    descricao       varchar(200),
    grupo           varchar(4),                       -- B1_GRUPO
    tipo            varchar(4),                       -- B1_TIPO (PA, PI, MP, etc)
    um              varchar(4),                       -- B1_UM
    custo_padrao    numeric(18,6) NOT NULL,           -- snapshot do B1_CUSTD
    custo_medio_ref numeric(18,6),                    -- snapshot do B2_CM1 (refencia)
    -- Indice MCL no momento do snapshot (pra recalculo posterior)
    mcl_no_snapshot numeric(10,4),
    competencia_mcl date,                              -- mes do MCL usado
    -- Auditoria
    criado_por      int          REFERENCES tab_intranet_usr(id) ON DELETE SET NULL,
    criado_em       timestamp    NOT NULL DEFAULT NOW(),
    UNIQUE (ano, versao, material)
);
CREATE INDEX IF NOT EXISTS ix_mcl_sc_ano       ON tab_mcl_standard_cost (ano DESC, versao DESC);
CREATE INDEX IF NOT EXISTS ix_mcl_sc_material  ON tab_mcl_standard_cost (material);
CREATE INDEX IF NOT EXISTS ix_mcl_sc_grupo     ON tab_mcl_standard_cost (grupo);

-- Tabela de metadados de snapshots (pra listar facilmente quais existem)
CREATE TABLE IF NOT EXISTS tab_mcl_standard_cost_meta (
    id              SERIAL PRIMARY KEY,
    ano             int          NOT NULL,
    versao          int          NOT NULL,
    qtd_materiais   int          NOT NULL,
    valor_total     numeric(18,2),
    observacao      text,
    criado_por      int          REFERENCES tab_intranet_usr(id) ON DELETE SET NULL,
    criado_em       timestamp    NOT NULL DEFAULT NOW(),
    UNIQUE (ano, versao)
);
