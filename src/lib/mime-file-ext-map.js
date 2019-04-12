var mimeFileExtMap = {
  "application/pdf": "pdf",
  "application/msaccesscab": "accdc",
  "application/x-csh": "csh",
  "application/x-msdownload": "dll",
  "application/xml": "xml",
  "audio/x-pn-realaudio-plugin": "rpm",
  "application/octet-stream": "bin",
  "text/plain": "txt",
  "text/css": "css",
  "text/x-perl": "pl",
  "text/x-php": "php",
  "text/x-ruby": "rb",
  "message/rfc822": "eml",
  "application/x-pkcs12": "p12",
  "application/x-zip-compressed": "zip",
  "application/x-gzip": "gz",
  "application/x-compressed": "tgz",
  "application/x-gtar": "gtar",
  "application/x-shockwave-flash": "swf",
  "video/x-flv": "flv",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/tiff": "tiff",
  "image/x-icon": "ico",
  "image/gif": "gif",
  "application/vndms-excel": "xls",
  "application/vndopenxmlformats-officedocumentspreadsheetmlsheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.oasis.opendocument.presentation": "pptx",
  "text/csv": "csv",
  "application/vndoasisopendocumentspreadsheet": "ods",
  "application/msword": "doc",
  "application/vnd.ms-word": "doc",
  "application/vnd.ms-excel": "xls",
  "application/msexcel": "xls",
  "application/vndopenxmlformats-officedocumentwordprocessingmldocument": "docx",
  "application/vndoasisopendocumenttext": "odt",
  "text/vbscript": "vbs",
  "application/vndms-powerpoint": "ppt",
  "application/vndopenxmlformats-officedocumentpresentationmlpresentation": "pptx",
  "application/vndoasisopendocumentpresentation": "odp",
  "image/svg+xml": "svg",
  "text/html": "html",
  "text/xml": "xml",
  "video/x-msvideo": "avi",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/mpeg": "mpeg",
  "audio/wav": "wav"
};

//create file extension to mime map
var fileExtMimeMap = {};
var mime;
for(mime in mimeFileExtMap) {
  var ext = mimeFileExtMap[mime];

  if(fileExtMimeMap[ext] === undefined) {
    fileExtMimeMap[ext] = [mime];
  } else {
    fileExtMimeMap[ext].push(mime);
  }
}

export {fileExtMimeMap, mimeFileExtMap}
