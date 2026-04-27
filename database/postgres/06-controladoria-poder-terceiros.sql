-- Permissão 11003 = Controladoria - Poder de Terceiros
INSERT INTO tab_intranet_permissoes (id_permissao, nome, modulo)
VALUES (11003, 'Controladoria - Poder de Terceiros', 'Controladoria')
ON CONFLICT (id_permissao) DO NOTHING;

-- Concede ao admin
INSERT INTO tab_intranet_usr_permissoes (id_user, id_permissao, matricula)
SELECT u.id, 11003, u.matricula
  FROM tab_intranet_usr u
 WHERE u.email = 'admin@gnatus.com.br'
ON CONFLICT (id_user, id_permissao) DO NOTHING;
