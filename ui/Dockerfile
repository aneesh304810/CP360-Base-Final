# ---- build stage ----
FROM registry.access.redhat.com/ubi9/nodejs-20:latest AS build
WORKDIR /app
COPY ui/package.json ui/package-lock.json* ./
ARG NPM_REGISTRY=""
RUN if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi && npm install
COPY ui/ ./
ARG VITE_API_BASE=/api
RUN npm run build
# ---- runtime stage ----
FROM registry.access.redhat.com/ubi9/nginx-124:latest
COPY --from=build /app/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
