
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_FITYR,
    secretAccessKey: process.env.AWS_SECRET_KEY_FITYR,
  },
});

module.exports = { s3, DeleteObjectCommand };
