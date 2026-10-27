
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

// Safely log diagnostic details without printing AWS credentials.
function logPhotoUploadError(err) {
  console.error("========== PROFILE PHOTO UPLOAD ERROR ==========");
  console.error("Name:", err?.name || "UnknownError");
  console.error("Code:", err?.code || "NoCode");
  console.error("Message:", err?.message || "No message");
  console.error(
    "HTTP status:",
    err?.$metadata?.httpStatusCode || "Unavailable"
  );
  console.error(
    "AWS request ID:",
    err?.$metadata?.requestId || "Unavailable"
  );
  console.error("================================================");
}

// Classify authentication errors separately from other failures.
function isAwsAuthError(err) {
  const name = String(err?.name || "").toLowerCase();
  const code = String(err?.code || "").toLowerCase();
  const message = String(err?.message || "").toLowerCase();

  return (
    [
      "invalidtoken",
      "expiredtoken",
      "invalidaccesskeyid",
      "signaturedoesnotmatch",
      "tokenrefreshrequired",
      "credentialprovidererror",
      "unrecognizedclientexception",
    ].includes(name) ||
    [
      "invalidtoken",
      "expiredtoken",
      "invalidaccesskeyid",
      "signaturedoesnotmatch",
    ].includes(code) ||
    message.includes("security token included in the request is invalid") ||
    message.includes("the security token included in the request is expired") ||
    message.includes("invalid access key") ||
    message.includes("could not load credentials") ||
    message.includes("unable to locate credentials") ||
    message.includes("credential provider")
  );
}

// Handle optional profile-photo uploads.
function uploadSingle(fieldName) {
  return (req, res, next) => {
    const contentType = req.headers["content-type"] || "";

    // Photo upload middleware is only required for multipart requests.
    if (!contentType.toLowerCase().includes("multipart/form-data")) {
      return next();
    }

    let uploader;

    try {
      uploader = buildUpload();
    } catch (err) {
      logPhotoUploadError(err);

      return res.status(500).json({
        message:
          "Unable to initialize photo upload. Check backend configuration and terminal logs.",
        error: err?.name || "UploadInitializationError",
      });
    }

    try {
      uploader.single(fieldName)(req, res, (err) => {
        if (err) {
          logPhotoUploadError(err);

          if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
              message: "Photo exceeds the 5 MB limit. Choose a smaller file.",
              error: "LIMIT_FILE_SIZE",
            });
          }

          if (
            String(err.message || "").startsWith("Invalid file type")
          ) {
            return res.status(400).json({
              message: err.message,
              error: "InvalidFileType",
            });
          }

          if (isAwsAuthError(err)) {
            return res.status(502).json({
              message:
                "AWS rejected the photo upload request. Check the backend terminal for the actual error.",
              error: "AwsAuthenticationError",
            });
          }

          const statusCode = err?.$metadata?.httpStatusCode;

          if (statusCode === 403 || err.name === "AccessDenied") {
            return res.status(403).json({
              message:
                "AWS denied the photo upload. Check bucket permissions and IAM policy in the backend terminal.",
              error: "S3AccessDenied",
            });
          }

          return res.status(500).json({
            message:
              "Photo upload failed. Check the backend terminal for the actual error.",
            error: err?.name || err?.code || "PhotoUploadError",
          });
        }

        // Only check bucket configuration when a file was actually uploaded.
        if (req.file && !process.env.S3_BUCKET_NAME?.trim()) {
          console.error(
            "PROFILE PHOTO CONFIGURATION ERROR: S3_BUCKET_NAME is missing."
          );

          return res.status(503).json({
            message: "S3_BUCKET_NAME is missing from backend/.env.",
            error: "S3StorageNotConfigured",
          });
        }

        return next();
      });
    } catch (err) {
      logPhotoUploadError(err);

      return res.status(500).json({
        message:
          "Photo upload failed during initialization. Check the backend terminal.",
        error: err?.name || "PhotoUploadError",
      });
    }
  };
}

// Register — profile photo is optional.
router.post("/register", uploadSingle("profilePhoto"), registerUser);

// Login.
router.post("/login", loginUser);

// Users.
router.get("/", getUsers);

// Get a pre-signed profile-photo URL.
router.get("/:id/photo", getProfilePhoto);

// Update and delete users.
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

module.exports = router;
