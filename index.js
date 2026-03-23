// index.js

// PASSO 1: Carrega as variáveis de ambiente. DEVE SER A PRIMEIRA COISA NO ARQUIVO.
require('dotenv').config();


const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

const loader = require('./config/loader');

// PASSO 2: Agora que as variáveis existem, carregamos os serviços
app.services = loader(path.join(__dirname, 'services'), app);
app.io = require('socket.io')(server);

// PASSO 3: Carregamos as rotas da API
require('./config/resources')(app, {
  directory: path.join(__dirname, 'resources'),
  log: 'errors',
  authentication: require('./middlewares/authentication')(app),
  environment: process.env.NODE_ENV || 'development'
});

const Jwt = require('./services/jwt')();

app.io.on('connection', socket => {
  const token = socket.handshake.query.token;
  if (!token) socket.disconnect();

  const tokenData = Jwt.verify(token.split(' ')[1]);
  if (!tokenData) socket.disconnect();

  socket.userId = tokenData.id;
  socket.join(`user_${tokenData.id}`);

  socket.on('join', room => {
    socket.join(room);
  });
  socket.on('leave', room => {
    socket.leave(room);
  });
});

const port = process.env.PORT || 3000

server.listen(port, () => {
  console.log(`API running on port: ${port}`);
})

