# Small, official Node.js image
FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests first so `npm install` is cached by Docker
# and only re-runs when package.json actually changes, not on every
# source code edit.
COPY package.json ./
RUN npm install --omit=dev

# Now copy the rest of the source code
COPY src ./src

EXPOSE 5000

CMD ["node", "src/server.js"]
