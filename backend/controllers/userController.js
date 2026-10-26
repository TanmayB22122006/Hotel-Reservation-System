const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const User = require("../models/User");
const { s3Client } = require("../middleware/upload");

// ---------------------------------------------------------------------------
// Helper: generate a pre-signed GET URL for a stored S3 key (3600s TTL)
// ---------------------------------------------------------------------------
async function buildPresignedUrl(key) {
  if (!key) return null;
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  } catch (err) {
    console.error("⚠️  Failed to generate pre-signed URL:", err.message);
    // Report AccessDenied honestly without crashing the response
    if (err.name === "AccessDenied" || err.$metadata?.httpStatusCode === 403) {
      console.error(
        "❌ AccessDenied from S3. Check that AWS credentials in .env are current\n" +
          "   (Learner Lab credentials expire when the session ends).\n" +
          "   Also verify AWS_SESSION_TOKEN is set if using temporary credentials."
      );
    }
    return null;
  }
}

// REGISTER USER IN MONGODB
// Now accepts multipart/form-data via multer (file is optional).
// If a photo was uploaded, multer-s3 already placed it in S3 and
// req.file.key holds the S3 object key.
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role = "guest" } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required." });
    }

    // Check if email already registered
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res
        .status(400)
        .json({ message: "An account with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // req.file is populated by multer-s3 when a photo is uploaded
    const profilePhotoKey = req.file ? req.file.key : null;

    const newUser = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role,
      profilePhotoKey,
    });

    res.status(201).json({
      message: "User registered successfully in MongoDB",
      user_id: newUser._id,
    });
  } catch (error) {
    console.error("Error in registerUser:", error);
    res
      .status(500)
      .json({ message: "Registration failed", error: error.message });
  }
};

// LOGIN USER IN MONGODB
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const secretKey =
      process.env.JWT_SECRET || "smart_hotel_default_secret_key";
    const token = jwt.sign(
      { id: user._id, role: user.role },
      secretKey,
      { expiresIn: "24h" }
    );

    res.json({ message: "Login successful", token });
  } catch (error) {
    console.error("Error in loginUser:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

// GET ALL USERS FROM MONGODB
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });

    const formattedUsers = users.map((u) => ({
      id: u._id.toString(),
      _id: u._id.toString(),
      name: u.name,
      email: u.email,
      role: u.role,
      profilePhotoKey: u.profilePhotoKey || null,
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error("Error in getUsers:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch users", error: error.message });
  }
};

// GET PRE-SIGNED URL FOR A USER'S PROFILE PHOTO
// GET /api/users/:id/photo
exports.getProfilePhoto = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(id).select("profilePhotoKey");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.profilePhotoKey) {
      return res.status(404).json({ message: "No profile photo on file" });
    }

    const url = await buildPresignedUrl(user.profilePhotoKey);

    if (!url) {
      return res.status(502).json({
        message:
          "Could not generate photo URL. Check AWS credentials in .env (Learner Lab credentials may have expired).",
      });
    }

    res.json({ url });
  } catch (error) {
    console.error("Error in getProfilePhoto:", error);
    res
      .status(500)
      .json({ message: "Failed to retrieve photo URL", error: error.message });
  }
};

// UPDATE USER
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const updated = await User.findByIdAndUpdate(
      id,
      { name, role },
      { new: true }
    ).select("-password");

    if (!updated) {
      return res.status(404).json({ message: "User not found to update" });
    }

    res.json({
      message: "User updated successfully in MongoDB",
      user: updated,
    });
  } catch (error) {
    console.error("Error in updateUser:", error);
    res
      .status(500)
      .json({ message: "Failed to update user", error: error.message });
  }
};

// DELETE USER
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "User not found to delete" });
    }

    res.json({ message: "User deleted successfully from MongoDB" });
  } catch (error) {
    console.error("Error in deleteUser:", error);
    res
      .status(500)
      .json({ message: "Failed to delete user", error: error.message });
  }
};