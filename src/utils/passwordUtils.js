const bcrypt = require('bcrypt')
const logger = require('../logger/logger')
const crypto = require('crypto')

class PasswordUtil {
  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, 10)
    } catch (error) {
      logger.error('Error hashing password:', error)
      throw new Error('Failed to hash password.')
    }
  }

  async comparePassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) {
      throw new Error('Missing arguments: plainPassword and hashedPassword are required')
    }
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

module.exports = new PasswordUtil()