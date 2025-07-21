import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createServer } from '../everything.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  CompleteRequestSchema,
  SetLevelRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

let server: any;
let cleanup: () => Promise<void>;

const invoke = async (schema: any, params: any = {}, extra?: any) => {
  const handler = server._requestHandlers.get(schema.shape.method.value);
  if (!handler) throw new Error(`No handler for ${schema.shape.method.value}`);
  return await handler({ method: schema.shape.method.value, params }, extra);
};

beforeEach(() => {
  ({ server, cleanup } = createServer());
});

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

describe('tools', () => {
  it('lists available tools', async () => {
    const result = await invoke(ListToolsRequestSchema);
    expect(result.tools.map((t: any) => t.name)).toContain('echo');
  });

  it('echo tool returns message', async () => {
    const result = await invoke(CallToolRequestSchema, { name: 'echo', arguments: { message: 'hi' } });
    expect(result.content[0]).toEqual({ type: 'text', text: 'Echo: hi' });
  });

  it('add tool sums numbers', async () => {
    const result = await invoke(CallToolRequestSchema, { name: 'add', arguments: { a: 2, b: 3 } });
    expect(result.content[0].text).toContain('5');
  });

  it('longRunningOperation sends progress updates', async () => {
    const notify = jest.spyOn(server, 'notification').mockResolvedValue(undefined as any);
    await invoke(CallToolRequestSchema, {
      name: 'longRunningOperation',
      arguments: { duration: 0, steps: 3 },
      _meta: { progressToken: '1' },
    });
    expect(notify).toHaveBeenCalledTimes(3);
  });

  it('printEnv returns environment variables', async () => {
    const result = await invoke(CallToolRequestSchema, { name: 'printEnv', arguments: {} });
    const env = JSON.parse(result.content[0].text);
    expect(env).toHaveProperty('PATH');
  });

  it('sampleLLM uses sampling request', async () => {
    const req = jest.spyOn(server, 'request').mockResolvedValue({ content: { text: 'result' } } as any);
    const result = await invoke(CallToolRequestSchema, { name: 'sampleLLM', arguments: { prompt: 'Hi', maxTokens: 5 } });
    expect(req).toHaveBeenCalled();
    expect(result.content[0].text).toContain('result');
  });

  it('getTinyImage returns image content', async () => {
    const result = await invoke(CallToolRequestSchema, { name: 'getTinyImage', arguments: {} });
    const hasImage = result.content.some((c: any) => c.type === 'image');
    expect(hasImage).toBe(true);
  });

  it('annotatedMessage includes annotations', async () => {
    const result = await invoke(CallToolRequestSchema, { name: 'annotatedMessage', arguments: { messageType: 'error', includeImage: false } });
    expect(result.content[0].annotations.priority).toBe(1.0);
  });

  it('getResourceReference returns resource content', async () => {
    const result = await invoke(CallToolRequestSchema, { name: 'getResourceReference', arguments: { resourceId: 1 } });
    const res = result.content.find((c: any) => c.type === 'resource');
    expect(res).toBeDefined();
  });

  it('startElicitation handles accept result', async () => {
    jest.spyOn(server, 'request').mockResolvedValue({ action: 'accept', content: { color: 'red', number: 7, pets: 'cats' } } as any);
    const result = await invoke(CallToolRequestSchema, { name: 'startElicitation', arguments: {} });
    expect(result.content[0].text).toContain('User provided');
  });

  it('getResourceLinks returns resource links', async () => {
    const result = await invoke(CallToolRequestSchema, { name: 'getResourceLinks', arguments: { count: 2 } });
    const links = result.content.filter((c: any) => c.type === 'resource_link');
    expect(links).toHaveLength(2);
  });
});

describe('resources', () => {
  it('lists resources with pagination', async () => {
    const first = await invoke(ListResourcesRequestSchema);
    expect(first.resources).toHaveLength(10);
    expect(first.nextCursor).toBeDefined();

    const second = await invoke(ListResourcesRequestSchema, { cursor: first.nextCursor });
    expect(second.resources[0].uri).not.toBe(first.resources[0].uri);
  });

  it('reads individual resources', async () => {
    const result = await invoke(ReadResourceRequestSchema, { uri: 'test://static/resource/2' });
    expect(result.contents[0]).toHaveProperty('uri', 'test://static/resource/2');
  });

  it('lists resource templates', async () => {
    const result = await invoke(ListResourceTemplatesRequestSchema);
    expect(result.resourceTemplates[0].uriTemplate).toContain('{id}');
  });

  it('subscribe triggers sampling request', async () => {
    const req = jest.spyOn(server, 'request').mockResolvedValue({} as any);
    await invoke(SubscribeRequestSchema, { uri: 'test://static/resource/1' });
    expect(req).toHaveBeenCalled();
    await invoke(UnsubscribeRequestSchema, { uri: 'test://static/resource/1' });
  });
});

describe('prompts and completions', () => {
  it('lists prompts', async () => {
    const result = await invoke(ListPromptsRequestSchema);
    expect(result.prompts.map((p: any) => p.name)).toContain('simple_prompt');
  });

  it('gets simple prompt', async () => {
    const result = await invoke(GetPromptRequestSchema, { name: 'simple_prompt' });
    expect(result.messages[0].content.text).toContain('simple prompt');
  });

  it('gets complex prompt with args', async () => {
    const result = await invoke(GetPromptRequestSchema, { name: 'complex_prompt', arguments: { temperature: '0.5', style: 'casual' } });
    expect(result.messages[0].content.text).toContain('complex prompt');
  });

  it('completes prompt arguments', async () => {
    const result = await invoke(CompleteRequestSchema, { ref: { type: 'ref/prompt', name: 'complex_prompt' }, argument: { name: 'style', value: 'c' } });
    expect(result.completion.values.some((v: string) => v.startsWith('c'))).toBe(true);
  });
});

describe('logging', () => {
  it('setLevel sends notification', async () => {
    const notify = jest.spyOn(server, 'notification').mockResolvedValue(undefined as any);
    await invoke(SetLevelRequestSchema, { level: 'warning' });
    expect(notify).toHaveBeenCalled();
  });
});
