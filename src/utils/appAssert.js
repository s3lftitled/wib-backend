/**
 * Custom error class that extends the built-in Error class to include HTTP status codes
 * and a flag for operational errors (as opposed to programmer errors).
 */
class AppError extends Error {
  /**
   * Constructs an AppError instance.
   * @param {string} message - A human-readable error message
   * @param {number} statusCode - The HTTP status code associated with the error
   */
  constructor(message, statusCode) {
    super(message) // Call parent class (Error) constructor with the error message
    this.statusCode = statusCode // Attach custom HTTP status code
    this.isOperational = true // Flag to distinguish operational errors from programming bugs

    // Captures the stack trace, excluding this constructor from it
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Assertion utility that throws an AppError if the provided condition is false.
 *
 * @param {boolean} condition - The condition to evaluate
 * @param {string} message - Error message if the condition is false
 * @param {number} statusCode - HTTP status code to attach to the error
 * @throws {AppError} If the condition is false
 */
const appAssert = (condition, message, statusCode) => {
  if (!condition) throw new AppError(message, statusCode)
}

// Export the utility for use in other parts of the application
module.exports = { appAssert }