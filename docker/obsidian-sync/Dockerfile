FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

RUN npm install --global --ignore-scripts @vectorize-io/hindsight-obsidian@0.3.0 \
    && npm cache clean --force \
    && mkdir -p /home/node/.hindsight/obsidian \
    && chown -R node:node /home/node/.hindsight

ENV HOME=/home/node
USER node

ENTRYPOINT ["hindsight-obsidian-sync"]
