/**
 * Constructor for DataTransferItemList handler
 *
 * @param function onCreateDir called when a directory is found.
 *                 Needs to return a promise, which is resolved with the id
 *                 of the created collection.
 * @param function onScheduleFile called when a file is found
 * @return $.Deferred
 */
var dataTransferItemsHandler = function(onCreateDir, onScheduleFile) {
  this._onCreateDir = onCreateDir;
  this._onScheduleFile = onScheduleFile;
}

/**
 * Handle dropped items
 *
 * @param DataTransferItemList dataTransferItems
 * @param string parent parent id
 * @return $.Deferred
 */
dataTransferItemsHandler.prototype.handleItems = function(dataTransferItems, parent) {
  var entries = [];

  var i;
  for(i=0; i<dataTransferItems.length; i++) {
    var entry = dataTransferItems[i].webkitGetAsEntry()
    entries.push(entry);
  }

  return this._handleEntries(entries, parent);
}

/**
 * Handle array of entries
 *
 * @param Array[DirectoryEntry|FileEntry] entries
 * @param string parent parent id
 * @return $.Deferred
 */
dataTransferItemsHandler.prototype._handleEntries = function(entries, parent) {
  var promises = [];
  var $d = $.Deferred();

  var i;
  for(i=0; i<entries.length; i++) {
    var $dHandleEntry = this._handleEntry(entries[i], parent);

    promises.push($dHandleEntry);
  }

  $.when.apply(this, promises)
    .done(function() {
      var $dFiles = [];
      var i;

      for(i=0; i < arguments.length; i++) {
        $dFiles = $dFiles.concat(arguments[i]);
      }

      $d.resolve($dFiles);
    })
    .fail(function(err) {
      $d.reject(err);
    });

  return $d;
}

/**
 * Handle single entry
 *
 * @param DirectoryEntry|FileEntry entry
 * @param string parent parent id
 * @return $.Deferred
 */
dataTransferItemsHandler.prototype._handleEntry = function(entry, parent) {
  var that = this;
  var $d = $.Deferred();

  if(entry.isDirectory) {
    var $dCreateDir = this._onCreateDir(parent, entry.name);

    $dCreateDir.done(function(newParent) {
      var $dReadDir = that._readDir(entry, newParent);
      $dReadDir.then($d.resolve, $d.reject);
    });

    $dCreateDir.fail($d.reject);
  } else if (entry.isFile) {
    var $dScheduleFile = this._onScheduleFile(entry, parent);
    $dScheduleFile.then($d.resolve, $d.reject);
  } else {
    //should never get here, because an entry should always be a directory or a file
    $d.reject();
  }

  return $d;
}

/**
 * Read contents of dir, and handle it
 *
 * @param DirectoryEntry entry
 * @param string parent parent id
 * @return $.Deferred
 */
dataTransferItemsHandler.prototype._readDir = function(entry, parent) {
  var that = this;
  var $d = $.Deferred();
  var handleEntriesPromises = [];

  var dirReader = entry.createReader();

  var success = function(entries) {

    if(entries.length === 0) {
      $.when.apply(that, handleEntriesPromises).then($d.resolve, $d.reject);
    } else {
      var $dHandleEntries = that._handleEntries(entries, parent);
      handleEntriesPromises.push($dHandleEntries);

      dirReader.readEntries(success, error);
    }
  };

  var error = function() {
    $d.reject(err);
  }

  dirReader.readEntries(success, error);

  return $d;
}

export default dataTransferItemsHandler;
