const bcrypt = require('bcrypt')
const logger = require('../logger/logger')
const crypto = require('crypto')


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

  async createTempPassword() {
    try {
      const tempPassword = crypto.randomBytes(10).toString('hex')
      const hashedPassword = await bcrypt.hash(tempPassword, 10) 

      return hashedPassword
    } catch (error) {
      logger.error('Error creating temporary password:', error)
      throw new Error('Failed to create temporary password.')
    }

  }
}

// Export a single instance of PasswordUtil
module.exports = new PasswordUtil()
