import http from "node:http";
import type { AddressInfo } from "node:net";

export interface MockOpenAIServerHandle {
  baseUrl: string;
  setResponse: (
    path: string,
    fn: (req: http.IncomingMessage, body: string) => MockResponse
  ) => void;
  close: () => Promise<void>;
}

export interface MockResponse {
  status: number;
  headers?: Record<string, string>;
  body: string;
}

export async function startMockOpenAIServer(): Promise<MockOpenAIServerHandle> {
  const overrides = new Map<
    string,
    (req: http.IncomingMessage, body: string) => MockResponse
  >();

  const defaultResponse = (
    path: string,
    req: http.IncomingMessage,
    body: string
  ): MockResponse => {
    if (path === "/v1/models") {
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          object: "list",
          data: [
            { id: "normattiva-legal-pro", object: "model", owned_by: "normattiva" },
            { id: "normattiva-legal-lite", object: "model", owned_by: "normattiva" },
          ],
        }),
      };
    }
    if (path === "/v1/chat/completions") {
      const parsed = body ? JSON.parse(body) : {};
      const userMsg = parsed.messages?.findLast?.(
        (m: { role: string }) => m.role === "user"
      )?.content ?? "";
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: 1781230509,
          model: parsed.model ?? "normattiva-legal-pro",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: `Risposta legale di test per: ${userMsg.slice(0, 80)}`,
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 42, completion_tokens: 17, total_tokens: 59 },
          x_normattiva: {
            citations: [
              {
                type: "article",
                ref: "c.c. art. 1456",
                title: "Clausola risolutiva espressa",
                url: "https://example.normattiva.test/codice-civile/art1456",
              },
            ],
            tools_used: ["codici.search", "massime.search"],
            cost_estimate_eur: 0.0123,
          },
        }),
      };
    }
    return { status: 404, body: "not found" };
  };

  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://x");
      const path = url.pathname;
      const handler = overrides.get(path) ?? defaultResponse;
      const resp = handler(path, req, body);
      res.statusCode = resp.status;
      for (const [k, v] of Object.entries(resp.headers ?? {})) {
        res.setHeader(k, v);
      }
      res.end(resp.body);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    setResponse: (path, fn) => overrides.set(path, fn),
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      ),
  };
}
