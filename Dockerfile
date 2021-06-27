FROM node:16

WORKDIR /app
COPY yarn.lock package.json /app/
RUN yarn install --frozen-lockfile
COPY . /app/
CMD ["yarn", "start"]
