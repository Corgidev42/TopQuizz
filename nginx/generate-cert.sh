#!/bin/bash
# Génère un certificat SSL auto-signé pour nginx local
CERT_DIR="$(dirname "$0")/certs"
mkdir -p "$CERT_DIR"
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$CERT_DIR/local.key" \
  -out "$CERT_DIR/local.crt" \
  -subj "/C=FR/ST=IDF/L=Paris/O=LocalDev/CN=localhost"
echo "Certificat généré dans $CERT_DIR"
