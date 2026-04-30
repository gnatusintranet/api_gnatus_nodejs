-- Adiciona coluna `acao` em tab_provisionamento_log pra distinguir CRIAR/DESLIGAR.
-- Default 'CRIAR' rotula registros antigos como criação (que era o único fluxo até agora).

ALTER TABLE tab_provisionamento_log
    ADD COLUMN IF NOT EXISTS acao varchar(20) NOT NULL DEFAULT 'CRIAR';

CREATE INDEX IF NOT EXISTS ix_provis_acao ON tab_provisionamento_log (acao, criado_em DESC);
