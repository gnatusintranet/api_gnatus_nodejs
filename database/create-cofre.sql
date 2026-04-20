-- ============================================================
-- Cofre pessoal de senhas (zero-knowledge)
-- ============================================================
-- Notas:
--  - Nada em texto puro. O servidor guarda apenas blobs cifrados.
--  - COFRE_MK_ENC_PASS      = master key cifrada com chave derivada da master password (PBKDF2)
--  - COFRE_MK_ENC_RECOVERY  = master key cifrada com a recovery key (mostrada ao usuário UMA única vez)
--  - COFRE_VERIFIER         = um plaintext conhecido cifrado com a master password (pra validar
--                              que a senha digitada no unlock está correta antes de tentar decryptar itens)
--  - Senha mestre e recovery key nunca saem do browser.
-- ============================================================

USE [Intranet];
GO

-- Adiciona colunas do cofre à tabela de usuários (se ainda não existirem)
IF COL_LENGTH('dbo.TAB_INTRANET_USR', 'COFRE_SALT') IS NULL
    ALTER TABLE [dbo].[TAB_INTRANET_USR]
    ADD
        [COFRE_SALT]               VARCHAR(256)   NULL,   -- base64, único por usuário
        [COFRE_ITERATIONS]         INT            NULL,   -- nº iterações do PBKDF2
        [COFRE_VERIFIER]           VARCHAR(1024)  NULL,   -- {iv,ct} base64: valida master password
        [COFRE_MK_ENC_PASS]        VARCHAR(1024)  NULL,   -- master key cifrada com master password
        [COFRE_MK_ENC_RECOVERY]    VARCHAR(1024)  NULL,   -- master key cifrada com recovery key
        [COFRE_CREATED_AT]         DATETIME       NULL;
GO

-- Tabela de itens do cofre
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TAB_COFRE_ITEM')
BEGIN
    CREATE TABLE [dbo].[TAB_COFRE_ITEM] (
        [ID]           INT            IDENTITY(1,1) NOT NULL,
        [ID_USER]      INT            NOT NULL,
        [TITULO]       NVARCHAR(200)  NOT NULL,       -- texto plano (pra facilitar busca/list)
        [CATEGORIA]    NVARCHAR(80)   NULL,           -- texto plano
        [URL]          NVARCHAR(500)  NULL,           -- texto plano
        [USUARIO_ENC]  NVARCHAR(MAX)  NULL,           -- {iv,ct} base64, cifrado com master key
        [SENHA_ENC]    NVARCHAR(MAX)  NOT NULL,       -- {iv,ct} base64
        [NOTAS_ENC]    NVARCHAR(MAX)  NULL,           -- {iv,ct} base64
        [CREATED_AT]   DATETIME       NOT NULL CONSTRAINT DF_TAB_COFRE_ITEM_CREATED DEFAULT GETDATE(),
        [UPDATED_AT]   DATETIME       NOT NULL CONSTRAINT DF_TAB_COFRE_ITEM_UPDATED DEFAULT GETDATE(),
        CONSTRAINT PK_TAB_COFRE_ITEM PRIMARY KEY CLUSTERED ([ID]),
        CONSTRAINT FK_TAB_COFRE_ITEM_USER FOREIGN KEY ([ID_USER])
            REFERENCES [dbo].[TAB_INTRANET_USR] ([ID])
    );

    CREATE INDEX IX_TAB_COFRE_ITEM_USER ON [dbo].[TAB_COFRE_ITEM] ([ID_USER], [CATEGORIA], [TITULO]);
    PRINT 'TAB_COFRE_ITEM criada.';
END
ELSE
    PRINT 'TAB_COFRE_ITEM já existe, ignorando.';
GO

PRINT '--- Cofre schema concluído ---';
GO
