FROM node:22-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all the rest of the backend code
COPY . .

# Open port 3001
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]