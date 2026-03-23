module.exports = (app) => ({
  verb: "get",
  route: "/all",
  anonymous: true,

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const limit = parseInt(req.query.limit) || 100; // Número de registros por página
    const offset = parseInt(req.query.offset) || 0; // Deslocamento para paginação

    try {
      let allQuery = `
      SELECT 
      A.ID,
      A.FILIAL,
      A.LOJA_CLIENTE,
      A.CONTRATO,
      A.COD_ROTA,
      A.CODCLI,
      A.NOME,
      A.CPF,
      A.COD_VENDEDOR,
      A.NOME_VENDEDOR,
      A.COD_EXECUTIVO,
      A.EXECUTIVO,
      A.ESTADO,
      A.MUNICIPIO,
      A.KWP,
      FORMAT(A.DT_LIBERAC, 'dd-MM-yyyy HH:mm:ss') AS DT_LIBERAC,
      A.DIAS,
      FORMAT(A.PRZ_CONTRATO, 'dd-MM-yyyy HH:mm:ss') AS PRZ_CONTRATO,
      CASE
          WHEN A.PRZ_CONTRATO < GETDATE() THEN 'Contrato Vencido'
          ELSE ''
      END AS SituacaoContrato,
      CASE
          WHEN A.PRZ_CONTRATO > GETDATE() AND DATEDIFF(DAY, GETDATE(), A.PRZ_CONTRATO) <= 20 THEN 'Próximo ao vencimento'
          ELSE ''
      END AS SituacaoContrato20dias,
      A.DDD,
      A.TELEFONE,
      A.EMAIL,
      A.PLACA_EDP,
      A.ANALISE_FIN,
      A.DESC_ANALISE_FIN,
      A.END_ENTREGA,
      A.TIPO_ESTRUTURA,
      A.DESC_ESTRUTURA,
      A.TIPO_TELHADO,
      A.DESC_TELHADO,
      A.STATUS,
      A.SUBSTATUS,
      A.COD_REF,
      A.COMPANHIA,
      A.MATRICULA,
      A.COD_FUNCAO,
      A.RATEIO,
      A.ANEXO_ART,
      A.ANEXO_DIAGRAMA,
      A.CONTRAT_FILHA,
      FORMAT(A.DATA_INTEGRACAO, 'dd-MM-yyyy HH:mm:ss') AS DATA_INTEGRACAO,
      A.FLUIG,
      A.ETAPA,
      A.COD_REF_STATUS,
      A.FLAG_PRIORIDADE1,
      A.FLAG_PRIORIDADE2,
      A.FLAG_PRIORIDADE3,
      A.FLAG_PRIORIDADE4,
      A.FLAG_PRIORIDADE5
  FROM TAB_INTRANET_ENG_CONTRATO AS A WITH (NOLOCK)
  ORDER BY 
      A.FLAG_PRIORIDADE1 DESC,
      A.FLAG_PRIORIDADE2 DESC,
      A.FLAG_PRIORIDADE3 DESC,
      A.FLAG_PRIORIDADE4 DESC,
      A.FLAG_PRIORIDADE5 DESC
  OFFSET ${offset} ROWS
  FETCH NEXT ${limit} ROWS ONLY
      `;

      const allList = await Mssql.connectAndQuery(allQuery);

      console.log(`Total de registros retornados: ${allList.length}`);
      console.log(`Offset: ${offset}, Limit: ${limit}`);

      return res.status(200).json(allList);
    } catch (error) {
      return res.status(500).json({ message: "Erro na base de dados" });
    }
  },
});
