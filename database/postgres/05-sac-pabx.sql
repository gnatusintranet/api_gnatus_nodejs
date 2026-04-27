-- SAC + Click-to-call via PABX virtual Falemais (Sigma API)
-- - Coluna RAMAL no usuário (extensão telefônica para o /dial)
-- - Tabela de log de discagem (auditoria)
-- - Permissão 6002 = Supervisor SAC
-- - Tabela de log da chamada à API (opcional p/ debug)

-- 1) Coluna ramal em tab_intranet_usr
ALTER TABLE tab_intranet_usr ADD COLUMN IF NOT EXISTS ramal varchar(8);

-- 2) Permissão Supervisor SAC
INSERT INTO tab_intranet_permissoes (id_permissao, nome, modulo)
VALUES (6002, 'SAC - Supervisor', 'SAC')
ON CONFLICT (id_permissao) DO NOTHING;

-- Concede 6002 para admin
INSERT INTO tab_intranet_usr_permissoes (id_user, id_permissao, matricula)
SELECT u.id, 6002, u.matricula
  FROM tab_intranet_usr u
 WHERE u.email = 'admin@gnatus.com.br'
ON CONFLICT (id_user, id_permissao) DO NOTHING;

-- 3) Log de discagens (click-to-call do SAC)
CREATE TABLE IF NOT EXISTS tab_sac_discagem (
    id                SERIAL PRIMARY KEY,
    id_user           int NOT NULL REFERENCES tab_intranet_usr(id) ON DELETE CASCADE,
    ramal             varchar(8) NOT NULL,
    telefone_destino  varchar(20) NOT NULL,
    cliente_codigo    varchar(10),
    cliente_loja      varchar(4),
    cliente_nome      varchar(150),
    sucesso           boolean NOT NULL DEFAULT false,
    dial_id           varchar(64),         -- id retornado pelo /dial (uniqueid p/ buscar áudio depois)
    erro              varchar(500),
    ip_origem         varchar(50),
    criado_em         timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_sac_disc_user ON tab_sac_discagem (id_user, criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_sac_disc_cli  ON tab_sac_discagem (cliente_codigo, cliente_loja);
