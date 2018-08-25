const AWS = require("aws-sdk");
const codepipeline = new AWS.CodePipeline();
const s3 = new AWS.S3();

// Notify AWS CodePipeline of a successful job
exports.putJobSuccess = async (jobId, message) => {
  console.log("CodePipeline job success.", message);
  let params = {
    jobId: jobId
  };
  await codepipeline.putJobSuccessResult(params).promise();
  return true;
};

// Notify AWS CodePipeline of a failed job
exports.putJobFailure = async (jobId, invokeId, error, errorMessage) => {
  console.log("CodePipeline job failure.", errorMessage);
  console.log(error);
  let params = {
    jobId: jobId,
    failureDetails: {
      message: JSON.stringify(errorMessage),
      type: "JobFailed",
      externalExecutionId: invokeId
    }
  };
  await codepipeline.putJobFailureResult(params).promise();
  return error;
};

// Retrieve an artifact from S3
const getArtifact = async (bucket, key) => {
  try {
    let response = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    console.log(`${bucket}/${key} ${response.ContentLength} bytes`);
    return response.Body;
  } catch (error) {
    console.log("Failed to retrieve from S3: " + bucket + key);
    throw error;
  }
};

exports.getArtifact = getArtifact;