const express = require('express')
require('dotenv').config()
const connectWithRetry = require('./src/config/connectDB')
const logger = require('./src/logger/logger')

const app = express()
const port = process.env.PORT || 5000

// Endpoint for checking the health of the server
app.get('/health-check', (req, res) => {
  res.send('server is healthy!!')
})

// Function to start the server
const start = async () => {
  try {
    // Attempt to connect to MongoDB
    await connectWithRetry()

    // Start the Express server after DB connection is successful
    app.listen(port, () => {
      logger.info(` ✅ Server is now listening in port ${port}`)
    })
  } catch (error) {
    // Log any error encountered during startup
     logger.logError(`🚫 Error starting server ${error.message}`)
  }
}

// Invoke the start function to launch the app
start()


