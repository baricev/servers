import { execa } from 'execa';
import request from 'supertest';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { ToolName } from '../everything.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Streamable HTTP add tool', () => {
  const PORT = 4100;
  let server: any;

  beforeAll(async () => {
    server = execa('node', ['dist/streamableHttp.js'], {
      cwd: path.join(__dirname, '..'),
      env: { PORT: String(PORT) },
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('server start timeout')), 5000);
      server.stderr?.on('data', (data: Buffer) => {
        if (data.toString().includes(`listening on port ${PORT}`)) {
          clearTimeout(timeout);
          resolve(null);
        }
      });
    });
  }, 10000);

  afterAll(() => {
    if (server) server.kill();
  });

  it('returns sum of numbers', async () => {
    const initRes = await request(`http://localhost:${PORT}`)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' },
        },
      })
      .expect(200);
    const sessionId = initRes.headers['mcp-session-id'];

    const addRes = await request(`http://localhost:${PORT}`)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .set('mcp-session-id', sessionId)
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: ToolName.ADD,
          arguments: { a: 2, b: 3 },
        },
      })
      .expect(200);

    expect(addRes.body.result.content[0].text).toContain('5');
  }, 15000);
});
