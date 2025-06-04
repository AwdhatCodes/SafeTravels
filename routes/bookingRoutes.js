const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const { auth, checkRole } = require('../middleware/auth');

// Create new booking
router.post('/', auth, async (req, res) => {
    try {
        const booking = new Booking({
            ...req.body,
            user: req.user._id
        });

        // Update vehicle availability
        const vehicle = await Vehicle.findById(req.body.vehicle);
        if (!vehicle || !vehicle.isAvailable) {
            return res.status(400).json({ error: 'Vehicle is not available' });
        }

        vehicle.isAvailable = false;
        vehicle.status = 'booked';
        await vehicle.save();

        await booking.save();
        res.status(201).json(booking);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get user's bookings
router.get('/my-bookings', auth, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user._id })
            .populate('vehicle')
            .sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get booking by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('vehicle')
            .populate('user', 'name email phone');

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Check if user is authorized to view this booking
        if (booking.user._id.toString() !== req.user._id.toString() && 
            req.user.role !== 'admin' && 
            req.user.role !== 'driver') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json(booking);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update booking status
router.patch('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Check authorization
        if (booking.user.toString() !== req.user._id.toString() && 
            req.user.role !== 'admin' && 
            req.user.role !== 'driver') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        booking.status = status;
        await booking.save();

        // Update vehicle availability if booking is completed or cancelled
        if (status === 'completed' || status === 'cancelled') {
            const vehicle = await Vehicle.findById(booking.vehicle);
            if (vehicle) {
                vehicle.isAvailable = true;
                vehicle.status = 'available';
                await vehicle.save();
            }
        }

        res.json(booking);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Cancel booking
router.post('/:id/cancel', auth, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        // Check if user is authorized to cancel
        if (booking.user.toString() !== req.user._id.toString() && 
            req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Check if booking can be cancelled
        if (booking.status === 'completed' || booking.status === 'cancelled') {
            return res.status(400).json({ error: 'Booking cannot be cancelled' });
        }

        booking.status = 'cancelled';
        await booking.save();

        // Update vehicle availability
        const vehicle = await Vehicle.findById(booking.vehicle);
        if (vehicle) {
            vehicle.isAvailable = true;
            vehicle.status = 'available';
            await vehicle.save();
        }

        res.json(booking);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get driver's bookings (for drivers)
router.get('/driver/bookings', auth, checkRole(['driver']), async (req, res) => {
    try {
        const bookings = await Booking.find({ 
            'vehicle.driver': req.user._id 
        })
        .populate('vehicle')
        .populate('user', 'name phone')
        .sort({ createdAt: -1 });
        
        res.json(bookings);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

module.exports = router; 