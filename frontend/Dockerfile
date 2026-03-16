FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build l'app en mode production
RUN npm run build

EXPOSE 3000

# Servez le build avec Vite preview (sans HMR/WebSocket de dev)
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "3000"]
