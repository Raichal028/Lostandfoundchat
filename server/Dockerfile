FROM node:18

WORKDIR /app

# Copy entire project (so public folder is included)
COPY . .

# Go to server folder
WORKDIR /app/server

RUN npm install

EXPOSE 5000

CMD ["node", "server.js"]