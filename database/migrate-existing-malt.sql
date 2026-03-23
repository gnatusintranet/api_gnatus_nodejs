-- =============================================
-- Migração Inicial - Registros Existentes com ZB_MALT
-- Copia todos os registros atuais da SZB010 que possuem ZB_MALT
-- para criar a versão inicial no histórico
-- =============================================

-- Verificar quantos registros serão migrados
SELECT 
    COUNT(*) AS TOTAL_REGISTROS_COM_MALT
FROM [dbo].[SZB010]
WHERE ZB_MALT IS NOT NULL 
  AND RTRIM(LTRIM(ZB_MALT)) <> '';

PRINT '----------------------------------------';
PRINT 'Iniciando migração de registros existentes...';
PRINT '----------------------------------------';

-- Inserir todos os registros existentes com ZB_MALT na tabela de histórico
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
    GETDATE() AS HIST_DATA_ALTERACAO,
    'SYSTEM' AS HIST_USUARIO,
    'MIGRATION' AS HIST_HOST,
    'INITIAL' AS HIST_OPERACAO,  -- Marca como versão inicial
    ZB_FILIAL,
    ZB_TIPO,
    ZB_FLUIG,
    ZB_EMISSAO,
    ZB_CLVL,
    ZB_STATUS,
    ZB_CODCLI,
    ZB_LOJCLI,
    ZB_NOME,
    ZB_CGC,
    ZB_VEND1,
    ZB_VEND2,
    ZB_VEND3,
    ZB_MUN,
    ZB_EST,
    ZB_X_KWP,
    ZB_DDD,
    ZB_TEL,
    ZB_EMAIL,
    ZB_ENDENT,
    ZB_NUMEROE,
    ZB_BAIRROE,
    ZB_XCIDADE,
    ZB_REG,
    ZB_ESTE,
    ZB_COD_M,
    ZB_XCEPE,
    ZB_X_CODC,
    ZB_ZZCOMP,
    ZB_XTPTLH,
    ZB_X_TPSL,
    ZB_XTPEST,
    ZB_ZZPT,
    ZB_STATUS_ENG,
    ZB_INVERS,
    ZB_PLACA,
    ZB_MALT
FROM [dbo].[SZB010]
WHERE ZB_MALT IS NOT NULL 
  AND RTRIM(LTRIM(ZB_MALT)) <> '';

-- Mostrar resultado da migração
DECLARE @TotalMigrado INT;
SELECT @TotalMigrado = COUNT(*) 
FROM [dbo].[SZB_HISTORICO_COMPLETO] 
WHERE HIST_OPERACAO = 'INITIAL';

PRINT '----------------------------------------';
PRINT 'Migração concluída!';
PRINT 'Total de registros migrados: ' + CAST(@TotalMigrado AS VARCHAR(10));
PRINT '----------------------------------------';

-- Estatísticas da migração
SELECT 
    'RESUMO DA MIGRAÇÃO' AS INFO,
    COUNT(*) AS TOTAL_VERSOES_INICIAIS,
    COUNT(DISTINCT ZB_FLUIG) AS PROPOSTAS_MIGRADAS,
    COUNT(DISTINCT ZB_FILIAL) AS FILIAIS,
    MIN(HIST_DATA_ALTERACAO) AS DATA_MIGRACAO
FROM [dbo].[SZB_HISTORICO_COMPLETO]
WHERE HIST_OPERACAO = 'INITIAL';

-- Top 10 propostas com MALT mais complexo (mais vírgulas = mais alterações prévias)
SELECT TOP 10
    ZB_FLUIG AS PROPOSTA,
    ZB_NOME AS CLIENTE,
    ZB_MALT,
    LEN(ZB_MALT) - LEN(REPLACE(ZB_MALT, ',', '')) + 1 AS QTD_VERSOES_ESTIMADAS
FROM [dbo].[SZB_HISTORICO_COMPLETO]
WHERE HIST_OPERACAO = 'INITIAL'
  AND ZB_MALT IS NOT NULL
ORDER BY LEN(ZB_MALT) - LEN(REPLACE(ZB_MALT, ',', '')) DESC;

GO
