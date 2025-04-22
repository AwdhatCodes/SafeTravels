let map;
let marker;
let routeLayer;
let searchMarker;
let currentRouteDistance = 0; // Store the current route distance
let currentBasePrice = 0; // Store the current base price
let selectedEscorts = new Set(); // Track selected escorts

function initMap() {
    // Default to Nairobi coordinates
    const nairobi = [ -1.2921, 36.8219 ];
    
    // Initialize the map
    map = L.map('map').setView(nairobi, 12);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Initialize marker
    marker = L.marker(nairobi, {
        title: 'Your Location',
        icon: L.divIcon({
            className: 'custom-div-icon',
            html: '<div style="background-color: #00ff00; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #000;"></div>',
            iconSize: [12, 12]
        })
    }).addTo(map);

    // Initialize route layer
    routeLayer = L.layerGroup().addTo(map);

    // Initialize search marker
    searchMarker = L.marker([0, 0], {
        icon: L.divIcon({
            className: 'search-marker',
            html: '<div style="background-color: #007bff; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff;"></div>',
            iconSize: [12, 12]
        })
    });

    // Add search event listener
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch(this.value);
        }
    });
}

function handleSearch(query) {
    if (!query) return;

    // Use Nominatim for geocoding
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                
                // Remove previous search marker if exists
                if (searchMarker) {
                    map.removeLayer(searchMarker);
                }

                // Add new search marker
                searchMarker.setLatLng([lat, lng]).addTo(map);
                
                // Center map on the result
                map.setView([lat, lng], 15);
                
                // Update search results display
                const searchResults = document.getElementById('searchResults');
                searchResults.innerHTML = '';
                
                data.slice(0, 5).forEach(item => {
                    const div = document.createElement('div');
                    div.className = 'search-result';
                    div.textContent = item.display_name;
                    div.onclick = () => {
                        const lat = parseFloat(item.lat);
                        const lng = parseFloat(item.lon);
                        searchMarker.setLatLng([lat, lng]);
                        map.setView([lat, lng], 15);
                        searchResults.style.display = 'none';
                    };
                    searchResults.appendChild(div);
                });
                
                searchResults.style.display = 'block';
            } else {
                alert('No results found for: ' + query);
            }
        })
        .catch(error => {
            console.error('Error searching location:', error);
            alert('Error searching location. Please try again.');
        });
}

function setCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const pos = [position.coords.latitude, position.coords.longitude];
                map.setView(pos, 15);
                marker.setLatLng(pos);
            },
            () => {
                alert('Error: The Geolocation service failed.');
            }
        );
    } else {
        alert('Error: Your browser doesn\'t support geolocation.');
    }
}

function calculateAndDisplayRoute() {
    const pickup = document.getElementById('pickup').value;
    const destination = document.getElementById('destination').value;
    
    if (!pickup || !destination) {
        alert('Please enter both pickup and destination locations');
        return;
    }

    // Clear previous route
    routeLayer.clearLayers();

    // Geocode both locations
    Promise.all([
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(pickup)}`).then(res => res.json()),
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}`).then(res => res.json())
    ])
    .then(([pickupResults, destResults]) => {
        if (pickupResults.length === 0 || destResults.length === 0) {
            alert('Could not find one or both locations. Please check your input.');
            return;
        }

        const start = {
            lat: parseFloat(pickupResults[0].lat),
            lng: parseFloat(pickupResults[0].lon)
        };
        const end = {
            lat: parseFloat(destResults[0].lat),
            lng: parseFloat(destResults[0].lon)
        };

        // Use OSRM for routing with detailed geometry
        fetch(`https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`)
            .then(response => response.json())
            .then(data => {
                if (data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                    
                    // Store the distance for pricing calculation
                    currentRouteDistance = route.distance / 1000; // Convert to kilometers
                    
                    // Calculate distance and duration
                    const distance = (route.distance / 1000).toFixed(1);
                    const duration = Math.ceil(route.duration / 60);

                    // Create route info div with improved styling
                    const routeInfo = L.divIcon({
                        className: 'route-info',
                        html: `<div style="background: rgba(255, 255, 255, 0.9); padding: 12px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 14px; min-width: 150px; text-align: center;">
                            <div style="color: #333; font-weight: bold; margin-bottom: 5px;">Route Information</div>
                            <div style="color: #007bff;"><strong>Distance:</strong> ${distance} km</div>
                            <div style="color: #28a745;"><strong>Duration:</strong> ${duration} min</div>
                        </div>`,
                        iconSize: [180, 80]
                    });

                    // Add route info to the middle of the route with improved positioning
                    const midPoint = coordinates[Math.floor(coordinates.length / 2)];
                    const routeInfoMarker = L.marker(midPoint, { 
                        icon: routeInfo,
                        zIndexOffset: 1000 // Ensure it's above other map elements
                    }).addTo(routeLayer);
                    
                    // Draw the route with proper road styling
                    L.polyline(coordinates, {
                        color: '#007bff',
                        weight: 5,
                        opacity: 0.8,
                        lineCap: 'round',
                        lineJoin: 'round',
                        dashArray: null // Remove dashArray for solid line
                    }).addTo(routeLayer);

                    // Add a shadow effect for better visibility
                    L.polyline(coordinates, {
                        color: '#000',
                        weight: 7,
                        opacity: 0.2,
                        lineCap: 'round',
                        lineJoin: 'round'
                    }).addTo(routeLayer);

                    // Fit the map to show the entire route with padding
                    const bounds = L.latLngBounds(coordinates);
                    map.fitBounds(bounds, { padding: [50, 50] });

                    // Add markers for start and end points with improved styling
                    L.marker([start.lat, start.lng], {
                        icon: L.divIcon({
                            className: 'start-marker',
                            html: '<div style="background-color: #28a745; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>',
                            iconSize: [16, 16]
                        })
                    }).addTo(routeLayer);

                    L.marker([end.lat, end.lng], {
                        icon: L.divIcon({
                            className: 'end-marker',
                            html: '<div style="background-color: #dc3545; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>',
                            iconSize: [16, 16]
                        })
                    }).addTo(routeLayer);

                    // Add turn-by-turn directions if available
                    if (route.legs && route.legs[0].steps) {
                        const steps = route.legs[0].steps;
                        steps.forEach((step, index) => {
                            if (index < steps.length - 1) { // Don't add marker for last step
                                const coord = step.maneuver.location;
                                L.circleMarker([coord[1], coord[0]], {
                                    radius: 3,
                                    color: '#007bff',
                                    fillColor: '#fff',
                                    weight: 2,
                                    opacity: 0.8,
                                    fillOpacity: 1
                                }).addTo(routeLayer);
                            }
                        });
                    }
                } else {
                    alert('No route found between these locations');
                }
            })
            .catch(error => {
                console.error('Error calculating route:', error);
                alert('Error calculating route. Please try again.');
            });
    })
    .catch(error => {
        console.error('Error geocoding locations:', error);
        alert('Error finding locations. Please check your input and try again.');
    });
}

function calculateBasePrice(distance) {
    // Base price per km
    const baseRate = 50; // Ksh per km
    return Math.round(distance * baseRate);
}

// Function to generate random profile images
function getRandomProfileImage(gender) {
    const maleImages = [
        'https://randomuser.me/api/portraits/men/1.jpg',
        'https://randomuser.me/api/portraits/men/2.jpg',
        'https://randomuser.me/api/portraits/men/3.jpg',
        'https://randomuser.me/api/portraits/men/4.jpg',
        'https://randomuser.me/api/portraits/men/5.jpg'
    ];
    const femaleImages = [
        'https://randomuser.me/api/portraits/women/1.jpg',
        'https://randomuser.me/api/portraits/women/2.jpg',
        'https://randomuser.me/api/portraits/women/3.jpg',
        'https://randomuser.me/api/portraits/women/4.jpg',
        'https://randomuser.me/api/portraits/women/5.jpg'
    ];
    return gender === 'male' ? maleImages[Math.floor(Math.random() * maleImages.length)] : 
                              femaleImages[Math.floor(Math.random() * femaleImages.length)];
}

// Function to generate random availability status
function getRandomAvailability() {
    return Math.random() > 0.3; // 70% chance of being available
}

// Add this function at the top of the file
function getRandomDriverImage() {
    const driverImages = [
        'https://randomuser.me/api/portraits/men/32.jpg',
        'https://randomuser.me/api/portraits/men/44.jpg',
        'https://randomuser.me/api/portraits/men/67.jpg',
        'https://randomuser.me/api/portraits/women/32.jpg',
        'https://randomuser.me/api/portraits/women/44.jpg',
        'https://randomuser.me/api/portraits/women/67.jpg'
    ];
    return driverImages[Math.floor(Math.random() * driverImages.length)];
}

function showBookingOptions() {
    if (currentRouteDistance === 0) {
        alert('Please calculate a route first to get accurate pricing');
        return;
    }

    currentBasePrice = calculateBasePrice(currentRouteDistance);
    
    // Generate random escort data
    const maleEscorts = Array(3).fill(null).map(() => ({
        id: Math.random().toString(36).substr(2, 9),
        name: `Officer ${Math.floor(Math.random() * 1000)}`,
        image: getRandomProfileImage('male'),
        available: getRandomAvailability(),
        rating: (4 + Math.random()).toFixed(1)
    }));

    const femaleEscorts = Array(3).fill(null).map(() => ({
        id: Math.random().toString(36).substr(2, 9),
        name: `Officer ${Math.floor(Math.random() * 1000)}`,
        image: getRandomProfileImage('female'),
        available: getRandomAvailability(),
        rating: (4 + Math.random()).toFixed(1)
    }));

    const bookingModal = document.createElement('div');
    bookingModal.className = 'booking-modal';
    bookingModal.innerHTML = `
        <div class="booking-content">
            <h2>Book Your Safe Travel</h2>
            <div class="route-info">
                <p>Distance: ${currentRouteDistance.toFixed(1)} km</p>
                <p>Base Price: Ksh ${currentBasePrice}</p>
            </div>
            <div class="booking-section">
                <h3>Available Vehicles & Drivers</h3>
                <div class="vehicle-options">
                    <div class="vehicle-card">
                        <div class="driver-info">
                            <img src="${getRandomDriverImage()}" alt="Driver" class="driver-photo">
                            <div class="driver-details">
                                <h4>John M.</h4>
                                <p>5 years experience</p>
                                <div class="rating">
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star-half'></i>
                                    <span>4.7</span>
                                </div>
                            </div>
                        </div>
                        <div class="vehicle-details">
                            <i class='bx bx-car'></i>
                            <h4>Premium Sedan</h4>
                            <div class="pricing">
                                <div class="price-item">
                                    <span>Base Rate:</span>
                                    <span>Ksh 2,500</span>
                                </div>
                                <div class="price-item">
                                    <span>Per Km:</span>
                                    <span>Ksh 50</span>
                                </div>
                                <div class="price-item total">
                                    <span>Total:</span>
                                    <span>Ksh ${currentBasePrice + 2500}</span>
                                </div>
                            </div>
                            <p class="features">Luxury comfort • Air conditioning • WiFi</p>
                            <button onclick="selectVehicle('premium')" class="confirm-btn">Select Premium</button>
                        </div>
                    </div>
                    <div class="vehicle-card">
                        <div class="driver-info">
                            <img src="${getRandomDriverImage()}" alt="Driver" class="driver-photo">
                            <div class="driver-details">
                                <h4>Sarah K.</h4>
                                <p>7 years experience</p>
                                <div class="rating">
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star'></i>
                                    <span>5.0</span>
                                </div>
                            </div>
                        </div>
                        <div class="vehicle-details">
                            <i class='bx bx-car'></i>
                            <h4>SUV</h4>
                            <div class="pricing">
                                <div class="price-item">
                                    <span>Base Rate:</span>
                                    <span>Ksh 3,000</span>
                                </div>
                                <div class="price-item">
                                    <span>Per Km:</span>
                                    <span>Ksh 60</span>
                                </div>
                                <div class="price-item total">
                                    <span>Total:</span>
                                    <span>Ksh ${currentBasePrice + 3000}</span>
                                </div>
                            </div>
                            <p class="features">Spacious ride • Extra luggage space • Child seats</p>
                            <button onclick="selectVehicle('suv')" class="confirm-btn">Select SUV</button>
                        </div>
                    </div>
                    <div class="vehicle-card">
                        <div class="driver-info">
                            <img src="${getRandomDriverImage()}" alt="Driver" class="driver-photo">
                            <div class="driver-details">
                                <h4>Michael R.</h4>
                                <p>10 years experience</p>
                                <div class="rating">
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star'></i>
                                    <i class='bx bxs-star'></i>
                                    <span>5.0</span>
                                </div>
                            </div>
                        </div>
                        <div class="vehicle-details">
                            <i class='bx bx-car'></i>
                            <h4>VIP Service</h4>
                            <div class="pricing">
                                <div class="price-item">
                                    <span>Base Rate:</span>
                                    <span>Ksh 4,000</span>
                                </div>
                                <div class="price-item">
                                    <span>Per Km:</span>
                                    <span>Ksh 80</span>
                                </div>
                                <div class="price-item total">
                                    <span>Total:</span>
                                    <span>Ksh ${currentBasePrice + 4000}</span>
                                </div>
                            </div>
                            <p class="features">VIP experience • Privacy partition • Refreshments</p>
                            <button onclick="selectVehicle('luxury')" class="confirm-btn">Select VIP</button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="booking-section">
                <h3>Available Security Escorts</h3>
                <p class="escort-note">You can select multiple escorts for enhanced security</p>
                <div class="escort-options">
                    <div class="escort-gender-section">
                        <h4>Male Escorts</h4>
                        <div class="escort-cards">
                            ${maleEscorts.map(escort => `
                                <div class="escort-card ${escort.available ? '' : 'unavailable'}" 
                                     data-escort-id="${escort.id}"
                                     onclick="${escort.available ? `selectEscort('male', '${escort.id}')` : ''}">
                                    <div class="escort-image">
                                        <img src="${escort.image}" alt="${escort.name}">
                                        <div class="availability-tag ${escort.available ? 'available' : 'unavailable'}">
                                            ${escort.available ? 'Available' : 'Unavailable'}
                                        </div>
                                    </div>
                                    <div class="escort-details">
                                        <h4>${escort.name}</h4>
                                        <div class="rating-container">
                                            <div class="stars">
                                                ${Array(5).fill().map((_, i) => `
                                                    <i class='bx ${i < Math.floor(escort.rating) ? 'bxs' : 'bx'}-star'></i>
                                                `).join('')}
                                            </div>
                                            <span class="rating">${escort.rating}</span>
                                        </div>
                                        <div class="escort-info">
                                            <span class="price">+ Ksh 1,500</span>
                                            <span class="experience">${Math.floor(Math.random() * 5) + 3} years exp</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="escort-gender-section">
                        <h4>Female Escorts</h4>
                        <div class="escort-cards">
                            ${femaleEscorts.map(escort => `
                                <div class="escort-card ${escort.available ? '' : 'unavailable'}" 
                                     data-escort-id="${escort.id}"
                                     onclick="${escort.available ? `selectEscort('female', '${escort.id}')` : ''}">
                                    <div class="escort-image">
                                        <img src="${escort.image}" alt="${escort.name}">
                                        <div class="availability-tag ${escort.available ? 'available' : 'unavailable'}">
                                            ${escort.available ? 'Available' : 'Unavailable'}
                                        </div>
                                    </div>
                                    <div class="escort-details">
                                        <h4>${escort.name}</h4>
                                        <div class="rating-container">
                                            <div class="stars">
                                                ${Array(5).fill().map((_, i) => `
                                                    <i class='bx ${i < Math.floor(escort.rating) ? 'bxs' : 'bx'}-star'></i>
                                                `).join('')}
                                            </div>
                                            <span class="rating">${escort.rating}</span>
                                        </div>
                                        <div class="escort-info">
                                            <span class="price">+ Ksh 1,500</span>
                                            <span class="experience">${Math.floor(Math.random() * 5) + 3} years exp</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
            <div class="booking-summary">
                <h3>Booking Summary</h3>
                <div id="selected-vehicle">No vehicle selected</div>
                <div id="selected-escort">No escorts selected</div>
                <div id="base-price">Base Price: Ksh ${currentBasePrice}</div>
                <div id="total-price">Total: Ksh ${currentBasePrice}</div>
            </div>
            <div class="booking-actions">
                <button onclick="closeBookingModal()" class="cancel-btn">Cancel</button>
            </div>
        </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .booking-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .booking-content {
            background: #1a1a1a;
            padding: 20px;
            border-radius: 10px;
            width: 90%;
            max-width: 800px;
            max-height: 90vh;
            overflow-y: auto;
        }
        .route-info {
            background: #2a2a2a;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
        }
        .route-info p {
            margin: 5px 0;
            color: #00ff00;
        }
        .booking-section {
            margin-bottom: 20px;
        }
        .vehicle-options {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
        }
        .vehicle-card {
            background: #2a2a2a;
            border-radius: 8px;
            padding: 15px;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 2px solid transparent;
        }
        .vehicle-card:hover {
            transform: translateY(-2px);
            border-color: #00ff00;
        }
        .driver-info {
            display: flex;
            align-items: center;
            gap: 15px;
            margin-bottom: 15px;
        }
        .driver-photo {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            object-fit: cover;
            border: 2px solid #00ff00;
        }
        .driver-details h4 {
            margin: 0 0 5px 0;
            color: white;
        }
        .driver-details p {
            margin: 0;
            color: #aaa;
            font-size: 12px;
        }
        .rating {
            display: flex;
            align-items: center;
            gap: 2px;
            margin-top: 5px;
        }
        .rating i {
            color: #ffc107;
            font-size: 14px;
        }
        .rating span {
            color: #ffc107;
            font-size: 12px;
            margin-left: 5px;
        }
        .vehicle-details {
            text-align: center;
        }
        .vehicle-details i {
            font-size: 24px;
            color: #00ff00;
            margin-bottom: 10px;
        }
        .vehicle-details h4 {
            margin: 5px 0;
            color: white;
        }
        .price {
            color: #00ff00;
            font-weight: bold;
            margin: 5px 0;
        }
        .features {
            color: #aaa;
            font-size: 12px;
            margin: 5px 0;
        }
        .escort-gender-section {
            margin-bottom: 20px;
        }
        .escort-gender-section h4 {
            color: #00ff00;
            margin-bottom: 10px;
        }
        .escort-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 15px;
        }
        .escort-card {
            background: #2a2a2a;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 2px solid transparent;
        }
        .escort-image {
            position: relative;
            width: 100%;
            height: 120px;
        }
        .escort-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .availability-tag {
            position: absolute;
            top: 10px;
            right: 10px;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .availability-tag.available {
            background: #28a745;
            color: white;
        }
        .availability-tag.unavailable {
            background: #dc3545;
            color: white;
        }
        .escort-details {
            padding: 10px;
        }
        .escort-details h4 {
            margin: 0 0 5px 0;
            color: white;
        }
        .rating-container {
            display: flex;
            align-items: center;
            gap: 5px;
            margin-bottom: 5px;
        }
        .stars {
            color: #ffc107;
        }
        .rating {
            color: #ffc107;
            font-weight: bold;
            font-size: 14px;
        }
        .escort-info {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .price {
            color: #00ff00;
            font-weight: bold;
        }
        .experience {
            color: #aaa;
            font-size: 12px;
        }
        .escort-card:hover {
            transform: translateY(-2px);
            border-color: #00ff00;
        }
        .escort-card.selected {
            border-color: #00ff00;
        }
        .escort-card.selected::after {
            content: '✓';
            position: absolute;
            top: 5px;
            left: 5px;
            background: #00ff00;
            color: #000;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }
        .escort-card.unavailable {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .booking-summary {
            background: #2a2a2a;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .booking-actions {
            display: flex;
            justify-content: flex-end;
            margin-top: 20px;
        }
        .cancel-btn {
            padding: 10px 20px;
            background: #333;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
        }
        .cancel-btn:hover {
            background: #444;
        }
        .escort-note {
            color: #00ff00;
            font-size: 14px;
            margin-bottom: 15px;
            text-align: center;
        }
        .pricing {
            background: #333;
            padding: 10px;
            border-radius: 5px;
            margin: 10px 0;
        }
        .price-item {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            color: #aaa;
        }
        .price-item.total {
            color: #00ff00;
            font-weight: bold;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid #444;
        }
        .confirm-btn {
            width: 100%;
            padding: 10px;
            background: #00ff00;
            color: #000;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            margin-top: 10px;
            transition: all 0.3s ease;
        }
        .confirm-btn:hover {
            background: #00cc00;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(bookingModal);
}

function selectVehicle(type) {
    const cards = document.querySelectorAll('.vehicle-card');
    cards.forEach(card => card.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    
    const vehiclePrice = {
        'premium': 2500,
        'suv': 3000,
        'luxury': 4000
    }[type];
    
    document.getElementById('selected-vehicle').textContent = `Vehicle: ${type.charAt(0).toUpperCase() + type.slice(1)} - + Ksh ${vehiclePrice}`;
    updateTotal(vehiclePrice);

    // Show payment confirmation modal for all vehicle types
    showPaymentModal(type, vehiclePrice);
}

function selectEscort(gender, escortId) {
    const card = event.currentTarget;
    const escortName = card.querySelector('h4').textContent;
    const escortPrice = 1500;

    if (card.classList.contains('selected')) {
        // Deselect escort
        card.classList.remove('selected');
        selectedEscorts.delete(escortId);
    } else {
        // Select escort
        card.classList.add('selected');
        selectedEscorts.add(escortId);
    }

    // Update escort selection display
    const escortList = Array.from(selectedEscorts).map(id => {
        const escortCard = document.querySelector(`[data-escort-id="${id}"]`);
        return escortCard ? escortCard.querySelector('h4').textContent : '';
    }).filter(Boolean);

    const totalEscortPrice = selectedEscorts.size * escortPrice;
    document.getElementById('selected-escort').textContent = 
        `Escorts: ${escortList.join(', ') || 'None'} - + Ksh ${totalEscortPrice}`;
    
    updateTotal(null, totalEscortPrice);
}

function updateTotal(vehiclePrice = null, escortPrice = null) {
    // Get current values from the DOM
    const vehicleText = document.getElementById('selected-vehicle').textContent;
    const escortText = document.getElementById('selected-escort').textContent;
    
    // Parse current prices if not provided
    const currentVehiclePrice = vehiclePrice !== null ? vehiclePrice : 
        (vehicleText.includes('Ksh') ? parseInt(vehicleText.split('Ksh ')[1]) : 0);
    const currentEscortPrice = escortPrice !== null ? escortPrice : 
        (escortText.includes('Ksh') ? parseInt(escortText.split('Ksh ')[1]) : 0);
    
    // Calculate total
    const total = currentBasePrice + currentVehiclePrice + currentEscortPrice;
    document.getElementById('total-price').textContent = `Total: Ksh ${total}`;
}

function confirmBooking() {
    const vehicle = document.getElementById('selected-vehicle').textContent;
    const escort = document.getElementById('selected-escort').textContent;
    const total = document.getElementById('total-price').textContent;
    
    if (vehicle === 'No vehicle selected') {
        alert('Please select a vehicle');
        return;
    }
    
    alert(`Booking Confirmed!\n${vehicle}\n${escort}\n${total}\n\nYour driver will arrive shortly.`);
    closeBookingModal();
}

function closeBookingModal() {
    const modal = document.querySelector('.booking-modal');
    if (modal) {
        modal.remove();
    }
    selectedEscorts.clear(); // Clear selected escorts when closing modal
}

function bookRide() {
    const pickup = document.getElementById('pickup').value;
    const destination = document.getElementById('destination').value;
    
    if (!pickup || !destination) {
        alert('Please enter both pickup and destination locations');
        return;
    }
    
    showBookingOptions();
}

// Add these functions at the top of the file
function hideMap() {
    const mapSection = document.querySelector('.map-section');
    if (mapSection) {
        mapSection.style.display = 'none';
    }
    // Also hide the map container
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.style.display = 'none';
    }
}

function showMap() {
    const mapSection = document.querySelector('.map-section');
    if (mapSection) {
        mapSection.style.display = 'block';
    }
    // Also show the map container
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.style.display = 'block';
    }
}

// Add event listeners for navigation
document.addEventListener('DOMContentLoaded', function() {
    // Function to check current section and update map visibility
    function updateMapVisibility() {
        const currentHash = window.location.hash;
        // Show map by default if no hash or if on home section
        if (!currentHash || currentHash === '#home') {
            showMap();
        } else {
            hideMap();
        }
    }

    // Initial check - show map by default
    showMap();

    // Listen for hash changes
    window.addEventListener('hashchange', updateMapVisibility);

    // Listen for clicks on home link
    document.querySelectorAll('a[href="#home"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.hash = this.getAttribute('href');
            showMap();
        });
    });

    // Listen for clicks on all other navigation links
    document.querySelectorAll('a[href="#services"], a[href="#about"], a[href="#plans"], a[href="#review"], a[href="#activity"], a[href="#account"]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.hash = this.getAttribute('href');
            hideMap();
        });
    });
});

function showPaymentModal(type, price) {
    const modal = document.createElement('div');
    modal.className = 'payment-modal';
    modal.innerHTML = `
        <div class="payment-modal-content">
            <h2>Confirm Payment</h2>
            <div class="payment-details">
                <p>Vehicle: ${type.charAt(0).toUpperCase() + type.slice(1)}</p>
                <p>Price: Ksh ${price}</p>
                <p>Total with Base Price: Ksh ${currentBasePrice + price}</p>
            </div>
            <div class="payment-options">
                <button onclick="processPayment('mpesa', ${price})" class="payment-btn mpesa-btn">
                    <i class='bx bx-mobile-alt'></i> Pay with M-Pesa
                </button>
                <button onclick="processPayment('card', ${price})" class="payment-btn card-btn">
                    <i class='bx bx-credit-card'></i> Pay with Card
                </button>
                <button onclick="processPayment('paypal', ${price})" class="payment-btn paypal-btn">
                    <i class='bx bxl-paypal'></i> Pay with PayPal
                </button>
            </div>
            <button onclick="closePaymentModal()" class="cancel-btn">Cancel</button>
        </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .payment-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .payment-modal-content {
            background: white;
            padding: 30px;
            border-radius: 10px;
            width: 90%;
            max-width: 500px;
            text-align: center;
        }
        .payment-details {
            margin: 20px 0;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .payment-details p {
            margin: 10px 0;
            color: #333;
        }
        .payment-options {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin: 20px 0;
        }
        .payment-btn {
            padding: 12px;
            border: none;
            border-radius: 5px;
            color: white;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            transition: all 0.3s ease;
        }
        .mpesa-btn {
            background: #00A300;
        }
        .card-btn {
            background: #007bff;
        }
        .paypal-btn {
            background: #003087;
        }
        .payment-btn:hover {
            transform: translateY(-2px);
            opacity: 0.9;
        }
        .cancel-btn {
            padding: 10px 20px;
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 10px;
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(modal);
}

function processPayment(method, price) {
    let message = '';
    switch(method) {
        case 'mpesa':
            message = `Please complete payment of Ksh ${price} via M-Pesa.\nPaybill: 123456\nAccount: Your Phone Number`;
            break;
        case 'card':
            message = `Please enter your card details to complete payment of Ksh ${price}`;
            break;
        case 'paypal':
            message = `Redirecting to PayPal to complete payment of Ksh ${price}`;
            break;
    }
    alert(message);
    closePaymentModal();
    // Here you would typically integrate with actual payment processing
}

function closePaymentModal() {
    const modal = document.querySelector('.payment-modal');
    if (modal) {
        modal.remove();
    }
} 