const AWS = require("aws-sdk");
const mime = require("mime-types");
const md5 = require("md5");
const s3 = new AWS.S3();
const cloudfront = new AWS.CloudFront();

const putObject = async (bucket, key, object, contentType) => {
  let params = {
    Bucket: bucket,
    Key: key,
    Body: object
  };

  if (contentType) {
    params.ContentType = contentType;
  }

  await s3.putObject(params).promise();
  return true;
};

const listAllS3 = async (
  bucket,
  prefix = "",
  maxKeys = 1000,
  completeList = [],
  continuationToken = undefined
) => {
  let params = {
    Bucket: bucket,
    MaxKeys: maxKeys,
    Prefix: prefix
  };
  continuationToken
    ? (params.ContinuationToken = continuationToken)
    : undefined;

  let response = await s3.listObjectsV2(params).promise();
  if (response.IsTruncated) {
    completeList = completeList.concat(response.Contents);
    return await listAllS3(
      bucket,
      prefix,
      maxKeys,
      completeList,
      response.NextContinuationToken
    );
  } else {
    return completeList.concat(response.Contents);
  }
};

const deployToS3 = async (deployment, targetBucket, prefix = "") => {
  let currentS3ObjectsList = [];
  try {
    currentS3ObjectsList = await listAllS3(targetBucket, prefix);
  } catch (error) {
    console.log(
      "WARNING - unable to list objects in S3 due to an error. Uploading all files!",
      error
    );
  }

  let uploaded = [];
  let skipped = [];

  for (let file of deployment) {
    let foundOnS3 = currentS3ObjectsList.find(
      s3Object => s3Object.Key === prefix + file.path
    );

    if (foundOnS3 && foundOnS3.ETag === '"' + md5(file.data) + '"') {
      skipped.push(prefix + file.path);
    } else {
      await putObject(
        targetBucket,
        prefix + file.path,
        file.data,
        mime.lookup(file.path)
      );
      uploaded.push(prefix + file.path);
    }
  }
  return {
    uploaded: uploaded,
    skipped: skipped
  };
};

const invalidateCloudFront = async (distributionId, items) => {
  let params = {
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: new Date().getTime().toString(),
      Paths: {
        Quantity: items.length,
        Items: items.map(path => path.startsWith("/") ? path : "/"+path)
      }
    }
  };
  return await cloudfront.createInvalidation(params).promise();
};

exports.listAllS3 = listAllS3;
exports.deployToS3 = deployToS3;
exports.invalidateCloudFront = invalidateCloudFront;
