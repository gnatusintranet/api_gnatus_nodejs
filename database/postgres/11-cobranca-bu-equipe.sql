-- Mapeamento BU -> Equipe da carteira de cobranca.
-- Substitui a aba "apoio" da planilha que normalizava os codigos brutos
-- de C5_ZTIPO (e seu fallback "<COD> (Desconhecido)" quando SX5 nao tinha
-- a descricao) em uma equipe consolidada.
--
-- Chave de busca = label do BU exatamente como o backend formata:
--   - X5_DESCRI quando existe
--   - "<COD> (Desconhecido)" quando SX5 nao tem entrada
--   - "(Desconhecido)" quando nem o codigo existe
--
-- Equipe agora deriva do BU, nao mais da atribuicao por cliente.

CREATE TABLE IF NOT EXISTS tab_cobranca_bu_equipe (
    bu_codigo       varchar(80)  PRIMARY KEY,           -- label do BU (case-sensitive)
    equipe          varchar(60)  NOT NULL,
    atualizado_por  int          REFERENCES tab_intranet_usr(id) ON DELETE SET NULL,
    atualizado_em   timestamp    NOT NULL DEFAULT NOW(),
    criado_em       timestamp    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_cob_bueq_equipe ON tab_cobranca_bu_equipe (equipe);

-- A coluna equipe da atribuicao por cliente nao faz mais sentido:
-- equipe vem do BU agora. Carteira (NORMAL/JURIDICO/NEGOCIACAO) continua
-- por cliente porque depende da relacao comercial, nao do BU.
ALTER TABLE tab_cobranca_atribuicao DROP COLUMN IF EXISTS equipe;
DROP INDEX IF EXISTS ix_cob_atrib_equipe;

-- Seed inicial. Repeticoes na planilha original (ex: MERCADO LIVRE varias vezes)
-- foram deduplicadas. ON CONFLICT DO NOTHING garante idempotencia.
INSERT INTO tab_cobranca_bu_equipe (bu_codigo, equipe) VALUES
  ('(Desconhecido)',                          '(Desconhecido)'),
  ('Comercial Varejo',                        'Comercial Varejo'),
  ('Assistência Técnica',                     'Assistência Técnica'),
  ('Comercial Atacado',                       'Comercial Atacado'),
  ('Congresso',                               'Comercial Varejo'),
  ('Comercial Dentais',                       'Comercial Atacado'),
  ('Vendas AT Produtos',                      'Assistência Técnica'),
  ('Redigitação',                             'Redigitação'),
  ('CIOSP 2020',                              'Comercial Varejo'),
  ('Representantes',                          'Representantes'),
  ('Corporativo',                             'Corporativo'),
  ('Garantia',                                'Garantia'),
  ('Retorno de Conserto',                     'Garantia'),
  ('TRC (Desconhecido)',                      'Troca'),
  ('OLI (Desconhecido)',                      'Olist'),
  ('S22 (Desconhecido)',                      'Comercial Varejo'),
  ('OLIST',                                   'Olist'),
  ('IFA (Desconhecido)',                      'Redigitação'),
  ('S23 (Desconhecido)',                      'Comercial Varejo'),
  ('RSB (Desconhecido)',                      'Comercial Varejo'),
  ('DIG (Desconhecido)',                      'Digital'),
  ('LIC (Desconhecido)',                      'Licitação'),
  ('FGV (Desconhecido)',                      'Comercial Varejo'),
  ('FGA (Desconhecido)',                      'Comercial Atacado'),
  ('DVV (Desconhecido)',                      'Comercial Varejo'),
  ('ASSISTENCIA TECNICA',                     'Assistência Técnica'),
  ('FUTURO GARANTIDO ATACADO',                'Representantes'),
  ('TROCA',                                   'Troca'),
  ('REPRESENTAÇÕES',                          'Representantes'),
  ('REDIGITACAO',                             'Redigitação'),
  ('CIOSP 2022',                              'Comercial Varejo'),
  ('CIOSP 2023',                              'Comercial Varejo'),
  ('DIGITAL',                                 'Digital'),
  ('LICITAÇÕES',                              'Licitação'),
  ('FUTURO GARANTIDO VAREJO',                 'Comercial Varejo'),
  ('PEDIDO DEVOLVIDO VAREJO',                 'Comercial Varejo'),
  ('CIOSP 2024',                              'Comercial Varejo'),
  ('CONESPO 2024',                            'Comercial Varejo'),
  ('OUTLET',                                  'Comercial Atacado'),
  ('PEDIDO DEVOLVIDO DIGITAL',                'Digital'),
  ('MERCADO LIVRE',                           'Online'),
  ('LEADING PAGE',                            'Online'),
  ('LANDING PAGE',                            'Online'),
  ('FRANQUIAS',                               'Franquias'),
  ('FRANQUIAS TAXAS',                         'Taxa de Franquia'),
  ('CONGRESSO IN 2024',                       'Comercial Varejo'),
  ('CONGRESSO ORTO 2024',                     'Comercial Varejo'),
  ('CIOBA 2024',                              'Comercial Varejo'),
  ('CIOSP 2025',                              'Comercial Varejo'),
  ('PEDIDO DEVOLVIDO REPRESENTAÇÃO',          'Representantes'),
  ('PEDIDO DEVOLVIDO ASSISTENCIA TECNICA',    'Assistência Técnica'),
  ('GNATUS SERVICE',                          'GNATUS SERVICE'),
  ('CORIG 2025',                              'Comercial Varejo'),
  ('CONESPO 2025',                            'Comercial Varejo'),
  ('FRANQUEADO SHOWROOM',                     'Comercial Atacado'),
  ('PEDIDO DEVOLVIDO LICITACAO',              'Licitação'),
  ('PEDIDO DEVOLVIDO LICITAÇÃO',              'Licitação'),
  ('FRANQUEADO ATACADO',                      'Comercial Atacado'),
  ('FRANQUEADO PEÇAS',                        'Assistência Técnica'),
  ('FRANQUEADO REPRESENTAÇÃO',                'Representantes'),
  ('INDEX 2025',                              'Comercial Varejo'),
  ('PEDIDO DEVOLVIDO CORPORATIVO',            'Corporativo'),
  ('CIOSP 2026',                              'Comercial Varejo'),
  ('GIFT SHOP',                               'Online')
ON CONFLICT (bu_codigo) DO NOTHING;
