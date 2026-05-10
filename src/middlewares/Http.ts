/**
 * Enable basic express APIs middleware
 */
// src/middlewares/Http.ts
import { json, urlencoded } from "express";
import type { Application } from "express";
import helmet from "helmet";
import compression from "compression";
import Logger from "../logger";

class Http {
  public static mount(_express: Application): Application {
    Logger.getInstance().info("App :: Registering HTTP middleware...");

    // Security headers
    _express.use(helmet());

    // Compress responses
    _express.use(compression());

    // Parse bodies — express 5 ships built-in json/urlencoded via body-parser;
    // registering body-parser separately would double-read the stream.
    _express.use(json({ limit: "100mb" }));
    _express.use(urlencoded({ extended: true, limit: "100mb" }));

    // Trust proxy (for reverse proxies / load balancers)
    _express.set("trust proxy", true);

    return _express;
  }
}

export default Http;
