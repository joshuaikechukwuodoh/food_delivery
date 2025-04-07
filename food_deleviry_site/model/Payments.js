const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Customer"
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: "Order"
    },
    cardNumber: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                // Basic Luhn algorithm check (example: 16-digit card)
                return /^\d{16}$/.test(v);
            },
            message: props => `${props.value} is not a valid card number!`
        }
    },
    amount: {
        type: Number,
        required: true,
        min: [0, "Amount cannot be negative"]
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ["Credit Card", "Debit Card", "PayPal", "Cash on Delivery"]
    },
    paymentDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    status: {
        type: String,
        enum: ["Pending", "Completed", "Failed", "Refunded"],
        default: "Pending"
    },
    transactionId: {
        type: String,
        unique: true,
        sparse: true // Allows null/undefined but ensures uniqueness when present
    }
}, { timestamps: true }); // Adds createdAt and updatedAt fields

module.exports = mongoose.model("Payment", paymentSchema);