import { execa } from 'execa';
import readline from 'node:readline';

function jsonLine<T>(id: number, method: string, params: unknown = {}) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
}

describe('STDIO transport (child process)', () => {
  const bin = new URL('../dist/index.js', import.meta.url).pathname;
  let child: execa.ExecaChildProcess;

  beforeAll(() => {
    child = execa('node', [bin, 'stdio'], { cwd: new URL('..', import.meta.url).pathname });
  });

  afterAll(async () => {
    child.kill('SIGINT', { forceKillAfterTimeout: 1000 });
    await child;
  });

  const ask = async <T = unknown>(payload: string): Promise<T> => {
    child.stdin!.write(payload);
    const rl = readline.createInterface({ input: child.stdout! });
    for await (const line of rl) {
      const msg = JSON.parse(line) as T & { id?: number };
      if ((msg as any).id === JSON.parse(payload).id) {
        rl.close();
        return msg;
      }
    }
    throw new Error('No response');
  };

  it('lists tools & calls add', async () => {
    const list = await ask<{ result: { tools: { name: string }[] } }>(jsonLine(1, 'tools/list'));
    expect(list.result.tools.map(t => t.name)).toContain('add');

    const add = await ask<{ result: { content: { text: string }[] } }>(
      jsonLine(2, 'tools/call', { name: 'add', arguments: { a: 7, b: 3 } })
    );
    expect(add.result.content[0].text).toMatch('10');
  }, 10000);
});
