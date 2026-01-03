const mongoose = require('mongoose')
const logger = require('../logger/logger')
require('dotenv').config()

// Helper to pause between retries
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const connectWithRetry = async (retries = 5, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.MONGO_URI, {
        // Connection Pooling & Options
        maxPoolSize: 20,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4,
      })

      logger.info(`MongoDB Connected: ${mongoose.connection.host}`)
      break
    } catch (err) {
      logger.error(`MongoDB connection attempt ${i + 1} failed: ${err.message}`)
      if (i < retries - 1) {
        logger.info(`Retrying in ${delay / 1000} seconds...`)
        await sleep(delay)
      } else {
        logger.error('All MongoDB connection attempts failed. Exiting.')
        process.exit(1)
      }
    }
  }

  // Connection Event Handlers
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connection established.')
  })

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB error: ${err.message}`)
  })

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected. Retrying...')
  })

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected.')
  })
}

module.exports = connectWithRetry