const mongoose = require('mongoose');

const deliveryAgentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['available', 'busy', 'offline'],
        default: 'offline'
    },
    currentLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            default: [0, 0]
        }
    },
    currentOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    vehicleType: {
        type: String,
        enum: ['bicycle', 'motorcycle', 'car'],
        required: true
    },
    vehicleDetails: {
        make: String,
        model: String,
        licensePlate: String
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    totalDeliveries: {
        type: Number,
        default: 0
    },
    averageDeliveryTime: {
        type: Number,
        default: 0
    },
    documents: {
        license: String,
        insurance: String,
        vehicleRegistration: String
    },
    lastActive: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Create a 2dsphere index for geospatial queries
deliveryAgentSchema.index({ currentLocation: '2dsphere' });

// Method to update location
deliveryAgentSchema.methods.updateLocation = async function (latitude, longitude) {
    this.currentLocation.coordinates = [longitude, latitude];
    this.lastActive = Date.now();
    return this.save();
};

// Method to update status
deliveryAgentSchema.methods.updateStatus = async function (newStatus) {
    this.status = newStatus;
    return this.save();
};

// Method to assign order
deliveryAgentSchema.methods.assignOrder = async function (orderId) {
    this.currentOrder = orderId;
    this.status = 'busy';
    return this.save();
};

// Method to complete delivery
deliveryAgentSchema.methods.completeDelivery = async function (deliveryTime) {
    this.currentOrder = null;
    this.status = 'available';
    this.totalDeliveries += 1;

    // Update average delivery time
    if (this.averageDeliveryTime === 0) {
        this.averageDeliveryTime = deliveryTime;
    } else {
        this.averageDeliveryTime = (this.averageDeliveryTime + deliveryTime) / 2;
    }

    return this.save();
};

// Method to update rating
deliveryAgentSchema.methods.updateRating = async function (newRating) {
    this.rating = newRating;
    return this.save();
};

const DeliveryAgent = mongoose.model('DeliveryAgent', deliveryAgentSchema);

module.exports = DeliveryAgent;


