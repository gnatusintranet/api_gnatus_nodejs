-- Permissão 1029 = Tecnologia - Provisionamento de Usuários (AD + M365)
INSERT INTO tab_intranet_permissoes (id_permissao, nome, modulo)
VALUES (1029, 'Tecnologia - Provisionamento de Usuários', 'Tecnologia')
ON CONFLICT (id_permissao) DO NOTHING;

-- Concede ao admin
INSERT INTO tab_intranet_usr_permissoes (id_user, id_permissao, matricula)
SELECT u.id, 1029, u.matricula
  FROM tab_intranet_usr u
 WHERE u.email = 'admin@gnatus.com.br'
ON CONFLICT (id_user, id_permissao) DO NOTHING;

-- Log de provisionamento (auditoria)
CREATE TABLE IF NOT EXISTS tab_provisionamento_log (
    id                 SERIAL PRIMARY KEY,
    id_user_executor   int NOT NULL REFERENCES tab_intranet_usr(id) ON DELETE CASCADE,
    nome_completo      varchar(200) NOT NULL,
    upn                varchar(200) NOT NULL,    -- email/UPN criado
    ou                 varchar(500),
    grupos_ad          text,                     -- CSV de grupos
    licenca_m365       varchar(100),
    criou_ad           boolean NOT NULL DEFAULT false,
    criou_m365         boolean NOT NULL DEFAULT false,
    atribuiu_licenca   boolean NOT NULL DEFAULT false,
    sucesso_geral      boolean NOT NULL DEFAULT false,
    detalhes           text,                     -- JSON com cada etapa
    erro               text,
    ip_origem          varchar(50),
    criado_em          timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_provis_user ON tab_provisionamento_log (id_user_executor, criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_provis_upn ON tab_provisionamento_log (upn);
