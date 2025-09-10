const UserModel = require('../models/user.model')
const EmployeeModel = require('../models/employee.model')
const HTTP_STATUS = require('../constants/httpConstants')
const ROLE_CONSTANTS = require('../constants/roleConstants')
const { appAssert } = require('../utils/appAssert')
const PasswordUtil = require('../utils/passwordUtils')
const EmailUtil = require('../utils/emailUtils')
const validator = require('validator')
const logger = require('../logger/logger')

// Change name
const changeNameService = async (userId, newName) => {
  try {
    appAssert(validator.isMongoId(userId), 'Invalid user ID format', HTTP_STATUS.BAD_REQUEST)
    appAssert(!typeof(newName) === 'string', 'Invalid name', HTTP_STATUS.BAD_REQUEST)

    const user = await UserModel.findById(userId)

    appAssert(user, 'User is not found', HTTP_STATUS.NOT_FOUND)

    user.name = newName
    await user.save()

    return { message: 'Name changed succesfully' }
  } catch (error) {
    throw error
  }
}


// Change display image
const uploadDisplayImageService = async (userId, base64Image) => {
  try {
    appAssert(base64Image, 'No new data to change', HTTP_STATUS.BAD_REQUEST)

    appAssert(validator.isMongoId(userId), 'Invalid user ID format', HTTP_STATUS.BAD_REQUEST)

    const user = await UserModel.findById(userId)

    appAssert(user, 'User is not found', HTTP_STATUS.NOT_FOUND)

    const allowedFormats = ['jpeg', 'jpg', 'png']
    // Detect the image format from base64 string
    const detectedFormat = base64Image.match(/^data:image\/(\w+);base64,/)
    const imageFormat = detectedFormat ? detectedFormat[1] : null

      // Check if image format is supported
    appAssert(
      imageFormat || allowedFormats.includes(imageFormat.toLowerCase()), 
      'Unsupported image format. Please upload a JPEG, JPG, or PNG image.',
      HTTP_STATUS.BAD_REQUEST
    ) 

      // Convert base64 image to buffer
    const imageBuffer = Buffer.from(base64Image.split(',')[1], 'base64')

    // Resize the image
    const resizedImage = await sharp(imageBuffer)
      .resize({
        fit: 'cover',
        width: 200,
        height: 200,
        withoutEnlargement: true,
      })
      .toFormat(imageFormat)
      .toBuffer()

    // Convert resized image buffer to base64
    const resizedImageBase64 = `data:image/${imageFormat};base64,${resizedImage.toString('base64')}`

    user.displayPicture= resizedImageBase64
    await user.save()

    return { message: 'Display picture uploaded succesfully' }
  } catch (error) {
    throw error
  }
}

module.exports = {
  uploadDisplayImageService,
}