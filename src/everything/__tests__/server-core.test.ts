import { z } from 'zod';
import { jest } from '@jest/globals';
import { createServer } from '../everything.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

describe('Everything server (in-process)', () => {
  let server: ReturnType<typeof createServer>['server'];
  let cleanup: () => Promise<void>;

  let client: Client;

  beforeEach(async () => {
    ({ server, cleanup } = createServer());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: 'test', version: '1.0' }, { capabilities: {} });
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
    await cleanup();
  });

  test('tools/list exposes all tools', async () => {
    const res = await client.request(
      { method: 'tools/list', params: {} },
      z.any()
    );
    expect(res.tools.length).toBeGreaterThanOrEqual(10);
    expect(res.tools.map((t: any) => t.name)).toContain('echo');
  });

  test('callTool:add returns correct sum', async () => {
    const res = await client.request(
      {
        method: 'tools/call',
        params: { name: 'add', arguments: { a: 2, b: 3 } }
      },
      z.any()
    );
    expect(res.content[0].text).toMatch('5');
  });

  test('longRunningOperation emits progress events', async () => {
    jest.useFakeTimers();
    const spy = jest.spyOn(server, 'notification');

    const promise = client.request(
      {
        method: 'tools/call',
        params: {
          name: 'longRunningOperation',
          arguments: { duration: 4, steps: 4 },
          _meta: { progressToken: 'tok' }
        }
      },
      z.any()
    );

    await jest.advanceTimersByTimeAsync(4000);
    await promise;

    const progressEvents = spy.mock.calls.filter(
      ([msg]) => msg.method === 'notifications/progress'
    );
    expect(progressEvents).toHaveLength(4);

    jest.useRealTimers();
  });
});
