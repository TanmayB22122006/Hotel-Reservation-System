const express = require("express");

const router = express.Router();

const {
  registerUser,
  loginUser,
  getUsers,
  updateUser,
  deleteUser,
  getProfilePhoto,
} = require("../controllers/userController");

const { buildUpload } = require("../middleware/upload");

// ---------------------------------------------------------------------------
// Error-handling wrapper for multer so validation errors (wrong MIME, size)
// return a clean JSON 400 instead of crashing the process.
// ---------------------------------------------------------------------------
function uploadSingle(fieldName) {
  return (req, res, next) => {
    const uploader = buildUpload();
    uploader.single(fieldName)(req, res, (err) => {
      if (!err) return next();

      // multer limit errors
      if (err.code === "LIMIT_FILE_SIZE") {
        return res
          .status(400)
          .json({ message: "Photo exceeds 5 MB limit. Please choose a smaller file." });
      }

      // Our custom fileFilter error
      if (err.message && err.message.startsWith("Invalid file type")) {
        return res.status(400).json({ message: err.message });
      }

      // AWS / network errors during upload
      console.error("Upload middleware error:", err);
      return res
        .status(500)
        .json({ message: "Photo upload failed", error: err.message });
    });
  };
}

// REGISTER  — accepts multipart/form-data; photo field is optional
router.post("/register", uploadSingle("profilePhoto"), registerUser);

// LOGIN
router.post("/login", loginUser);

// GET USERS
router.get("/", getUsers);

// GET PRE-SIGNED PHOTO URL FOR A SPECIFIC USER
router.get("/:id/photo", getProfilePhoto);

// UPDATE USER
router.put("/:id", updateUser);

// DELETE USER
router.delete("/:id", deleteUser);

module.exports = router;