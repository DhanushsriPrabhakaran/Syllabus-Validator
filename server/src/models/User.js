import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[^@\s]+@tce\.edu$/, 'Only @tce.edu email addresses are permitted']
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  picture: {
    type: String,
    default: ''
  },
  department: {
    type: String,
    default: null,
    trim: true
  },
  role: {
    type: String,
    enum: ['staff', 'admin'],
    default: 'staff'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: {
    type: Date,
    default: Date.now
  }
});

export const User = mongoose.model('User', UserSchema);
