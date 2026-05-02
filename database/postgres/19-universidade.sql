-- ============================================================================
-- Modulo Universidade Gnatus
--
-- Plataforma interna de treinamento. Conteudo (videos/PDFs/slides) hospedado
-- no SharePoint corporativo — guardamos so URL.
--
-- Tabelas:
--   tab_uni_categoria  — categorias de curso (Onboarding, Compliance, etc)
--   tab_uni_curso      — header do curso
--   tab_uni_aula       — aulas dentro do curso
--   tab_uni_matricula  — user x curso
--   tab_uni_progresso  — matricula x aula (aula concluida)
--
-- Permissoes:
--   15001 = Universidade - Aluno (matricular-se, fazer cursos)
--   15002 = Universidade - Instrutor (criar/editar proprios cursos)
--   15003 = Universidade - Admin (gerenciar tudo, ver relatorios)
-- ============================================================================

-- ============== Permissoes ==============
INSERT INTO tab_intranet_permissoes (id_permissao, nome, modulo)
VALUES (15001, 'Universidade - Aluno', 'Universidade')
ON CONFLICT (id_permissao) DO NOTHING;

INSERT INTO tab_intranet_permissoes (id_permissao, nome, modulo)
VALUES (15002, 'Universidade - Instrutor', 'Universidade')
ON CONFLICT (id_permissao) DO NOTHING;

INSERT INTO tab_intranet_permissoes (id_permissao, nome, modulo)
VALUES (15003, 'Universidade - Admin', 'Universidade')
ON CONFLICT (id_permissao) DO NOTHING;

-- Concede ao admin
INSERT INTO tab_intranet_usr_permissoes (id_user, id_permissao, matricula)
SELECT u.id, 15001, u.matricula FROM tab_intranet_usr u WHERE u.email = 'admin@gnatus.com.br'
ON CONFLICT (id_user, id_permissao) DO NOTHING;
INSERT INTO tab_intranet_usr_permissoes (id_user, id_permissao, matricula)
SELECT u.id, 15002, u.matricula FROM tab_intranet_usr u WHERE u.email = 'admin@gnatus.com.br'
ON CONFLICT (id_user, id_permissao) DO NOTHING;
INSERT INTO tab_intranet_usr_permissoes (id_user, id_permissao, matricula)
SELECT u.id, 15003, u.matricula FROM tab_intranet_usr u WHERE u.email = 'admin@gnatus.com.br'
ON CONFLICT (id_user, id_permissao) DO NOTHING;

-- ============== tab_uni_categoria ==============
CREATE TABLE IF NOT EXISTS tab_uni_categoria (
    id          SERIAL PRIMARY KEY,
    nome        varchar(80) NOT NULL UNIQUE,
    descricao   varchar(300),
    cor         varchar(20) DEFAULT '#1e5fb5',  -- usado pra colorir card no catalogo
    ordem       smallint NOT NULL DEFAULT 0,
    ativo       boolean NOT NULL DEFAULT true,
    criado_em   timestamp NOT NULL DEFAULT NOW()
);

-- Categorias-semente (admin pode editar/desativar/criar mais depois)
INSERT INTO tab_uni_categoria (nome, descricao, cor, ordem) VALUES
    ('Onboarding',  'Cursos de boas-vindas e integracao',                       '#09A013', 1),
    ('Compliance',  'Politicas, codigo de conduta, LGPD e regulatorio',         '#c9302c', 2),
    ('Produto',     'Catalogo, especificacoes tecnicas e demonstracoes',         '#1e5fb5', 3),
    ('Tecnico',     'Treinamentos tecnicos especializados',                      '#6b46c1', 4),
    ('Lideranca',   'Desenvolvimento de gestores e soft skills',                 '#f5a500', 5)
ON CONFLICT (nome) DO NOTHING;

-- ============== tab_uni_curso ==============
CREATE TABLE IF NOT EXISTS tab_uni_curso (
    id              SERIAL PRIMARY KEY,
    codigo          varchar(20) NOT NULL UNIQUE,           -- ex: ONB-001
    titulo          varchar(200) NOT NULL,
    descricao       text,
    categoria_id    int REFERENCES tab_uni_categoria(id) ON DELETE SET NULL,
    instrutor_id    int REFERENCES tab_intranet_usr(id) ON DELETE SET NULL,
    instrutor_nome  varchar(120),                          -- snapshot
    capa_url        text,                                  -- imagem capa SharePoint (opcional)
    carga_horaria_h numeric(5,1) NOT NULL DEFAULT 1,       -- horas
    publico         boolean NOT NULL DEFAULT true,         -- false = matricula so via admin
    ativo           boolean NOT NULL DEFAULT true,
    criado_em       timestamp NOT NULL DEFAULT NOW(),
    atualizado_em   timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_uni_curso_cat ON tab_uni_curso (categoria_id, ativo);

-- ============== tab_uni_aula ==============
CREATE TABLE IF NOT EXISTS tab_uni_aula (
    id            SERIAL PRIMARY KEY,
    curso_id      int NOT NULL REFERENCES tab_uni_curso(id) ON DELETE CASCADE,
    ordem         smallint NOT NULL DEFAULT 0,
    titulo        varchar(200) NOT NULL,
    descricao     text,
    conteudo_url  text NOT NULL,                          -- URL SharePoint (video/PDF/slide)
    tipo          varchar(20) NOT NULL DEFAULT 'video',   -- video|pdf|slide|link|texto
    duracao_min   smallint NOT NULL DEFAULT 0,            -- minutos estimados
    obrigatoria   boolean NOT NULL DEFAULT true,          -- se false nao precisa pra concluir
    criado_em     timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_uni_aula_curso ON tab_uni_aula (curso_id, ordem);

-- ============== tab_uni_matricula ==============
CREATE TABLE IF NOT EXISTS tab_uni_matricula (
    id                SERIAL PRIMARY KEY,
    user_id           int NOT NULL REFERENCES tab_intranet_usr(id) ON DELETE CASCADE,
    curso_id          int NOT NULL REFERENCES tab_uni_curso(id) ON DELETE CASCADE,
    data_matricula    timestamp NOT NULL DEFAULT NOW(),
    data_conclusao    timestamp,
    status            varchar(20) NOT NULL DEFAULT 'matriculado', -- matriculado|em_andamento|concluido|cancelado
    percent_progresso numeric(5,2) NOT NULL DEFAULT 0,            -- 0..100
    UNIQUE (user_id, curso_id)
);
CREATE INDEX IF NOT EXISTS ix_uni_matr_user   ON tab_uni_matricula (user_id, status);
CREATE INDEX IF NOT EXISTS ix_uni_matr_curso  ON tab_uni_matricula (curso_id, status);

-- ============== tab_uni_progresso ==============
CREATE TABLE IF NOT EXISTS tab_uni_progresso (
    id            SERIAL PRIMARY KEY,
    matricula_id  int NOT NULL REFERENCES tab_uni_matricula(id) ON DELETE CASCADE,
    aula_id       int NOT NULL REFERENCES tab_uni_aula(id) ON DELETE CASCADE,
    concluido_em  timestamp NOT NULL DEFAULT NOW(),
    UNIQUE (matricula_id, aula_id)
);
CREATE INDEX IF NOT EXISTS ix_uni_prog_matr ON tab_uni_progresso (matricula_id);
