// Import required packages and modules
const express = require('express')
require('dotenv').config()

// Import custom modules
const connectWithRetry = require('./src/config/connectDB')  // Function to connect to MongoDB
const logger = require('./src/logger/logger')         // Custom logger for logging info and errors
const errorHandler = require('./src/middlewares/errorHandler') // Global error handler middleware

// Import route modules
const authRouter = require('./src/routers/authRouter')
const employeeRouter = require('./src/routers/employeeRouter')

// Initialize the Express app
const app = express()

// Set server port from environment variable or use default 5001
const port = process.env.PORT || 5000

// Middleware to parse incoming JSON and URL-encoded data with high size limits
app.use(express.json({ limit: '100mb' }))
app.use(express.urlencoded({ extended: true, limit: '100mb', parameterLimit: 1000000 }))

// Endpoint for checking the health of the server
app.get('/health-check', (req, res) => {
  res.send('server is healthy!!')
})

app.use('/api/auth', authRouter)
app.use('/api/employee', employeeRouter)

// Global error-handling middleware
app.use(errorHandler)

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


