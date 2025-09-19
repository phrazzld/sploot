import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Polyfill Request and Response for Next.js API routes testing
if (!global.Request) {
  global.Request = class Request {
    url: string;
    method: string;
    headers: Headers;
    body: any;

    constructor(input: string | Request, init?: RequestInit) {
      if (typeof input === 'string') {
        this.url = input;
      } else {
        this.url = input.url;
      }
      this.method = init?.method || 'GET';
      this.headers = new Headers(init?.headers);
      this.body = init?.body;
    }

    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body);
      }
      return this.body;
    }

    async text() {
      if (typeof this.body === 'string') {
        return this.body;
      }
      return JSON.stringify(this.body);
    }

    clone() {
      return new Request(this.url, {
        method: this.method,
        headers: this.headers,
        body: this.body,
      });
    }
  } as any;
}

if (!global.Response) {
  global.Response = class Response {
    body: any;
    status: number;
    statusText: string;
    headers: Headers;
    ok: boolean;

    constructor(body?: any, init?: ResponseInit) {
      this.body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new Headers(init?.headers);
      this.ok = this.status >= 200 && this.status < 300;
    }

    async json() {
      if (typeof this.body === 'string') {
        return JSON.parse(this.body);
      }
      return this.body;
    }

    async text() {
      if (typeof this.body === 'string') {
        return this.body;
      }
      return JSON.stringify(this.body);
    }

    clone() {
      return new Response(this.body, {
        status: this.status,
        statusText: this.statusText,
        headers: this.headers,
      });
    }
  } as any;
}

if (!global.Headers) {
  global.Headers = class Headers {
    private headers: Map<string, string> = new Map();

    constructor(init?: HeadersInit) {
      if (init) {
        if (Array.isArray(init)) {
          init.forEach(([key, value]) => this.set(key, value));
        } else if (init instanceof Headers) {
          init.forEach((value, key) => this.set(key, value));
        } else {
          Object.entries(init).forEach(([key, value]) => this.set(key, value as string));
        }
      }
    }

    set(key: string, value: string) {
      this.headers.set(key.toLowerCase(), value);
    }

    get(key: string) {
      return this.headers.get(key.toLowerCase()) || null;
    }

    has(key: string) {
      return this.headers.has(key.toLowerCase());
    }

    delete(key: string) {
      this.headers.delete(key.toLowerCase());
    }

    forEach(callback: (value: string, key: string) => void) {
      this.headers.forEach((value, key) => callback(value, key));
    }

    entries() {
      return this.headers.entries();
    }

    keys() {
      return this.headers.keys();
    }

    values() {
      return this.headers.values();
    }
  } as any;
}

// Mock environment variables
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_mock';
process.env.CLERK_SECRET_KEY = 'sk_test_mock';
process.env.BLOB_READ_WRITE_TOKEN = 'mock_blob_token';
process.env.POSTGRES_URL = 'postgresql://mock:mock@localhost:5432/mock';
process.env.POSTGRES_URL_NON_POOLING = 'postgresql://mock:mock@localhost:5432/mock';
process.env.REPLICATE_API_TOKEN = 'r8_mock_token';
// Redis removed - using in-memory cache only

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock crypto
global.crypto = {
  randomUUID: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9),
  subtle: {
    digest: jest.fn().mockResolvedValue(new ArrayBuffer(32)),
  },
} as any;

// Mock NextResponse
jest.mock('next/server', () => {
  const actualNext = jest.requireActual('next/server');
  return {
    ...actualNext,
    NextRequest: class NextRequest {
      url: string;
      method: string;
      headers: Headers;
      body: any;
      nextUrl: any;

      constructor(input: string | URL | Request, init?: RequestInit) {
        if (typeof input === 'string') {
          this.url = input;
        } else if (input instanceof URL) {
          this.url = input.href;
        } else {
          this.url = input.url || 'http://localhost:3000';
        }
        this.method = init?.method || 'GET';
        this.headers = new Headers(init?.headers);
        this.body = init?.body;
        const url = new URL(this.url);
        this.nextUrl = {
          searchParams: url.searchParams,
          pathname: url.pathname,
          href: url.href,
        };
      }

      async json() {
        if (typeof this.body === 'string') {
          return JSON.parse(this.body);
        }
        return this.body;
      }

      async text() {
        if (typeof this.body === 'string') {
          return this.body;
        }
        return JSON.stringify(this.body);
      }

      clone() {
        return new NextRequest(this.url, {
          method: this.method,
          headers: this.headers,
          body: this.body,
        });
      }
    },
    NextResponse: class NextResponse extends Response {
      static json(body: any, init?: ResponseInit) {
        const response = new Response(JSON.stringify(body), {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            ...(init?.headers || {}),
          },
        });
        // Add json method to the response instance
        (response as any).json = async () => body;
        return response;
      }

      static redirect(url: string | URL, status?: number) {
        return new Response(null, {
          status: status || 302,
          headers: {
            Location: url.toString(),
          },
        });
      }
    },
  };
});