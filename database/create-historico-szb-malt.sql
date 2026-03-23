-- =============================================
-- Tabela de Histórico Completo SZB010
-- COPIA TODO O REGISTRO quando houver alteração
-- =============================================

-- Criar tabela de histórico com TODOS os campos da SZB010
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SZB_HISTORICO_COMPLETO]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[SZB_HISTORICO_COMPLETO] (
        -- ID único do histórico
        [HIST_ID] INT IDENTITY(1,1) PRIMARY KEY,
        
        -- Metadados da alteração
        [HIST_DATA_ALTERACAO] DATETIME DEFAULT GETDATE(),
        [HIST_USUARIO] VARCHAR(100) DEFAULT SUSER_SNAME(),
        [HIST_HOST] VARCHAR(100) DEFAULT HOST_NAME(),
        [HIST_OPERACAO] VARCHAR(20), -- 'INSERT' ou 'UPDATE'
        
        -- TODOS OS CAMPOS DA TABELA SZB010 (cópia completa)
        [ZB_FILIAL] VARCHAR(10),
        [ZB_TIPO] VARCHAR(10),
        [ZB_FLUIG] VARCHAR(20),
        [ZB_EMISSAO] VARCHAR(20),
        [ZB_CLVL] VARCHAR(20),
        [ZB_STATUS] VARCHAR(10),
        [ZB_CODCLI] VARCHAR(20),
        [ZB_LOJCLI] VARCHAR(10),
        [ZB_NOME] VARCHAR(100),
        [ZB_CGC] VARCHAR(20),
        [ZB_VEND1] VARCHAR(20),
        [ZB_VEND2] VARCHAR(20),
        [ZB_VEND3] VARCHAR(20),
        [ZB_MUN] VARCHAR(100),
        [ZB_EST] VARCHAR(10),
        [ZB_X_KWP] VARCHAR(20),
        [ZB_DDD] VARCHAR(10),
        [ZB_TEL] VARCHAR(20),
        [ZB_EMAIL] VARCHAR(200),
        [ZB_ENDENT] VARCHAR(200),
        [ZB_NUMEROE] VARCHAR(20),
        [ZB_BAIRROE] VARCHAR(100),
        [ZB_XCIDADE] VARCHAR(100),
        [ZB_REG] VARCHAR(50),
        [ZB_ESTE] VARCHAR(10),
        [ZB_COD_M] VARCHAR(20),
        [ZB_XCEPE] VARCHAR(20),
        [ZB_X_CODC] VARCHAR(20),
        [ZB_ZZCOMP] VARCHAR(100),
        [ZB_XTPTLH] VARCHAR(50),
        [ZB_X_TPSL] VARCHAR(10),
        [ZB_XTPEST] VARCHAR(10),
        [ZB_ZZPT] VARCHAR(50),
        [ZB_STATUS_ENG] VARCHAR(100),
        [ZB_INVERS] VARCHAR(200),
        [ZB_PLACA] VARCHAR(200),
        [ZB_MALT] VARCHAR(100)
        -- Adicione mais campos se necessário
    );

    -- Criar índices para melhor performance
    CREATE INDEX IX_SZB_HIST_FILIAL_FLUIG ON [dbo].[SZB_HISTORICO_COMPLETO] ([ZB_FILIAL], [ZB_FLUIG]);
    CREATE INDEX IX_SZB_HIST_DATA ON [dbo].[SZB_HISTORICO_COMPLETO] ([HIST_DATA_ALTERACAO] DESC);
    CREATE INDEX IX_SZB_HIST_CODCLI ON [dbo].[SZB_HISTORICO_COMPLETO] ([ZB_CODCLI]);
    CREATE INDEX IX_SZB_HIST_MALT ON [dbo].[SZB_HISTORICO_COMPLETO] ([ZB_MALT]);

    PRINT 'Tabela SZB_HISTORICO_COMPLETO criada com sucesso!';
END
ELSE
BEGIN
    PRINT 'Tabela SZB_HISTORICO_COMPLETO já existe.';
END
GO
