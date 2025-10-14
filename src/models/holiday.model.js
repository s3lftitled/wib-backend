const mongoose = require("mongoose")

const HolidaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  holidate: { type: Date, required: true },
  description: String,
  type: String,
}, { timestamps: true })

module.exports = mongoose.model("Holiday", HolidaySchema)


