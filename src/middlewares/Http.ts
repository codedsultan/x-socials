/**
 * Enable basic express APIs middleware
 */
// src/middlewares/Http.ts
import { json, urlencoded, type Request, type Response, type NextFunction } from "express";
import type { Application } from "express";
import helmet from "helmet";
import compression from "compression";
import Logger from "../logger";

class Http {
  public static mount(_express: Application): Application {
    Logger.getInstance().info("App :: Registering HTTP middleware...");

    // Several layers add 'finish' listeners to ServerResponse: compression,
    // morgan, monitoring, otel-http, and (when tracing is on) otel-router adds
    // one per matched layer. Set a generous ceiling so Node never fires
    // MaxListenersExceededWarning regardless of how deep the middleware stack grows.
    _express.use((_req: Request, res: Response, next: NextFunction) => {
      res.setMaxListeners(50);
      next();
    });

    // Security headers
    _express.use(helmet());

    // Compress responses
    _express.use(compression());

    // Parse bodies — express 5 ships built-in json/urlencoded via body-parser;
    // registering body-parser separately would double-read the stream.
    //
    // The verify callback captures the raw body buffer before it is parsed.
    // requireAdminKey reads req.rawBody to compute the HMAC body hash; without
    // this, req.rawBody is undefined and the signature check fails on any
    // admin request that carries a body (POST / PATCH / PUT).
    _express.use(
      json({
        limit: "100mb",
        verify: (req: Request, _res: Response, buf: Buffer) => {
          (req as any).rawBody = buf.toString("utf8");
        },
      })
    );
    _express.use(urlencoded({ extended: true, limit: "100mb" }));

    // Trust proxy (for reverse proxies / load balancers)
    _express.set("trust proxy", true);

    return _express;
  }
}

export default Http;