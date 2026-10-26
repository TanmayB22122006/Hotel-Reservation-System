const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");

// ---------------------------------------------------------------------------
// S3 client — reads credentials and region from environment variables only.
// Never hard-code credentials here.
// ---------------------------------------------------------------------------
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  // AWS SDK v3 automatically picks up:
  //   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SESSION_TOKEN
  // from process.env (set in backend/.env via dotenv).
});

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ---------------------------------------------------------------------------
// File filter — reject non-image types before upload starts
// ---------------------------------------------------------------------------
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type "${file.mimetype}". Only JPEG, PNG, and WebP are allowed.`
      ),
      false
    );
  }
};

// ---------------------------------------------------------------------------
// buildUpload — lazily creates the multer instance so the bucket name is read
// at request time (not at module load time). This prevents a crash at startup
// when S3_BUCKET_NAME is not yet configured in .env.
// ---------------------------------------------------------------------------
function buildUpload() {
  const bucket = process.env.S3_BUCKET_NAME;

  if (!bucket) {
    // Return a no-op middleware that passes the request through without
    // uploading anything. req.file will be undefined, so profilePhotoKey
    // stays null — graceful degradation when S3 is not configured.
    return (req, res, next) => {
      console.warn(
        "⚠️  S3_BUCKET_NAME is not set in .env — photo upload is disabled.\n" +
          "   Set S3_BUCKET_NAME (and AWS credentials) to enable profile photos."
      );
      next();
    };
  }

  const s3Storage = multerS3({
    s3: s3Client,
    bucket,
    // No ACL — bucket stays fully private; access only via pre-signed URLs
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      // Key format: avatars/<userId>-<timestamp>.<ext>
      const userId = req.params?.userId || req.body?.email || "unknown";
      const timestamp = Date.now();
      const ext = file.originalname.split(".").pop().toLowerCase();
      cb(null, `avatars/${userId}-${timestamp}.${ext}`);
    },
  });

  return multer({
    storage: s3Storage,
    fileFilter,
    limits: { fileSize: MAX_SIZE_BYTES },
  });
}

// ---------------------------------------------------------------------------
// Exported lazy upload factory and the shared s3Client instance
// ---------------------------------------------------------------------------
module.exports = { buildUpload, s3Client };
