// Cadastro completo do colaborador no Protheus (SRA010 + SQ3010 cargo + SQB010 depto).
// Decodifica estado civil e nacionalidade.
// Endereço NÃO está populado em SRA010 da Gnatus — retorna vazio (user completa manual).

const trim = (v) => String(v || '').trim();

const ESTCIVI = {
  'S': 'Solteiro(a)', 'C': 'Casado(a)', 'V': 'Viúvo(a)',
  'D': 'Divorciado(a)', 'O': 'Outros', 'U': 'União estável'
};
const NACIONA = {
  '10': 'Brasileiro(a)', '20': 'Brasileiro(a) naturalizado(a)',
  '21': 'Brasileiro(a) nascido no exterior'
};

const checarPerm = async (Pg, idUser) => {
  const r = await Pg.connectAndQuery(
    `SELECT id_permissao FROM tab_intranet_usr_permissoes
      WHERE id_user = @id AND id_permissao IN (0, 1027)`,
    { id: idUser }
  );
  return r.length > 0;
};

module.exports = (app) => ({
  verb: 'get',
  route: '/colaborador',

  handler: async (req, res) => {
    const { Pg, Protheus } = app.services;
    const user = req.user && req.user[0];
    if (!user) return res.status(401).json({ message: 'Não autenticado.' });
    if (!(await checarPerm(Pg, user.ID))) {
      return res.status(403).json({ message: 'Sem permissão (1027).' });
    }

    const matricula = trim(req.query.matricula);
    const filial    = trim(req.query.filial);  // opcional — se houver matrícula igual em filiais diferentes
    if (!matricula) return res.status(400).json({ message: 'Matrícula obrigatória.' });

    try {
      const r = await Protheus.connectAndQuery(
        `SELECT TOP 1
                RTRIM(sra.RA_FILIAL)   filial,
                RTRIM(sra.RA_MAT)      matricula,
                RTRIM(sra.RA_NOME)     nome,
                RTRIM(sra.RA_NOMECMP)  nomeCompleto,
                RTRIM(sra.RA_CIC)      cpf,
                RTRIM(sra.RA_RG)       rg,
                RTRIM(sra.RA_PIS)      pis,
                RTRIM(sra.RA_NACIONA)  nacionalidadeCod,
                RTRIM(sra.RA_ESTCIVI)  estadoCivilCod,
                RTRIM(sra.RA_SEXO)     sexo,
                RTRIM(sra.RA_EMAIL)    email,
                RTRIM(sra.RA_TELEFON)  telefone,
                RTRIM(sra.RA_ENDEREC)  endereco,
                RTRIM(sra.RA_BAIRRO)   bairro,
                RTRIM(sra.RA_MUNICIP)  municipio,
                RTRIM(sra.RA_ESTADO)   uf,
                RTRIM(sra.RA_CEP)      cep,
                RTRIM(sra.RA_COMPLEM)  complemento,
                sra.RA_ADMISSA         admissao,
                RTRIM(sra.RA_SITFOLH)  situacao,
                RTRIM(sq3.Q3_DESCSUM)  cargo,
                RTRIM(sqb.QB_DESCRIC)  departamento
           FROM SRA010 sra WITH (NOLOCK)
           LEFT JOIN SQ3010 sq3 WITH (NOLOCK)
             ON RTRIM(sq3.Q3_CARGO) = RTRIM(sra.RA_CARGO) AND sq3.D_E_L_E_T_ <> '*'
           LEFT JOIN SQB010 sqb WITH (NOLOCK)
             ON RTRIM(sqb.QB_DEPTO) = RTRIM(sra.RA_DEPTO) AND sqb.D_E_L_E_T_ <> '*'
          WHERE sra.D_E_L_E_T_ <> '*'
            AND sra.RA_MAT = @mat
            ${filial ? "AND sra.RA_FILIAL = @fil" : ''}`,
        filial ? { mat: matricula, fil: filial } : { mat: matricula }
      );

      if (!r.length) return res.status(404).json({ message: 'Colaborador não encontrado.' });

      const c = r[0];
      return res.json({
        filial: trim(c.filial),
        matricula: trim(c.matricula),
        nome: trim(c.nome),
        nomeCompleto: trim(c.nomeCompleto) || trim(c.nome),
        cpf: trim(c.cpf),
        rg: trim(c.rg),
        pis: trim(c.pis),
        nacionalidade: NACIONA[trim(c.nacionalidadeCod)] || (trim(c.nacionalidadeCod) ? 'Estrangeiro(a)' : ''),
        nacionalidadeCod: trim(c.nacionalidadeCod),
        estadoCivil: ESTCIVI[trim(c.estadoCivilCod)] || '',
        estadoCivilCod: trim(c.estadoCivilCod),
        sexo: trim(c.sexo),
        email: trim(c.email),
        telefone: trim(c.telefone),
        endereco: trim(c.endereco),
        bairro: trim(c.bairro),
        municipio: trim(c.municipio),
        uf: trim(c.uf),
        cep: trim(c.cep),
        complemento: trim(c.complemento),
        admissao: trim(c.admissao),
        situacao: trim(c.situacao),
        cargo: trim(c.cargo),
        departamento: trim(c.departamento)
      });
    } catch (err) {
      console.error('Erro buscar colaborador:', err);
      return res.status(502).json({ message: 'Falha ao consultar Protheus: ' + err.message });
    }
  }
});
