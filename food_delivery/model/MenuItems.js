const mongoose = require('mongoose');

const MenuItems = new mongoose.Schema({
    itemName: String,
    itemPrice: Number,
    itemDescription: String
});

module.exports = mongoose.model("MenuItem", MenuItems);