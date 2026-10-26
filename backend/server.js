const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("./database/db");

const express = require("express");
const cors = require("cors");

const app = express();


// MIDDLEWARE
app.use(cors());
app.use(express.json());


// HOME ROUTE
app.get("/", (req, res) => {
    res.send("Smart Hotel Backend Running");
});


// ROOM ROUTES
const roomRoutes = require("./routes/roomRoutes");
app.use("/api/rooms", roomRoutes);


// BOOKING ROUTES
const bookingRoutes = require("./routes/bookingRoutes");
app.use("/api/bookings", bookingRoutes);


// USER ROUTES
const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);


// SERVER PORT
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});