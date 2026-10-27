const multer = require("multer");
const multerS3 = require("multer-s3");
const { S3Client } = require("@aws-sdk/client-s3");

// ---------------------------------------------------------------------------
// S3 client — reads credentials and region from environment variables only.
// Never hard-code credentials here.
// ---------------------------------------------------------------------------
function getAwsCredentials() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const sessionToken = process.env.AWS_SESSION_TOKEN?.trim();

  if (accessKeyId && secretAccessKey) {
    const creds = { accessKeyId, secretAccessKey };
    if (sessionToken && sessionToken.length > 0) {
      creds.sessionToken = sessionToken;
    }
    return creds;
  }
  return undefined;
}

const credentials = getAwsCredentials();

const s3Client = new S3Client({
  region: process.env.AWS_REGION?.trim() || "us-east-1",
  ...(credentials ? { credentials } : {}),
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
// at request time. If S3_BUCKET_NAME is not set, returns a memoryStorage
// multer instance so form fields are parsed into req.body and uploader.single()
// is always a valid function.
// ---------------------------------------------------------------------------
function buildUpload() {
  const bucket = process.env.S3_BUCKET_NAME?.trim();

  if (!bucket) {
    console.warn(
      "⚠️  S3_BUCKET_NAME is not set in .env — S3 photo upload is disabled.\n" +
        "   Set S3_BUCKET_NAME (and AWS credentials) to enable profile photos."
    );
    return multer({
      storage: multer.memoryStorage(),
      fileFilter,
      limits: { fileSize: MAX_SIZE_BYTES },
    });
  }

  const s3Storage = multerS3({
    s3: s3Client,
    bucket,
    // No ACL — bucket stays fully private; access only via pre-signed URLs
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (req, file, cb) => {
      // Key format: avatars/<safeId>-<timestamp>.<ext>
      const rawUser = req.params?.userId || req.body?.email || "avatar";
      const safeUser = rawUser.replace(/[^a-zA-Z0-9_-]/g, "_");
      const timestamp = Date.now();
      const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase();
      cb(null, `avatars/${safeUser}-${timestamp}.${ext}`);
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
