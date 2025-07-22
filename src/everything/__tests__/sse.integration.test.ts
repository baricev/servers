import { execa } from 'execa';
import fetch from 'node-fetch';

describe('SSE transport (HTTP)', () => {
  const PORT = '3101';
  let server: execa.ExecaChildProcess;

  beforeAll(async () => {
    server = execa('node', [new URL('../dist/sse.js', import.meta.url).pathname], {
      env: { PORT },
      cwd: new URL('..', import.meta.url).pathname,
      stderr: 'inherit'
    });
    await new Promise(r => setTimeout(r, 500));
  });

  afterAll(() => server.kill('SIGINT', { forceKillAfterTimeout: 1000 }));

  it('handles GET /sse + POST /message', async () => {
    const res = await fetch(`http://localhost:${PORT}/sse`);
    expect(res.ok).toBeTruthy();

    const firstChunk: Buffer = await new Promise(resolve =>
      (res.body as any).once('data', (c: Buffer) => resolve(c))
    );
    const line = firstChunk.toString();
    const match = line.match(/sessionId=([^\\n]+)/);
    const sessionId = match ? match[1] : '';

    expect(sessionId).not.toBe('');
    const rpc = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'add', arguments: { a: 1, b: 2 } }
    };

    const r = await fetch(`http://localhost:${PORT}/message?sessionId=${sessionId}`,
    {
      method: 'POST',
      body: JSON.stringify(rpc),
      headers: { 'content-type': 'application/json' }
    });
    expect(r.status).toBe(202);

    expect(sessionId).not.toBe('');
  }, 15000);
});
