FROM node:latest

WORKDIR /home/node/app

COPY . /home/node/app

RUN npm install -g nodemon && npm install
