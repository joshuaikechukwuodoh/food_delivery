const mongoose = require('mongoose');

const Restaurantschema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: 3,
        maxlength: 50,
    },
    address: {
        type: String,
        required: true,
        minlength: 10,
        maxlength: 100,
    },

    menu: {
        type: [String],
        required: true,
        minlength: 3,
        maxlength: 20,
    },

    priceRange: {
        type: String,
        required: true,
        enum: ['Low', 'Medium', 'High'],
    },
    customerRatings: {
        type: [Number],
        required: true,
        minlength: 1,
        maxlength: 5,
    },
    reviews: {
        type: [String],
        required: true,
        minlength: 10,
        maxlength: 500,
    },
    openingHours: {
        type: String,
        required: true,
        minlength: 10,
        maxlength: 100,
    },
    deliveryFee: {
        type: Number,
        required: true,
        min: 0,
    },
    averageDeliveryTime: {
        type: Number,
        required: true,
        min: 0,
    },
    isClosed: {
        type: Boolean,
        required: true,
        default: false,
    },
    isFeatured: {
        type: Boolean,
        required: true,
        default: false,
    },
    menuItems: {
        type: [String],
        required: true,
        minlength: 3,
        maxlength: 20,
    },
});

module.exports = mongoose.model('Restaurant', Restaurantschema);