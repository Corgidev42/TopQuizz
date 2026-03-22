#!/bin/bash
# Génère un certificat SSL auto-signé avec SAN pour localhost + IP locale
CERT_DIR="$(dirname "$0")/certs"
mkdir -p "$CERT_DIR"

# IP locale (en0 = Wi-Fi macOS) ou argument passé en paramètre
LOCAL_IP="${1:-$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')}"

echo "Génération du certificat pour localhost + ${LOCAL_IP}"

openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout "$CERT_DIR/local.key" \
  -out "$CERT_DIR/local.crt" \
  -subj "/C=FR/ST=IDF/L=Paris/O=LocalDev/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${LOCAL_IP}"

echo "Certificat généré dans $CERT_DIR (valide pour localhost + ${LOCAL_IP})"
