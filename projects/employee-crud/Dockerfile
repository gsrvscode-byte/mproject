# Dockerfile
#
# See README section "Dockerfile, Explained Line by Line" for the full
# explanation of each instruction below.

FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
