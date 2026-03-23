FROM node:18-alpine

ENV NODE_ENV production

# Diretório de trabalho
WORKDIR /usr/src/app

# Instala dependências de Puppeteer + Chromium
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      nodejs \
      yarn \
      bash \
      udev \
      xvfb-run \
      dumb-init \
      mesa-gl \
      mesa-dri-gallium \
      alsa-lib \
      chromium-chromedriver

# Copia package.json e instala node modules
COPY package*.json ./
RUN npm install --omit=dev

# Copia restante do projeto
COPY . .

# Expõe porta
EXPOSE 3000

# Define variáveis de ambiente para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_BIN=/usr/bin/chromium-browser

# Comando para rodar a aplicação
CMD [ "/bin/sh", "-c", "/usr/src/app/node_modules/pm2/bin/pm2-runtime pm2.config.js" ]
