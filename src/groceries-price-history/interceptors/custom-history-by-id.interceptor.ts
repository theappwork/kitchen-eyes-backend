import {CACHE_KEY_METADATA, CacheInterceptor} from "@nestjs/cache-manager";
import {FastifyRequest} from "fastify";
import {ExecutionContext, Injectable} from "@nestjs/common";
import {Reflector} from "@nestjs/core";

const cacheInterceptorTrackBy = (context: ExecutionContext, reflector: Reflector): string | undefined => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
        if (request.method !== 'GET') return;

        const cacheKey = reflector.get(CACHE_KEY_METADATA, context.getHandler());
        const historyId = (request.params as any).id;

        return cacheKey.replace('$id', historyId);
}

/**
 * Custom interceptor to cache history by id
 * Just for the sake of example
 */
@Injectable()
export class CustomHistoryByIdInterceptor extends CacheInterceptor {
    /* istanbul ignore next */
    protected trackBy(context: ExecutionContext): string | undefined {
        // ignored as 'trackBy' is a protected method.
        return cacheInterceptorTrackBy(context, this.reflector);
    }
}

export {
    cacheInterceptorTrackBy,
}