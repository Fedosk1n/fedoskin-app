"""Drive the festival UI at 30 virtual frames per second in an isolated mobile Chromium."""
import argparse
import json
from pathlib import Path
from threading import Thread
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--limit', type=int, default=60)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    with ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=root)) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        host = f'127.0.0.1:{server.server_port}'
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            page = browser.new_page(viewport={'width': 393, 'height': 852},
                                    is_mobile=True, has_touch=True, service_workers='block')
            errors = []
            outbound = []

            def route(interception):
                request = interception.request
                address = urlsplit(request.url)
                if address.netloc != host or request.method != 'GET':
                    outbound.append((request.method, request.url))
                    interception.abort()
                elif address.path == '/story-stage-audit':
                    interception.fulfill(content_type='text/html; charset=utf-8', body='''<!doctype html>
                        <html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1">
                        <script type="module" src="/tools/test_story_stage_runtime.mjs"></script><body></body></html>''')
                else:
                    interception.continue_()

            page.route('**/*', route)
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(f'http://{host}/story-stage-audit', wait_until='domcontentloaded')
            page.wait_for_function('window.storyStageAudit', timeout=30000)
            report = {
                'coverage': 'Actual festival DOM and keyboard handlers; simulated walking, district remount, 3D callbacks and 30 fps virtual clock; audio intentionally muted and external networking blocked.',
                'prologue': 'Covered in test_story_stage_audit.mjs as an ordered save/reward state machine.',
                'episodes': [], 'errors': errors, 'externalRequests': outbound,
            }
            try:
                for number in range(1, args.limit + 1):
                    stage = page.evaluate('() => storyStageAudit.runEpisode()')
                    assert stage['episode'] == number
                    report['episodes'].append(stage)
                    print(number, stage['title'], stage['stageMetrics']['active']['frames'],
                          'frames, active max', round(stage['stageMetrics']['active']['maxMs'], 2),
                          'ms,', stage['saveCount'], 'saves', flush=True)
                if args.limit == 60:
                    report['exams'] = page.evaluate('() => storyStageAudit.runExams()')
                report['totals'] = page.evaluate('() => storyStageAudit.totals()')
                assert not errors and not outbound, (errors, outbound)
            finally:
                args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
                browser.close()
        server.shutdown()


if __name__ == '__main__':
    main()
