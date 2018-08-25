const AWS = require("aws-sdk");
const globby = require("globby");
const fs = require("fs");
const Compression = require("../src/compression.js");
let chai = require("chai");
let assert = chai.assert;

suite("Compression & decompression tests", function() {
  suite("Decompression test", function() {
    let referenceBasePath = "test/reference/";
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

    test("Unwrap .tar", async () => {
      let result = await Compression.decompress(
        "test.tar",
        fs.readFileSync(referenceBasePath + "test.tar")
      );
      assert.sameDeepMembers(referenceFiles, result);
    });

    test("Unwrap .zip", async () => {
      let result = await Compression.decompress(
        "test.zip",
        fs.readFileSync(referenceBasePath + "test.zip")
      );
      assert.sameDeepMembers(referenceFiles, result);
    });

    test("Unwrap .tar.gz", async () => {
      let result = await Compression.decompress(
        "test.tar.gz",
        fs.readFileSync(referenceBasePath + "test.tar.gz")
      );
      assert.sameDeepMembers(referenceFiles, result);
    });

    test("Unwrap .tgz", async () => {
      let result = await Compression.decompress(
        "test.tgz",
        fs.readFileSync(referenceBasePath + "test.tgz")
      );
      assert.sameDeepMembers(referenceFiles, result);
    });

    test("Unwrap .gz", async () => {
      let result = await Compression.decompress(
        "test.gz",
        fs.readFileSync(referenceBasePath + "test.gz")
      );
      let referenceFile = [
        {
          path: "test", // no option to preserve filename with zlib.
          data: fs.readFileSync(referenceBasePath + "raw/test-1.txt")
        }
      ];
      assert.sameDeepMembers(referenceFile, result);
    });

    // Not supported
    test("Attempt unwrapping an unsupported file", async () => {
      let result = "";
      try {
        await Compression.decompress(
          "test.txt",
          fs.readFileSync(referenceBasePath + "raw/test-1.txt")
        );
      } catch (error) {
        result = error;
      }
      assert.equal("Unknown file type or unsupported compression.", result);
    });

    test("Attempt unwrapping an unsupported .tar.bz2 compressed archive", async () => {
      let result = "";
      try {
        await Compression.decompress(
          "test.tar.bz2",
          fs.readFileSync(referenceBasePath + "test.tar.bz2")
        );
      } catch (error) {
        result = error;
      }
      assert.equal("Unknown file type or unsupported compression.", result);
    });

    suiteTeardown(async () => {});
  });
});
