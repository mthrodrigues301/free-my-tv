#!/usr/bin/env python3
"""Local Spotify bridge. Reads SPOTIFY_ACCESS_TOKEN from the process environment only.

No token files, refresh-token storage, request logging or public network binding.
Run with the environment variable already set; the preview can call port 8788.
"""
import json
import os
import re
import urllib.parse
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ORIGIN = 'http://127.0.0.1:8770'
ROUTES = {'/profile': '/me', '/devices': '/me/player/devices', '/playback': '/me/player'}
COMMANDS = {'/play': ('PUT', '/me/player/play'), '/pause': ('PUT', '/me/player/pause'),
            '/next': ('POST', '/me/player/next'), '/previous': ('POST', '/me/player/previous')}
retry_at = 0
lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status)
        if self.headers.get('Origin') == ORIGIN:
            self.send_header('Access-Control-Allow-Origin', ORIGIN)
        self.send_header('Vary', 'Origin')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Type', 'application/json')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def allowed(self):
        return self.headers.get('Host') == '127.0.0.1:8788' and self.headers.get('Origin') in (None, ORIGIN)

    def do_OPTIONS(self):
        if not self.allowed():
            return self.reply(403, {'error': 'origin_denied'})
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', ORIGIN)
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-FreeMyTV-Local')
        self.end_headers()

    def call(self, method, path, body=None):
        global retry_at
        if not self.allowed():
            return self.reply(403, {'error': 'origin_denied'})
        token = os.environ.get('SPOTIFY_ACCESS_TOKEN', '')
        if not token:
            return self.reply(503, {'error': 'token_missing'})
        with lock:
            remaining = max(0, int(retry_at - time.time()) + 1)
            if remaining:
                return self.reply(429, {'error': 'rate_limited', 'retry_after': remaining})
            headers = {'Authorization': 'Bearer ' + token, 'Accept': 'application/json'}
            request = urllib.request.Request('https://api.spotify.com/v1' + path,
                                            data=json.dumps(body).encode() if body else None, headers=dict(headers, **{'Content-Type': 'application/json'}), method=method)
            try:
                with urllib.request.urlopen(request, timeout=12) as response:
                    value = json.loads(response.read() or '{}')
                    # Do not expose profile identity to the preview; only capability data.
                    if path == '/me':
                        value = {'subscription': value.get('product')}
                    self.reply(200, value)
            except urllib.error.HTTPError as error:
                if error.code == 429:
                    try:
                        seconds = max(1, int(error.headers.get('Retry-After', '60')))
                    except ValueError:
                        seconds = 60
                    retry_at = time.time() + seconds
                    self.reply(429, {'error': 'rate_limited', 'retry_after': seconds})
                else:
                    labels = {401: 'token_expired_or_invalid', 403: 'permission_required',
                              404: 'no_active_device'}
                    self.reply(error.code, {'error': labels.get(error.code, 'spotify_request_failed')})
            except Exception:
                self.reply(502, {'error': 'spotify_unreachable'})

    def do_GET(self):
        if not self.allowed():
            return self.reply(403, {'error': 'origin_denied'})
        if self.path == '/token':
            if self.headers.get('Origin') != ORIGIN or self.headers.get('X-FreeMyTV-Local') != '1':
                return self.reply(403, {'error': 'origin_denied'})
            token = os.environ.get('SPOTIFY_ACCESS_TOKEN', '')
            return self.reply(200 if token else 503, {'access_token': token} if token else {'error': 'token_missing'})
        if self.path == '/health':
            return self.reply(200, {'token_configured': bool(os.environ.get('SPOTIFY_ACCESS_TOKEN')),
                                    'storage': 'process_environment_only',
                                    'retry_after': max(0, int(retry_at - time.time()) + 1)})
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path == '/search':
            query = urllib.parse.parse_qs(parsed.query).get('q', [''])[0].strip()[:120]
            if not query:
                return self.reply(400, {'error': 'query_required'})
            return self.call('GET', '/search?' + urllib.parse.urlencode({'q': query, 'type': 'track', 'limit': 10}))
        if self.path not in ROUTES:
            return self.reply(404, {'error': 'route_not_found'})
        self.call('GET', ROUTES[self.path])

    def do_POST(self):
        # Custom header forces cross-origin requests through a validated preflight.
        if not self.allowed() or self.headers.get('X-FreeMyTV-Local') != '1':
            return self.reply(403, {'error': 'origin_denied'})
        command = COMMANDS.get(self.path)
        if not command:
            return self.reply(404, {'error': 'route_not_found'})
        if self.path == '/play':
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if size < 1 or size > 4096:
                    raise ValueError()
                value = json.loads(self.rfile.read(size))
                uri, device = value.get('uri', ''), value.get('device_id', '')
                if not re.fullmatch(r'spotify:track:[A-Za-z0-9]{22}', uri) or not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', device):
                    raise ValueError()
            except (ValueError, TypeError, AttributeError):
                return self.reply(400, {'error': 'invalid_track_or_device'})
            return self.call('PUT', '/me/player/play?' + urllib.parse.urlencode({'device_id': device}), {'uris': [uri]})
        self.call(*command)


if __name__ == '__main__':
    if not os.environ.get('SPOTIFY_ACCESS_TOKEN'):
        raise SystemExit('Set SPOTIFY_ACCESS_TOKEN in the process environment before starting.')
    server = ThreadingHTTPServer(('127.0.0.1', 8788), Handler)
    print('Spotify local bridge ready on 127.0.0.1:8788; token held in process environment only.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
