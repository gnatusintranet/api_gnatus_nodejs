// Cliente para a API Sigma do PABX Falemais (https://app.falemaisvoip.com.br/api/seg/v1)
//
// Doc:
//   /token             — GET  /token/{user}/{password} → { status: 'ok', token: '<41 hex>' }
//   /dial              — GET  /dial/{token}/{ramal}/{phone} → { status, id }
//   /audio             — GET  /audio/{token}/{id}/{play|get|info}
//   /status            — GET  /status (sem auth)
//
// API de Gravações (separada): http://apigravacoes.falemaisvoip.com.br/api
//   POST /login                      — body { email, password } → token
//   GET  /ligacoes                   — header token + body { data_inicial, data_final, exportar:1 }
//   GET  /download/{token}/{uniqueid}— download individual
//
// Variáveis .env:
//   FALEMAIS_USER, FALEMAIS_PASSWORD     (Sigma — login PABX)
//   FALEMAIS_REC_EMAIL, FALEMAIS_REC_PASSWORD (Gravações — pode ser igual)
//
// Token Sigma cacheado em memória por TTL (regeneramos se 401/403/expirar).

const SIGMA_BASE = process.env.FALEMAIS_SIGMA_URL || 'https://app.falemaisvoip.com.br/api/seg/v1'  // /api/seg/v1, NÃO /segv1 como diz a doc oficial;
const REC_BASE   = process.env.FALEMAIS_REC_URL   || 'http://apigravacoes.falemaisvoip.com.br/api';

const TOKEN_TTL_MS = 30 * 60 * 1000;  // 30 min — regenera com folga
let sigmaCache = { token: null, exp: 0 };
let recCache   = { token: null, exp: 0 };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const getSigmaToken = async ({ force = false } = {}) => {
  // Prioridade 1: Token fixo configurado em .env (FALEMAIS_TOKEN).
  // O endpoint /token está retornando "não autorizado" para nosso IP (provável
  // rate limit / restrição), mas tokens gerados pelo suporte funcionam normalmente
  // em /dial e /audio. Solução: receber o token pronto via env.
  const fixedToken = process.env.FALEMAIS_TOKEN;
  if (fixedToken) return fixedToken;

  if (!force && sigmaCache.token && Date.now() < sigmaCache.exp) return sigmaCache.token;

  const user = process.env.FALEMAIS_USER;
  const pass = process.env.FALEMAIS_PASSWORD;
  if (!user || !pass) throw new Error('FALEMAIS_USER / FALEMAIS_PASSWORD não configurados (ou defina FALEMAIS_TOKEN com um token pronto).');

  const url = `${SIGMA_BASE}/token/${encodeURIComponent(user)}/${encodeURIComponent(pass)}`;
  const r = await fetch(url);
  const txt = await r.text();
  let json;
  try { json = JSON.parse(txt); } catch { throw new Error(`Falemais /token resposta inválida: ${txt.slice(0,200)}`); }
  if (json.status !== 'ok' || !json.token) {
    throw new Error(`Falemais /token falhou: ${json.status || 'sem status'}`);
  }
  sigmaCache = { token: json.token, exp: Date.now() + TOKEN_TTL_MS };
  return json.token;
};

const sanitizeNumero = (raw) => {
  const d = String(raw || '').replace(/\D/g, '');
  // Remove "55" inicial se vier (DDI Brasil)
  return d.length > 11 && d.startsWith('55') ? d.slice(2) : d;
};

// Disca: PABX toca o ramal, ao atender disca para o número
const dial = async ({ ramal, phone }) => {
  const ext = String(ramal || '').replace(/\D/g, '');
  const num = sanitizeNumero(phone);
  if (ext.length < 4 || ext.length > 8) throw new Error(`Ramal '${ramal}' inválido (4-8 dígitos).`);
  if (num.length < 8 || num.length > 11) throw new Error(`Telefone '${phone}' inválido (8-11 dígitos).`);

  const tryDial = async (token) => {
    const url = `${SIGMA_BASE}/dial/${token}/${ext}/${num}`;
    const r = await fetch(url, { method: 'GET' });
    const txt = await r.text();
    let json;
    try { json = JSON.parse(txt); } catch { throw new Error(`Resposta /dial inválida: ${txt.slice(0,200)}`); }
    return { httpOk: r.ok, status: r.status, json };
  };

  let token = await getSigmaToken();
  let res = await tryDial(token);
  if (!res.httpOk || res.json?.status !== 'ok') {
    // Se token inválido/expirado, regenera e tenta de novo (1x)
    if (res.status === 401 || res.status === 403 || /token/i.test(JSON.stringify(res.json))) {
      token = await getSigmaToken({ force: true });
      res = await tryDial(token);
    }
  }
  if (res.json?.status !== 'ok') {
    throw new Error(res.json?.cause || res.json?.status || `HTTP ${res.status}`);
  }
  return { id: res.json.id, raw: res.json };
};

// O suporte Falemais (2026-04-27) confirmou: o mesmo token (FALEMAIS_TOKEN)
// vale para Sigma E para a API de Gravações. Não precisa mais de email/senha.
// Mantemos fallback para gerar via /login só por segurança (caso o token expire).
const getRecToken = async ({ force = false } = {}) => {
  const fixedToken = process.env.FALEMAIS_TOKEN;
  if (fixedToken) return fixedToken;

  if (!force && recCache.token && Date.now() < recCache.exp) return recCache.token;

  const email = process.env.FALEMAIS_REC_EMAIL || process.env.FALEMAIS_USER;
  const pass  = process.env.FALEMAIS_REC_PASSWORD || process.env.FALEMAIS_PASSWORD;
  if (!email || !pass) throw new Error('FALEMAIS_TOKEN não configurado (e fallback FALEMAIS_REC_EMAIL/PASSWORD ausentes).');

  const r = await fetch(`${REC_BASE}/login`, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass })
  });
  const txt = await r.text();
  let json;
  try { json = JSON.parse(txt); } catch { throw new Error(`Gravacoes /login resposta inválida: ${txt.slice(0,200)}`); }
  const token = json.token || json.access_token || json.data?.token;
  if (!token) throw new Error(`Gravacoes /login falhou: ${txt.slice(0,200)}`);
  recCache = { token, exp: Date.now() + TOKEN_TTL_MS };
  return token;
};

// Parser CSV simples — respeita aspas duplas, suporta aspas escapadas ("")
const parseCSV = (txt) => {
  const linhas = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (inQ) {
      if (c === '"' && txt[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { cur += c; }
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); linhas.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* skip */ }
      else { cur += c; }
    }
  }
  if (cur || row.length) { row.push(cur); linhas.push(row); }
  if (!linhas.length) return [];
  const header = linhas[0];
  return linhas.slice(1).filter(r => r.length === header.length).map(r => {
    const o = {}; header.forEach((h, i) => { o[h] = r[i]; }); return o;
  });
};

// Lista ligações (CDRs). API limita 10 dias por request.
// Fluxo: GET /ligacoes?... → { status:'success', arquivo:'/storage/.../cdr-XXX.csv' } → baixa CSV → parse.
const listarLigacoes = async ({ dataInicial, dataFinal }) => {
  const token = await getRecToken();
  const qs = new URLSearchParams({ data_inicial: dataInicial, data_final: dataFinal, exportar: '1' });
  const r = await fetch(`${REC_BASE}/ligacoes?${qs}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json', token }
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`/ligacoes HTTP ${r.status}: ${txt.slice(0,300)}`);
  let json;
  try { json = JSON.parse(txt); } catch { throw new Error(`/ligacoes resposta inválida: ${txt.slice(0,200)}`); }
  if (json.status !== 'success' || !json.arquivo) {
    throw new Error(`/ligacoes sem arquivo: ${JSON.stringify(json).slice(0,200)}`);
  }

  // Base do CSV: /storage não fica em /api, e sim na raiz do host
  const recBaseUrl = REC_BASE.replace(/\/api\/?$/, '');
  const csvUrl = recBaseUrl + json.arquivo;
  const cr = await fetch(csvUrl);
  if (!cr.ok) throw new Error(`Download CSV HTTP ${cr.status}`);
  const csv = await cr.text();
  const rows = parseCSV(csv);
  return { ligacoes: rows, total: rows.length, arquivoCsv: csvUrl };
};

// Stream de áudio individual (modo 'play' = stream WAV, 'get' = download, 'info' = JSON metadata)
const audioUrl = async (id, modo = 'play') => {
  const token = await getSigmaToken();
  return `${SIGMA_BASE}/audio/${token}/${encodeURIComponent(id)}/${modo}`;
};

// Download direto via API de gravações (alternativo)
const downloadGravacaoUrl = async (uniqueid) => {
  const token = await getRecToken();
  return `${REC_BASE}/download/${token}/${encodeURIComponent(uniqueid)}`;
};

module.exports = {
  getSigmaToken,
  dial,
  sanitizeNumero,
  getRecToken,
  listarLigacoes,
  audioUrl,
  downloadGravacaoUrl,
  _internal: { sleep }
};
