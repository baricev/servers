

// Dynamic imports are used for SDK modules to avoid TypeScript resolution issues
const sdk = {
  async client() {
    const mod = await import('@modelcontextprotocol/sdk/client/index.js');
    return mod.Client;
  },
  async transport() {
    const mod = await import('@modelcontextprotocol/sdk/inMemory.js');
    return mod.InMemoryTransport;
  },
};

type TestContext = {
  client: any;
  server: any;
  cleanup: () => Promise<void>;
};

async function setup(): Promise<TestContext> {
  // @ts-ignore
  const mod: any = await import('../dist/everything.js');
  const { server, cleanup } = mod.createServer();
  const Client = await sdk.client();
  const InMemoryTransport = await sdk.transport();
  const client = new Client(
    { name: 'test-client', version: '1.0.0' },
    { capabilities: { sampling: {} } }
  );
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server, cleanup };
}

describe('Everything server', () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await setup();
  });

  afterEach(async () => {
    await ctx.client.close();
    await ctx.server.close();
    await ctx.cleanup();
  });

  it('lists resources with pagination', async () => {
    const res = await ctx.client.listResources();
    expect(res.resources.length).toBe(10);
    expect(res.nextCursor).toBeDefined();
  });

  it('reads text and blob resources', async () => {
    const textRes = await ctx.client.readResource({ uri: 'test://static/resource/2' });
    expect(textRes.contents[0].text).toContain('Resource 2: This is a plaintext resource');

    const blobRes = await ctx.client.readResource({ uri: 'test://static/resource/1' });
    expect(blobRes.contents[0].blob).toBeDefined();
    expect(typeof blobRes.contents[0].blob).toBe('string');
  });

  it('lists available prompts', async () => {
    const res = await ctx.client.listPrompts();
    const names = res.prompts.map((p: any) => p.name);
    expect(names).toEqual(expect.arrayContaining(['simple_prompt', 'complex_prompt', 'resource_prompt']));
  });

  it('retrieves simple prompt', async () => {
    const res = await ctx.client.getPrompt({ name: 'simple_prompt' });
    expect(res.messages[0].content.text).toContain('simple prompt');
  });

  it('lists available tools', async () => {
    const res = await ctx.client.listTools();
    const names = res.tools.map((t: any) => t.name);
    expect(names).toEqual(expect.arrayContaining(['echo', 'add', 'getTinyImage']));
  });

  it('echo tool responds with provided message', async () => {
    const res = await ctx.client.callTool({ name: 'echo', arguments: { message: 'hello' } });
    expect(res.content[0]).toEqual({ type: 'text', text: 'Echo: hello' });
  });

  it('add tool sums numbers', async () => {
    const res = await ctx.client.callTool({ name: 'add', arguments: { a: 2, b: 3 } });
    expect(res.content[0].text).toContain('5');
  });

  it('getTinyImage tool returns image content', async () => {
    const res = await ctx.client.callTool({ name: 'getTinyImage', arguments: {} });
    expect(res.content.some((c: any) => c.type === 'image')).toBe(true);
  });

  it('completion provides suggestions for resource IDs', async () => {
    const res = await ctx.client.complete({
      ref: { type: 'ref/resource', uri: 'test://static/resource/1' },
      argument: { name: 'resourceId', value: '1' },
    });
    expect(res.completion.values).toEqual(expect.arrayContaining(['1']));
  });
});
