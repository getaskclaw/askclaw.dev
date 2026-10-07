"""Exercise the generated redirect include with a real loopback-only Caddy.

CADDY_BIN may point at a downloaded binary. Missing Caddy is a gate failure,
not a reason to treat HTML refresh/our test HTTP server as proof of HTTP 301.
"""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def verify_redirects(dist, base, expected):
    dist = Path(dist).resolve()
    manifest = json.loads((dist / '_en-first-redirects.json').read_text())
    assert manifest['schema'] == 'en-first-redirects-v1'
    assert manifest['base'] == base and manifest['status'] == 301
    assert manifest['redirects'] == expected, 'redirect inventory differs from source-derived routes'
    legacy = sorted(p for p in expected if p.startswith('/en/'))
    assert manifest['legacyEnglish'] == legacy and len(legacy) == len(set(legacy))
    binary = os.environ.get('CADDY_BIN') or shutil.which('caddy')
    assert binary, 'Install Caddy or set CADDY_BIN; actual HTTP 301 is required'
    prefix = base.rstrip('/')
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1', 0))
        port = reservation.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    direct = build_opener(ProxyHandler({}), NoRedirect())
    follow = build_opener(ProxyHandler({}))
    checks = []
    with tempfile.TemporaryDirectory(prefix='en-first-caddy-') as tmp:
        config = Path(tmp) / 'Caddyfile'
        serving = f'root * "{dist}"\nfile_server'
        if prefix:
            serving = f'handle_path {base}* {{\n{serving}\n}}'
        config.write_text(f'{{\nadmin off\nauto_https off\n}}\nhttp://127.0.0.1:{port} {{\nimport "{dist / "_en-first.caddy"}"\n{serving}\n}}\n')
        validation = subprocess.run([binary, 'validate', '--adapter', 'caddyfile', '--config', str(config)], capture_output=True, text=True)
        assert validation.returncode == 0, validation.stdout + validation.stderr
        with (Path(tmp) / 'caddy.log').open('w+') as log:
            process = subprocess.Popen([binary, 'run', '--adapter', 'caddyfile', '--config', str(config)], stdout=log, stderr=log)
            try:
                deadline = time.monotonic() + 10
                while True:
                    try:
                        with follow.open(origin + base, timeout=1) as response:
                            assert response.status == 200
                        break
                    except (URLError, TimeoutError):
                        if process.poll() is not None or time.monotonic() >= deadline:
                            log.seek(0)
                            raise AssertionError('Local Caddy did not become ready: ' + log.read())
                        time.sleep(0.05)
                for source, destination in sorted(expected.items()):
                    path, mark, fragment = destination.partition('#')
                    for variant in [source, source.rstrip('/'), source + 'index.html']:
                        for query in ['', '?q=GPT%20x&axes=build%2Cops&x=1&x=2']:
                            wanted = prefix + path + query + (mark + fragment if mark else '')
                            for method in ['GET', 'HEAD']:
                                request = Request(origin + prefix + variant + query, method=method)
                                try:
                                    response = direct.open(request, timeout=5)
                                except HTTPError as error:
                                    response = error
                                with response:
                                    location = response.headers.get('Location')
                                    assert response.code == 301 and location == wanted, (variant, method, response.code, location, wanted)
                                    checks.append({'path': prefix + variant + query, 'method': method, 'status': response.code, 'location': location})
                    # Follow every complete legacy chain: no 404, loop or meta-refresh-only alias.
                    with follow.open(origin + prefix + source + '?keep=1', timeout=5) as response:
                        assert response.status == 200, source
                        html = response.read().decode()
                        assert '<meta http-equiv="refresh"' not in html, (source, 'chain ended on HTML refresh')
                        assert urlsplit(response.geturl()).query == 'keep=1', source
                        lang = 'zh-CN' if source.startswith('/zh/') or source in ['/method/', '/notes/', '/notes/agent-is-new-software/'] else 'en'
                        assert f'<html lang="{lang}"' in html, (source, lang)
                        if fragment:
                            assert f'id="{fragment}"' in html, (source, fragment)
                # Prefix stripping is bounded to /en/, not /english/ or unrelated paths.
                for source in ['/en/not-a-real-page/', '/english/not-a-real-page/']:
                    try:
                        response = direct.open(origin + prefix + source, timeout=5)
                    except HTTPError as error:
                        response = error
                    with response:
                        assert response.code == (301 if source.startswith('/en/') else 404), source
                return {'server': subprocess.check_output([binary, 'version'], text=True).strip(),
                        'base': base, 'legacy_english_count': len(legacy), 'mapping_count': len(expected),
                        'http_checks': len(checks), 'checks': checks, 'all_chains_reachable': True}
            finally:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
