const express = require('express')
require('dotenv').config()

const app = express()
const port = process.env.PORT || 5000

app.get('/health-check', (req, res) => {
  res.send('server is healthy!!')
})

app.listen(port, () => {
  console.log(`Server is now listening in port ${port}`)
})

