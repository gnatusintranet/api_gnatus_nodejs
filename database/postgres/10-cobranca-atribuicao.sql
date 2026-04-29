-- Atribuicao manual de carteira e equipe responsavel por cliente Protheus.
-- Substitui a planilha que mantinha as abas "Juridico Rodrigo", "Juridico
-- Mohamed", "Negociarie" etc. Carteira e equipe sao definidas por cliente
-- (cod + loja) e impactam o agrupamento na nova pagina Carteira de Cobranca.

CREATE TABLE IF NOT EXISTS tab_cobranca_atribuicao (
    id              SERIAL PRIMARY KEY,
    cliente_cod     varchar(10)  NOT NULL,
    cliente_loja    varchar(4)   NOT NULL,
    carteira        varchar(40),                        -- ex: 'NORMAL','JURIDICO','NEGOCIACAO','OUTROS'
    equipe          varchar(60),                        -- ex: 'Rodrigo','Mohamed','Equipe SP'
    observacao      text,
    atualizado_por  int          REFERENCES tab_intranet_usr(id) ON DELETE SET NULL,
    atualizado_em   timestamp    NOT NULL DEFAULT NOW(),
    criado_em       timestamp    NOT NULL DEFAULT NOW(),
    UNIQUE (cliente_cod, cliente_loja)
);
CREATE INDEX IF NOT EXISTS ix_cob_atrib_carteira ON tab_cobranca_atribuicao (carteira);
CREATE INDEX IF NOT EXISTS ix_cob_atrib_equipe   ON tab_cobranca_atribuicao (equipe);
