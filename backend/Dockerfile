# Dockerfile for backend
FROM node:18

WORKDIR /app
COPY . .

RUN npm install

EXPOSE 10000
ENV PORT=10000

CMD ["npm", "start"]
