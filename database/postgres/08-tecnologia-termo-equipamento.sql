-- Log de termos de responsabilidade de equipamento emitidos
-- Auditoria: quem emitiu, pra quem, qual equipamento, quando.
-- Permite consultar histórico de equipamentos por colaborador.

CREATE TABLE IF NOT EXISTS tab_termo_equipamento (
    id                  SERIAL PRIMARY KEY,
    id_emissor          int NOT NULL REFERENCES tab_intranet_usr(id) ON DELETE CASCADE,
    -- Colaborador
    modo                varchar(3) NOT NULL,            -- 'CLT' ou 'PJ'
    matricula_protheus  varchar(10),                    -- só preenchido se vier do SRA010
    nome                varchar(200) NOT NULL,
    documento           varchar(20) NOT NULL,           -- CPF (CLT) ou CNPJ (PJ)
    cargo               varchar(100),
    -- Equipamento
    marca               varchar(80),
    modelo              varchar(80),
    cor                 varchar(40),
    novo                boolean,
    acessorios          text,
    condicoes           text,
    -- Localização / data
    cidade              varchar(100),
    data_termo          date NOT NULL,
    ip_origem           varchar(50),
    criado_em           timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_termo_eq_matricula ON tab_termo_equipamento (matricula_protheus, criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_termo_eq_doc       ON tab_termo_equipamento (documento, criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_termo_eq_emissor   ON tab_termo_equipamento (id_emissor, criado_em DESC);
