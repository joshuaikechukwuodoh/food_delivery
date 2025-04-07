const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullname: String,
    email: String,
    password: String,
    phone: String,
    address: String,
    gender: String,
    age: Number,
    image: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }

});

const User = mongoose.model('User', userSchema);

module.exports = User;