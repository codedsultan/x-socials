import type { NextFunction, Request, Response } from "express";
import type { IUser } from "../entities/user/core";  // Database-agnostic user type

/**
 * Define custom Express's Request interface
 * Now works with any database backend!
 */
export interface IRequest extends Request {
  currentUser?: IUser;  // Always the agnostic type, regardless of DB
}

/**
 * Define custom Express's Response interface
 */
export interface IResponse extends Response { }

/**
 * Define custom Express's NextFunction interface
 */
export interface INext extends NextFunction { }