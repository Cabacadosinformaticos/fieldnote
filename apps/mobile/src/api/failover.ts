// Requests go to the gateway currently preferred. A network error or an HTTP 502, 503 or 504
// makes the next gateway try the same request once; if it answers, it becomes the preferred one.
// The load generator keeps the same rule (tools/loadgen/src/loadgen/client.py).

const ATTEMPT_TIMEOUT_MS = 10_000;
const GATEWAY_FAILURE_STATUSES = new Set([502, 503, 504]);

type RequestWithBody = Request & { _bodyInit?: BodyInit | null };

/** The origin of a gateway base URL: the address without its trailing `/api/v1`. */
export function gatewayOrigin(baseUrl: string): string {
  return baseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
}

function isGatewayFailure(status: number): boolean {
  return GATEWAY_FAILURE_STATUSES.has(status);
}

function requestTarget(baseUrl: string, request: Request): string {
  const url = new URL(request.url);

  return `${gatewayOrigin(baseUrl)}${url.pathname}${url.search}`;
}

/**
 * The body to send in a new request. React Native keeps it in `_bodyInit`; a browser clone is
 * read as bytes so the body stays reusable and no stream needs a duplex option.
 */
async function requestBody(request: Request): Promise<BodyInit | null | undefined> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;

  const internal = (request as RequestWithBody)._bodyInit;
  if (internal !== undefined) return internal;
  if (request.body === null) return undefined;

  return request.clone().arrayBuffer();
}

/** Clone the request for one gateway, with a signal that also honours the attempt timeout. */
async function send(
  baseUrl: string,
  request: Request,
  callerSignal: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (callerSignal.aborted) {
    controller.abort();
  } else {
    callerSignal.addEventListener('abort', abort);
  }

  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const init: RequestInit = {
      method: request.method,
      headers: request.headers,
      body: await requestBody(request),
      credentials: request.credentials,
      redirect: request.redirect,
      signal: controller.signal,
    };

    return await fetch(requestTarget(baseUrl, request), init);
  } finally {
    clearTimeout(timer);
    callerSignal.removeEventListener('abort', abort);
  }
}

/**
 * Build the `fetch` every openapi-fetch client uses. The preferred gateway is held in memory and
 * starts as the first address of the list.
 */
export function createFailoverFetch(baseUrls: readonly string[]): (input: Request) => Promise<Response> {
  const gateways = baseUrls.map((url) => url.trim().replace(/\/$/, '')).filter((url) => url.length > 0);
  let preferred = 0;

  return async function failoverFetch(input: Request): Promise<Response> {
    if (gateways.length === 0) {
      throw new Error('No API gateway is configured.');
    }

    const attempts = [preferred];
    if (gateways.length > 1) {
      attempts.push((preferred + 1) % gateways.length);
    }

    let lastResponse: Response | null = null;
    let lastError: unknown = null;

    for (let index = 0; index < attempts.length; index += 1) {
      const gateway = attempts[index];

      try {
        const response = await send(gateways[gateway], input, input.signal);

        if (!isGatewayFailure(response.status)) {
          preferred = gateway;
          return response;
        }

        lastResponse = response;
        lastError = null;
      } catch (error) {
        // A caller that cancelled itself must not be retried on another gateway.
        if (input.signal.aborted) throw error;

        lastResponse = null;
        lastError = error;
      }
    }

    if (lastResponse) return lastResponse;
    throw lastError ?? new Error('Every API gateway failed.');
  };
}
