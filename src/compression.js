const zlib = require("zlib");
const JSZip = require("jszip");
const tar = require("tar-stream");

const isGzip = data => {
  return data.slice(0, 3).toString("hex") === "1f8b08";
};

const isBzip2 = data => {
  return data.slice(0, 3).toString("hex") === "425a68";
};

const isTar = data => {
  return data.slice(257, 262).toString("ascii") === "ustar";
};

const isZip = data => {
  return data.slice(0, 4).toString("hex") === "504b0304";
};

const isAppleDouble = (key, data) => {
  return (
    key
      .split("/")
      .pop()
      .startsWith("._") && data.slice(8, 16).toString() === "Mac OS X"
  );
};

const untar = archive => {
  let extract = tar.extract();
  return new Promise((resolve, reject) => {
    let output = [];

    extract.on("entry", (header, stream, next) => {
      stream.on("data", data => {
        if (header.type === "file" && !isAppleDouble(header.name, data)) {
          output.push({
            path: header.name,
            data: data
          });
        }
      });
      stream.on("end", () => next());
      stream.resume();
    });

    extract.on("finish", () => {
      resolve(output);
    });
    extract.end(archive);
  });
};

const unzip = async data => {
  let zip = new JSZip();
  let zipper = await zip.loadAsync(data);
  let unzipping = Object.values(zipper.files).map(entry => {
    if (!entry.dir) {
      return entry.async("nodebuffer").then(decompressed => {
        return {
          path: entry.name,
          data: decompressed
        };
      });
    } else {
      // Skip directories
      return undefined;
    }
  });

  // Clean up undefined entries
  unzipping = unzipping.filter(entry => entry);
  return Promise.all(unzipping);
};

const decompress = async (fileName, fileData) => {
  if (isGzip(fileData)) {
    let decompressed = zlib.unzipSync(fileData);
    if (isTar(decompressed)) {
      return untar(decompressed);
    } else {
      return [
        {
          path: fileName
            .split(".")
            .slice(0, -1)
            .join("."),
          data: decompressed
        }
      ];
    }
  } else if (isTar(fileData)) {
    return await untar(fileData);
  } else if (isZip(fileData)) {
    return unzip(fileData);
  } else {
    throw "Unknown file type or unsupported compression.";
  }
};

exports.decompress = decompress;
