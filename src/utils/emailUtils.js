const nodemailer = require('nodemailer')
const logger = require('../logger/logger')
require('dotenv').config()
const crypto = require('crypto')

/**
 * 📧 Utility class for sending password setup emails to employees.
 */
class EmailUtil {
  constructor() {
    /**
     * Nodemailer transporter configured to use Gmail with credentials from environment variables.
     * @type {import('nodemailer').Transporter}
     */
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
      },
      secure: true,
      pool: true,
      maxConnections: 5,
    })
  }

  /**
   * Generates a unique token for password setup links.
   * @returns {string} A randomly generated token
   */
  generateToken() {
    return crypto.randomBytes(20).toString('hex')
  }

  /**
   * Sends a password setup email to the specified employee.
   * @param {string} email - Employee's email address
   * @param {string} baseUrl - Base URL of your frontend app where the employee can set the password
   * @returns {Promise<string>} The generated token
   */
  async sendPasswordSetupEmail(email, token) {
    const setupLink = `${process.env.BASE_URL}/activate-account/${token}/${encodeURIComponent(email)}`

    try {
      const mailOptions = {
        from: process.env.USER,
        to: email,
        subject: 'Set Up Your WIB Attendance Account Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #000000;">
            <h2>Welcome to WIB Attendance Management System</h2>
            <p>An admin has created an account for you. Click the button below to set your password:</p>
            <p style="text-align: center;">
              <a href="${setupLink}" 
                 style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 5px;">
                 Set Your Password
              </a>
            </p>
            <p>If you did not expect this email, please ignore it.</p>
            <p>When In Baguio Inc.</p>
          </div>
        `,
      }

      await this.transporter.sendMail(mailOptions)
      return token
    } catch (error) {
      logger.error('Error sending password setup email:', error)
      throw new Error('Failed to send password setup email.')
    }
  }
}

module.exports = new EmailUtil()
