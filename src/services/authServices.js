const UserModel = require('../models/user.model')        // Import User model for database operations
const HTTP_STATUS = require('../constants/httpConstants') // HTTP status codes (200, 400, 404, etc.)
const { appAssert } = require('../utils/appAssert')      // Utility function for assertions and error handling
const PasswordUtil = require('../utils/passwordUtils')  // Utility for password hashing and comparison

// Service function to handle user login
const logInService = async (email, password) => {
  try {
    // Find user by email in the database
    const user = await UserModel.findOne({ email })

    // If user not found, throw an error
    appAssert(user, "User is not found", HTTP_STATUS.NOT_FOUND)

    // Compare the provided password with the stored hashed password
    const isPasswordValid = PasswordUtil.comparePassword(password, user.password)
    
    // If password is invalid, throw an error
    appAssert(isPasswordValid, "Password is incorrect, please try again", HTTP_STATUS.BAD_REQUEST)

    // Return the user object and success message if login is successful
    return { user, message: 'Logged in succesfully' }
  } catch (error) {
    // Propagate the error to be handled by controller or middleware
    throw error
  }
}

// Export the service function for use in controllers
module.exports = { 
  logInService,
}
