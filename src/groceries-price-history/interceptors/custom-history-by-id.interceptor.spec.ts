import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { cacheInterceptorTrackBy } from './custom-history-by-id.interceptor';

describe('CustomHistoryByIdInterceptor', () => {
  function makeContext(req: Partial<{ method: string; params: any }>, handler: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => handler,
    } as ExecutionContext;
  }

  it('should build cache key by replacing $id for GET requests', () => {
    const reflector = new Reflector();

    jest.spyOn(reflector, 'get').mockReturnValue('groceries:history:$id');

    const ctx = makeContext({ method: 'GET', params: { id: 'abc-123' } }, () => {});
    const key = cacheInterceptorTrackBy(ctx, reflector);

    expect(reflector.get).toHaveBeenCalled();
    expect(key).toBe('groceries:history:abc-123');
  });

  it('should return undefined for non-GET requests', () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'get').mockReturnValue('groceries:history:$id');

    const ctx = makeContext({ method: 'POST', params: { id: 'abc-123' } }, () => {});
    const key = cacheInterceptorTrackBy(ctx, reflector);

    expect(key).toBeUndefined();
  });
});
