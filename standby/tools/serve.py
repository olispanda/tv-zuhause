"""Browser preview for the standby map: serves app/standby/ and proxies adsb.fi and adsb.lol (neither sends CORS headers).

Usage: python3 tools/serve.py  ->  http://127.0.0.1:8791/
"""
import http.server
import pathlib
import socketserver
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2] / 'app' / 'standby'   # the map lives inside the CleanFrame app
PORT = 8791
PROXIES = {'/proxy/adsbfi/': 'https://opendata.adsb.fi/api/', '/proxy/adsb/': 'https://api.adsb.lol/'}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        for prefix, upstream in PROXIES.items():
            if self.path.startswith(prefix):
                return self.proxy(upstream + self.path[len(prefix):])
        return super().do_GET()

    def proxy(self, url):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'hb-standby-preview/0.1', 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=10) as res:
                body = res.read()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except urllib.error.HTTPError as err:  # pass the status and rate-limit hints on, so the page can pause that source
            self.send_response(err.code)
            for name in ('Retry-After', 'X-RateLimit-Reset', 'X-RateLimit-Remaining'):
                if err.headers.get(name):
                    self.send_header(name, err.headers[name])
            self.send_header('Content-Length', '0')
            self.end_headers()
        except Exception as err:  # upstream down or slow: report, the page keeps running
            self.send_error(502, str(err))

    def log_message(self, fmt, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == '__main__':
    with Server(('127.0.0.1', PORT), Handler) as httpd:
        print(f'Zürich HB Live: http://127.0.0.1:{PORT}/')
        httpd.serve_forever()
