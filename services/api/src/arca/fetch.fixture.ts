const HTTP_OK = 200;

export interface CapturedRequest {
  url: string;
  body: string;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function stubFetchResponse(body: string, status: number = HTTP_OK): void {
  global.fetch = (): Promise<Response> => Promise.resolve(new Response(body, { status }));
}

export function captureFetchRequests(responseBody: string): CapturedRequest[] {
  const captured: CapturedRequest[] = [];
  global.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    captured.push({ url: requestUrl(input), body: typeof init?.body === "string" ? init.body : "" });
    return Promise.resolve(new Response(responseBody, { status: HTTP_OK }));
  };
  return captured;
}
