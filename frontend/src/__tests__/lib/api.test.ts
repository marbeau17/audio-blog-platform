import { api } from '@/lib/api';

// Mock firebase/auth module
const mockGetIdToken = jest.fn().mockResolvedValue('test-token-123');
jest.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

// Get a reference to the mocked firebase module so we can change currentUser per test
import { auth } from '@/lib/firebase';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockReset();
  // Reset currentUser to null
  (auth as any).currentUser = null;
});

describe('ApiClient', () => {
  describe('GET requests', () => {
    it('makes correct GET request with path', async () => {
      const responseData = { data: { id: '1', name: 'Test' } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseData),
      });

      const result = await api.get('/content');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/content',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        }),
      );
      expect(result).toEqual(responseData);
    });
  });

  describe('auth headers', () => {
    it('does not include Authorization header when no user is signed in', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await api.get('/test');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('includes Authorization header when user is signed in', async () => {
      (auth as any).currentUser = { getIdToken: mockGetIdToken };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: {} }),
      });

      await api.get('/test');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Bearer test-token-123');
    });
  });

  describe('POST requests', () => {
    it('makes POST request with JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: '1' } }),
      });

      const body = { title: 'New Content', excerpt: 'Description' };
      await api.post('/content', body);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/content',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    });
  });

  describe('PUT requests', () => {
    it('makes PUT request with JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: '1' } }),
      });

      const body = { title: 'Updated' };
      await api.put('/content/1', body);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/content/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(body),
        }),
      );
    });
  });

  describe('DELETE requests', () => {
    it('makes DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await api.delete('/content/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/content/1',
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('throws API error when response is not ok and body is JSON', async () => {
      const apiError = {
        error: { type: 'not_found', status: 404, detail: 'Content not found' },
      };
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve(apiError),
      });

      await expect(api.get('/content/missing')).rejects.toEqual(apiError);
    });

    it('throws generic error when response body is not JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(api.get('/broken')).rejects.toEqual({
        error: { type: 'unknown', status: 500, detail: 'Internal Server Error' },
      });
    });
  });
});
