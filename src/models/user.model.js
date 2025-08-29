const mongoose = require("mongoose");
const ROLE_CONSTANTS = require("../constants/roleConstants");

// Define the User schema
const userSchema = new mongoose.Schema({
  name: {
     type: String, 
  },
  email: { 
    type: String,          // Data type is String
    required: true,        // This field is mandatory
    unique: true,          // Ensures no duplicate emails in the collection
    lowercase: true,       // Converts the value to lowercase before saving
    trim: true             // Removes leading/trailing spaces
  },
  password: { 
    type: String,          // Data type is String
    required: true         // This field is mandatory
  },
  role: { 
    type: String, // Data type is String
    enum: [ROLE_CONSTANTS[101], ROLE_CONSTANTS[202]], // Only these two values are allowed
    required: true // Role must be provided
  },
  createdAt: { 
    type: Date,            
    default: Date.now      // Automatically sets creation date to current time
  },
  isActive: { 
    type: Boolean,         
    default: true,         // Users are active by default
    required: true         // Must always have a value
  }
});

// Export the model to use in other parts of the app
module.exports = mongoose.model("User", userSchema)
