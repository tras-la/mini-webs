const SHEET_ID = "1l1JdsIleqocV2pNGlSSxGbl7-PzU9QeGh52N9tEQScc";
const SHEET_GID = "0";
const OG_IMAGE_WIDTH = 600;

export function compressImageBlob(blob, maxWidth = 1000, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Revoke the object URL to free memory
      URL.revokeObjectURL(img.src);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Calculate the new dimensions
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw the image on the canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert the canvas to a Blob
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}

/**
 * Converts an array of Blob objects to an array of base64 encoded objects.
 * Each object contains the file name, mime type, and base64 encoded content.
 * @param {Blob[]} blobs - Array of Blob objects to convert.
 * @returns {Promise<Object[]>} - Promise resolving to an array of objects with base64 encoded content.
 */
export async function convertBlobsToBase64(blobs) {
  const promises = [];
  for (const blob of blobs) {
    if (!blob || !(blob instanceof Blob)) {
      console.warn("Skipping non-blob input:", blob);
      continue;
    }
    // No compression needed, use the original blob
    const promise = new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result.split(",")[1];
        resolve({
          name: new Date().toISOString(),
          mimeType: blob.type,
          base64,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    promises.push(promise);
  }
  return await Promise.all(promises);
}

export async function convertBlobToDataURI(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 *
 * @param {String} urls, a string containing google drive links separated by commas
 * @returns {String} id of the last google drive link provided
 */
function getFileIdsFromDriveUrls(urls) {
  const imageIdRegexp = /\/d\/([\d\w-]*)\//gm;
  const ids = Array.from(urls.matchAll(imageIdRegexp), (m) => m[1]);
  return ids; // Get the last match
}

/**
 * 
 * @param {String} imageId 
 * @param {Number} width in pixels
 * @returns {String} Image url from a google drive to use in <img>
 
 */
function createGoogleDriveImageUrl(imageId, width = OG_IMAGE_WIDTH) {
  return `https://drive.google.com/thumbnail?sz=w${width}&id=${imageId}`;
}

/**
 *
 * @param {String} imageUrls A comma separated list of google drive urls
 * @returns {String} preview image url for the last file on the list
 * @returns {Array} Preview images urls
 */
function getGoogleDriveImagesPreviews(imageUrls, width = OG_IMAGE_WIDTH) {
  return getFileIdsFromDriveUrls(imageUrls).map((id) => createGoogleDriveImageUrl(id, width));
}

/**
 * Get formatted events from a Google Sheet using its ID and GID.
 *
 * @param {string} id - The ID of the Google Sheet.
 * @param {number} gid - The grid ID of the specific sheet within the Google Sheet.
 * @returns {Promise<Object[]>} A promise that resolves to an array of objects, keys mapped to table headers.
 */
async function getGoogleSheetData(id = SHEET_ID, gid = SHEET_GID) {
  const data = await getSheetData(id, gid);
  return data.map((item) => {
    if (item.images) {
      item.images = getGoogleDriveImagesPreviews(item.images);
    }
    return item;
  });
}

async function getSheetData(id, gid = 0) {
  const queryTextResponse = await (
    await fetch(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&gid=${gid}`)
  ).text();

  ///Need to extract the JSON part between "google.visualization.Query.setResponse({"version":"0.6","reqId":"0","status":"ok","sig":"1053501725","table":{cols: [...], rows: [...]}});"
  const jsonString = queryTextResponse.match(/(?<="table":).*(?=}\);)/g)[0];
  const json = JSON.parse(jsonString);
  const table = [];
  const row = [];
  const dateRegexp = /Date\((.*)\)/;
  json.cols.forEach((column) => row.push(column.label));
  table.push(row);
  json.rows.forEach((r) => {
    const row = [];
    r.c.forEach((cel) => {
      let value = "";
      if (cel && (cel.f || cel.v)) {
        value = cel.v || cel.f;
      }
      row.push(typeof value == "string" ? value.trim() : value);
    });
    const allValuesAreEmpty = row.reduce((acc, curr) => acc && !curr, true);
    if (allValuesAreEmpty) return;

    table.push(row);
  });
  return table_to_objects(table);
}

/* 
    Receive a gsheet array as input in the form of
    [
        ['header a', 'header b', 'header c'],
        ['value 1 a', 'value 1 b', 'value 1 c'],
        ['value 2 a', 'value 2 b', 'value 2 c'],
    ]
    
    Output the corresponding json object associated
    [
        {
            'header a': 'value 1 a',
            'header b': 'value 1 b',
            'header c': 'value 1 c'
        },
        {
            'header a': 'value 2 a',
            'header b': 'value 2 b',
            'header c': 'value 2 c'
        }
    ]
*/
function table_to_objects(gsheet_array) {
  // array containing the jsons
  let final_object = [];

  // iterate over the gsheet array receives from 1 to end
  for (let row_values = 1; row_values < gsheet_array.length; row_values++) {
    // each row in the gheet array will represent an object
    const row = gsheet_array[row_values];
    // store the index of the headers
    let index_keys = 0;
    // create a temporary object holding to hold the values of each row
    let temp_object = {};

    // loop over each row
    for (let index_value = 0; index_value < row.length; index_value++) {
      // get each value and assign it as a value to the respective key
      const value = row[index_value];
      temp_object[gsheet_array[index_keys][index_value]] = gsheet_array[row_values][index_value];
    }

    // append the current temporary object to the final array of objects
    final_object.push(temp_object);
  }

  // return the final array of json
  return final_object;
}

export { getGoogleSheetData };
