#!/usr/bin/env python3
# Servidor local do Painel de Tracking DHL.
# Serve a pasta atual em http://localhost:8000 SEM cache, para que toda
# alteracao em index.html / app.js / data.js apareca no refresh.
import http.server
import socketserver
import os

PORT = 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

class ReusableServer(socketserver.TCPServer):
    allow_reuse_address = True

with ReusableServer(('', PORT), NoCacheHandler) as httpd:
    print('')
    print('  Painel de Tracking DHL servindo em:  http://localhost:%d/index.html' % PORT)
    print('  (cache desativado - alteracoes aparecem ao recarregar)')
    print('  Feche esta janela para parar o servidor.')
    print('')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
