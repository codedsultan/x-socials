// src/middlewares/Morgan.ts - UPDATED VERSION
import type { Application, Request, Response, NextFunction } from "express";
import Logger from "../logger";

class Morgan {
  public static mount(_express: Application): Application {
    Logger.getInstance().info("App :: Registering Morgan middleware...");

    // Custom middleware using once instead of on
    _express.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const { method, originalUrl, ip } = req;

      // Use once() instead of on() to auto-cleanup
      res.once('finish', () => {
        const duration = Date.now() - startTime;
        const { statusCode } = res;
        const contentLength = res.get('content-length') || 0;

        const logMessage = `${ip || '-'} ${method} ${originalUrl} ${statusCode} ${contentLength} - ${duration} ms`;

        // Log based on status code
        if (statusCode >= 500) {
          Logger.getInstance().error(logMessage);
        } else if (statusCode >= 400) {
          Logger.getInstance().warn(logMessage);
        } else {
          (Logger.getInstance() as any).http(logMessage);
        }
      });

      next();
    });

    return _express;
  }
}

export default Morgan;