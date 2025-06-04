const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes
const userRoutes = require('./routes/userRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
const bookingRoutes = require('./routes/bookingRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/safetravels', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/bookings', bookingRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected');

    // Handle vehicle location updates
    socket.on('updateVehicleLocation', async (data) => {
        try {
            const { vehicleId, coordinates } = data;
            // Emit the location update to all connected clients
            io.emit('vehicleLocationUpdated', { vehicleId, coordinates });
        } catch (error) {
            console.error('Error updating vehicle location:', error);
        }
    });

    // Handle booking status updates
    socket.on('bookingStatusUpdate', async (data) => {
        try {
            const { bookingId, status } = data;
            // Emit the status update to all connected clients
            io.emit('bookingStatusUpdated', { bookingId, status });
        } catch (error) {
            console.error('Error updating booking status:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
