-- Equipamentos em poder dos colaboradores (estado atual + historico).
--
-- A tab_termo_equipamento existente continua sendo o LOG IMUTAVEL de termos
-- emitidos. Esta nova tabela representa o ESTADO atual de cada equipamento
-- (ativo, removido, substituido), permitindo responder "qual equipamento o
-- colaborador X tem hoje?" e "ha quanto tempo ele tem?".
--
-- Status:
--   ATIVO       -> esta com o colaborador agora
--   SUBSTITUIDO -> foi trocado por outro (ver id_substituicao apontando pro novo)
--   REMOVIDO    -> foi devolvido (motivo_remocao explica)
--
-- Motivos de remocao:
--   DEFEITO         -> equipamento estragou (controla tempo de uso ate quebra)
--   PERDA           -> roubo/extravio
--   FIM_CONTRATO    -> colaborador desligado
--   UPGRADE         -> trocado por melhor (sem ser por defeito)
--   OUTRO           -> com observacao livre

CREATE TABLE IF NOT EXISTS tab_equipamento_atual (
    id                  SERIAL PRIMARY KEY,
    -- Colaborador
    documento           varchar(20)  NOT NULL,            -- CPF ou CNPJ (chave de agrupamento)
    nome                varchar(200) NOT NULL,
    matricula_protheus  varchar(10),
    cargo               varchar(100),
    -- Equipamento
    marca               varchar(80),
    modelo              varchar(80),
    cor                 varchar(40),
    novo                boolean,
    acessorios          text,
    condicoes           text,
    -- Estado
    data_entrega        date         NOT NULL,
    status              varchar(15)  NOT NULL DEFAULT 'ATIVO',
    data_remocao        date,
    motivo_remocao      varchar(20),
    obs_remocao         text,
    -- Rastreabilidade
    id_termo_origem     int          REFERENCES tab_termo_equipamento(id) ON DELETE SET NULL,
    id_substituicao     int          REFERENCES tab_equipamento_atual(id) ON DELETE SET NULL,
    registrado_por      int          REFERENCES tab_intranet_usr(id) ON DELETE SET NULL,
    criado_em           timestamp    NOT NULL DEFAULT NOW(),
    atualizado_em       timestamp    NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_equip_status CHECK (status IN ('ATIVO','SUBSTITUIDO','REMOVIDO')),
    CONSTRAINT chk_equip_motivo CHECK (motivo_remocao IS NULL OR motivo_remocao IN ('DEFEITO','PERDA','FIM_CONTRATO','UPGRADE','OUTRO'))
);
CREATE INDEX IF NOT EXISTS ix_equip_documento ON tab_equipamento_atual (documento, status);
CREATE INDEX IF NOT EXISTS ix_equip_status    ON tab_equipamento_atual (status);
CREATE INDEX IF NOT EXISTS ix_equip_motivo    ON tab_equipamento_atual (motivo_remocao);

-- Popula com termos existentes (1 termo = 1 equipamento ATIVO).
-- Idempotente: so insere se nao existe linha referenciando aquele termo.
INSERT INTO tab_equipamento_atual (
    documento, nome, matricula_protheus, cargo,
    marca, modelo, cor, novo, acessorios, condicoes,
    data_entrega, status, id_termo_origem, registrado_por
)
SELECT
    t.documento, t.nome, t.matricula_protheus, t.cargo,
    t.marca, t.modelo, t.cor, t.novo, t.acessorios, t.condicoes,
    t.data_termo, 'ATIVO', t.id, t.id_emissor
FROM tab_termo_equipamento t
WHERE NOT EXISTS (
    SELECT 1 FROM tab_equipamento_atual e WHERE e.id_termo_origem = t.id
);
