// Unit tests for upload API
const { createMocks } = require('node-mocks-http');
const handler = require('../../api/upload.js').default;

// Mock formidable
jest.mock('formidable', () => {
  return jest.fn().mockImplementation(() => ({
    parse: jest.fn()
  }));
});

// Mock fs
jest.mock('fs', () => ({
  createReadStream: jest.fn(),
  unlinkSync: jest.fn()
}));

// Mock axios
jest.mock('axios', () => ({
  post: jest.fn()
}));

const formidable = require('formidable');
const fs = require('fs');
const axios = require('axios');

describe('/api/upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle OPTIONS request (CORS preflight)', async () => {
    const { req, res } = createMocks({
      method: 'OPTIONS',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(res._getHeaders()['access-control-allow-origin']).toBe('*');
  });

  test('should reject non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('Method not allowed');
  });

  test('should reject request when no file uploaded', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    const mockForm = {
      parse: jest.fn().mockResolvedValue([{}, {}])
    };
    formidable.mockReturnValue(mockForm);

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.error).toBe('No file uploaded');
  });

  test('should reject unsupported file types', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    const mockFile = {
      originalFilename: 'test.txt',
      mimetype: 'text/plain',
      size: 1000,
      filepath: '/tmp/test'
    };

    const mockForm = {
      parse: jest.fn().mockResolvedValue([{}, { file: [mockFile] }])
    };
    formidable.mockReturnValue(mockForm);

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    const data = JSON.parse(res._getData());
    expect(data.error).toContain('Unsupported file type');
  });

  test('should successfully upload image file', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    const mockFile = {
      originalFilename: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 1000,
      filepath: '/tmp/test.jpg'
    };

    const mockForm = {
      parse: jest.fn().mockResolvedValue([{}, { file: [mockFile] }])
    };
    formidable.mockReturnValue(mockForm);

    // Mock successful Telegram API response
    axios.post.mockResolvedValue({
      data: {
        ok: true,
        result: {
          message_id: 123
        }
      }
    });

    fs.createReadStream.mockReturnValue({});
    fs.unlinkSync.mockImplementation(() => {});

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.success).toBe(true);
    expect(data.data.filename).toBe('test.jpg');
    expect(data.data.telegramMessageId).toBe(123);
  });

  test('should handle Telegram API errors', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    const mockFile = {
      originalFilename: 'test.jpg',
      mimetype: 'image/jpeg',
      size: 1000,
      filepath: '/tmp/test.jpg'
    };

    const mockForm = {
      parse: jest.fn().mockResolvedValue([{}, { file: [mockFile] }])
    };
    formidable.mockReturnValue(mockForm);

    // Mock Telegram API error
    axios.post.mockRejectedValue({
      response: {
        data: {
          description: 'Bot token invalid'
        }
      }
    });

    fs.createReadStream.mockReturnValue({});
    fs.unlinkSync.mockImplementation(() => {});

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    const data = JSON.parse(res._getData());
    expect(data.success).toBe(false);
    expect(data.error).toBe('Bot token invalid');
  });

  test('should handle video file upload', async () => {
    const { req, res } = createMocks({
      method: 'POST',
    });

    const mockFile = {
      originalFilename: 'test.mp4',
      mimetype: 'video/mp4',
      size: 5000000,
      filepath: '/tmp/test.mp4'
    };

    const mockForm = {
      parse: jest.fn().mockResolvedValue([{}, { file: [mockFile] }])
    };
    formidable.mockReturnValue(mockForm);

    // Mock successful Telegram API response
    axios.post.mockResolvedValue({
      data: {
        ok: true,
        result: {
          message_id: 456
        }
      }
    });

    fs.createReadStream.mockReturnValue({});
    fs.unlinkSync.mockImplementation(() => {});

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.success).toBe(true);
    expect(data.data.filename).toBe('test.mp4');
    expect(data.data.telegramMessageId).toBe(456);
  });
});