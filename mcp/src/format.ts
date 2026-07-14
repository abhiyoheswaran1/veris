export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export function json(value: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export function fail(message: string): ToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function root(input: { path?: string }): string {
  return input.path ?? process.cwd();
}
