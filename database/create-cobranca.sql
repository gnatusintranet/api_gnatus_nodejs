-- Módulo de Cobrança: tabelas auxiliares na base Intranet
-- Rodar com: sqlcmd -S localhost -d Intranet -E -No -i database/create-cobranca.sql

USE Intranet;
GO

SET QUOTED_IDENTIFIER ON;
GO

----------------------------------------------------------------------
-- 1) Ações registradas pela equipe de cobrança
----------------------------------------------------------------------
IF OBJECT_ID('dbo.TAB_COBRANCA_ACAO','U') IS NULL
BEGIN
  CREATE TABLE dbo.TAB_COBRANCA_ACAO (
    ID               INT IDENTITY(1,1) PRIMARY KEY,
    CLIENTE_COD      VARCHAR(10)   NOT NULL,
    CLIENTE_LOJA     VARCHAR(4)    NOT NULL,
    TITULO_PREFIXO   VARCHAR(10)   NULL,
    TITULO_NUM       VARCHAR(20)   NULL,
    TITULO_PARCELA   VARCHAR(4)    NULL,
    TITULO_TIPO      VARCHAR(6)    NULL,
    TIPO_ACAO        VARCHAR(20)   NOT NULL,   -- LIGACAO|EMAIL|WHATSAPP|VISITA|ACORDO|BAIXA_PARCIAL|OUTRO
    RESULTADO        VARCHAR(30)   NOT NULL,   -- SEM_CONTATO|PROMESSA_PAGAMENTO|RECUSA|PAGO|ACORDO_FECHADO|OUTRO
    DATA_PROMESSA    DATE          NULL,
    VALOR_PROMETIDO  DECIMAL(18,2) NULL,
    DESCRICAO        NVARCHAR(MAX) NULL,
    ID_USER          INT           NOT NULL,
    CRIADO_EM        DATETIME      NOT NULL CONSTRAINT DF_COBR_ACAO_CRIADO DEFAULT (GETDATE()),
    CONSTRAINT FK_COBR_ACAO_USER FOREIGN KEY (ID_USER) REFERENCES dbo.TAB_INTRANET_USR(ID)
  );
  CREATE INDEX IX_COBR_ACAO_CLIENTE  ON dbo.TAB_COBRANCA_ACAO (CLIENTE_COD, CLIENTE_LOJA);
  CREATE INDEX IX_COBR_ACAO_USER     ON dbo.TAB_COBRANCA_ACAO (ID_USER);
  CREATE INDEX IX_COBR_ACAO_PROMESSA ON dbo.TAB_COBRANCA_ACAO (DATA_PROMESSA) WHERE DATA_PROMESSA IS NOT NULL;
  PRINT '  -> TAB_COBRANCA_ACAO criada.';
END
ELSE PRINT '  -> TAB_COBRANCA_ACAO ja existe.';
GO

----------------------------------------------------------------------
-- 2) Comentarios internos (thread por cliente, visibilidade da equipe)
----------------------------------------------------------------------
IF OBJECT_ID('dbo.TAB_COBRANCA_COMENTARIO','U') IS NULL
BEGIN
  CREATE TABLE dbo.TAB_COBRANCA_COMENTARIO (
    ID            INT IDENTITY(1,1) PRIMARY KEY,
    CLIENTE_COD   VARCHAR(10)   NOT NULL,
    CLIENTE_LOJA  VARCHAR(4)    NOT NULL,
    ID_USER       INT           NOT NULL,
    TEXTO         NVARCHAR(MAX) NOT NULL,
    CRIADO_EM     DATETIME      NOT NULL CONSTRAINT DF_COBR_COMT_CRIADO DEFAULT (GETDATE()),
    CONSTRAINT FK_COBR_COMT_USER FOREIGN KEY (ID_USER) REFERENCES dbo.TAB_INTRANET_USR(ID)
  );
  CREATE INDEX IX_COBR_COMT_CLIENTE ON dbo.TAB_COBRANCA_COMENTARIO (CLIENTE_COD, CLIENTE_LOJA, CRIADO_EM DESC);
  PRINT '  -> TAB_COBRANCA_COMENTARIO criada.';
END
ELSE PRINT '  -> TAB_COBRANCA_COMENTARIO ja existe.';
GO

----------------------------------------------------------------------
-- 3) Status de cliente em cobranca (flag de estagio)
----------------------------------------------------------------------
IF OBJECT_ID('dbo.TAB_COBRANCA_STATUS_CLIENTE','U') IS NULL
BEGIN
  CREATE TABLE dbo.TAB_COBRANCA_STATUS_CLIENTE (
    CLIENTE_COD      VARCHAR(10) NOT NULL,
    CLIENTE_LOJA     VARCHAR(4)  NOT NULL,
    STATUS           VARCHAR(20) NOT NULL,  -- REGULAR|NEGOCIANDO|PROMESSA|PROTESTO|JURIDICO|PERDA
    OBSERVACAO       NVARCHAR(500) NULL,
    DT_ATUALIZACAO   DATETIME    NOT NULL CONSTRAINT DF_COBR_STS_DT DEFAULT (GETDATE()),
    ID_USER          INT         NOT NULL,
    CONSTRAINT PK_COBR_STS PRIMARY KEY (CLIENTE_COD, CLIENTE_LOJA),
    CONSTRAINT FK_COBR_STS_USER FOREIGN KEY (ID_USER) REFERENCES dbo.TAB_INTRANET_USR(ID)
  );
  PRINT '  -> TAB_COBRANCA_STATUS_CLIENTE criada.';
END
ELSE PRINT '  -> TAB_COBRANCA_STATUS_CLIENTE ja existe.';
GO

----------------------------------------------------------------------
-- 4) Permissoes do modulo
----------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM dbo.TAB_INTRANET_PERMISSOES WHERE ID_PERMISSAO = 9001)
  INSERT INTO dbo.TAB_INTRANET_PERMISSOES (ID_PERMISSAO, NOME, MODULO)
  VALUES (9001, 'Cobranca - Painel', 'Cobranca');

IF NOT EXISTS (SELECT 1 FROM dbo.TAB_INTRANET_PERMISSOES WHERE ID_PERMISSAO = 9002)
  INSERT INTO dbo.TAB_INTRANET_PERMISSOES (ID_PERMISSAO, NOME, MODULO)
  VALUES (9002, 'Cobranca - Registrar Acao', 'Cobranca');

IF NOT EXISTS (SELECT 1 FROM dbo.TAB_INTRANET_PERMISSOES WHERE ID_PERMISSAO = 9003)
  INSERT INTO dbo.TAB_INTRANET_PERMISSOES (ID_PERMISSAO, NOME, MODULO)
  VALUES (9003, 'Cobranca - Minhas Acoes', 'Cobranca');

----------------------------------------------------------------------
-- 5) Atribui as 3 permissoes ao admin
----------------------------------------------------------------------
DECLARE @idAdmin INT;
SELECT @idAdmin = ID FROM dbo.TAB_INTRANET_USR WHERE EMAIL = 'admin@gnatus.com.br';

IF @idAdmin IS NOT NULL
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.TAB_INTRANET_USR_PERMISSOES WHERE ID_USER = @idAdmin AND ID_PERMISSAO = 9001)
    INSERT INTO dbo.TAB_INTRANET_USR_PERMISSOES (ID_USER, ID_PERMISSAO, MATRICULA) VALUES (@idAdmin, 9001, 'ADM001');
  IF NOT EXISTS (SELECT 1 FROM dbo.TAB_INTRANET_USR_PERMISSOES WHERE ID_USER = @idAdmin AND ID_PERMISSAO = 9002)
    INSERT INTO dbo.TAB_INTRANET_USR_PERMISSOES (ID_USER, ID_PERMISSAO, MATRICULA) VALUES (@idAdmin, 9002, 'ADM001');
  IF NOT EXISTS (SELECT 1 FROM dbo.TAB_INTRANET_USR_PERMISSOES WHERE ID_USER = @idAdmin AND ID_PERMISSAO = 9003)
    INSERT INTO dbo.TAB_INTRANET_USR_PERMISSOES (ID_USER, ID_PERMISSAO, MATRICULA) VALUES (@idAdmin, 9003, 'ADM001');
  PRINT '  -> Permissoes de cobranca atribuidas ao admin.';
END
GO

PRINT 'Modulo de cobranca: setup concluido.';
