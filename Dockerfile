FROM node:6.11.5-alpine AS builder

RUN mkdir -p /build
COPY . /build
RUN apk update && \
    apk add make bash git && \
    npm install -g napa && \
    cd /build && \
    make build

FROM ubuntu:16.04
RUN apt-get update && \
    apt-get install --no-install-recommends -y nginx-full && \
    rm -rf /var/www/html/* && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

COPY --from=builder /build/packaging/nginx.site*.conf /etc/nginx/sites-enabled/
COPY --from=builder /build/build /var/www/html/
RUN rm -f /etc/nginx/sites-enabled/default && \
    sed -i "s#/path/to/vhost#/var/www/html/#g" /etc/nginx/sites-enabled/nginx.site*.conf && \
    sed -i "s#/path/to/ssl#/etc/ssl/balloon#g" /etc/nginx/sites-enabled/nginx.site*.conf && \
    chown -R www-data /var/www/html

ARG SSL=false
RUN [ "$SSL" = "true" ] && (\
        apt-get update && \
        apt-get install --no-install-recommends -y openssl && \
        mv /etc/nginx/sites-enabled/nginx.site_ssl.conf /etc/nginx/sites-enabled/default && \
        rm -f /etc/nginx/sites-enabled/nginx.site.conf && \
        mkdir -p /etc/ssl/balloon && \
        openssl genrsa -des3 -passout pass:balloon -out server.pass.key 2048 && \
        openssl rsa -passin pass:balloon -in server.pass.key -out key.pem && \
        openssl req -new -key key.pem -out server.csr \
          -subj "/C=CH/L=Zurich/O=Balloon/CN=balloon.local"  && \
        openssl x509 -req -days 365 -in server.csr -signkey key.pem -out chain.pem  && \
        mv key.pem /etc/ssl/balloon/ && \
        mv chain.pem /etc/ssl/balloon/ && \
        rm server.csr server.pass.key && \
        rm -rf /var/lib/apt/lists/* && \
        apt-get clean \\
    ) || (\
        mv /etc/nginx/sites-enabled/nginx.site.conf /etc/nginx/sites-enabled/default && \
        rm -f /etc/nginx/sites-enabled/nginx.site_ssl.conf \
    )

EXPOSE 80 443

CMD /usr/sbin/nginx -g 'daemon off;'
