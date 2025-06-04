function submitBooking(event) {
    event.preventDefault();
    const type = document.querySelector('.ride-card.selected').getAttribute('data-type');
    const pickup = document.getElementById('pickup').value;
    const destination = document.getElementById('destination').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const distance = parseFloat(document.getElementById('distance').value);

    if (!distance || distance <= 0) {
        alert('Please enter a valid distance!');
        return false;
    }

    const rates = {
        normal: 1.5,
        premium: 3.0,
        security: 5.0
    };
    const rate = rates[type];
    const price = (rate * distance).toFixed(2);

    let extra;
    if (type === 'premium') {
        extra = document.getElementById('vehicleType').value;
        if (!extra) return alert('Select a premium vehicle type!');
    } else if (type === 'security') {
        extra = document.getElementById('escortType').value;
        if (!extra) return alert('Select a security escort package!');
    } else {
        extra = document.getElementById('normalType').value;
        if (!extra) return alert('Select a normal vehicle type!');
    }

    if (!pickup || !destination || !date || !time) {
        alert('Please fill in all fields!');
        return false;
    }

    alert(
        `Booking Confirmed!\n\n` +
        `Type: ${type.charAt(0).toUpperCase() + type.slice(1)}\n` +
        `From: ${pickup}\nTo: ${destination}\nDistance: ${distance} km\n` +
        `Date: ${date}\nTime: ${time}\n` +
        `Option: ${extra.replace(/_/g,' ')}\n` +
        `Price: $${price}`
    );

    document.getElementById('bookingForm').reset();
    selectRideType(document.querySelector('.ride-card[data-type="premium"]'));
    return false;
}
