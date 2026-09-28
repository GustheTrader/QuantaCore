FROM node:24-alpine

RUN npm install --global --ignore-scripts @vectorize-io/hindsight-obsidian@0.3.0 \
    && npm cache clean --force

ENV HOME=/home/node
USER node

ENTRYPOINT ["hindsight-obsidian-sync"]
