FROM node:20-alpine

RUN apk add --no-cache git curl jq

WORKDIR /action
COPY package.json .
RUN npm install

COPY . .
RUN chmod +x entrypoint.sh

ENTRYPOINT ["/action/entrypoint.sh"]
