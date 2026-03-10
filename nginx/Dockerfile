FROM nginx:stable

COPY nginx.conf /etc/nginx/nginx.conf
COPY certs/local.crt /etc/nginx/certs/local.crt
COPY certs/local.key /etc/nginx/certs/local.key

EXPOSE 443 80
CMD ["nginx", "-g", "daemon off;"]
