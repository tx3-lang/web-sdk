import { Client } from '../src/trp/client';
import { createIntArg, createStringArg, createBoolArg } from '../src/trp/args';
import { 
  TrpError, 
  NetworkError, 
  StatusCodeError, 
  JsonRpcError,
  ProtoTxRequest,
  TxEnvelope 
} from '../src/trp/types';

// Mock fetch globally for Node.js environment
global.fetch = jest.fn();

describe('TRP Client Tests', () => {
  let client: Client;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    client = new Client({
      endpoint: 'https://test-endpoint.com/trp',
      headers: {
        'Authorization': 'Bearer test-token'
      }
    });
    mockFetch.mockClear();
  });

  describe('Client Construction', () => {
    test('creates client with basic options', () => {
      const basicClient = new Client({
        endpoint: 'https://api.example.com'
      });
      expect(basicClient).toBeInstanceOf(Client);
    });

    test('creates client with full options', () => {
      const fullClient = new Client({
        endpoint: 'https://api.example.com',
        headers: {
          'Authorization': 'Bearer token',
          'X-Custom-Header': 'value'
        },
        envArgs: {
          network: createStringArg('mainnet'),
          debug: createBoolArg(true)
        }
      });
      expect(fullClient).toBeInstanceOf(Client);
    });
  });

  describe('Successful Resolution', () => {
    test('resolves proto transaction successfully', async () => {
      const mockResponse: TxEnvelope = {
        tx: '84a400d90102838258201234567890abcdef'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          result: mockResponse,
          id: 'test-id'
        })
      } as Response);

      const protoTx: ProtoTxRequest = {
        tir: {
          version: '1.0',
          bytecode: 'test-bytecode',
          encoding: 'base64'
        },
        args: {
          amount: createIntArg(100_000_000),
          recipient: createStringArg('addr1...'),
          active: createBoolArg(true)
        }
      };

      const result = await client.resolve(protoTx);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Verify the request was made correctly
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://test-endpoint.com/trp');
      expect(options?.method).toBe('POST');
      expect(options?.headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token'
      });

      // Verify request body
      const body = JSON.parse(options?.body as string);
      expect(body).toMatchObject({
        jsonrpc: '2.0',
        method: 'trp.resolve',
        params: {
          tir: protoTx.tir,
          args: {
            amount: expect.any(Number),
            recipient: 'addr1...',
            active: true
          }
        }
      });
      expect(body.id).toBeDefined();
    });

    test('includes environment arguments in request', async () => {
      const clientWithEnv = new Client({
        endpoint: 'https://test.com',
        envArgs: {
          network: createStringArg('testnet'),
          fee_multiplier: createIntArg(150)
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          result: { tx: 'mock-tx' },
          id: 'test'
        })
      } as Response);

      const protoTx: ProtoTxRequest = {
        tir: { version: '1.0', bytecode: 'test', encoding: 'hex' },
        args: { amount: createIntArg(1000) }
      };

      await clientWithEnv.resolve(protoTx);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.params.env).toEqual({
        network: 'testnet',
        fee_multiplier: 150
      });
    });
  });

  describe('Error Handling', () => {
    test('handles HTTP status errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as Response);

      const protoTx: ProtoTxRequest = {
        tir: { version: '1.0', bytecode: 'test', encoding: 'hex' },
        args: {}
      };

      await expect(client.resolve(protoTx)).rejects.toThrow(StatusCodeError);
      await expect(client.resolve(protoTx)).rejects.toThrow('HTTP error 404: Not Found');
    });

    test('handles JSON-RPC errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          error: {
            message: 'Invalid transaction',
            data: { code: 'INVALID_TX', details: 'Missing inputs' }
          },
          id: 'test'
        })
      } as Response);

      const protoTx: ProtoTxRequest = {
        tir: { version: '1.0', bytecode: 'test', encoding: 'hex' },
        args: {}
      };

      await expect(client.resolve(protoTx)).rejects.toThrow(JsonRpcError);
      
      try {
        await client.resolve(protoTx);
      } catch (error) {
        expect(error).toBeInstanceOf(JsonRpcError);
        const jsonRpcError = error as JsonRpcError;
        expect(jsonRpcError.message).toBe('JSON-RPC error: Invalid transaction');
        expect(jsonRpcError.data).toEqual({ code: 'INVALID_TX', details: 'Missing inputs' });
      }
    });

    test('handles network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      const protoTx: ProtoTxRequest = {
        tir: { version: '1.0', bytecode: 'test', encoding: 'hex' },
        args: {}
      };

      await expect(client.resolve(protoTx)).rejects.toThrow(NetworkError);
      await expect(client.resolve(protoTx)).rejects.toThrow('Network error: fetch failed');
    });

    test('handles JSON parsing errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token in JSON');
        }
      } as unknown as Response);

      const protoTx: ProtoTxRequest = {
        tir: { version: '1.0', bytecode: 'test', encoding: 'hex' },
        args: {}
      };

      await expect(client.resolve(protoTx)).rejects.toThrow(TrpError);
      await expect(client.resolve(protoTx)).rejects.toThrow('Failed to parse response');
    });

    test('handles missing result in response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          id: 'test'
          // Missing result field
        })
      } as Response);

      const protoTx: ProtoTxRequest = {
        tir: { version: '1.0', bytecode: 'test', encoding: 'hex' },
        args: {}
      };

      await expect(client.resolve(protoTx)).rejects.toThrow(TrpError);
      await expect(client.resolve(protoTx)).rejects.toThrow('No result in response');
    });
  });

  describe('Request Format', () => {
    test('generates unique IDs for each request', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          result: { tx: 'mock' },
          id: 'test'
        })
      } as Response);

      const protoTx: ProtoTxRequest = {
        tir: { version: '1.0', bytecode: 'test', encoding: 'hex' },
        args: {}
      };

      await client.resolve(protoTx);
      await client.resolve(protoTx);

      expect(mockFetch).toHaveBeenCalledTimes(2);
      
      const body1 = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      const body2 = JSON.parse(mockFetch.mock.calls[1][1]?.body as string);
      
      expect(body1.id).toBeDefined();
      expect(body2.id).toBeDefined();
      expect(body1.id).not.toBe(body2.id);
    });

    test('properly converts complex arguments', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jsonrpc: '2.0',
          result: { tx: 'mock' },
          id: 'test'
        })
      } as Response);

      const protoTx: ProtoTxRequest = {
        tir: { version: '1.0', bytecode: 'test', encoding: 'hex' },
        args: {
          smallNumber: createIntArg(42),
          bigNumber: createIntArg(BigInt('123456789012345678901234567890')),
          flag: createBoolArg(true),
          name: createStringArg('test-transaction')
        }
      };

      await client.resolve(protoTx);

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.params.args).toEqual({
        smallNumber: 42,
        bigNumber: expect.stringMatching(/^0x[0-9a-f]+$/),
        flag: true,
        name: 'test-transaction'
      });
    });
  });

  describe('Error Type Inheritance', () => {
    test('error types inherit from base classes correctly', () => {
      const trpError = new TrpError('test message');
      const networkError = new NetworkError('network issue');
      const statusError = new StatusCodeError(500, 'server error');
      const jsonRpcError = new JsonRpcError('rpc error', { code: 123 });

      expect(trpError).toBeInstanceOf(Error);
      expect(trpError).toBeInstanceOf(TrpError);

      expect(networkError).toBeInstanceOf(Error);
      expect(networkError).toBeInstanceOf(TrpError);
      expect(networkError).toBeInstanceOf(NetworkError);

      expect(statusError).toBeInstanceOf(Error);
      expect(statusError).toBeInstanceOf(TrpError);
      expect(statusError).toBeInstanceOf(StatusCodeError);

      expect(jsonRpcError).toBeInstanceOf(Error);
      expect(jsonRpcError).toBeInstanceOf(TrpError);
      expect(jsonRpcError).toBeInstanceOf(JsonRpcError);
    });
  });

  describe('Submit Method', () => {
    test('submits transaction successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          result: {},
          id: 'test'
        })
      } as Response);

      const submitParams = {
        tx: { content: 'deadbeef', encoding: 'hex' as const },
        witnesses: [{
          type: 'vkey' as const,
          key: { content: 'abcdef', encoding: 'hex' as const },
          signature: { content: '123456', encoding: 'hex' as const }
        }]
      };

      await expect(client.submit(submitParams)).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-endpoint.com/trp',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }),
          body: expect.stringContaining('trp.submit')
        })
      );
    });

    test('handles submit errors', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: '2.0',
          error: {
            message: 'Transaction rejected',
            data: { code: 'INVALID_TX' }
          },
          id: 'test'
        })
      } as Response);

      const submitParams = {
        tx: { content: 'deadbeef', encoding: 'hex' as const },
        witnesses: [{
          type: 'vkey' as const,
          key: { content: 'abcdef', encoding: 'hex' as const },
          signature: { content: '123456', encoding: 'hex' as const }
        }]
      };

      await expect(client.submit(submitParams)).rejects.toThrow(JsonRpcError);
    });

    test('handles network errors on submit', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      } as Response);

      const submitParams = {
        tx: { content: 'deadbeef', encoding: 'hex' as const },
        witnesses: [{
          type: 'vkey' as const,
          key: { content: 'abcdef', encoding: 'hex' as const },
          signature: { content: '123456', encoding: 'hex' as const }
        }]
      };

      await expect(client.submit(submitParams)).rejects.toThrow(StatusCodeError);
    });
  });
});
