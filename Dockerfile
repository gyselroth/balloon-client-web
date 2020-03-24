FROM nginxinc/nginx-unprivileged:1-alpine
COPY packaging/nginx.conf /etc/nginx/conf.d/default.conf
COPY build/ /usr/share/balloon-web
