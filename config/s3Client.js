const { S3Client } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_FITYR,
    secretAccessKey: process.env.AWS_SECRET_KEY_FITYR,
  },
});

module.exports = { s3 };
