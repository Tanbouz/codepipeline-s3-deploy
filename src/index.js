const CodePipeline = require("./code-pipeline");
const S3Deploy = require("./s3-deploy");
const Compression = require("./compression.js");

const setOptions = userParameters => {
  let options = {
    prefix: "",
    distributionId: "",
    targetBucket: ""
  };
  let parsedParameters = {};

  if (!userParameters) {
    return options;
  }

  try {
    parsedParameters = JSON.parse(userParameters);
  } catch (error) {
    console.log(userParameters);
    console.log(error);
    throw "ERROR - Invalid JSON for user parameters";
  }

  if (parsedParameters["prefix"]) {
    if (parsedParameters["prefix"].endsWith("/")) {
      options.prefix = parsedParameters["prefix"];
    } else {
      throw "Invalid S3 prefix, must end with a /";
    }
  }

  if (parsedParameters["invalidate"] === true) {
    if (parsedParameters["distributionId"]) {
      options.distributionId = parsedParameters["distributionId"];
    } else {
      throw "Missing CloudFront distribution Id";
    }
  } else {
    options.distributionId = "";
  }

  if (parsedParameters["targetBucketName"]) {
    options.targetBucket = parsedParameters["targetBucketName"];
  }

  console.log("With options ", options);
  return options;
};

exports.handler = async (event, context) => {
  let jobMeta = event["CodePipeline.job"];
  let inputArtifactsMeta = jobMeta["data"]["inputArtifacts"];
  let outputArtifactsMeta = jobMeta["data"]["outputArtifacts"];
  let jobId = jobMeta.id;
  let invokeId = context.invokeId;

  /* ---- Options ---- */
  try {
    options = setOptions(
      jobMeta.data.actionConfiguration.configuration.UserParameters
    );
  } catch (error) {
    return await CodePipeline.putJobFailure(jobId, invokeId, error, error);
  }

  if (inputArtifactsMeta.length < 1) {
    return await CodePipeline.putJobSuccess(
      jobId,
      "Skipping. No input artifacts found."
    );
  }

  let results = [];

  try {
    for (let inputArtifactMeta of inputArtifactsMeta) {
      /* ---- Get input artifact ---- */
      let artifact = undefined;
      try {
        artifact = await CodePipeline.getArtifact(
          inputArtifactMeta.location.s3Location.bucketName,
          inputArtifactMeta.location.s3Location.objectKey
        );
      } catch (error) {
        return await CodePipeline.putJobFailure(
          jobId,
          invokeId,
          error,
          "ERROR - Retrieving input artifacts."
        );
      }

      /* ---- Decompress artifact ---- */
      let files = undefined;
      try {
        files = await Compression.decompress(
          inputArtifactMeta.location.s3Location.objectKey,
          artifact
        );
      } catch (error) {
        return await CodePipeline.putJobFailure(
          jobId,
          invokeId,
          error,
          "ERROR - Decompressing input artifact."
        );
      }

      /* ---- Deploy files to S3 ---- */
      let result = undefined;
      try {
        result = await S3Deploy.deployToS3(
          files,
          options.targetBucket || process.env.TARGET_BUCKET,
          options.prefix
        );
      } catch (error) {
        return await CodePipeline.putJobFailure(
          jobId,
          invokeId,
          error,
          "ERROR - Deploying to S3."
        );
      }
      results.push(result);
    }

    if (options.distributionId) {
      let invalidationList = results.reduce((allUploadedItems, result) => {
        return allUploadedItems.concat(result.uploaded);
      }, []);

      if (invalidationList.length > 0) {
        console.log("Invalidating items.");
        // AWS charges invalidation per path.
        // Invalidating a list of paths would cost more than invalidating everything with a single path of  "*".
        // Optimize later to balance cost with performance.
        invalidationList = ["/*"];
        try {
          await S3Deploy.invalidateCloudFront(
            options.distributionId,
            invalidationList
          );
        } catch (error) {
          return await CodePipeline.putJobFailure(
            jobId,
            invokeId,
            error,
            "ERROR - Invalidating CloudFront."
          );
        }
      } else {
        console.log("Nothing to invalidate.");
      }
    }
  } catch (error) {
    return await CodePipeline.putJobFailure(
      jobId,
      invokeId,
      error,
      "ERROR - Unexpected error."
    );
  }

  await CodePipeline.putJobSuccess(jobId, "Deployed to S3");
  return results;
};
