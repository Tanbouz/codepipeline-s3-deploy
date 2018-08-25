const AWS = require("aws-sdk");
const s3 = new AWS.S3();
const S3Deploy = require("../src/s3-deploy.js");
const fs = require("fs");
const globby = require("globby");
let chai = require("chai");
let assert = chai.assert;

suite("Deploy to S3", () => {
  suite("Deployment tests", () => {
    let targetBucket = process.env.TARGET_BUCKET;
    let referenceBasePath = "test/reference/";
    let bucketPrefix = "test-deployment/";
    let referenceFiles;

    suiteSetup(async () => {
      let referenceFilesPaths = await globby([referenceBasePath + "raw/*/**"]);
      referenceFiles = referenceFilesPaths.map(path => {
        return {
          path: path.split(referenceBasePath + "raw/")[1],
          data: fs.readFileSync(path)
        };
      });
    });

    const checkFiles = async () => {
      for (let referenceFile of referenceFiles) {
        let s3File = await s3
          .getObject({
            Bucket: targetBucket,
            Key: bucketPrefix + referenceFile.path
          })
          .promise();

        assert.deepEqual(s3File.Body, referenceFile.data);
        if (referenceFile.path.endsWith(".txt")) {
          assert.strictEqual(s3File.ContentType, "text/plain");
        } else if (referenceFile.path.endsWith(".html")) {
          assert.strictEqual(s3File.ContentType, "text/html");
        }
      }
    }

    test("Deploy to S3", async () => {
      let result = await S3Deploy.deployToS3(
        referenceFiles,
        targetBucket,
        bucketPrefix
      );
      assert.strictEqual(
        Number(result.uploaded.length),
        referenceFiles.length
      );
    });

    test("Check files after deploy", async () => {
      await checkFiles();
    });

    test("Redeploy - test skipping existing file", async () => {
      result = await S3Deploy.deployToS3(
        referenceFiles,
        targetBucket,
        bucketPrefix
      );
      assert.strictEqual(
        Number(result.skipped.length),
        referenceFiles.length
      );
    });

    test("Check files after redeploy", async () => {
      await checkFiles();
    });

    test("List S3", async () => {
      let result = await S3Deploy.listAllS3(
        targetBucket,
        bucketPrefix,
        1
      );

      let referenceList = referenceFiles.map(
        file => bucketPrefix + file.path
      );
      let resultList = result.map(file => file.Key);
      assert.sameDeepMembers(referenceList, resultList);
    });

    suiteTeardown(async () => {
      let items = await s3
        .listObjectsV2({
          Bucket: targetBucket,
          MaxKeys: 1000,
          Prefix: bucketPrefix
        })
        .promise();

      for (let item of items.Contents) {
        await s3
          .deleteObject({
            Bucket: targetBucket,
            Key: item.Key
          })
          .promise();
      }
    });
  });
});
