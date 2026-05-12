/**
 * @file src/helpers/TokenServiceHelper.ts
 * @description Utility helpers for JWT token lifecycle checks.
 */
export default class TokenServiceHelper {
  /**
   * Returns true when the Unix-epoch `expiresAt` value is in the past.
   */
  static async isTokenExpired(expiresAt: number): Promise<boolean> {
    return expiresAt < Math.floor(Date.now() / 1000);
  }
}
