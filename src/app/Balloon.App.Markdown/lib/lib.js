/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import i18next from 'i18next';
import SimpleMDE from 'simplemde';
import balloonWindow from '../../../lib/widget-balloon-window.js';
import css from '../styles/style.scss';


var app = {
  id: 'Balloon.App.Markdown',

  /**
  * File extension for Markdown files
  */
  MARKDOWN_EXTENSION: 'md',

  balloon: null,

  editor: {},

  render: function() {
  },

  preInit: function(core) {
    this.balloon = core;

    this.balloon.addNew(app.MARKDOWN_EXTENSION, 'app.markdown.markdownFile', 'file-text', function(type) {
      return core.showNewNode(type, core.addFile);
    });

    this.balloon.fileExtIconMap[app.MARKDOWN_EXTENSION] = 'gr-i-file-text';
    this.balloon.mimeFileExtMap['text/markdown'] = app.MARKDOWN_EXTENSION;

    this.balloon.addPreviewHandler('markdown', this._handlePreview);
  },

  /**
   * Checks if "preview" for a given node can be handled by this app.
   * If it can handle it, return a handler to preview the file
   *
   * @param   string mime
   * @return  void|function
   */
  _handlePreview: function(node) {
    if (app.isMarkdownFile(node)) {
      return function(node) {
        app.editMarkdownFile(node);
      }
    }
  },

  /**
   * Check if file is .burl
   *
   * @param   object node
   * @return  bool
   */
  isMarkdownFile: function(node) {
    return this.MARKDOWN_EXTENSION === this.balloon.getFileExtension(node);
  },

  /**
   * Edit a markdown file
   *
   * @param  object node
   * @return void
   */
  editMarkdownFile: function(node) {
    app._initializeMarkdownEditor();

    app.editor.node = node;

    var ext = app.balloon.getFileExtension(node);
    var winTitle = node.name

    if(ext != null && node.directory == false) {
      winTitle = node.name.substr(0, node.name.length-ext.length-1) + ' (' + ext.toUpperCase() + ')';
    }

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/files/content',
      type: 'GET',
      data: {
        id: app.balloon.id(node),
      },
      dataType: 'text',
      success: function (data) {
        app.editor.data = data;

        app.editor.$k_window = app.$windowHtml.kendoBalloonWindow({
          title: winTitle,
          resizable: false,
          modal: true,
          draggable: false,
          close: function(e) {
            if(e.userTriggered && app._editorCancel() === false) {
              e.preventDefault();
            }
          },
          open: function(e) {
            app.editor.simplemde.value(app.editor.data);
          }
        }).data("kendoBalloonWindow").center().open().maximize();
      }
    });

    app.$windowHtml.find('input[type=submit]').off('click').on('click', function(e) {
      app._editorSave();
    });
  },

  /**
   * Initializes the editor
   *
   * @return void
   */
  _initializeMarkdownEditor: function() {
    app.editor = {
      simplemde: null,
      data: '',
      $k_window: null,
      node: null
    };

    $('#app-markdown-edit-live').remove();

    this.$windowHtml = $(
      '<div id="app-markdown-edit-live">'+
          '<textarea></textarea>'+
          '<div id="fs-prompt-window-button-wrapper" class="fs-window-secondary-actions">'+
              '<input type="submit" class="fs-button-primary" data-i18n="[value]button.save" />'+
          '</div>'+
      '</div>'
    );

    $('body').append(this.$windowHtml);

    app.editor.simplemde = new SimpleMDE({
      element: this.$windowHtml.find('textarea')[0],
      autofocus: true,
      toolbar: ['bold', 'italic', '|', 'heading-1', 'heading-2', 'heading-3', '|', 'code', 'quote', 'unordered-list', 'ordered-list', '|', 'link', 'image', '|', 'preview', '|', 'guide'],
    });
  },

  /**
   * Save the content of the editor
   *
   * @return void
   */
  _editorSave: function() {
    app.balloon.saveFile(app.editor.node, app.editor.simplemde.value());
    app._closeEditorWindow();
  },

  /**
   * Check if editor has unsaved changes, display prompt if unsaved changes have been detected
   *
   * @return void
   */
  _editorCancel: function() {
    if(app.editor.data == app.editor.simplemde.value()) {
      app._closeEditorWindow();
      return true;
    }

    var msg  = i18next.t('prompt.close_save_file', app.editor.node.name);
    app.balloon.promptConfirm(msg, function(){
      app._editorSave();
    });

    $("#fs-prompt-window").find('input[name=cancel]').unbind('click').bind('click', function(){
      $("#fs-prompt-window").data('kendoBalloonWindow').close();
      app._closeEditorWindow();
    });

    return false;
  },

  /**
   * Close the editor window
   *
   * @return void
   */
  _closeEditorWindow: function() {
    app.editor.$k_window.close();
    app.editor = {};
  }
}

export default app;
