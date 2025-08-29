const bcrypt = require('bcrypt')         // Bcrypt library for hashing and comparing passwords
const logger = require('../logger/logger') // Custom logger for error tracking

class PasswordUtil {
  // Method to hash a plain text password
  async hashPassword(password) {
    try {
      // Generate a hash using bcrypt with 10 salt rounds
      return await bcrypt.hash(password, 10)
    } catch (error) {
      // Log the error and throw a new descriptive error
      logger.error('Error hashing password:', error)
      throw new Error('Failed to hash password.')
    }
  }

  // Method to compare a plain password with a hashed password
  async comparePassword(plainPassword, hashedPassword) {
    // Validate that both arguments are provided
    if (!plainPassword || !hashedPassword) {
      throw new Error('Missing arguments: plainPassword and hashedPassword are required')
    }
    // Return true if passwords match, false otherwise
    return await bcrypt.compare(plainPassword, hashedPassword)
  }
}

// Export a single instance of PasswordUtil
module.exports = new PasswordUtil()
