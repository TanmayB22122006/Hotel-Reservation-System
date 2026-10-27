const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { GetObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
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
      Bucket: process.env.S3_BUCKET_NAME?.trim(),
      Key: key,
    });
    return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  } catch (err) {
    console.error("⚠️  Failed to generate pre-signed URL:", err.message);
    return null;
  }
}

// REGISTER USER IN MONGODB
// Accepts multipart/form-data via multer or application/json.
// If a photo was uploaded, multer-s3 placed it in S3 and req.file.key holds the key.
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role = "guest" } = req.body || {};

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

    // req.file is populated by multer-s3 when a photo is uploaded to S3
    const profilePhotoKey = req.file?.key || null;

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: "guest", // Always guest for public registration; admin accounts cannot be self-registered
      profilePhotoKey,
    });

    res.status(201).json({
      message: "User registered successfully in MongoDB",
      user_id: newUser._id,
      user: {
        id: newUser._id.toString(),
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        profilePhotoKey: newUser.profilePhotoKey,
      },
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
    const { email, password } = req.body || {};

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

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        profilePhotoKey: user.profilePhotoKey || null,
      },
    });
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

    const bucket = process.env.S3_BUCKET_NAME?.trim();
    if (!bucket) {
      return res.status(503).json({
        message: "Photo storage is not configured. S3_BUCKET_NAME is missing in .env.",
      });
    }

    // Verify object exists in S3 before generating presigned URL
    try {
      const headCmd = new HeadObjectCommand({
        Bucket: bucket,
        Key: user.profilePhotoKey,
      });
      await s3Client.send(headCmd);
    } catch (headErr) {
      if (
        headErr.name === "NotFound" ||
        headErr.name === "NoSuchKey" ||
        headErr.$metadata?.httpStatusCode === 404
      ) {
        return res.status(404).json({ message: "Profile photo not found in storage" });
      }

      if (
        headErr.name === "InvalidToken" ||
        headErr.name === "ExpiredToken" ||
        headErr.name === "InvalidAccessKeyId" ||
        headErr.name === "AccessDenied" ||
        headErr.$metadata?.httpStatusCode === 403 ||
        headErr.$metadata?.httpStatusCode === 400 ||
        (headErr.message && (
          headErr.message.includes("token") ||
          headErr.message.includes("credential") ||
          headErr.message.includes("Access Denied") ||
          headErr.message.includes("security token")
        ))
      ) {
        console.error("❌ S3 error verifying profile photo:", headErr.name, headErr.message);
        return res.status(502).json({
          message:
            "Could not retrieve photo: AWS S3 credentials in backend/.env are invalid or expired (Learner Lab credentials require an active session and complete session token).",
        });
      }

      console.error("⚠️ S3 HeadObject unexpected error:", headErr.message);
      return res.status(500).json({
        message: "Failed to verify photo in storage",
        error: headErr.message,
      });
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
      { returnDocument: "after" }
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