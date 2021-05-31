sudo mkdir cert
sudo openssl req  -subj '/CN=www.micadat.com/O=ADAT/C=TW' -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./cert/ssl.key -out ./cert/ssl.csr
