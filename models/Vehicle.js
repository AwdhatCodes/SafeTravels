const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['Standard', 'Premium', 'Luxury']
    },
    subtype: {
        type: String,
        required: true
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    location: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number],
            required: true
        }
    },
    price: {
        type: Number,
        required: true
    },
    seats: {
        type: Number,
        required: true
    },
    amenities: [{
        type: String,
        enum: ['wifi', 'refreshments', 'child-seat', 'privacy']
    }],
    isAvailable: {
        type: Boolean,
        default: true
    },
    status: {
        type: String,
        enum: ['available', 'booked', 'maintenance'],
        default: 'available'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Index for geospatial queries
vehicleSchema.index({ location: '2dsphere' });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
module.exports = Vehicle; 