var dataTransferItemsHandler = function(onCreateDir, onScheduleFile) {
  this._onCreateDir = onCreateDir;
  this._onScheduleFile = onScheduleFile;
}

dataTransferItemsHandler.prototype.handleItems = function(dataTransferItems, parent) {
  var entries = [];

  var i;
  for(i=0; i<dataTransferItems.length; i++) {
    var entry = dataTransferItems[i].webkitGetAsEntry()
    entries.push(entry);
  }

  return this._handleEntries(entries, parent);
}

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
      $d.resolve();
    })
    .fail(function(err) {
      $d.reject(err);
    });

  return $d;
}

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
