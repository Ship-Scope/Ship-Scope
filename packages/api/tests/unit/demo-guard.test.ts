import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { type Request, type Response, type NextFunction } from 'express';
import { demoGuard } from '../../src/middleware/demoGuard';

function mockReqRes(method: string) {
  const req = { method } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('demoGuard middleware', () => {
  const originalEnv = process.env.DEMO_MODE;

  afterEach(() => {
    process.env.DEMO_MODE = originalEnv;
  });

  describe('when DEMO_MODE is not set', () => {
    beforeEach(() => {
      delete process.env.DEMO_MODE;
    });

    it('should pass through GET requests', () => {
      const { req, res, next } = mockReqRes('GET');
      demoGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through POST requests', () => {
      const { req, res, next } = mockReqRes('POST');
      demoGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('when DEMO_MODE=true', () => {
    beforeEach(() => {
      process.env.DEMO_MODE = 'true';
    });

    it('should allow GET requests', () => {
      const { req, res, next } = mockReqRes('GET');
      demoGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow HEAD requests', () => {
      const { req, res, next } = mockReqRes('HEAD');
      demoGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should allow OPTIONS requests', () => {
      const { req, res, next } = mockReqRes('OPTIONS');
      demoGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should block POST requests with 403', () => {
      const { req, res, next } = mockReqRes('POST');
      demoGuard(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DEMO_MODE_RESTRICTED',
        }),
      );
    });

    it('should block PUT requests with 403', () => {
      const { req, res, next } = mockReqRes('PUT');
      demoGuard(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block PATCH requests with 403', () => {
      const { req, res, next } = mockReqRes('PATCH');
      demoGuard(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should block DELETE requests with 403', () => {
      const { req, res, next } = mockReqRes('DELETE');
      demoGuard(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should include self-host link in error response', () => {
      const { req, res, next } = mockReqRes('POST');
      demoGuard(req, res, next);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('github.com/Ship-Scope/Ship-Scope'),
        }),
      );
    });
  });

  describe('when DEMO_MODE=false', () => {
    beforeEach(() => {
      process.env.DEMO_MODE = 'false';
    });

    it('should pass through POST requests', () => {
      const { req, res, next } = mockReqRes('POST');
      demoGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should pass through DELETE requests', () => {
      const { req, res, next } = mockReqRes('DELETE');
      demoGuard(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
