const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl: generateSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3 } = require("../config/s3Client");

const uploadEventBanner = async (req, res) => {
  try {
    const { fileName, fileType } = req.body;

    const command = new PutObjectCommand({
      Bucket: "fitness-project-tldayan",
      Key: `eventBanners/${Date.now()}-${fileName}`,
      ContentType: fileType,
    });

    const uploadUrl = await generateSignedUrl(s3, command, { expiresIn: 3600 });

    return res.json({ uploadUrl });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    return res.status(500).json({ error: "Failed to generate signed URL" });
  }
};



const uploadProfilePicture = async (req, res) => {
  try {
    const { fileType } = req.body;
    console.log(req.user.stytch_user_id)
    const command = new PutObjectCommand({
      Bucket: "fitness-project-tldayan",
      Key: `profilePics/${req.user.stytch_user_id}.png`, 
      ContentType: fileType,
    });

    const uploadUrl = await generateSignedUrl(s3, command, { expiresIn: 3600 });
    
    res.json({ uploadUrl });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate signed URL" });
  }
};





module.exports = { uploadEventBanner, uploadProfilePicture };
