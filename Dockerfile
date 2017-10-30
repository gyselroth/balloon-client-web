FROM node:6.11.5-alpine AS builder

RUN mkdir -p /build
COPY . /build
RUN apk update && \
    apk add make bash git && \
    npm install -g napa && \
    cd /build && \
    make build && \
    make mostlyclean && \
    apk del make bash git && \
    rm -rf /usr/local/lib/node_modules && \
    rm -rf /var/cache/apk/*

FROM ubuntu:16.04
RUN apt-get update && \
    apt-get install --no-install-recommends -y nginx-full && \
    rm -rf /var/www/html/*
COPY --from=builder /build/build /var/www/html/
RUN chown -R www-data /var/www/html

CMD /usr/sbin/nginx -g 'daemon off;'
