const mongoose = require("mongoose");
const Room = require("../models/Room");

// CREATE ROOM WITH COMPLETE DETAILS IN MONGODB
exports.createRoom = async (req, res) => {
  try {
    const {
      room_number,
      room_type,
      price,
      status = "Available",
      image = "",
      description = "",
      capacity = "2 Guests",
      bed_type = "1 King Bed",
      room_size = "380 sq ft",
      view_type = "City Skyline",
      amenities = ""
    } = req.body;

    if (!room_number || !room_type || !price) {
      return res.status(400).json({
        message: "room_number, room_type, and price are required."
      });
    }

    // Check if room number already exists
    const existingRoom = await Room.findOne({ room_number: Number(room_number) });
    if (existingRoom) {
      return res.status(400).json({
        message: `Room #${room_number} already exists in database.`
      });
    }

    const newRoom = await Room.create({
      room_number: Number(room_number),
      room_type,
      price: Number(price),
      status,
      image,
      description,
      capacity,
      bed_type,
      room_size,
      view_type,
      amenities: Array.isArray(amenities) ? amenities.join(", ") : amenities
    });

    res.status(201).json({
      message: "Room created successfully in MongoDB",
      room_id: newRoom._id,
      room: newRoom
    });
  } catch (error) {
    console.error("Error in createRoom:", error);
    res.status(500).json({ message: "Failed to create room", error: error.message });
  }
};

// GET ALL ROOMS FROM MONGODB
exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find().sort({ room_number: 1 });

    // Format to ensure both id and _id are present for frontend compatibility
    const formattedRooms = rooms.map((room) => ({
      id: room._id.toString(),
      _id: room._id.toString(),
      room_number: room.room_number,
      room_type: room.room_type,
      price: room.price,
      status: room.status,
      image: room.image,
      description: room.description,
      capacity: room.capacity,
      bed_type: room.bed_type,
      room_size: room.room_size,
      view_type: room.view_type,
      amenities: room.amenities
    }));

    res.json(formattedRooms);
  } catch (error) {
    console.error("Error in getRooms:", error);
    res.status(500).json({ message: "Failed to fetch rooms", error: error.message });
  }
};

// GET SINGLE ROOM BY ID OR ROOM NUMBER
exports.getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    let room = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      room = await Room.findById(id);
    }

    if (!room && !isNaN(Number(id))) {
      room = await Room.findOne({ room_number: Number(id) });
    }

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    res.json({
      id: room._id.toString(),
      _id: room._id.toString(),
      room_number: room.room_number,
      room_type: room.room_type,
      price: room.price,
      status: room.status,
      image: room.image,
      description: room.description,
      capacity: room.capacity,
      bed_type: room.bed_type,
      room_size: room.room_size,
      view_type: room.view_type,
      amenities: room.amenities
    });
  } catch (error) {
    console.error("Error in getRoomById:", error);
    res.status(500).json({ message: "Failed to fetch room", error: error.message });
  }
};

// UPDATE ROOM IN MONGODB
exports.updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    if (updateData.amenities && Array.isArray(updateData.amenities)) {
      updateData.amenities = updateData.amenities.join(", ");
    }
    if (updateData.price) {
      updateData.price = Number(updateData.price);
    }

    let updatedRoom = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      updatedRoom = await Room.findByIdAndUpdate(id, updateData, { returnDocument: "after" });
    } else if (!isNaN(Number(id))) {
      updatedRoom = await Room.findOneAndUpdate({ room_number: Number(id) }, updateData, { returnDocument: "after" });
    }

    if (!updatedRoom) {
      return res.status(404).json({ message: "Room not found to update" });
    }

    res.json({
      message: "Room updated successfully in MongoDB",
      room: updatedRoom
    });
  } catch (error) {
    console.error("Error in updateRoom:", error);
    res.status(500).json({ message: "Failed to update room", error: error.message });
  }
};

// DELETE ROOM IN MONGODB
exports.deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    let deleted = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      deleted = await Room.findByIdAndDelete(id);
    } else if (!isNaN(Number(id))) {
      deleted = await Room.findOneAndDelete({ room_number: Number(id) });
    }

    if (!deleted) {
      return res.status(404).json({ message: "Room not found to delete" });
    }

    res.json({ message: "Room deleted successfully from MongoDB" });
  } catch (error) {
    console.error("Error in deleteRoom:", error);
    res.status(500).json({ message: "Failed to delete room", error: error.message });
  }
};