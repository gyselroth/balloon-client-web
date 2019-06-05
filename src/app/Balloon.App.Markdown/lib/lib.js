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
import iconsSvg from '@gyselroth/icon-collection/src/icons.svg';

const showdown = require('showdown');
const showdownHighlight = require("showdown-highlight");
import login from '../../../lib/auth.js';

var app = {
  id: 'Balloon.App.Markdown',

  /**
  * File extension for Markdown files
  */
  MARKDOWN_EXTENSION: 'md',

  balloon: null,

  editor: {},

  render: function() {
    this.initExtensions();
  },

  preInit: function(core) {
    this.balloon = core;

    this.balloon.addNew(app.MARKDOWN_EXTENSION, 'app.markdown.markdownFile', 'file-markdown', function(type) {
      return core.showNewNode(type, core.addFile);
    });

    this.balloon.fileExtIconMap[app.MARKDOWN_EXTENSION] = 'gr-i-file-markdown';
    this.balloon.mimeFileExtMap['text/markdown'] = app.MARKDOWN_EXTENSION;

    app.balloon.addFileHandler({
      app: 'SimpleMDE Markdown Editor',
      appIcon: null,
      ext: 'md',
      handler: app.editMarkdownFile
    });
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

        app.editor.k_window = app.$windowHtml.kendoBalloonWindow({
          title: winTitle,
          resizable: false,
          modal: false,
          draggable: false,
          fullscreen: true,
          deactivate: function(e) {
            e.sender.destroy();
          },
          close: function(e) {
            if(e.userTriggered && app._editorCancel() === false) {
              e.preventDefault();
            }
          },
          open: function(e) {
            app.editor.simplemde.value(app.editor.data);

            if(app.editor.data.length > 0) {
              app._togglePreview(true);
            } else {
              app._togglePreview(false);
            }
          }
        }).data("kendoBalloonWindow").center();
      }
    });

    app.$windowHtml.find('input[type=submit]').off('click').on('click', function(e) {
      app._editorSave();
    });
  },

  /**
   * Toglgle the preview view
   *
   * @return void
   */
  _togglePreview: function(forcePreview) {
    if(forcePreview || app.$windowHtml.hasClass('preview-active') === false) {
      app.$windowHtml.find('#app-markdown-edit-live-preview-content')
        .html(app._renderMarkdown(app.editor.data));
      app.$windowHtml.addClass('preview-active');
      app.$windowHtml.find('#app-markdown-edit-preview-button-wrapper input[name="edit"]')
        .off('click').on('click', function(event) {
          event.preventDefault();
          event.stopPropagation();

          app._togglePreview();
        });
    } else {
      app.$windowHtml.removeClass('preview-active');
      app.editor.simplemde.value(app.editor.data);
    }
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
      k_window: null,
      node: null
    };

    $('#app-markdown-edit-live').remove();

    this.$windowHtml = $(
      '<div id="app-markdown-edit-live" class="preview-active">'+
          '<div id="app-markdown-edit-live-editor">'+
            '<textarea></textarea>'+
            '<div id="app-markdown-edit-editor-button-wrapper" class="fs-window-secondary-actions">'+
                '<input type="submit" class="fs-button-primary" name="save" value="'+ i18next.t('button.save') +'" />'+
            '</div>'+
          '</div>'+
          '<div id="app-markdown-edit-live-preview">'+
            '<div id="app-markdown-edit-live-preview-content"></div>'+
            '<div id="app-markdown-edit-preview-button-wrapper" class="fs-window-secondary-actions">'+
                '<input type="submit" class="fs-button-primary" name="edit" value="'+ i18next.t('app.markdown.edit') +'"/>'+
            '</div>'+
          '</div>'+
      '</div>'
    );

    $('body').append(this.$windowHtml);

    app.editor.simplemde = new SimpleMDE({
      element: this.$windowHtml.find('textarea')[0],
      autofocus: true,
      toolbar: [
        {
          name: 'bold',
          action: SimpleMDE.toggleBold,
          className: 'gr-icon-bold',
          title: 'Bold'
        }, {
          name: 'italic',
          action: SimpleMDE.toggleItalic,
          className: 'gr-icon-italic',
          title: 'Italic'
        },

        '|',

        {
          name: 'heading-1',
          action: SimpleMDE.toggleHeading1,
          className: 'gr-icon-heading-big',
          title: 'Heading 1'
        }, {
          name: 'heading-2',
          action: SimpleMDE.toggleHeading2,
          className: 'gr-icon-heading-medium',
          title: 'Heading 2'
        }, {
          name: 'heading-3',
          action: SimpleMDE.toggleHeading3,
          className: 'gr-icon-heading-small',
          title: 'Heading 3'
        },

        '|',

        {
          name: 'code',
          action: SimpleMDE. toggleCodeBlock,
          className: 'gr-icon-html',
          title: 'Code'
        }, {
          name: 'quote',
          action: SimpleMDE.toggleBlockquote,
          className: 'gr-icon-quote',
          title: 'Quote'
        }, {
          name: 'unordered-list',
          action: SimpleMDE.toggleUnorderedList,
          className: 'gr-icon-insert-unordered-list',
          title: 'Unordered list'
        }, {
          name: 'ordered-list',
          action: SimpleMDE.toggleOrderedList,
          className: 'gr-icon-insert-ordered-list',
          title: 'Numbered list'
        },

        '|',

        {
          name: 'link',
          action: SimpleMDE.drawLink,
          className: 'gr-icon-hyperlink',
          title: 'Create link'
        }, {
          name: 'image',
          action: SimpleMDE.drawImage,
          className: 'gr-icon-image',
          title: 'Insert image'
        },

        '|',

        {
          name: 'preview',
          action: SimpleMDE.togglePreview,
          className: 'gr-icon-preview',
          title: 'Toggle preview'
        },

        '|',

        {
          name: 'guide',
          action: 'https://simplemde.com/markdown-guide',
          className: 'gr-icon-help',
          title: 'Markdown guide'
        }
      ],
      spellChecker: false,
      previewRender: app._renderMarkdown,
      autoDownloadFontAwesome: false,
      shortcuts: {
        'toggleSideBySide': null,
        'toggleFullScreen': null,
      },
    });

    var parent_node = app.balloon.getCurrentCollectionId();
    var $fs_browser_tree = $('#fs-browser-tree');

    this.$windowHtml.find('.editor-toolbar a').map(function(i, el) {
      var icon = el.className.substring(8);

      $(el).append('<svg class="gr-icon gr-i-'+ icon + '"><use xlink:href="' + iconsSvg + '#' + icon + '"></use></svg>');
    });

    this.$windowHtml.unbind('drop').on('drop', function(e) {
      $fs_browser_tree.removeClass('fs-file-dropable');
      $fs_browser_tree.find('.fs-file-drop').removeClass('fs-file-drop');
      $('#fs-upload').removeClass('fs-file-dropable');

      var pos = app.editor.simplemde.codemirror.getCursor();
      app.editor.simplemde.codemirror.setSelection(pos, pos);
      app.editor.simplemde.codemirror.replaceSelection('TEST');

      app.balloon._handleFileSelect(e, parent_node);
    });
  },

  /**
   * Renders given markup to html
   *
   * @return string rendered html
   */
  _renderMarkdown: function(markdown) {

    let converter = new showdown.Converter({
      extensions: [showdownHighlight, 'href', 'balloon-image']
    });

    let html = converter.makeHtml(markdown);

    $('#app-markdown-edit-live-preview-content, .editor-preview').off('click', 'a').on('click', 'a', function(e) {
      var href = $(this).attr('href');

      if(href.match(/^balloon\/[0-9a-fA-F]{24}$/)) {
        e.preventDefault();

        app.balloon.xmlHttpRequest({
          url: app.balloon.base+'/nodes/'+href.substr(8),
          success: function(node) {
            app.editor.k_window.close();
            app.balloon.openFile(node);

            if(app.balloon.id(node) !== app.balloon.id(app.balloon.last)) {
              app.balloon.deselectAll();
              app.balloon._updateLastNode(node);
              app.balloon._updateContentView(node);
            }
          }
        });
      }
    });

    return html;
  },

  initExtensions: function() {
    showdown.extension('href', function () {
      return [{
        type: "output",
        filter: function (html, converter, options) {
          var $liveHtml = $('<div></div>').html(html);
          $liveHtml.find('a').each(function(){
            $(this).attr('target', '_blank');
          });

          return $liveHtml.html();
        }
      }];
    });

    showdown.extension('balloon-image', function () {
      return [{
        type: "output",
        filter: function (html, converter, options) {
          var $liveHtml = $('<div></div>').html(html);
          $liveHtml.find('img').each(function(){

            var href = $(this).attr('src');

            if(href.match(/^balloon\/[0-9a-fA-F]{24}$/)) {
              var url = app.balloon.base+'/files/'+href.substr(8)+'/content';
              if(typeof(login) === 'object' && login.getAccessToken()) {
                url += '?access_token='+login.getAccessToken();
              }

              $(this).attr('src', url);
            }
          });

          return $liveHtml.html();
        }
      }];
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
    if(app.editor.simplemde === undefined) {
      return;
    }

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
    app.editor.k_window.close();
    app.editor = {};
  }
}

export default app;
