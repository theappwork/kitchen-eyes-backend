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

@Injectable()
export class CustomHistoryByIdInterceptor extends CacheInterceptor {
    protected trackBy(context: ExecutionContext): string | undefined {
        return cacheInterceptorTrackBy(context, this.reflector);
    }
}

export {
    cacheInterceptorTrackBy,
}