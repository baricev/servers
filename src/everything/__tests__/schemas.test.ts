import { z } from 'zod';
import { EchoSchema, AddSchema, ToolName } from '../everything.js';

describe('Schema contracts', () => {
  it('EchoSchema validates correct payload', () => {
    expect(EchoSchema.parse({ message: 'hi' }).message).toBe('hi');
  });

  it('EchoSchema rejects missing message', () => {
    expect(() => EchoSchema.parse({} as unknown as z.input<typeof EchoSchema>))
      .toThrow();
  });

  it('AddSchema sums two numbers', () => {
    const parsed = AddSchema.parse({ a: 2, b: 3 });
    expect(parsed).toEqual({ a: 2, b: 3 });
  });
});

describe('ToolName enum', () => {
  const expected = [
    'echo',
    'add',
    'longRunningOperation',
    'printEnv',
    'sampleLLM',
    'getTinyImage',
    'annotatedMessage',
    'getResourceReference',
    'startElicitation',
    'getResourceLinks'
  ];
  it('contains all declared tools', () => {
    expect(Object.values(ToolName)).toEqual(expect.arrayContaining(expected));
  });
});
