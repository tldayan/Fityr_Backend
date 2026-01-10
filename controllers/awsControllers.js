const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner"); // use this everywhere
const { s3 } = require("../config/s3Client");
const { randomUUID } = require("crypto");


const uploadEventBanner = async (req, res) => {
  try {
    const { fileName, fileType } = req.body;

    const command = new PutObjectCommand({
      Bucket: "fitness-project-tldayan",
      Key: `eventBanners/${Date.now()}-${fileName}`,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 }); 

    return res.json({ uploadUrl });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return res.status(500).json({ error: "Failed to generate signed URL" });
  }
};



const uploadProfilePicture = async (req, res) => {
  try {
    const { fileType } = req.body;

    // Validate MIME type
    if (!fileType?.startsWith("image/")) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    const command = new PutObjectCommand({
      Bucket: "fitness-project-tldayan",
      Key: `profilePics/${req.user.stytch_user_id}.png`,
      ContentType: fileType,
    });

    // ✅ Correct function
    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 3600,
    });

    res.json({ uploadUrl });
  } catch (error) {
    console.error("Profile picture signed URL error:", error);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
};


const uploadPostImages = async (req, res) => {
  try {
    const { fileType } = req.body;

    if (!fileType?.startsWith("image/")) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    const fileExtension = fileType.split("/")[1];

    const key = `postImages/${req.user.stytch_user_id}/${randomUUID()}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: "fitness-project-tldayan",
      Key: key,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 60, // 1 minute
    });
    console.log(uploadUrl)

    res.json({
      uploadUrl,
      imageUrl: `https://fitness-project-tldayan.s3.amazonaws.com/${key}`,
    });
  } catch (err) {
    console.error("Signed URL error:", err);
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
};



module.exports = { uploadEventBanner, uploadProfilePicture, uploadPostImages };
