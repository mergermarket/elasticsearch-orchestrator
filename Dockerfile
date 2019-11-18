FROM node:12.13.0-alpine as install

WORKDIR /usr/src/orchestrator

COPY package.json yarn.lock ./
RUN yarn

COPY . .

RUN yarn build

ENV NODE_ENV production

ENTRYPOINT ["/usr/src/orchestrator/run.sh"]
