// Registra uma nova ação de cobrança (ligação, e-mail, acordo, etc.)
const TIPOS_ACAO = ['LIGACAO','EMAIL','WHATSAPP','VISITA','ACORDO','BAIXA_PARCIAL','OUTRO'];
const RESULTADOS = ['SEM_CONTATO','PROMESSA_PAGAMENTO','RECUSA','PAGO','ACORDO_FECHADO','OUTRO'];

module.exports = (app) => ({
  verb: 'post',
  route: '/acao',

  handler: async (req, res) => {
    const { Mssql } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Usuário não autenticado.' });

    const {
      clienteCod, clienteLoja,
      tituloPrefixo, tituloNum, tituloParcela, tituloTipo,
      tipoAcao, resultado, dataPromessa, valorPrometido, descricao
    } = req.body || {};

    if (!clienteCod || !clienteLoja) return res.status(400).json({ message: 'Cliente é obrigatório.' });
    if (!TIPOS_ACAO.includes(tipoAcao)) return res.status(400).json({ message: 'Tipo de ação inválido.' });
    if (!RESULTADOS.includes(resultado)) return res.status(400).json({ message: 'Resultado inválido.' });

    try {
      const result = await Mssql.connectAndQuery(
        `INSERT INTO TAB_COBRANCA_ACAO
           (CLIENTE_COD, CLIENTE_LOJA, TITULO_PREFIXO, TITULO_NUM, TITULO_PARCELA, TITULO_TIPO,
            TIPO_ACAO, RESULTADO, DATA_PROMESSA, VALOR_PROMETIDO, DESCRICAO, ID_USER)
         OUTPUT INSERTED.ID
         VALUES (@cod, @loja, @pref, @num, @parc, @tt, @tipo, @res, @dp, @vp, @desc, @uid)`,
        {
          cod: String(clienteCod).trim(), loja: String(clienteLoja).trim(),
          pref: String(tituloPrefixo || '').trim(), num: String(tituloNum || '').trim(),
          parc: String(tituloParcela || '').trim(), tt: String(tituloTipo || '').trim(),
          tipo: tipoAcao, res: resultado,
          dp: dataPromessa ? new Date(dataPromessa) : null,
          vp: valorPrometido != null ? Number(valorPrometido) : null,
          desc: descricao || null,
          uid: user.ID
        }
      );
      return res.status(201).json({ ok: true, id: result[0]?.ID });
    } catch (err) {
      console.error('Erro cobranca/acao-create:', err);
      return res.status(500).json({ message: 'Erro ao registrar ação.' });
    }
  }
});
