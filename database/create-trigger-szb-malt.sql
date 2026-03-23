-- =============================================
-- Trigger para Copiar REGISTRO COMPLETO quando ZB_MALT mudar
-- Mantém histórico completo de todas as alterações
-- =============================================

-- Dropar trigger se já existir
IF EXISTS (SELECT * FROM sys.triggers WHERE object_id = OBJECT_ID(N'[dbo].[TRG_SZB010_HISTORICO_COMPLETO]'))
BEGIN
    DROP TRIGGER [dbo].[TRG_SZB010_HISTORICO_COMPLETO];
    PRINT 'Trigger anterior removido.';
END
GO

CREATE TRIGGER [dbo].[TRG_SZB010_HISTORICO_COMPLETO]
ON [dbo].[SZB010]
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Variável para controle
    DECLARE @OperationType VARCHAR(20);

    -- Detectar tipo de operação
    IF EXISTS(SELECT * FROM deleted)
        SET @OperationType = 'UPDATE';
    ELSE
        SET @OperationType = 'INSERT';

    -- CASO 1: INSERT - Copia registro completo quando criado com ZB_MALT
    -- MAS: Verifica se já existe histórico com o mesmo ZB_MALT (evita duplicatas da carga diária)
    IF @OperationType = 'INSERT'
    BEGIN
        INSERT INTO [dbo].[SZB_HISTORICO_COMPLETO] (
            [HIST_DATA_ALTERACAO],
            [HIST_USUARIO],
            [HIST_HOST],
            [HIST_OPERACAO],
            [ZB_FILIAL],
            [ZB_TIPO],
            [ZB_FLUIG],
            [ZB_EMISSAO],
            [ZB_CLVL],
            [ZB_STATUS],
            [ZB_CODCLI],
            [ZB_LOJCLI],
            [ZB_NOME],
            [ZB_CGC],
            [ZB_VEND1],
            [ZB_VEND2],
            [ZB_VEND3],
            [ZB_MUN],
            [ZB_EST],
            [ZB_X_KWP],
            [ZB_DDD],
            [ZB_TEL],
            [ZB_EMAIL],
            [ZB_ENDENT],
            [ZB_NUMEROE],
            [ZB_BAIRROE],
            [ZB_XCIDADE],
            [ZB_REG],
            [ZB_ESTE],
            [ZB_COD_M],
            [ZB_XCEPE],
            [ZB_X_CODC],
            [ZB_ZZCOMP],
            [ZB_XTPTLH],
            [ZB_X_TPSL],
            [ZB_XTPEST],
            [ZB_ZZPT],
            [ZB_STATUS_ENG],
            [ZB_INVERS],
            [ZB_PLACA],
            [ZB_MALT]
        )
        SELECT 
            GETDATE(),
            SUSER_SNAME(),
            HOST_NAME(),
            'INSERT',
            i.ZB_FILIAL,
            i.ZB_TIPO,
            i.ZB_FLUIG,
            i.ZB_EMISSAO,
            i.ZB_CLVL,
            i.ZB_STATUS,
            i.ZB_CODCLI,
            i.ZB_LOJCLI,
            i.ZB_NOME,
            i.ZB_CGC,
            i.ZB_VEND1,
            i.ZB_VEND2,
            i.ZB_VEND3,
            i.ZB_MUN,
            i.ZB_EST,
            i.ZB_X_KWP,
            i.ZB_DDD,
            i.ZB_TEL,
            i.ZB_EMAIL,
            i.ZB_ENDENT,
            i.ZB_NUMEROE,
            i.ZB_BAIRROE,
            i.ZB_XCIDADE,
            i.ZB_REG,
            i.ZB_ESTE,
            i.ZB_COD_M,
            i.ZB_XCEPE,
            i.ZB_X_CODC,
            i.ZB_ZZCOMP,
            i.ZB_XTPTLH,
            i.ZB_X_TPSL,
            i.ZB_XTPEST,
            i.ZB_ZZPT,
            i.ZB_STATUS_ENG,
            i.ZB_INVERS,
            i.ZB_PLACA,
            i.ZB_MALT
        FROM inserted i
        WHERE i.ZB_MALT IS NOT NULL 
          AND RTRIM(LTRIM(i.ZB_MALT)) <> ''
          -- Só insere se NÃO existir histórico com esse ZB_MALT
          AND NOT EXISTS (
              SELECT 1 
              FROM [dbo].[SZB_HISTORICO_COMPLETO] h
              WHERE h.ZB_FILIAL = i.ZB_FILIAL
                AND h.ZB_FLUIG = i.ZB_FLUIG
                AND ISNULL(h.ZB_MALT, '') = ISNULL(i.ZB_MALT, '')
          );
    END

    -- CASO 2: UPDATE - Copia registro completo quando ZB_MALT foi alterado
    IF @OperationType = 'UPDATE'
    BEGIN
        INSERT INTO [dbo].[SZB_HISTORICO_COMPLETO] (
            [HIST_DATA_ALTERACAO],
            [HIST_USUARIO],
            [HIST_HOST],
            [HIST_OPERACAO],
            [ZB_FILIAL],
            [ZB_TIPO],
            [ZB_FLUIG],
            [ZB_EMISSAO],
            [ZB_CLVL],
            [ZB_STATUS],
            [ZB_CODCLI],
            [ZB_LOJCLI],
            [ZB_NOME],
            [ZB_CGC],
            [ZB_VEND1],
            [ZB_VEND2],
            [ZB_VEND3],
            [ZB_MUN],
            [ZB_EST],
            [ZB_X_KWP],
            [ZB_DDD],
            [ZB_TEL],
            [ZB_EMAIL],
            [ZB_ENDENT],
            [ZB_NUMEROE],
            [ZB_BAIRROE],
            [ZB_XCIDADE],
            [ZB_REG],
            [ZB_ESTE],
            [ZB_COD_M],
            [ZB_XCEPE],
            [ZB_X_CODC],
            [ZB_ZZCOMP],
            [ZB_XTPTLH],
            [ZB_X_TPSL],
            [ZB_XTPEST],
            [ZB_ZZPT],
            [ZB_STATUS_ENG],
            [ZB_INVERS],
            [ZB_PLACA],
            [ZB_MALT]
        )
        SELECT 
            GETDATE(),
            SUSER_SNAME(),
            HOST_NAME(),
            'UPDATE',
            i.ZB_FILIAL,
            i.ZB_TIPO,
            i.ZB_FLUIG,
            i.ZB_EMISSAO,
            i.ZB_CLVL,
            i.ZB_STATUS,
            i.ZB_CODCLI,
            i.ZB_LOJCLI,
            i.ZB_NOME,
            i.ZB_CGC,
            i.ZB_VEND1,
            i.ZB_VEND2,
            i.ZB_VEND3,
            i.ZB_MUN,
            i.ZB_EST,
            i.ZB_X_KWP,
            i.ZB_DDD,
            i.ZB_TEL,
            i.ZB_EMAIL,
            i.ZB_ENDENT,
            i.ZB_NUMEROE,
            i.ZB_BAIRROE,
            i.ZB_XCIDADE,
            i.ZB_REG,
            i.ZB_ESTE,
            i.ZB_COD_M,
            i.ZB_XCEPE,
            i.ZB_X_CODC,
            i.ZB_ZZCOMP,
            i.ZB_XTPTLH,
            i.ZB_X_TPSL,
            i.ZB_XTPEST,
            i.ZB_ZZPT,
            i.ZB_STATUS_ENG,
            i.ZB_INVERS,
            i.ZB_PLACA,
            i.ZB_MALT
        FROM inserted i
        INNER JOIN deleted d 
            ON i.ZB_FILIAL = d.ZB_FILIAL 
            AND i.ZB_FLUIG = d.ZB_FLUIG
        WHERE (
            -- Captura quando ZB_MALT mudou
            ISNULL(i.ZB_MALT, '') <> ISNULL(d.ZB_MALT, '')
        );
    END
END
GO

PRINT 'Trigger TRG_SZB010_HISTORICO_COMPLETO criado com sucesso!';
PRINT 'O trigger agora copia TODO o registro quando ZB_MALT for alterado.';
GO

-- Verificar se o trigger foi criado
SELECT 
    name AS TriggerName,
    OBJECT_NAME(parent_id) AS TableName,
    is_disabled,
    create_date,
    modify_date
FROM sys.triggers
WHERE name = 'TRG_SZB010_HISTORICO_COMPLETO';
GO
