-- =============================================
-- Limpeza de Duplicatas - Histórico SZB_MALT
-- Remove registros duplicados mantendo apenas a primeira ocorrência
-- =============================================

-- 1. Verificar quantas duplicatas existem
PRINT '===========================================';
PRINT 'VERIFICANDO DUPLICATAS...';
PRINT '===========================================';

SELECT 
    ZB_FILIAL,
    ZB_FLUIG,
    ZB_MALT,
    COUNT(*) AS QTD_DUPLICATAS
FROM [dbo].[SZB_HISTORICO_COMPLETO]
GROUP BY ZB_FILIAL, ZB_FLUIG, ZB_MALT
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 2. Contar total de duplicatas
DECLARE @TotalDuplicatas INT;

SELECT @TotalDuplicatas = SUM(QTD - 1)
FROM (
    SELECT COUNT(*) AS QTD
    FROM [dbo].[SZB_HISTORICO_COMPLETO]
    GROUP BY ZB_FILIAL, ZB_FLUIG, ZB_MALT
    HAVING COUNT(*) > 1
) AS Duplicatas;

PRINT 'Total de registros duplicados a remover: ' + CAST(ISNULL(@TotalDuplicatas, 0) AS VARCHAR(10));
PRINT '';

-- 3. Remover duplicatas mantendo apenas a PRIMEIRA ocorrência (menor HIST_ID)
PRINT 'Removendo duplicatas...';

;WITH CTE_Duplicatas AS (
    SELECT 
        HIST_ID,
        ROW_NUMBER() OVER (
            PARTITION BY ZB_FILIAL, ZB_FLUIG, ZB_MALT 
            ORDER BY HIST_ID ASC  -- Mantém o primeiro registro (menor ID)
        ) AS RowNum
    FROM [dbo].[SZB_HISTORICO_COMPLETO]
)
DELETE FROM CTE_Duplicatas
WHERE RowNum > 1;

PRINT 'Duplicatas removidas!';
PRINT '';

-- 4. Verificar resultado
PRINT '===========================================';
PRINT 'RESULTADO DA LIMPEZA';
PRINT '===========================================';

-- Contar se ainda há duplicatas
SELECT 
    COUNT(*) AS REGISTROS_DUPLICADOS_RESTANTES
FROM (
    SELECT ZB_FILIAL, ZB_FLUIG, ZB_MALT
    FROM [dbo].[SZB_HISTORICO_COMPLETO]
    GROUP BY ZB_FILIAL, ZB_FLUIG, ZB_MALT
    HAVING COUNT(*) > 1
) AS RestoDuplicatas;

-- Estatísticas finais
SELECT 
    COUNT(*) AS TOTAL_REGISTROS,
    COUNT(DISTINCT ZB_FLUIG) AS PROPOSTAS_DISTINTAS,
    COUNT(DISTINCT CONCAT(ZB_FILIAL, '-', ZB_FLUIG, '-', ZB_MALT)) AS VERSOES_UNICAS
FROM [dbo].[SZB_HISTORICO_COMPLETO];

PRINT '';
PRINT '===========================================';
PRINT 'LIMPEZA CONCLUÍDA!';
PRINT '===========================================';

GO
