const express = require('express');
const router = express.Router();
const Vehicle = require('../models/Vehicle');
const { auth, checkRole } = require('../middleware/auth');

// Get nearby vehicles
router.get('/nearby', async (req, res) => {
    try {
        const { lat, lng, maxDistance = 5000 } = req.query; // maxDistance in meters

        const vehicles = await Vehicle.find({
            location: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [parseFloat(lng), parseFloat(lat)]
                    },
                    $maxDistance: parseInt(maxDistance)
                }
            },
            isAvailable: true
        }).populate('driver', 'name phone');

        res.json(vehicles);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get vehicle by ID
router.get('/:id', async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id)
            .populate('driver', 'name phone');
        
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        res.json(vehicle);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Admin only: Add new vehicle
router.post('/', auth, checkRole(['admin']), async (req, res) => {
    try {
        const vehicle = new Vehicle(req.body);
        await vehicle.save();
        res.status(201).json(vehicle);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Admin only: Update vehicle
router.patch('/:id', auth, checkRole(['admin']), async (req, res) => {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['type', 'subtype', 'location', 'price', 'seats', 'amenities', 'isAvailable', 'status'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
        return res.status(400).json({ error: 'Invalid updates' });
    }

    try {
        const vehicle = await Vehicle.findById(req.params.id);
        
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        updates.forEach(update => vehicle[update] = req.body[update]);
        await vehicle.save();
        res.json(vehicle);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Admin only: Delete vehicle
router.delete('/:id', auth, checkRole(['admin']), async (req, res) => {
    try {
        const vehicle = await Vehicle.findByIdAndDelete(req.params.id);
        
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        res.json(vehicle);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update vehicle location (for drivers)
router.patch('/:id/location', auth, checkRole(['driver']), async (req, res) => {
    try {
        const { coordinates } = req.body;
        
        const vehicle = await Vehicle.findOne({ driver: req.user._id, _id: req.params.id });
        
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        vehicle.location.coordinates = coordinates;
        vehicle.lastUpdated = Date.now();
        await vehicle.save();

        res.json(vehicle);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 