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
    var $add_node = $('#fs-action-add-select').find('ul');

    $add_node.append(
      '<li data-type="burl">' +
      '<svg class="gr-icon gr-i-hyperlink"><use xlink:href="/assets/icons.svg#hyperlink"></use></svg>' +
      '<span data-i18n="tree.burl_file"></span>' +
      '</li>'
    );
  },

  preInit: function(core) {
    this.balloon = core;
    this.orig_treeDblclick = this.balloon._treeDblclick;
    this.origMapMimeToExtension = this.balloon.mapMimeToExtension;
    this.origGetSpriteClass = this.balloon.getSpriteClass;
    //TODO pixtron - find a clean way for apps to hook into core. Just overriding core methods is quite a hack.
    this.balloon._treeDblclick = this._treeDblclick.bind(this);
    this.balloon.mapMimeToExtension = this.mapMimeToExtension.bind(this);
    this.balloon.getSpriteClass = this.getSpriteClass.bind(this);
    this.balloon.add_file_handlers.burl = this.addBurl.bind(this);
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
   * Extension => Sprite classname mapper
   *
   * @param  object|string node
   * @return string
   */
  getSpriteClass: function(node) {
    try {
      if (this.isBurlFile(node)) {
        return 'gr-i-hyperlink';
      }
    } catch (error) {
      // do nothing
    } finally {
      return this.origGetSpriteClass(node);
    }
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
  addBurl: function(name) {
    name = encodeURI(name);
    this.balloon.xmlHttpRequest({
      url: this.balloon.base+'/files?name='+name+'&'+this.balloon.param('collection', this.balloon.getCurrentCollectionId()),
      type: 'PUT',
      success: function(data) {
        this.balloon.added = data.id;
        this.balloon.refreshTree('/collections/children', {id: this.balloon.getCurrentCollectionId()});
        this.balloon._editFile(data);
      }.bind(this),
    });
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
          var msg  = i18next.t('prompt.open_burl', url.href);
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
