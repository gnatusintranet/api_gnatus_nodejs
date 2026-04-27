// Cliente Microsoft Graph (server-to-server) para provisionamento de usuários M365.
// Usa Client Credentials Flow via @azure/msal-node — token é emitido pelo Entra
// para a App Registration e cacheado por TTL (~1h).
//
// Mesma App Registration "Intranet GNATUS - Reserva de Salas" do MSAL,
// porém usando permissões DE APLICATIVO (User.ReadWrite.All etc) com client secret.
//
// Funções expostas:
//   listSkus()                          → array de licenças com {sku, nome, total, atribuidas, disponiveis}
//   userExistsByMail(upn)               → bool
//   createUser({displayName, mailNickname, upn, password, ...})
//   assignLicense(userId, skuId)
//   addUserToGroup(userId, groupId)
//   listGroups()                        → grupos do M365 (uso opcional)
//   testConnection()                    → tenta obter token

const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
require('isomorphic-fetch');

const TENANT_ID = process.env.M365_TENANT_ID;
const CLIENT_ID = process.env.M365_CLIENT_ID;
const CLIENT_SECRET = process.env.M365_CLIENT_SECRET;

let msalApp = null;
const getMsalApp = () => {
  if (msalApp) return msalApp;
  if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('M365_TENANT_ID / M365_CLIENT_ID / M365_CLIENT_SECRET não configurados.');
  }
  msalApp = new ConfidentialClientApplication({
    auth: {
      clientId: CLIENT_ID,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
      clientSecret: CLIENT_SECRET
    }
  });
  return msalApp;
};

const getToken = async () => {
  const app = getMsalApp();
  const r = await app.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  });
  if (!r?.accessToken) throw new Error('Falha ao obter token Graph (sem accessToken na resposta).');
  return r.accessToken;
};

const getClient = async () => {
  const token = await getToken();
  return Client.init({
    authProvider: (done) => done(null, token),
    defaultVersion: 'v1.0'
  });
};

// Mapa amigável de SKU IDs → nomes comerciais (parcial — Graph retorna skuPartNumber técnico)
const SKU_FRIENDLY = {
  'O365_BUSINESS_ESSENTIALS': 'Microsoft 365 Business Basic',
  'O365_BUSINESS_PREMIUM':    'Microsoft 365 Business Standard',
  'SPB':                       'Microsoft 365 Business Premium',
  'EXCHANGESTANDARD':          'Exchange Online (Plan 1)',
  'EXCHANGEENTERPRISE':        'Exchange Online (Plan 2)',
  'STANDARDPACK':              'Office 365 E1',
  'ENTERPRISEPACK':            'Office 365 E3',
  'ENTERPRISEPREMIUM':         'Office 365 E5',
  'O365_BUSINESS':             'Microsoft 365 Apps for Business',
  'OFFICESUBSCRIPTION':        'Microsoft 365 Apps for Enterprise',
  'POWER_BI_STANDARD':         'Power BI (free)',
  'POWER_BI_PRO':              'Power BI Pro',
  'TEAMS_EXPLORATORY':         'Teams Exploratory',
  'STREAM':                    'Microsoft Stream'
};

const listSkus = async () => {
  const c = await getClient();
  const r = await c.api('/subscribedSkus').get();
  return (r.value || []).map(s => {
    const total = s.prepaidUnits?.enabled || 0;
    const atribuidas = s.consumedUnits || 0;
    return {
      sku: s.skuId,
      partNumber: s.skuPartNumber,
      nome: SKU_FRIENDLY[s.skuPartNumber] || s.skuPartNumber,
      total,
      atribuidas,
      disponiveis: Math.max(0, total - atribuidas)
    };
  }).sort((a, b) => a.nome.localeCompare(b.nome));
};

const userExistsByMail = async (mail) => {
  const c = await getClient();
  try {
    const r = await c.api(`/users/${encodeURIComponent(mail)}`).get();
    return !!r?.id;
  } catch (e) {
    if (e.statusCode === 404) return false;
    throw e;
  }
};

const createUser = async ({
  displayName, mailNickname, upn, password,
  givenName, surname, jobTitle, department, mobilePhone, usageLocation = 'BR'
}) => {
  const c = await getClient();
  const body = {
    accountEnabled: true,
    displayName,
    mailNickname,
    userPrincipalName: upn,
    usageLocation,
    passwordProfile: {
      forceChangePasswordNextSignIn: false,  // M365 não exige troca; AD ainda força (pwdLastSet=0)
      password
    }
  };
  if (givenName) body.givenName = givenName;
  if (surname) body.surname = surname;
  if (jobTitle) body.jobTitle = jobTitle;
  if (department) body.department = department;
  if (mobilePhone) body.mobilePhone = mobilePhone;

  return await c.api('/users').post(body);
};

const assignLicense = async (userId, skuId) => {
  const c = await getClient();
  return await c.api(`/users/${encodeURIComponent(userId)}/assignLicense`).post({
    addLicenses: [{ disabledPlans: [], skuId }],
    removeLicenses: []
  });
};

const addUserToGroup = async (userId, groupId) => {
  const c = await getClient();
  return await c.api(`/groups/${encodeURIComponent(groupId)}/members/$ref`).post({
    '@odata.id': `https://graph.microsoft.com/v1.0/directoryObjects/${userId}`
  });
};

const listGroups = async () => {
  const c = await getClient();
  // Lista apenas groups do tipo segurança/M365 (exclui distribution lists)
  const r = await c.api('/groups')
    .select('id,displayName,description,securityEnabled,mailEnabled,groupTypes')
    .top(999)
    .get();
  return (r.value || [])
    .filter(g => g.securityEnabled || (g.groupTypes || []).includes('Unified'))
    .map(g => ({
      id: g.id, name: g.displayName, description: g.description || '',
      tipo: (g.groupTypes || []).includes('Unified') ? 'M365' : 'Segurança'
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

// Busca por nome ou email — retorna até 25 matches
const searchUsers = async (q) => {
  const c = await getClient();
  const filter = q.includes('@')
    ? `mail eq '${q}' or userPrincipalName eq '${q}'`
    : `startswith(displayName,'${q}') or startswith(mailNickname,'${q}')`;
  const r = await c.api('/users')
    .filter(filter)
    .select('id,displayName,mail,userPrincipalName,accountEnabled,jobTitle,department')
    .top(25)
    .get();
  return (r.value || []).map(u => ({
    id: u.id, nome: u.displayName, mail: u.mail, upn: u.userPrincipalName,
    ativo: u.accountEnabled, cargo: u.jobTitle || '', departamento: u.department || ''
  }));
};

// Pega licenças atribuídas ao usuário
const getUserLicenses = async (userId) => {
  const c = await getClient();
  const r = await c.api(`/users/${encodeURIComponent(userId)}/licenseDetails`).get();
  return (r.value || []).map(l => ({ sku: l.skuId, partNumber: l.skuPartNumber }));
};

// Bloqueia o usuário (accountEnabled = false)
const disableUser = async (userId) => {
  const c = await getClient();
  return await c.api(`/users/${encodeURIComponent(userId)}`).patch({ accountEnabled: false });
};

// Remove TODAS as licenças do usuário
const removeAllLicenses = async (userId) => {
  const licencas = await getUserLicenses(userId);
  if (!licencas.length) return { removidas: 0 };
  const c = await getClient();
  await c.api(`/users/${encodeURIComponent(userId)}/assignLicense`).post({
    addLicenses: [],
    removeLicenses: licencas.map(l => l.sku)
  });
  return { removidas: licencas.length, skus: licencas.map(l => l.partNumber) };
};

const testConnection = async () => {
  try {
    await getToken();
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
};

module.exports = {
  listSkus,
  userExistsByMail,
  createUser,
  assignLicense,
  addUserToGroup,
  listGroups,
  searchUsers,
  getUserLicenses,
  disableUser,
  removeAllLicenses,
  testConnection
};
