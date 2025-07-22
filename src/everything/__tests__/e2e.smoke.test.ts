import { execa } from 'execa';
import fetch from 'node-fetch';
import { createParser } from 'eventsource-parser';

describe('E2E journey on Streamable HTTP', () => {
  const PORT = '3103';
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

  const initSession = async () => {
    const r = await fetch(`http://localhost:${PORT}/mcp`, {
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
    return r.headers.get('mcp-session-id')!;
  };

  it('smoke, concurrency & resumability', async () => {
    const sessionId = await initSession();

    const longOp = (i: number) =>
      fetch(`http://localhost:${PORT}/mcp`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'mcp-session-id': sessionId,
          Accept: 'application/json, text/event-stream'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 100 + i,
          method: 'tools/call',
          params: {
            name: 'longRunningOperation',
            arguments: { duration: 1, steps: 2 },
            _meta: { progressToken: `tok-${i}` }
          }
        })
      });

    await Promise.all([...Array(10).keys()].map(longOp));

    const stream1 = await fetch(`http://localhost:${PORT}/mcp`, {
      method: 'GET',
      headers: { 'mcp-session-id': sessionId, Accept: 'text/event-stream' }
    });
    let lastId = '';
    const parser = createParser(ev => (lastId = ev.id ?? lastId));
    for await (const chunk of stream1.body as any as AsyncIterable<Buffer>) {
      parser.feed(chunk.toString());
      if (lastId) break;
    }
    (stream1.body as any).destroy();

    const stream2 = await fetch(`http://localhost:${PORT}/mcp`, {
      method: 'GET',
      headers: {
        'mcp-session-id': sessionId,
        'last-event-id': lastId,
        Accept: 'text/event-stream'
      }
    });
    expect(stream2.status).toBe(200);
    (stream2.body as any).destroy();
  }, 30000);
});
