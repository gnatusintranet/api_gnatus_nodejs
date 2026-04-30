-- MCL Fase 3 - SCII (Should Cost Inflation Index)
--
-- Armazena expectativas do Boletim Focus do BCB pra IPCA, IGP-M e Cambio (USD).
-- API: https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/...
--
-- Cada linha representa uma expectativa publicada num momento (data_referencia)
-- pra um mes futuro especifico (competencia). Pegamos sempre o ultimo valor
-- publicado pra cada (indicador, competencia) — mediana das instituicoes.

CREATE TABLE IF NOT EXISTS tab_mcl_scii (
    id              SERIAL PRIMARY KEY,
    indicador       varchar(20)   NOT NULL,    -- 'IPCA' | 'IGPM' | 'CAMBIO'
    competencia     date          NOT NULL,    -- mes/ano sendo previsto (primeiro dia do mes)
    data_publicacao date          NOT NULL,    -- data em que a expectativa foi publicada
    mediana         numeric(10,4),
    media           numeric(10,4),
    minimo          numeric(10,4),
    maximo          numeric(10,4),
    desvio_padrao   numeric(10,4),
    coeficiente_variacao numeric(10,4),
    base_calculo    int,                       -- BaseCalculo do BCB (0=long, 1=short)
    sincronizado_em timestamp     NOT NULL DEFAULT NOW(),
    UNIQUE (indicador, competencia, data_publicacao, base_calculo)
);
CREATE INDEX IF NOT EXISTS ix_mcl_scii_indicador_comp ON tab_mcl_scii (indicador, competencia, data_publicacao DESC);
CREATE INDEX IF NOT EXISTS ix_mcl_scii_pub             ON tab_mcl_scii (data_publicacao DESC);
