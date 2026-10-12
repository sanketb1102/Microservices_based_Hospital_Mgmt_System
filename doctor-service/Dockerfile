FROM node:18

WORKDIR /app

# package.json is copied on its own first. Docker caches each layer, so as
# long as the dependency list has not changed, a code edit reuses the
# cached npm install layer instead of running it again.
COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
