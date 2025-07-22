import { execa } from 'execa';
import fetch from 'node-fetch';

describe('Streamable HTTP transport', () => {
  const PORT = '3102';
  let server: execa.ExecaChildProcess;

  beforeAll(async () => {
    server = execa('node', [new URL('../dist/streamableHttp.js', import.meta.url).pathname], {
      env: { PORT },
      cwd: new URL('..', import.meta.url).pathname,
      stderr: 'inherit'
    });
    await new Promise(r => setTimeout(r, 500));
  });

  afterAll(() => server.kill('SIGINT', { forceKillAfterTimeout: 1000 }));

  it('negotiates session + call echo', async () => {
    const init = await fetch(`http://localhost:${PORT}/mcp`, {
      method: 'POST',
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '1.0',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        }
      }),
      headers: {
        'content-type': 'application/json',
        Accept: 'application/json, text/event-stream'
      }
    });
    const sessionId = init.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    const echoReq = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'echo', arguments: { message: 'hi' } }
    };
    const echoRes = await fetch(`http://localhost:${PORT}/mcp`, {
      method: 'POST',
      body: JSON.stringify(echoReq),
      headers: {
        'content-type': 'application/json',
        'mcp-session-id': sessionId!,
        Accept: 'application/json, text/event-stream'
      }
    }).then(r => r.json());

    expect(echoRes.result.content[0].text).toBe('Echo: hi');
  }, 10000);
});
