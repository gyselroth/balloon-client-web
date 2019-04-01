FROM nginx:1-alpine

RUN apk add --update openssl \
  && rm -rf /var/cache/apk/*

RUN mkdir /usr/share/balloon-web/nginx -p
COPY build/ /usr/share/balloon-web/
COPY packaging/nginx.conf /etc/nginx/conf.d/balloon.conf

RUN sed -i "s#unix:/run/php/php7.2-fpm.sock#balloon:9000#g" /etc/nginx/conf.d/balloon.conf \
  && sed -i "s#/var/log/balloon/nginx_access.log#/dev/stdout#g" /etc/nginx/conf.d/balloon.conf \
  && sed -i "s#/var/log/balloon/nginx_error.log#/dev/stderr#g" /etc/nginx/conf.d/balloon.conf

RUN openssl genrsa -des3 -passout pass:balloon -out server.pass.key 2048 \
  && openssl rsa -passin pass:balloon -in server.pass.key -out key.pem \
  && rm server.pass.key \
  && openssl req -new -key key.pem -out server.csr -subj "/C=CH/L=Zurich/O=Balloon/CN=balloon.local" \
  && openssl x509 -req -days 365 -in server.csr -signkey key.pem -out chain.pem \
  && rm server.csr \
  && mv key.pem /etc/ssl/balloon \
  && mv chain.pem /etc/ssl/balloon

EXPOSE 80 443
