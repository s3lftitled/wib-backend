const nodemailer = require('nodemailer')
const logger = require('../logger/logger')
require('dotenv').config()
const crypto = require('crypto')

/**
 * 📧 Utility class for sending emails.
 */
class EmailUtil {
  constructor() {
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

  generateToken() {
    return crypto.randomBytes(20).toString('hex')
  }

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

  async sendLeaveRequestNotification(adminEmails, leaveRequest, employee) {
    try {
      if (!adminEmails || adminEmails.length === 0) {
        logger.warn('No admin emails provided for leave request notification')
        return
      }

      const adminInterfaceUrl = `${process.env.BASE_URL}/dashboard`
      
      const startDate = new Date(leaveRequest.startDate).toLocaleDateString()
      const endDate = new Date(leaveRequest.endDate).toLocaleDateString()
      
      const mailOptions = {
        from: process.env.USER,
        to: adminEmails.join(', '),
        subject: `New Leave Request from ${employee.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #000000;">
            <h2>New Leave Request</h2>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Employee:</strong> ${employee.name}</p>
              <p><strong>Email:</strong> ${employee.email}</p>
              <p><strong>Leave Type:</strong> ${leaveRequest.leaveType}</p>
              <p><strong>Category:</strong> ${leaveRequest.leaveCategory}</p>
              <p><strong>Duration:</strong> ${leaveRequest.numberOfDays} day(s)</p>
              <p><strong>Start Date:</strong> ${startDate}</p>
              <p><strong>End Date:</strong> ${endDate}</p>
              <p><strong>Reason:</strong> ${leaveRequest.reason}</p>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${adminInterfaceUrl}" 
                 style="background-color: #2196F3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                 Review Leave Request
              </a>
            </p>
            
            <p style="color: #666; font-size: 12px;">
              This is an automated notification from WIB Attendance Management System
            </p>
          </div>
        `,
      }

      await this.transporter.sendMail(mailOptions)
      logger.info(`Leave request notification sent to ${adminEmails.length} admin(s)`)
    } catch (error) {
      logger.error('Error sending leave request notification:', error)
    }
  }

  /**
   * Sends overtime/undertime notification to admin emails
   * @param {Array<string>} adminEmails - Array of admin email addresses
   * @param {Object} overtimeRecord - The overtime/undertime record document
   * @param {Object} user - The user object (name, email)
   * @param {Object} employee - The employee document
   * @returns {Promise<void>}
   */
  async sendOvertimeNotification(adminEmails, overtimeRecord, user, employee) {
    try {
      if (!adminEmails || adminEmails.length === 0) {
        logger.warn('No admin emails provided for overtime notification')
        return
      }

      const adminInterfaceUrl = `${process.env.BASE_URL}/dashboard`
      
      const recordDate = new Date(overtimeRecord.date).toLocaleDateString()
      const scheduledEndTime = new Date(overtimeRecord.scheduledEnd).toLocaleTimeString()
      const actualTimeOut = new Date(overtimeRecord.actualTimeOut).toLocaleTimeString()
      
      const typeColor = overtimeRecord.type === 'Overtime' ? '#FF9800' : '#F44336'
      const typeLabel = overtimeRecord.type === 'Overtime' ? 'Overtime' : 'Undertime'
      
      const mailOptions = {
        from: process.env.USER,
        to: adminEmails.join(', '),
        subject: `New ${typeLabel} Record from ${user.name}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #000000;">
            <h2 style="color: ${typeColor};">New ${typeLabel} Record</h2>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p><strong>Employee:</strong> ${user.name}</p>
              <p><strong>Email:</strong> ${user.email}</p>
              <p><strong>Date:</strong> ${recordDate}</p>
              <p><strong>Type:</strong> <span style="color: ${typeColor}; font-weight: bold;">${typeLabel}</span></p>
              <p><strong>Duration:</strong> ${overtimeRecord.minutes} minute(s)</p>
              <p><strong>Scheduled End:</strong> ${scheduledEndTime}</p>
              <p><strong>Actual Time Out:</strong> ${actualTimeOut}</p>
              <p><strong>Reason:</strong> ${overtimeRecord.reason}</p>
              <p><strong>Status:</strong> ${overtimeRecord.status}</p>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${adminInterfaceUrl}" 
                 style="background-color: ${typeColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                 Review ${typeLabel} Record
              </a>
            </p>
            
            <p style="color: #666; font-size: 12px;">
              This is an automated notification from WIB Attendance Management System
            </p>
          </div>
        `,
      }

      await this.transporter.sendMail(mailOptions)
      logger.info(`${typeLabel} notification sent to ${adminEmails.length} admin(s)`)
    } catch (error) {
      logger.error('Error sending overtime notification:', error)
    }
  }

  /**
 * Sends schedule notification email to an employee
 * @param {string} email - Employee's email address
 * @param {string} name - Employee's name
 * @param {string} subject - Email subject
 * @param {string} message - Notification message
 * @param {string} adminName - Name of admin who sent the notification
 * @returns {Promise<void>}
 */
  async sendScheduleNotificationEmail(email, name, subject, message, adminName) {
    try {
      const scheduleUrl = `${process.env.BASE_URL}/employee/schedule`
      
      const mailOptions = {
        from: process.env.USER,
        to: email,
        subject: subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #000000;">
            <h2 style="color: #2196F3;">📅 Schedule Update</h2>
            
            <p>Hello <strong>${name}</strong>,</p>
            
            <div style="background-color: #E3F2FD; padding: 20px; border-left: 4px solid #2196F3; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6;">
                ${message}
              </p>
            </div>
            
            <p style="text-align: center; margin: 30px 0;">
              <a href="${scheduleUrl}" 
                style="background-color: #2196F3; color: white; padding: 14px 28px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                View Your Schedule
              </a>
            </p>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin-top: 30px;">
              <p style="margin: 5px 0; font-size: 14px; color: #666;">
                <strong>Notification sent by:</strong> ${adminName}
              </p>
              <p style="margin: 5px 0; font-size: 14px; color: #666;">
                <strong>Date:</strong> ${new Date().toLocaleString('en-US', { 
                  dateStyle: 'long', 
                  timeStyle: 'short' 
                })}
              </p>
            </div>
            
            <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 20px;">
              This is an automated notification from WIB Attendance Management System.<br/>
              Please do not reply to this email.
            </p>
            
            <p style="color: #333; font-size: 14px; margin-top: 20px;">
              When In Baguio Inc.
            </p>
          </div>
        `,
      }

      await this.transporter.sendMail(mailOptions)
      logger.info(`Schedule notification sent to ${email}`)
    } catch (error) {
      logger.error(`Error sending schedule notification to ${email}:`, error)
      throw new Error(`Failed to send schedule notification email to ${email}`)
    }
  }
}

module.exports = new EmailUtil()