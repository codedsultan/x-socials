/**
 * Define the error & exception handlers
 */

import type { Application } from "express";
import ConfigService from "../config/config.service";
import Logger from "../logger";
import StatusCodes from "../constants/statusCodes";
import StringValues from "../constants/strings";
import type { INext, IRequest, IResponse } from "../interfaces/core/express";

class ExceptionHandler {
  /**
   * @name notFoundHandler
   * @description Handles all the not found routes
   * @param _express
   * @returns any
   */
  public static notFoundHandler(_express: Application) {
    _express.use("/{*path}", (req, res) => {
      const url = req.originalUrl;

      if (url === "/") {
        return res.status(200).json({
          success: true,
          server: "online",
          timestamp: new Date(),
          message: "Server is up and running...",
        });
      }

      const ip =
        req.headers["x-forwarded-for"] ||
        req.headers["x-real-ip"] ||
        req.socket.remoteAddress;

      Logger.getInstance().error(`${ip} Path '${url}' not found!`);

      return res.status(404).json({
        success: false,
        server: "online",
        method: req.method,
        timestamp: new Date(),
        error: "Path not found",
      });
    });

    return _express;
  }

  /**
   * @name clientErrorHandler
   * @description Handles your api/web routes errors/exception
   * @param err any
   * @param req IRequest
   * @param res IResponse
   * @param next INext
   * @returns any
   */
  public static clientErrorHandler(
    err: any,
    req: IRequest,
    res: IResponse,
    next: INext
  ) {
    Logger.getInstance().error(err.stack);

    if (req.xhr) {
      return res.status(500).send({ error: "Something went wrong!" });
    } else {
      return next(err);
    }
  }

  /**
   * @name isUnauthorizedError
   * @description Robust check for UnauthorizedError across different environments
   */
  // private static isUnauthorizedError(err: any): boolean {
  //   return (
  //     err.name === "UnauthorizedError" ||
  //     err.constructor?.name === "UnauthorizedError" ||
  //     (err instanceof Error && err.message === "Unauthorized")
  //   );
  // }

  /**
   * @name isCastError
   * @description Robust check for Mongoose CastError
   */
  // private static isCastError(err: any): boolean {
  //   return (
  //     err.name === "CastError" ||
  //     err.constructor?.name === "CastError" ||
  //     (err.name === "CastError" && err.kind === "ObjectId")
  //   );
  // }

  /**
   * @name isJwtError
   * @description Robust check for JWT-related errors
   */
  // private static isJwtError(err: any): boolean {
  //   const jwtErrorNames = [
  //     "JsonWebTokenError",
  //     "TokenExpiredError",
  //     "jsonWebTokenError",
  //     "NotBeforeError",
  //   ];
  //   return (
  //     jwtErrorNames.includes(err.name) ||
  //     jwtErrorNames.includes(err.constructor?.name) ||
  //     (err.message && err.message.includes("jwt"))
  //   );
  // }

  /**
   * @name isApiRoute
   * @description Check if the request is for an API route
   */
  // private static isApiRoute(req: IRequest): boolean {
  //   const configService = ConfigService;
  //   const apiPrefix = configService.getServerConfig().API_PREFIX;
  //   const url = req.originalUrl;

  //   // Check for API prefix with or without trailing slash
  //   return url.includes(`/${apiPrefix}/`) ||
  //     url === `/${apiPrefix}` ||
  //     url.startsWith(`/${apiPrefix}/`) ||
  //     url.startsWith(`/${apiPrefix}?`);
  // }

  /**
   * @name errorHandler
   * @description Show undermaintenance page incase of errors
   * @param err any
   * @param req IRequest
   * @param res IResponse
   * @param _next INext
   * @returns any
   */
  public static errorHandler(
    err: any,
    req: IRequest,
    res: IResponse,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: INext
  ) {
    // Set default error values
    let statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
    let message = err.message || StringValues.INTERNAL_SERVER_ERROR;

    const configService = ConfigService;
    const apiPrefix = configService.getServerConfig().API_PREFIX;

    // Debug logging for CI environment
    if (process.env.NODE_ENV === "test" || process.env.CI) {
      Logger.getInstance().debug(`Error details:`, {
        url: req.originalUrl,
        apiPrefix,
        isApiRoute: req.originalUrl.includes(`/${apiPrefix}/`),
        errName: err.name,
        errMessage: err.message,
      });
    }

    if (req.originalUrl.includes(`/${apiPrefix}/`)) {
      // Handle Unauthorized Error
      if (err.name && err.name === "UnauthorizedError") {
        message = StringValues.INVALID_TOKEN;
        statusCode = StatusCodes.UNAUTHORIZED;
      }
      // Handle Wrong MongoDB Id error
      else if (err.name === "CastError") {
        message = StringValues.RESOURCE_NOT_FOUND;
        statusCode = StatusCodes.NOT_FOUND;
      }
      // Handle Wrong JWT error
      else if (err.name === "jsonWebTokenError") {
        message = StringValues.INVALID_TOKEN;
        statusCode = StatusCodes.UNAUTHORIZED;
      }
      // Handle JWT Expire error
      else if (err.name === "TokenExpiredError") {
        message = StringValues.TOKEN_EXPIRED;
        statusCode = StatusCodes.UNAUTHORIZED;
      }
      // For any other error that reaches here, ensure we use the default message
      // Don't leak internal error details to the client
      else if (statusCode === StatusCodes.INTERNAL_SERVER_ERROR) {
        message = StringValues.INTERNAL_SERVER_ERROR;
      }

      Logger.getInstance().error(`${statusCode} - ${message} - ${req.originalUrl}`);

      const responseBody: any = {
        success: false,
        error: message,
      };

      // Include debug details in non-production environments
      if (process.env.NODE_ENV !== "production") {
        responseBody.statusCode = statusCode;
        responseBody.errorType = err.name;
      }

      return res.status(statusCode).json(responseBody);
    }

    // Non-API route - render error page or return JSON if render is not available
    // Check if res.render exists (for HTML responses)
    if (typeof res.render === 'function') {
      return res.render("pages/error", {
        error: message,
        title: "Under Maintenance",
      });
    }

    // Fallback for test environments or when view engine isn't configured
    return res.status(statusCode).json({
      success: false,
      error: message,
      statusCode,
      errorType: err.name,
    });
  }
  /**
   * @name logErrors
   * @description Register your error/exception monitoring tools right here ie. before "next(err)"!
   * @param err any
   * @param _req IRequest
   * @param _res IResponse
   * @param next INext
   * @returns any
   */
  public static logErrors(
    err: any,
    _req: IRequest,
    _res: IResponse,
    next: INext
  ) {
    Logger.getInstance().error(err.stack);

    return next(err);
  }
}

export default ExceptionHandler;