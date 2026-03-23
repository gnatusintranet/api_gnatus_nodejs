-- =============================================
-- SCRIPT COMPLETO: Limpeza + Atualização do Trigger
-- =============================================

PRINT '============================================='
PRINT 'ETAPA 1: REMOVENDO DUPLICATAS'
PRINT '============================================='

-- Verificar quantas duplicatas existem ANTES
SELECT 
    'ANTES DA LIMPEZA' AS STATUS,
    COUNT(*) AS TOTAL_REGISTROS,
    COUNT(DISTINCT CONCAT(ZB_FILIAL, '-', ZB_FLUIG, '-', ZB_MALT)) AS VERSOES_UNICAS,
    COUNT(*) - COUNT(DISTINCT CONCAT(ZB_FILIAL, '-', ZB_FLUIG, '-', ZB_MALT)) AS DUPLICATAS_A_REMOVER
FROM [dbo].[SZB_HISTORICO_COMPLETO];

-- Remover duplicatas mantendo apenas a PRIMEIRA ocorrência (menor HIST_ID)
DELETE FROM [dbo].[SZB_HISTORICO_COMPLETO]
WHERE HIST_ID IN (
    SELECT HIST_ID
    FROM (
        SELECT 
            HIST_ID,
            ROW_NUMBER() OVER (
                PARTITION BY ZB_FILIAL, ZB_FLUIG, ZB_MALT 
                ORDER BY HIST_ID ASC
            ) AS RowNum
        FROM [dbo].[SZB_HISTORICO_COMPLETO]
    ) AS Duplicatas
    WHERE RowNum > 1
);

PRINT 'Duplicatas removidas!'
PRINT ''

-- Verificar resultado da limpeza
SELECT 
    'DEPOIS DA LIMPEZA' AS STATUS,
    COUNT(*) AS TOTAL_REGISTROS,
    COUNT(DISTINCT CONCAT(ZB_FILIAL, '-', ZB_FLUIG, '-', ZB_MALT)) AS VERSOES_UNICAS,
    COUNT(*) - COUNT(DISTINCT CONCAT(ZB_FILIAL, '-', ZB_FLUIG, '-', ZB_MALT)) AS DUPLICATAS_RESTANTES
FROM [dbo].[SZB_HISTORICO_COMPLETO];

PRINT ''
PRINT '============================================='
PRINT 'ETAPA 2: ATUALIZANDO TRIGGER'
PRINT '============================================='

-- Dropar trigger antigo
IF EXISTS (SELECT * FROM sys.triggers WHERE object_id = OBJECT_ID(N'[dbo].[TRG_SZB010_HISTORICO_COMPLETO]'))
BEGIN
    DROP TRIGGER [dbo].[TRG_SZB010_HISTORICO_COMPLETO]
    PRINT 'Trigger anterior removido.'
END
GO

-- Criar trigger atualizado COM proteção contra duplicatas
CREATE TRIGGER [dbo].[TRG_SZB010_HISTORICO_COMPLETO]
ON [dbo].[SZB010]
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OperationType VARCHAR(20);

    -- Detectar tipo de operação
    IF EXISTS(SELECT * FROM deleted)
        SET @OperationType = 'UPDATE';
    ELSE
        SET @OperationType = 'INSERT';

    -- CASO 1: INSERT - Copia registro completo quando criado com ZB_MALT
    -- PROTEÇÃO: Só insere se NÃO existir histórico com o mesmo ZB_MALT
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
          -- PROTEÇÃO CONTRA DUPLICATAS DA CARGA DIÁRIA
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

PRINT 'Trigger atualizado com sucesso!'
PRINT ''

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

PRINT ''
PRINT '============================================='
PRINT 'ETAPA 3: VERIFICAÇÃO FINAL'
PRINT '============================================='

-- Estatísticas finais
SELECT 
    COUNT(*) AS TOTAL_REGISTROS,
    COUNT(DISTINCT ZB_FLUIG) AS PROPOSTAS_DISTINTAS,
    COUNT(DISTINCT CONCAT(ZB_FILIAL, '-', ZB_FLUIG, '-', ZB_MALT)) AS VERSOES_UNICAS,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT CONCAT(ZB_FILIAL, '-', ZB_FLUIG, '-', ZB_MALT)) 
        THEN 'SEM DUPLICATAS ✓'
        ELSE 'AINDA HÁ DUPLICATAS ✗'
    END AS STATUS_DUPLICATAS
FROM [dbo].[SZB_HISTORICO_COMPLETO];

PRINT ''
PRINT '============================================='
PRINT 'CORREÇÃO CONCLUÍDA!'
PRINT '============================================='
PRINT 'Trigger agora está protegido contra duplicatas da carga diária'
PRINT ''
GO
