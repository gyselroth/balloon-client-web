/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import i18next from 'i18next';

var app = {
  id: 'Balloon.App.Burl',

  /**
  * File extension for Burl files
  */
  BURL_EXTENSION: 'burl',

  balloon: null,

  render: function() {
  },

  preInit: function(core) {
    this.balloon = core;
    this.balloon.addNew(app.BURL_EXTENSION, i18next.t('app.burl.tree.burl_file'), 'hyperlink', this.addBurl.bind(this));
    this.orig_treeDblclick = this.balloon._treeDblclick;
    this.origMapMimeToExtension = this.balloon.mapMimeToExtension;

    //TODO pixtron - find a clean way for apps to hook into core. Just overriding core methods is quite a hack.
    this.balloon._treeDblclick = this._treeDblclick.bind(this);
    this.balloon.mapMimeToExtension = this.mapMimeToExtension.bind(this);

    this.balloon.fileExtIconMap[app.BURL_EXTENSION] = 'gr-i-language';
  },


  /**
   * treeview dblclick
   *
   * @param   object e
   * @return  void
   */
  _treeDblclick: function(e) {
    if (this.isBurlFile(this.balloon.getCurrentNode())) {
      this.handleBurl(this.balloon.getCurrentNode());
    } else {
      this.orig_treeDblclick(e);
    }
  },

  /**
   * Map mime to file extension
   *
   * @param   string mime
   * @return  string|bool
   */
  mapMimeToExtension: function(mime) {
    return mime === 'application/vnd.balloon.burl' ? 'burl' : this.origMapMimeToExtension(mime);
  },

  /**
   * Check if file is .burl
   *
   * @param   object node
   * @return  bool
   */
  isBurlFile: function(node) {
    return this.BURL_EXTENSION === this.balloon.getFileExtension(node);
  },


  /**
   * Add new burl file
   *
   * @param string name
   * @return void
   */
  addBurl: function() {
    this.balloon.showNewNode(app.BURL_EXTENSION, this._addBurl.bind(this));
  },


  /**
   * Add new burl file with given name
   *
   * @param string name
   * @return void
   */
  _addBurl: function(name) {
    var $d = $.Deferred();

    name = encodeURI(name);
    this.balloon.xmlHttpRequest({
      url: this.balloon.base+'/files?name='+name+'&'+this.balloon.param('collection', this.balloon.getCurrentCollectionId()),
      type: 'PUT',
      complete: function(data, textStatus) {
        switch(textStatus) {
        case 'success':
          this.balloon.added = data.responseJSON.id;
          this.balloon.refreshTree('/collections/children', {id: this.balloon.getCurrentCollectionId()});
          this.balloon._editFile(data.responseJSON);
          $d.resolve();
          break;
        default:
          $d.reject();
        }
      }.bind(this),
    });

    return $d;
  },


  /**
   * Handle Burl file
   *
   * @param  object node
   * @return void
   */
  handleBurl: function(node) {
    this.balloon.xmlHttpRequest({
      url: this.balloon.base+'/files/content',
      type: 'GET',
      data: {
        id: this.balloon.id(node),
      },
      dataType: 'text',
      success: function (data) {
        try {
          let url = new URL(data);
          var msg  = i18next.t('app.burl.prompt.open_burl', url.href);
          this.balloon.promptConfirm(msg, this._handleBurl, [url]);
        } catch (error) {
          this.balloon.displayError(error);
        }
      }.bind(this)
    });
  },


  /**
   * Handle Burl file
   *
   * @param  object node
   * @return void
   */
  _handleBurl: function(url) {
    window.open(url.href, '_blank');
  },
}

export default app;
