-- ============================================================
-- Criação das tabelas do banco Intranet
-- Executar no banco: Intranet
-- ============================================================

USE [Intranet];
GO

-- ------------------------------------------------------------
-- Usuários internos
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TAB_INTRANET_USR')
BEGIN
    CREATE TABLE [dbo].[TAB_INTRANET_USR] (
        [ID]        INT            IDENTITY(1,1) NOT NULL,
        [NOME]      NVARCHAR(150)  NOT NULL,
        [EMAIL]     NVARCHAR(150)  NOT NULL,
        [SENHA]     NVARCHAR(255)  NOT NULL,
        [MATRICULA] NVARCHAR(50)   NULL,
        [ATIVO]     BIT            NOT NULL CONSTRAINT DF_TAB_INTRANET_USR_ATIVO DEFAULT 1,
        CONSTRAINT PK_TAB_INTRANET_USR       PRIMARY KEY CLUSTERED ([ID]),
        CONSTRAINT UQ_TAB_INTRANET_USR_EMAIL UNIQUE ([EMAIL])
    );
    PRINT 'TAB_INTRANET_USR criada.';
END
ELSE
    PRINT 'TAB_INTRANET_USR já existe, ignorando.';
GO

-- ------------------------------------------------------------
-- Usuários franqueados
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TAB_INTRANET_USR_FRANQUEADO')
BEGIN
    CREATE TABLE [dbo].[TAB_INTRANET_USR_FRANQUEADO] (
        [ID]        INT            IDENTITY(1,1) NOT NULL,
        [NOME]      NVARCHAR(150)  NULL,
        [EMAIL]     NVARCHAR(150)  NULL,
        [SENHA]     NVARCHAR(255)  NULL,
        [MATRICULA] NVARCHAR(50)   NULL,
        [ATIVO]     BIT            NOT NULL CONSTRAINT DF_TAB_INTRANET_USR_FRANQUEADO_ATIVO DEFAULT 1,
        CONSTRAINT PK_TAB_INTRANET_USR_FRANQUEADO PRIMARY KEY CLUSTERED ([ID])
    );
    PRINT 'TAB_INTRANET_USR_FRANQUEADO criada.';
END
ELSE
    PRINT 'TAB_INTRANET_USR_FRANQUEADO já existe, ignorando.';
GO

-- ------------------------------------------------------------
-- Catálogo de permissões
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TAB_INTRANET_PERMISSOES')
BEGIN
    CREATE TABLE [dbo].[TAB_INTRANET_PERMISSOES] (
        [ID]           INT            IDENTITY(1,1) NOT NULL,
        [ID_PERMISSAO] INT            NOT NULL,
        [NOME]         NVARCHAR(150)  NOT NULL,
        [MODULO]       NVARCHAR(100)  NOT NULL,
        CONSTRAINT PK_TAB_INTRANET_PERMISSOES               PRIMARY KEY CLUSTERED ([ID]),
        CONSTRAINT UQ_TAB_INTRANET_PERMISSOES_ID_PERMISSAO  UNIQUE ([ID_PERMISSAO])
    );
    PRINT 'TAB_INTRANET_PERMISSOES criada.';
END
ELSE
    PRINT 'TAB_INTRANET_PERMISSOES já existe, ignorando.';
GO

-- ------------------------------------------------------------
-- Vínculo usuário <-> permissão
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TAB_INTRANET_USR_PERMISSOES')
BEGIN
    CREATE TABLE [dbo].[TAB_INTRANET_USR_PERMISSOES] (
        [ID]           INT           IDENTITY(1,1) NOT NULL,
        [ID_USER]      INT           NOT NULL,
        [ID_PERMISSAO] INT           NOT NULL,
        [MATRICULA]    NVARCHAR(50)  NULL,
        CONSTRAINT PK_TAB_INTRANET_USR_PERMISSOES PRIMARY KEY CLUSTERED ([ID]),
        CONSTRAINT FK_USR_PERM_USER FOREIGN KEY ([ID_USER])
            REFERENCES [dbo].[TAB_INTRANET_USR] ([ID]),
        CONSTRAINT FK_USR_PERM_PERM FOREIGN KEY ([ID_PERMISSAO])
            REFERENCES [dbo].[TAB_INTRANET_PERMISSOES] ([ID_PERMISSAO])
    );
    PRINT 'TAB_INTRANET_USR_PERMISSOES criada.';
END
ELSE
    PRINT 'TAB_INTRANET_USR_PERMISSOES já existe, ignorando.';
GO

-- ------------------------------------------------------------
-- Códigos de verificação para reset de senha
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TAB_VERIFICACAO_INTRANET')
BEGIN
    CREATE TABLE [dbo].[TAB_VERIFICACAO_INTRANET] (
        [Email]         NVARCHAR(150) NOT NULL,
        [Codigo]        NVARCHAR(10)  NOT NULL,
        [DataExpiracao] DATETIME      NOT NULL,
        CONSTRAINT PK_TAB_VERIFICACAO_INTRANET PRIMARY KEY CLUSTERED ([Email])
    );
    PRINT 'TAB_VERIFICACAO_INTRANET criada.';
END
ELSE
    PRINT 'TAB_VERIFICACAO_INTRANET já existe, ignorando.';
GO

-- ------------------------------------------------------------
-- Usuário administrador inicial
-- Senha: Gnatus@2026   (hash bcrypt gerado com fator 10)
-- Troque a senha após o primeiro login via /users/password
-- ------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM [dbo].[TAB_INTRANET_USR] WHERE EMAIL = 'admin@gnatus.com.br')
BEGIN
    INSERT INTO [dbo].[TAB_INTRANET_USR] (NOME, EMAIL, SENHA, MATRICULA, ATIVO)
    VALUES (
        N'Administrador',
        N'admin@gnatus.com.br',
        N'$2b$10$NI9ashw/cQ2yUSJyMaEKHebRg1UtBooKc9.mP2gER5WCpy.1X1d.C',
        N'ADM001',
        1
    );
    PRINT 'Usuário admin@gnatus.com.br inserido. Senha inicial: Gnatus@2026';
END
ELSE
    PRINT 'Usuário admin@gnatus.com.br já existe, ignorando.';
GO

PRINT '--- Setup concluído ---';
GO
