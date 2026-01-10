const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3 } = require("../config/s3Client");
const { randomUUID } = require("crypto");

const BUCKET = process.env.AWS_BUCKET_NAME;

const uploadEventBanner = async (req, res) => {
  try {
    const { fileName, fileType } = req.body;

    if (!fileType?.startsWith("image/")) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "");

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: `eventBanners/${Date.now()}-${safeFileName}`,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.json({ uploadUrl });
  } catch (error) {
    console.error("Event banner signed URL error:", error);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
};

const uploadProfilePicture = async (req, res) => {
  try {
    const { fileType } = req.body;

    if (!fileType?.startsWith("image/")) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: `profilePics/${req.user.stytch_user_id}.png`,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.json({ uploadUrl });
  } catch (error) {
    console.error("Profile pic signed URL error:", error);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
};

const uploadPostImages = async (req, res) => {
  try {
    const { fileType } = req.body;

    if (!fileType?.startsWith("image/")) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    const ext = fileType.split("/")[1];
    const key = `postImages/${req.user.stytch_user_id}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 });

    res.json({
      uploadUrl,
      imageUrl: `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    });
  } catch (err) {
    console.error("Post image signed URL error:", err);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
};

module.exports = { uploadEventBanner, uploadProfilePicture, uploadPostImages };
