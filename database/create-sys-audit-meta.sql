-- ============================================================
-- Tabela auxiliar de metadados do sistema (nome intencionalmente genérico).
-- ============================================================
-- Uso interno: guarda o backup cifrado da chave de recuperação do cofre.
-- Essa chave só pode ser descriptografada com COFRE_BACKUP_KEY (env do servidor).
-- Nomes de colunas propositalmente neutros pra não revelar o conteúdo.
-- ============================================================

USE [Intranet];
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TAB_SYS_AUDIT_META')
BEGIN
    CREATE TABLE [dbo].[TAB_SYS_AUDIT_META] (
        [META_ID]        INT            IDENTITY(1,1) NOT NULL,
        [META_REF]       INT            NOT NULL,              -- FK pro usuário
        [META_HASH]      VARCHAR(64)    NOT NULL,              -- SHA-256 do conteúdo, pra integridade
        [META_DATA]      VARCHAR(2048)  NOT NULL,              -- payload cifrado {iv,ct} base64
        [META_CREATED]   DATETIME       NOT NULL CONSTRAINT DF_TAB_SYS_AUDIT_META_CREATED DEFAULT GETDATE(),
        [META_UPDATED]   DATETIME       NULL,
        [META_LAST_READ] DATETIME       NULL,                  -- timestamp do último acesso (audit)
        [META_READ_COUNT] INT           NOT NULL CONSTRAINT DF_TAB_SYS_AUDIT_META_READCOUNT DEFAULT 0,
        CONSTRAINT PK_TAB_SYS_AUDIT_META PRIMARY KEY CLUSTERED ([META_ID]),
        CONSTRAINT FK_TAB_SYS_AUDIT_META_USER FOREIGN KEY ([META_REF])
            REFERENCES [dbo].[TAB_INTRANET_USR] ([ID]),
        CONSTRAINT UQ_TAB_SYS_AUDIT_META_REF UNIQUE ([META_REF])
    );
    PRINT 'TAB_SYS_AUDIT_META criada.';
END
ELSE
    PRINT 'TAB_SYS_AUDIT_META já existe, ignorando.';
GO
