# Sistema de Histórico Completo SZB010

## 📋 Descrição

Sistema automático que **copia o registro COMPLETO** da tabela `SZB010` sempre que o campo `ZB_MALT` é alterado.

Toda vez que `ZB_MALT` é modificado (valores como `6`, `6,1`, `6,1,2`), um novo registro com **TODOS os campos** é automaticamente criado na tabela de histórico, permitindo:
- ✅ Auditoria completa de alterações
- ✅ Comparação entre versões
- ✅ Rastreabilidade total do estado do registro
- ✅ Recuperação de dados históricos

## 🚀 Instalação

### 1. Criar Tabela de Histórico

Execute o script `create-historico-szb-malt.sql` no banco de dados SQL Server:

```bash
sqlcmd -S 181.41.190.44,37000 -U CLT125995-C4WC2E -d C4WC2E_125995_PR_PD -i create-historico-szb-malt.sql
```

Ou execute manualmente via SQL Server Management Studio (SSMS).

### 2. Criar Trigger de Captura

Execute o script `create-trigger-szb-malt.sql`:

```bash
sqlcmd -S 181.41.190.44,37000 -U CLT125995-C4WC2E -d C4WC2E_125995_PR_PD -i create-trigger-szb-malt.sql
```

## 📊 Estrutura da Tabela de Histórico

```sql
SZB_HISTORICO_COMPLETO
├── HIST_ID (PK, IDENTITY) - ID único do histórico
├── HIST_DATA_ALTERACAO - Timestamp da alteração
├── HIST_USUARIO - Usuário que fez a alteração
├── HIST_HOST - Máquina/host de origem
├── HIST_OPERACAO - 'INSERT' ou 'UPDATE'
└── [TODOS OS CAMPOS DA SZB010]
    ├── ZB_FILIAL
    ├── ZB_TIPO
    ├── ZB_FLUIG
    ├── ZB_EMISSAO
    ├── ZB_CLVL
    ├── ZB_STATUS
    ├── ZB_CODCLI
    ├── ZB_LOJCLI
    ├── ZB_NOME
    ├── ZB_CGC
    ├── ZB_VEND1, ZB_VEND2, ZB_VEND3
    ├── ZB_MUN, ZB_EST
    ├── ZB_X_KWP
    ├── ZB_EMAIL, ZB_TEL
    ├── ZB_STATUS_ENG
    ├── ZB_INVERS, ZB_PLACA
    ├── ZB_MALT
    └── [... todos os demais campos]
```

## 🔍 Como Funciona

O trigger copia **TODO o registro** sempre que `ZB_MALT` é alterado:

### Cenário 1: Criação de Registro
Quando um novo registro é inserido na `SZB010` com `ZB_MALT` preenchido:
- ✅ Cria versão 1 no histórico com TODOS os dados
- Campo `HIST_OPERACAO = 'INSERT'`

### Cenário 2: Primeira Alteração
Quando `ZB_MALT` muda de `6` para `6,1`:
- ✅ Cria versão 2 no histórico com TODOS os dados atualizados
- Campo `HIST_OPERACAO = 'UPDATE'`
- Mantém versão 1 intacta

### Cenário 3: Alteração Subsequente
Quando `ZB_MALT` muda de `6,1` para `6,1,2`:
- ✅ Cria versão 3 no histórico com TODOS os dados atualizados
- Campo `HIST_OPERACAO = 'UPDATE'`
- Mantém versões 1 e 2 intactas

### Vantagem: Histórico Completo
Você pode ver EXATAMENTE como estava o registro em qualquer momento:
- Nome do cliente naquele momento
- Status de engenharia
- Vendedores
- KWP, inversores, placas
- Endereço
- **TODOS os campos**

## 📈 Exemplos de Uso

### Consultar TODAS as versões de uma proposta:
```sql
SELECT 
    HIST_ID,
    HIST_DATA_ALTERACAO,
    HIST_USUARIO,
    ZB_NOME AS CLIENTE,
    ZB_MALT,
    ZB_STATUS_ENG,
    ZB_X_KWP
FROM SZB_HISTORICO_COMPLETO 
WHERE ZB_FLUIG = '00339129'
ORDER BY HIST_DATA_ALTERACAO DESC;
```

### Ver TODOS os dados de uma versão específica:
```sql
SELECT * FROM SZB_HISTORICO_COMPLETO 
WHERE ZB_FLUIG = '00339129'
ORDER BY HIST_DATA_ALTERACAO DESC;
```

### Comparar duas versões (antes e depois):
```sql
WITH Versoes AS (
    SELECT 
        ROW_NUMBER() OVER (PARTITION BY ZB_FLUIG ORDER BY HIST_DATA_ALTERACAO) AS VERSAO,
        *
    FROM SZB_HISTORICO_COMPLETO
    WHERE ZB_FLUIG = '00339129'
)
SELECT 
    V1.VERSAO AS VERSAO_ANTERIOR,
    V2.VERSAO AS VERSAO_ATUAL,
    V1.ZB_MALT AS MALT_ANTES,
    V2.ZB_MALT AS MALT_DEPOIS,
    V1.ZB_STATUS_ENG AS STATUS_ANTES,
    V2.ZB_STATUS_ENG AS STATUS_DEPOIS,
    V2.HIST_DATA_ALTERACAO,
    V2.HIST_USUARIO
FROM Versoes V1
INNER JOIN Versoes V2 ON V2.VERSAO = V1.VERSAO + 1;
```

## 🛠️ Manutenção

### Verificar se o trigger está ativo:
```sql
SELECT 
    name AS TriggerName,
    OBJECT_NAME(parent_id) AS TableName,
    is_disabled,
    create_date
FROM sys.triggers
WHERE name = 'TRG_SZB010_HISTORICO_COMPLETO';
```

### Desabilitar temporariamente (se necessário):
```sql
DISABLE TRIGGER TRG_SZB010_HISTORICO_COMPLETO ON SZB010;
```

### Reabilitar:
```sql
ENABLE TRIGGER TRG_SZB010_HISTORICO_COMPLETO ON SZB010;
```

### Remover o trigger:
```sql
DROP TRIGGER TRG_SZB010_HISTORICO_COMPLETO;
```

### Ver quantos registros no histórico:
```sql
SELECT 
    COUNT(*) AS TOTAL_VERSOES,
    COUNT(DISTINCT ZB_FLUIG) AS PROPOSTAS_COM_HISTORICO
FROM SZB_HISTORICO_COMPLETO;
```

## 📊 Performance

- **Impacto**: Mínimo (apenas quando ZB_MALT é alterado)
- **Índices criados**: 4 índices para otimizar consultas
  - `IX_SZB_HIST_FILIAL_FLUIG` - Busca por proposta
  - `IX_SZB_HIST_DATA` - Busca por período
  - `IX_SZB_HIST_CODCLI` - Busca por cliente
  - `IX_SZB_HIST_MALT` - Busca por valor de MALT
- **Armazenamento**: Registro completo (não JSON, campos separados)
- **Vantagem**: Queries mais rápidas (sem parse de JSON)

## 🔒 Segurança

- Captura automaticamente o usuário SQL (`SUSER_SNAME()`)
- Captura o host/máquina (`HOST_NAME()`)
- Registra timestamp preciso (`GETDATE()`)
- Imutável após inserção (não permite UPDATE/DELETE na tabela de histórico)

## 📝 Queries Úteis

Consulte o arquivo `queries-historico-malt.sql` para mais de 10 queries prontas para:
- Listar histórico por proposta
- Alterações recentes
- Estatísticas por usuário
- Timeline de alterações
- Auditoria completa
- E muito mais!

## 🆘 Troubleshooting

### Trigger não está disparando?
```sql
-- Verificar se o trigger existe e está habilitado
SELECT * FROM sys.triggers WHERE name = 'TRG_SZB010_HISTORICO_COMPLETO';

-- Verificar permissões
SELECT * FROM sys.database_permissions 
WHERE grantee_principal_id = USER_ID('CLT125995-C4WC2E');
```

### Tabela de histórico não foi criada?
```sql
-- Verificar se a tabela existe
SELECT * FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME = 'SZB_HISTORICO_COMPLETO';
```

### Verificar se está gravando corretamente:
```sql
-- Fazer um update de teste
UPDATE SZB010 SET ZB_MALT = '6,1' WHERE ZB_FLUIG = '00339129';

-- Verificar se foi gravado no histórico
SELECT * FROM SZB_HISTORICO_COMPLETO WHERE ZB_FLUIG = '00339129';
```

## 📞 Suporte

Para dúvidas ou problemas, consulte a documentação completa ou entre em contato com a equipe de desenvolvimento.
