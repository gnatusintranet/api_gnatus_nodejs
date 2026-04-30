-- Modulo MCL (Material Cost Level) - Dashboard de variacao de custo
-- de materiais baseado em indices economicos.
--
-- MCL = (USD * peso_usd) + (IGPM * peso_igpm) + (IPCA * peso_ipca)
-- Pesos default: 50% / 30% / 20% (configuraveis pra simulacao)
--
-- Indices vem do BCB (Banco Central) via API publica:
--   USD comercial venda fim do mes  -> serie 1
--   IGP-M variacao % mensal         -> serie 189
--   IPCA variacao % mensal          -> serie 433
-- Cobertura mensal. Usuario pode fazer override manual via tela.

CREATE TABLE IF NOT EXISTS tab_mcl_indices (
    id              SERIAL PRIMARY KEY,
    competencia     date         NOT NULL UNIQUE,        -- primeiro dia do mes
    usd             numeric(18,4),                       -- cotacao
    igpm            numeric(8,4),                        -- variacao % mensal
    ipca            numeric(8,4),                        -- variacao % mensal
    fonte           varchar(20)  NOT NULL DEFAULT 'BCB', -- 'BCB' ou 'MANUAL'
    atualizado_por  int          REFERENCES tab_intranet_usr(id) ON DELETE SET NULL,
    atualizado_em   timestamp    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_mcl_indices_comp ON tab_mcl_indices (competencia DESC);

-- Configuracao unica (linha 1) com pesos e mes base pra normalizacao 100
CREATE TABLE IF NOT EXISTS tab_mcl_config (
    id                SERIAL PRIMARY KEY,
    peso_usd          numeric(5,4) NOT NULL DEFAULT 0.5000,
    peso_igpm         numeric(5,4) NOT NULL DEFAULT 0.3000,
    peso_ipca         numeric(5,4) NOT NULL DEFAULT 0.2000,
    base_competencia  date         NOT NULL DEFAULT DATE '2026-01-01',
    atualizado_por    int          REFERENCES tab_intranet_usr(id) ON DELETE SET NULL,
    atualizado_em     timestamp    NOT NULL DEFAULT NOW()
);

-- Linha unica de config (id sempre 1)
INSERT INTO tab_mcl_config (id, peso_usd, peso_igpm, peso_ipca, base_competencia)
VALUES (1, 0.5000, 0.3000, 0.2000, DATE '2026-01-01')
ON CONFLICT (id) DO NOTHING;

-- Permissao 4003
INSERT INTO tab_intranet_permissoes (id_permissao, nome, modulo)
VALUES (4003, 'Compras - Dashboard MCL', 'Compras')
ON CONFLICT (id_permissao) DO NOTHING;

-- Atribui ao admin
INSERT INTO tab_intranet_usr_permissoes (id_user, id_permissao, matricula)
SELECT id, 4003, matricula FROM tab_intranet_usr WHERE email = 'admin@gnatus.com.br'
ON CONFLICT DO NOTHING;
