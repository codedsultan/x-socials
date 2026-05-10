/**
 * Define Morgan Middleware
 */
// src/middlewares/Morgan.ts
import type { Application } from "express";
import morgan from "morgan";
import type { StreamOptions } from "morgan";
import Logger from "../logger";

class Morgan {
  // Route morgan logs through our Winston logger
  private static _stream: StreamOptions = {
    write: (message) =>
      (Logger.getInstance() as any).http(message.trim()),
  };

  private static _format: string =
    ":remote-addr :method :url :status :res[content-length] - :response-time ms";

  public static mount(_express: Application): Application {
    Logger.getInstance().info("App :: Registering Morgan middleware...");

    _express.use(morgan(this._format, { stream: this._stream }));

    return _express;
  }
}

export default Morgan;
