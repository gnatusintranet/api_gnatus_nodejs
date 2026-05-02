// Catalogo das 12 etapas do Registro Historico do Produto.
// Espelha o pipe Pipefy "01 | REGISTRO HISTORICO DO PRODUTO".
// `_` no inicio do nome do arquivo faz o resource loader ignorar como rota.

const ETAPAS = [
  { codigo: 1,  nome: 'Separação de Materiais',           campos: ['tipo_separacao', 'materiais_falta'],
    descricao: 'Separar materiais conforme OP. Anexar a Ordem de Produção.' },
  { codigo: 2,  nome: 'Impressão do Rótulo',              campos: ['rotulagem_url'],
    descricao: 'Imprimir e aprovar rótulo. Anexar cópia da rotulagem ANVISA.' },
  { codigo: 3,  nome: 'Liberação de Início de Processo',  campos: ['checklist', 'justificativa'],
    descricao: 'Validar 8 requisitos antes de liberar início.',
    checklist: [
      'Foram retirados os materiais de fabricação do lote anterior',
      'Foram realizados os procedimentos de limpeza/sanitização ou organização do local',
      'As ferramentas/jigas/instrumentos necessários estão disponíveis e aptos',
      'Os equipamentos de medição/verificação foram testados e/ou tem calibração válida',
      'Os documentos de produção estão disponíveis',
      'As instruções, folhas de processos, métodos de ensaio e registros estão disponíveis',
      'Os colaboradores estão treinados nas atividades a serem executadas',
      'O ambiente de trabalho atende aos requisitos para o processo'
    ] },
  { codigo: 4,  nome: 'Montagem',                          campos: [],
    descricao: 'Executar montagem conforme procedimento.' },
  { codigo: 5,  nome: 'Inspeção e Teste Montagem',         campos: [],
    descricao: 'Inspecionar e testar a montagem.' },
  { codigo: 6,  nome: 'Inspeção e Testes Finais',          campos: [],
    descricao: 'Realizar inspeção e testes finais do produto.' },
  { codigo: 7,  nome: 'Embalagem e Rotulagem',             campos: [],
    descricao: 'Embalar e rotular o produto.' },
  { codigo: 8,  nome: 'Inspeção da Embalagem e Rotulagem', campos: [],
    descricao: 'Inspecionar embalagem e rotulagem.' },
  { codigo: 9,  nome: 'Liberação Final',                   campos: [],
    descricao: 'Aprovar liberação final do lote.' },
  { codigo: 10, nome: 'Apontamento Protheus',              campos: [],
    descricao: 'Apontar produção no Protheus (SD3).' },
  { codigo: 11, nome: 'Aguardando Coleta',                 campos: ['armazem', 'localizacao'],
    descricao: 'Produto disponível pra coleta.',
    armazens: [
      { codigo: '00', descricao: 'Produto Acabado' },
      { codigo: '12', descricao: 'Assistência Técnica' }
    ] },
  { codigo: 12, nome: 'Concluído',                         campos: [],
    descricao: 'Registro concluído.' }
];

const ETAPAS_MAP = new Map(ETAPAS.map(e => [e.codigo, e]));

// Sanitiza dados_extras pra so guardar campos esperados da etapa
function sanitizarDadosExtras(etapaCodigo, dados) {
  const meta = ETAPAS_MAP.get(etapaCodigo);
  if (!meta || !dados) return {};
  const out = {};
  for (const k of meta.campos || []) {
    if (k in dados) out[k] = dados[k];
  }
  return out;
}

module.exports = { ETAPAS, ETAPAS_MAP, sanitizarDadosExtras };
