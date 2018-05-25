/**
 * balloon
 *
 * @copyright Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license   GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import kendoAutoComplete from 'kendo-ui-core/js/kendo.autocomplete.js';
import kendoProgressBar from 'kendo-ui-core/js/kendo.progressbar.js';
import kendoSplitter from 'kendo-ui-core/js/kendo.splitter.js';
import kendoTreeview from 'kendo-ui-web/scripts/kendo.treeview.min.js';
import balloonWindow from './widget-balloon-window.js';
import balloonDatePicker from './widget-balloon-datepicker.js';
import balloonTimePicker from './widget-balloon-timepicker.js';
import login from './auth.js';
import i18next from 'i18next';
import app from './app.js';

var balloon = {
  /**
   * Debug mode
   */
  DEBUG_SIMULATOR: {
    idevice:  false,
    mobileport: false,
    touch:    false,
  },


  /**
   * API Version
   */
  BALLOON_API_VERSION: 2,


  /**
   * Prompt warning if open large file
   */
  EDIT_TEXT_SIZE_LIMIT: 2194304,


  /**
   * Chunk upload size (4MB Chunk)
   */
  BYTES_PER_CHUNK: 4194304,

  /**
   * API Base url
   *
   */
  base: '/api',


  /**
   * Datasource
   *
   * @var HierarchicalDataSource
   */
  datasource: null,


  /**
   * Previous selected node
   *
   * @var object
   */
  previous: null,


  /**
   * Last selected node
   *
   * @var object
   */
  last: null,


  /**
   * Upload manager
   *
   * @var object
   */
  upload_manager: null,


  /**
   * Is initialized?
   *
   * @var bool
   */
  initialized: false,


  /**
   * Last html5 pushState() url
   *
   * @var string
   */
  history_last_url: null,


  /**
   * Selected nodes action
   *
   * @var object
   */
  selected_action: {
    command: null,
    nodes: null,
    collection: null
  },


  /**
   * Quota usage
   *
   * @var object
   */
  quota: {},

  /**
   * Add file handlers
   *
   * @var object
   */
  add_file_handlers: {},

  /**
   * Content views in side pannel
   *
   * Array of side pannel items.
   * - item.id: unique id for the item (required)
   * - item.title: title of the item (required)
   * - item.isEnabled: method, which decides if the item is enabled in current state (required)
   * - item.onActivate: method, which is triggered, when the side pannel is opened (required)
   * - item.$content: jQuery dom representation of item content (optional). If present it will replace the content present in the template
   *
   * @var array
   */
  fs_content_views: [
    {
      id: 'preview',
      title: 'nav.view.preview',
      isEnabled: function() {
        return true;
      },
      onActivate: function() {
        balloon.displayPreview(balloon.getCurrentNode());
      },
    },
    {
      id: 'share-link',
      title: 'nav.view.share_link',
      isEnabled: function() {
        return balloon.last.access != 'r' && !balloon.last.deleted;
      },
      onActivate: function() {
        balloon.shareLink(balloon.getCurrentNode());
      },
    },
    {
      id: 'share',
      title: 'nav.view.share_folder',
      isEnabled: function() {
        return balloon.last.directory && balloon.last.access === 'm' && !balloon.last.share;
      },
      onActivate: function() {
        balloon.shareCollection(balloon.getCurrentNode());
      },
    },
    {
      id: 'properties',
      title: 'nav.view.properties',
      isEnabled: function() {
        return true;
      },
      onActivate: function() {
        balloon.displayProperties(balloon.getCurrentNode());
      },
    },
    {
      id: 'history',
      title: 'nav.view.history',
      isEnabled: function() {
        return !balloon.last.directory;
      },
      onActivate: function() {
        balloon.displayHistory(balloon.getCurrentNode());
      },
    },
    {
      id: 'events',
      title: 'nav.view.events',
      isEnabled: function() {
        return true;
      },
      onActivate: function() {
        var $view_list = $('#fs-events ul');
        balloon.displayEventsInfiniteScroll($view_list, balloon.getCurrentNode());
        balloon.displayEvents($view_list, balloon.getCurrentNode());
      },
    },
    {
      id: 'advanced',
      title: 'nav.view.advanced',
      isEnabled: function() {
        return balloon.last.access != 'r';
      },
      onActivate: function() {
        balloon.advancedOperations(balloon.getCurrentNode());
      },
    },
  ],

  /**
   * Init file browsing
   *
   * @return void
   */
  init: function() {
    balloon.add_file_handlers = {
      txt: balloon.addFile,
      folder: balloon.addFolder,
    };

    if(balloon.isInitialized()) {
      balloon.resetDom();
    } else {
      this.base = this.base+'/v'+this.BALLOON_API_VERSION;
    }

    app.preInit(this);
    balloon.kendoFixes();

    var $fs_browser_layout = $("#fs-browser-layout");
    var $fs_layout_left = $("#fs-layout-left");

    if($fs_browser_layout.data('kendoSplitter') === undefined) {
      $fs_browser_layout.kendoSplitter({
        panes: [
          { collapsible: false, min: "25%" },
          { collapsible: true, size: "400px", min: "400px", collapsed: true },
        ],
        scrollable: false
      });
    }

    balloon.initFsContentView();

    $("#fs-menu-left").off('click').on('click', 'li', balloon.menuLeftAction);
    $("#fs-identity").off('click').on('click', 'li', balloon._menuRightAction);

    balloon.createDatasource();
    balloon.initCrumb();

    $(".fs-action-element").unbind('click').click(balloon.doAction);
    $("#fs-browser-header").find("> div.fs-browser-column-sortable").unbind('click').click(balloon._sortTree);

    $(document).unbind('drop').on('drop', function(e) {
      e.stopPropagation();
      e.preventDefault();
    })
      .unbind('dragover').on('dragover', function(e) {
        e.stopPropagation();
        e.preventDefault();
      })
      .unbind('keyup').bind('keyup', balloon._treeKeyup);

    var menu = balloon.getURLParam('menu');
    if(menu != 'cloud' && menu !== null) {
      balloon.menuLeftAction(menu);
    }

    var options  = {
      dataSource:  balloon.datasource,
      dataTextField: "name",
      dragAndDrop:   true,
      dragstart:   balloon._treeDragstart,
      dragend:     balloon._treeDragend,
      drag:      balloon._treeDrag,
      drop:      balloon._treeDrop,
      dataBound:   balloon._treeDataBound,
      select:    balloon._treeSelect,
      messages: {
        loading: "",
      }
    };

    var $fs_browser_tree = $('#fs-browser-tree');
    $fs_browser_tree.kendoTreeView(options);

    if(balloon.isTouchDevice()) {
      $fs_browser_tree
        .off('touchstart', '.k-in').on('touchstart', '.k-in', balloon._treeTouch)
        .off('touchend', '.k-in').on('touchend', '.k-in', balloon._treeTouchEnd)
        .off('touchmove', '.k-in').on('touchmove', '.k-in', balloon._treeTouchMove);
    }

    if(!balloon.isTouchDevice() && balloon.isMobileViewPort()) {
      $fs_browser_tree
        .off('dblclick', '.k-in').on('click', '.k-in', balloon._treeDblclick);
    } else {
      $fs_browser_tree
        .off('click', '.k-in').on('click', '.k-in', balloon._treeClick)
        .off('dblclick', '.k-in').on('dblclick', '.k-in', balloon._treeDblclick);
    }

    balloon.displayQuota();


    var $fs_search = $('#fs-search');
    var $fs_search_input = $fs_search.find('#fs-search-input');
    var $fs_search_filter_toggle = $fs_search.find('#fs-search-toggle-filter');

    $fs_search_input.off('focus').on('focus', function() {
      $fs_search.addClass('fs-search-focused');

      // if field is empty it is a fresh search, wait for first change to occur
      if($fs_search_input.val() === '') {
        $fs_search_input.off('keypress').on('keypress', function() {
          $fs_search_input.off('keypress');
          balloon.advancedSearch();
        });
      } else {
        balloon.advancedSearch();
      }
    });

    $fs_search_input.off('blur').on('blur', function() {
      if($fs_search_input.val() === '') {
        balloon.resetSearch();
      }
    });

    $fs_search.find('.gr-i-close').off('click').on('click', function() {
      balloon.resetSearch();
    });

    $fs_search_filter_toggle.off('click').on('click', function() {
      $('#fs-search-filter').toggle();
    });

    $('#fs-namespace').unbind('dragover').on('dragover', function(e) {
      e.preventDefault();
      e.stopPropagation();

      if(balloon.isSearch()) {
        return;
      }

      $fs_browser_tree.addClass('fs-file-dropable');
      var $parent = $(e.target).parents('.k-item'),
        $target = $parent.find('.k-in');

      if($parent.attr('fs-type') !== 'folder') {
        return;
      }

      if($target.parents('#fs-browser-tree').length !== 0) {
        $target.addClass('fs-file-drop');
      }
    })
      .unbind('dragleave').on('dragleave', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $fs_browser_tree.removeClass('fs-file-dropable');
        $fs_browser_tree.find('.fs-file-drop').removeClass('fs-file-drop');
      });

    $(window).unbind('popstate').bind('popstate', balloon._statePop);
    balloon.buildCrumb(balloon.getURLParam('collection'));

    $('#fs-title').unbind('click').bind('click', function(){
      balloon.menuLeftAction('cloud')
    });

    $('#fs-browser-header-checkbox').off('click').on('click', function() {
      var $this = $(this);
      var $fs_browser_tree = $("#fs-browser-tree");
      var $k_tree = $fs_browser_tree.data('kendoTreeView');

      if($this.hasClass('fs-browser-header-checkbox-undetermined') || $this.hasClass('fs-browser-header-checkbox-checked')) {
        balloon.deselectAll();
      } else {
        balloon.selectAll();
      }

      balloon._updateCheckAllState();
    });

    balloon.showHint();
    balloon.initialized = true;
    app.postInit(this);
  },

  /**
   * initializes fs-content-view
   *
   * @return void
   */
  initFsContentView: function() {
    var $fs_content_view_template = $('#fs-content-view');
    var $fs_content_view = $('<dl id="fs-content-view"></dl>');

    for(var i=0; i<balloon.fs_content_views.length; i++) {
      var viewConfig = balloon.fs_content_views[i];
      var view = viewConfig.id;

      $fs_content_view.append(
        '<dt id="fs-content-view-title-' + view + '">'+
            '<span>' + i18next.t(viewConfig.title) + '</span>'+
            '<svg class="gr-icon gr-i-arrowhead-n"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#arrowhead-n"></use></svg>'+
            '<svg class="gr-icon gr-i-arrowhead-s"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#arrowhead-s"></use></svg>'+
        '</dt>'
      );

      var $content = viewConfig.$content || $fs_content_view_template.find('#fs-'+view);
      $fs_content_view.append($content);
    }

    $fs_content_view_template.replaceWith($fs_content_view);
  },

  /**
   * show hint
   *
   * @return void
   */
  showHint: function() {
    var disabled = localStorage.noHint;
    if(disabled == "true" || balloon.getURLParam('menu') !== null) {
      return;
    }

    var $fs_hint_win = $('#fs-hint-window');
    var $k_hint = $fs_hint_win.kendoBalloonWindow({
      title: $fs_hint_win.attr('title'),
      resizable: false,
      modal: true,
      open: function() {
        balloon._showHint();
        setTimeout(function(){
          $fs_hint_win.find('input[name=next]').focus();
        }, 900);

        var $k_that = this;
        $fs_hint_win.find('input[name=stop]').off('click').on('click', function(){
          localStorage.noHint = true;
          $k_that.close();
        });

        $fs_hint_win.find('input[name=next]').focus().off('click').on('click', function(){
          balloon._showHint();
        });
      }
    }).data('kendoBalloonWindow').center().open();

    $fs_hint_win.unbind('keydown').keydown(function(e) {
      if(e.keyCode === 27) {
        e.stopImmediatePropagation();
        $k_hint.close();
      }
    });
  },


  /**
   * show hint
   *
   * @return void
   */
  _showHint: function() {
    var total = 25,
      hint  = Math.floor(Math.random() * total) + 1,
      $div  = $('#fs-hint-window-content');

    $div.html(i18next.t("hint.hint_"+hint));
  },


  /**
   * Kendo fixes & enhancements
   *
   * @return void
   */
  kendoFixes: function() {
    //disable inbuilt navigate() event, conflict with balloon.fileUpload()
    window.kendo.ui.TreeView.fn._keydown = function(){};

    window.kendo.ui.Window.fn._keydown = function (originalFn) {
      return function (e) {
        if('keydown' in this.options) {
          this.options.keydown.call(this, e);
        } else {
          originalFn.call(this, e);
        }
      };
    }(kendo.ui.Window.fn._keydown);
  },


  /**
   * Check if client is initialized
   *
   * @return bool
   */
  isInitialized: function() {
    return balloon.initialized;
  },


  /**
   * Ajax request
   *
   * @param   object options
   * @return  object
   */
  xmlHttpRequest: function(options) {
    if(options.beforeSend === undefined) {
      options.beforeSend = balloon.showSpinner;
    } else {
      var beforeSend = options.beforeSend;
      options.beforeSend = function(jqXHR, settings) {
        balloon.showSpinner();
        beforeSend(jqXHR, settings);
      };
    }

    var complete = options.complete;
    options.complete = function(jqXHR, textStatus) {
      balloon.hideSpinner();

      var valid = ['POST', 'PUT', 'DELETE', 'PATCH'],
        show  = (valid.indexOf(options.type) > -1);

      if(show && jqXHR.status.toString().substr(0, 1) === '2') {
        balloon.showSnackbar();
      }

      if(complete !== undefined) {
        complete(jqXHR, textStatus);
      }
    };

    if(options.error === undefined) {
      options.error = balloon.displayError;
    }

    if(options.cache === undefined) {
      options.cache = false;
    }

    options.headers = {
      'X-Client': 'Webinterface|'+process.env.VERSION+'-'+process.env.COMMITHASH
    }

    return login.xmlHttpRequest(options);
  },


  /**
   * Show snackbar with given options
   *
   * @param object options
   * @return void
   */
  showSnackbar: function(options) {
    var options = options || {};
    var $snackbar = $('#fs-snackbar');

    var icon = options.icon || 'check';
    var message = options.message || 'snackbar.default';

    $snackbar.find('.gr-icon').hide();
    $snackbar.find('.gr-i-' + icon).show();

    $snackbar.find('#fs-snackbar-message').html(i18next.t(message));
    $snackbar.addClass('show');

    setTimeout(function() {
      $snackbar.removeClass('show');
    }, 2900);
  },


  /**
   * Kendo tree: dragstart event
   *
   * @param   object e
   * @return  void
   */
  _treeDragstart: function(e) {
    if((balloon.isSearch() && balloon.getCurrentCollectionId() === null) || balloon.touch_move === true) {
      e.preventDefault();
      return;
    }

    $('#fs-browser-tree').find('li[fs-type=folder]').addClass('fs-file-dropable');
    $('#fs-browser-top').find('li').addClass('fs-file-dropable');
    $('#fs-upload').addClass('fs-file-dropable');
    $('#fs-browser-tree').find('li[fs-type=file]').addClass('fs-file-disabled');

    var $itemCount = balloon.isMultiSelect() ? balloon.multiselect.length : 1;
    var clue = $('.k-drag-clue').html();

    clue = clue.substr(0, clue.search('</span>')+7);

    clue += '<svg viewBox="0 0 24 24" class="gr-icon gr-i-file"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#file"></use></svg>';
    clue += '<div class="clue-item-count">' + $itemCount + '</span>';

    $('.k-drag-clue').html(clue);
  },


  /**
   * Keyup
   *
   * @param   object e
   * @return  void
   */
  _treeKeyup: function(e) {
    e.preventDefault();
    if($('.k-window').is(':visible') || $('input,select,textarea').is(':focus')) {
      return;
    }

    //keyup/keydown node selection
    if(e.keyCode === 38 || e.keyCode === 40) {
      if($("#fs-share").find("input[share_consumer_search]").is(':focus')
      || $('#fs-properties-meta-tags-tags').hasClass('fs-select-tags')) {
        return;
      }

      var next = balloon.datasource._pristineData.indexOf(balloon.last);
      var current = next;

      if(e.keyCode === 40) {
        next++;

        if(next >= balloon.datasource._data.length) {
          next--;
        }
      } else if(e.keyCode === 38) {
        next--;
        if(0 > next) {
          next = 0;
        }
      }

      if(next == current) {
        return;
      }

      var $fs_browser_tree = $("#fs-browser-tree"),
        $k_tree = $fs_browser_tree.data('kendoTreeView'),
        $node;

      if(balloon.datasource._data[next].id == '_FOLDERUP') {
        $node = $fs_browser_tree.find('.k-first');
      } else {
        $node = $fs_browser_tree.find('.k-item[fs-id='+balloon.datasource._data[next].id+']');
      }

      $k_tree.select($node);
      $k_tree.trigger('select', {node: $node});

      return;
    }

    var $fs_namespace_input = $("#fs-namespace").find("input");
    if(e.keyCode === 13 && !$fs_namespace_input.is(":focus") && !$("#fs-prompt-window").is(':visible') && !$('#fs-edit-live').is(':visible')) {
      balloon._treeDblclick();
    }

    if($fs_namespace_input.is(":focus")) {
      return;
    }

    balloon._keyAction(e);
  },


  /**
   * Trigger action using keyboard
   *
   * @param  object e
   * @return void
   */
  _keyAction: function(e) {
    switch(e.keyCode) {
    //delete/shift+delete
    case 46:
      if(balloon.last !== undefined) {
        if(e.shiftKey) {
          balloon.deletePrompt(balloon.getSelected(balloon.last), true);
        } else {
          balloon.deletePrompt(balloon.getSelected(balloon.last));
        }
      }
      break;

      //cut node (shift+x)
    case 88:
      if(e.shiftKey && !(balloon.isSearch() && balloon.getCurrentCollectionId() === null)) {
        balloon.doAction('cut');
      }
      break;

      //copy node (shift+c)
    case 67:
      if(e.shiftKey && !(balloon.isSearch() && balloon.getCurrentCollectionId() === null)) {
        balloon.doAction('copy');
      }
      break;

      //paste node (shift+v)
    case 86:
      if(e.shiftKey && !(balloon.isSearch() && balloon.getCurrentCollectionId() === null)) {
        balloon.doAction('paste');
      }
      break;

      //add folder (shift+n)
    case 78:
      if(e.shiftKey && !(balloon.isSearch() && balloon.getCurrentCollectionId() === null)) {
        balloon.doAction('folder');
      }
      break;

      //add file (shift+a)
    case 65:
      if(e.shiftKey && !(balloon.isSearch() && balloon.getCurrentCollectionId() === null)) {
        balloon.doAction('file');
      }
      break;

      //upload (shift+u)
    case 85:
      if(e.shiftKey && !(balloon.isSearch() && balloon.getCurrentCollectionId() === null)) {
        balloon.doAction('upload');
      }
      break;

      //download (shift+d)
    case 68:
      if(e.shiftKey && balloon.last !== undefined) {
        balloon.doAction('download');
      }
      break;

      //download (shift+r)
    case 82:
      if(e.shiftKey && balloon.last !== undefined) {
        balloon.doAction('restore');
      }
      break;

      //rename node (F2)
    case 113:
      if(balloon.last !== undefined) {
        balloon.initRename();
      }
      break;
    }
  },


  /**
   * Kendo tree: drag event
   *
   * @param   object e
   * @return  void
   */
  _treeDrag: function(e) {
    var src = balloon.datasource.getByUid($(e.sourceNode).attr('data-uid')),
      $drop_target = $(e.dropTarget),
      $dest;

    if(src == undefined || balloon.isSystemNode(src)) {
      e.setStatusClass("k-denied");
      return;
    }

    if($drop_target.attr('fs-id') != null) {
      $dest = $drop_target;
    } else if($drop_target.parent().attr('fs-id') != null) {
      $dest = $drop_target.parent();
    }

    if(!$drop_target.parents('li.k-item').hasClass('fs-file-dropable') &&
    !($drop_target.hasClass('fs-file-dropable') || $drop_target.parent().hasClass('fs-file-dropable'))
      || (balloon.isSearch() && balloon.getCurrentCollectionId() === null)) {
      e.setStatusClass("k-denied");
      return;
    } else if($dest != undefined) {
      e.setStatusClass("k-add");
      return;
    }
  },


  /**
   * Kendo tree: drag end
   *
   * @param   object e
   * @return  void
   */
  _treeDragend: function(e) {
    $('#fs-browser-tree').find('.k-item').removeClass('fs-file-dropable').removeClass('fs-file-disabled');
    $('#fs-browser-top').find('li').removeClass('fs-file-dropable');
    $('#fs-upload').removeClass('fs-file-dropable');
  },


  /**
   * Kendo tree: drop event
   *
   * @param   object e
   * @return  void
   */
  _treeDrop: function(e) {
    $('#fs-browser-tree').find('.k-item').removeClass('fs-file-dropable').removeClass('fs-file-disabled');
    $('#fs-browser-top').find('li').removeClass('fs-file-dropable');
    $('#fs-upload').removeClass('fs-file-dropable');

    if(balloon.isSearch() && balloon.getCurrentCollectionId() === null) {
      return;
    }

    e.preventDefault();

    var src    = balloon.datasource.getByUid($(e.sourceNode).attr('data-uid')),
      dest     = balloon.datasource.getByUid($(e.destinationNode).attr('data-uid')),
      src_parent = $(e.sourceNode).parents('.k-item').first().attr('data-uid');

    if(src == undefined || balloon.isSystemNode(src)) {
      e.setValid(false); return;
    }

    if(typeof(dest) == 'object') {
      var dest_parent = $(e.destinationNode).parents('.k-item').first().attr('data-uid');

      var c1 = src_parent == dest_parent && e.dropPosition != 'over',
        c2 = e.dropPosition == 'over' && dest.directory == false,
        c3 = src.id == dest.id,
        c4 = balloon.isSystemNode(src) && !dest.id == '_FOLDERUP';

      if(c1 || c2 || dest.id == undefined || dest.id == '' || c3 || c4) {
        e.setValid(false); return;
      }

      if(dest.id == '_FOLDERUP') {
        dest = balloon.getPreviousCollectionId();
      }

      if(e.dropPosition != 'over') {
        dest = dest_parent;
      }
    }    else if(dest === undefined) {
      if($(e.dropTarget).attr('fs-id') != null) {
        dest = $(e.dropTarget).attr('fs-id');
      } else if($(e.dropTarget).parent().attr('fs-id') != null) {
        dest = $(e.dropTarget).parent().attr('fs-id');
      }

      //root folder
      if(dest === '') {
        dest = null;
      }

      if(dest === undefined || dest == balloon.getCurrentCollectionId()) {
        e.setValid(false); return;
      }
    }

    balloon.move(balloon.getSelected(src), dest);
    balloon.deselectAll();
  },


  /**
   * Kendo tree: dataBound event
   *
   * @param   object e
   * @return  void
   */
  _treeDataBound: function(e) {
    balloon.resetDom(['multiselect', 'action-bar']);

    var actions = ['add', 'upload', 'refresh', 'filter', 'rename'];

    if(balloon.selected_action.command !== null) {
      actions.push('paste');
    }

    if(!balloon.isSearch() || balloon.getCurrentCollectionId() !== null) {
      balloon.showAction(actions);
    } else {
      balloon.showAction(['refresh']);
    }

    var selected = balloon.getURLParam('selected[]'),
      $fs_browser_tree = $("#fs-browser-tree"),
      $k_tree = $fs_browser_tree.data('kendoTreeView'),
      select_match = false;

    $fs_browser_tree.find('.k-item').each(function() {
      var $that = $(this), node;
      node = balloon.datasource.getByUid($(this).attr('data-uid'));

      var order = ['icon', 'name', 'meta', 'size', 'changed', 'checkbox'];
      var metaOrder = ['color_tag', 'sharelink_token', 'deleted', 'readonly', 'destroy'];

      if(balloon.isSystemNode(node)) {
        if(balloon.id(node) == '_FOLDERUP') {
          $that.addClass('fs-folderup');
          balloon.fileUpload(balloon.getPreviousCollectionId(), $that);
          order = ['icon', 'name'];
        } else {
          return;
        }
      }

      if(node.meta != undefined && node.meta.tags != undefined) {
        node.meta.tags = $.makeArray(node.meta.tags);
      }

      if(node.deleted) {
        $that.addClass('fs-node-deleted');
      }

      $that.attr('fs-id', balloon.id(node));

      if(node.directory === true) {
        $that.attr('fs-type', 'folder');
      } else {
        $that.attr('fs-type', 'file');
      }

      var $that_k_in = $that.find('.k-in');
      var $node_el = $that_k_in.first();
      $node_el.empty();

      if(balloon.isSearch() && balloon.id(node) !== '_FOLDERUP') {
        $node_el.addClass('fs-browser-search-item');
      }

      for(var prop in order) {
        switch(order[prop]) {
        case 'changed':
          var since = balloon.timeSince(new Date(node.changed));

          $node_el.append('<div class="fs-browser-column fs-browser-column-changed">'+since+'</div>');
          break;

        case 'size':
          var size = '';
          if(node.directory) {
            size = i18next.t('view.prop.data.childcount', {count: node.size})
          } else {
            size = balloon.getReadableFileSizeString(node.size || 0);
          }

          $node_el.append('<div class="fs-browser-column fs-browser-column-size">'+size+'</div>');
          break;

        case 'meta':
          var meta_html_children = [];
          for(var metaProp in metaOrder) {
            switch(metaOrder[metaProp]) {
            case 'sharelink_token':
              if(node.sharelink_token) {
                meta_html_children.push('<div class="fs-node-state"><svg class="gr-icon gr-i-hyperlink"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#hyperlink"></use></svg></div>');
              }
              break;
            case 'deleted':
              if(node.deleted) {
                meta_html_children.push('<div class="fs-node-state"><svg class="gr-icon gr-i-trash"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#trash"></use></svg></div>');
              }
              break;
            case 'readonly':
              if(node.readonly) {
                meta_html_children.push('<div class="fs-node-state"><svg class="gr-icon gr-i-lock"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#lock"></use></svg></div>');
              }
              break;
            case 'destroy':
              if(node.destroy) {
                meta_html_children.push('<div class="fs-node-state"><svg class="gr-icon gr-i-flag"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#flag"></use></svg></div>');
              }
              break;
            case 'color_tag':
              if(node.meta && node.meta.color && balloon.isValidColor(node.meta.color)) {
                var color_tag = '<span class="fs-color-tag fs-color-tag-'+node.meta.color+'"></span>';
              } else {
                var color_tag = '<span class="fs-color-tag"></span>';
              }
              meta_html_children.push(color_tag);
              break;
            }
          }
          $node_el.append('<div class="fs-browser-column fs-browser-column-meta">' + meta_html_children.join('') + '</div>');
          break;

        case 'name':
          var ext = balloon.getFileExtension(node);
          var $name_el;
          if(ext != null && !node.directory) {
            $name_el = $('<div class="fs-browser-column fs-browser-column-name"><span class="fs-name">'+node.name.substr(0, node.name.length-ext.length-1)+'</span><span class="fs-ext">&nbsp;('+ext+')</span></div>');
          } else {
            $name_el = $('<div class="fs-browser-column fs-browser-column-name"><span class="fs-name">'+node.name+'</span></div>');
          }

          if(balloon.isSearch() && balloon.id(node) !== '_FOLDERUP') {
            var path = node.path.split('/').slice(1);
            var $path_el = $('<p></p>');

            path.forEach(function(item) {
              $path_el.append('<span> / </span><span>' + item + '</span>');
            });

            $name_el.append($path_el);
          }

          $node_el.append($name_el);
          break;

        case 'icon':
          var spriteClass = balloon.getSpriteClass(node);
          $node_el.append('<div class="fs-browser-column fs-browser-column-icon"><svg class="gr-icon  ' + spriteClass + '"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#' + spriteClass.replace('gr-i-', '') + '"></use></svg></div>');
          break;

        case 'checkbox':
          $node_el.append('<div class="fs-browser-column fs-browser-column-checkbox">&nbsp;</div>');
          break;
        }
      }

      if(node.directory) {
        balloon.fileUpload(node);
      }

      if(balloon.added == balloon.id(node)) {
        select_match = node;
      }

      if(selected !== null && typeof(selected) === 'object' && selected.indexOf(balloon.id(node)) > -1) {
        if(selected.length > 1) {
          balloon.multiSelect(node);
        }

        var dom_node = $fs_browser_tree.find('.k-item[fs-id='+balloon.id(node)+']');
        $k_tree.select(dom_node);
        $k_tree.trigger('select', {node: dom_node});
      }
    });

    if(select_match !== false) {
      var dom_node = $('li[fs-id='+select_match.id+']');
      $k_tree.select(dom_node);
      $k_tree.trigger('select', {node: dom_node});

      balloon.added = null;
      select_match = false;
    }

    balloon._updateCheckAllState();
    balloon.fileUpload(balloon.getCurrentCollectionId(), $('#fs-layout-left'));
  },


  /**
   * Kendo tree: select event
   *
   * @param   object e
   * @return  void
   */
  _treeSelect: function(e) {
    $('.k-in').removeClass('fs-rename');

    var id   = $(e.node).attr('data-uid'),
      node = balloon.datasource.getByUid(id)._childrenOptions.data;

    if(balloon.id(node) === balloon.id(balloon.last)) {
      balloon.last = node;
      return;
    }

    balloon.resetDom(
      ['properties','preview','view-bar', 'action-bar',
        'history','share','share-link'
      ]);

    var copy = balloon.last;
    balloon.last = node;

    if(!balloon.isSystemNode(copy)) {
      balloon.previous = copy;
    }

    var actions = ['download', 'delete', 'refresh'];
    if(!balloon.isSearch() || balloon.getCurrentCollectionId() !== null) {
      actions.push('add', 'upload', 'cut', 'copy', 'filter', 'rename');
    }
    if(balloon.last.deleted !== false) {
      actions.push('restore', 'delete');
    }
    if(balloon.selected_action.command !== null) {
      actions.push('paste');
    }

    balloon.showAction(actions);

    if(balloon.isSystemNode(node) || balloon.isMultiSelect()) {
      e.preventDefault();
      return;
    }

    if(typeof(balloon.last_click_event) == 'object' && balloon.last_click_event.ctrlKey == false
    && balloon.last_click_event.metaKey == false && balloon.last_click_event.shiftKey == false) {
      balloon.multiSelect();
    }

    $(e.node).find('.k-in').addClass('k-state-selected');

    balloon.resetDom([
      'selected',
      'properties',
      'preview',
      'multiselect',
      'view-bar',
      'history',
      'share',
      'share-link',
    ]);

    balloon.displayProperties(node);
    var view  = balloon.getURLParam('view');

    if(balloon.previous !== null && balloon.previous.id !== balloon.last.id || view === null) {
      view = 'preview';
    }

    var views = [];

    for(var i=0; i<balloon.fs_content_views.length; i++) {
      var viewConfig = balloon.fs_content_views[i];
      if(viewConfig.isEnabled && viewConfig.isEnabled()) {
        views.push(viewConfig.id);
      }
    }

    balloon.switchView(view);
    $('#fs-properties-name').show();

    balloon.showView(views);

    if(!balloon.isMobileViewPort()) {
      balloon.togglePannel('content', true);
    }

    $('#fs-content-view dt').unbind('click').not('.disabled').click(function() {
      var $that = $(this),
        action = $that.attr('id').substr(22);

      if(balloon.getViewName() != action) {
        balloon.switchView(action);
      }
    });
  },


  /**
   * Pop state
   *
   * @param   object e
   * @return  void
   */
  _statePop: function(e) {
    balloon.resetDom('multiselect');
    balloon.resetDom('breadcrumb');
    balloon.previous = null;
    balloon.last = null;

    var view     = balloon.getURLParam('view'),
      collection = balloon.getURLParam('collection'),
      selected   = balloon.getURLParam('selected[]'),
      menu     = balloon.getURLParam('menu');

    if(collection !== null) {
      balloon.menuLeftAction(menu, false);
      balloon.refreshTree('/collections/children', {id: collection}, null, {nostate: true});
    } else {
      balloon.menuLeftAction(menu);
    }

    if(e.originalEvent.state === null) {
      balloon.buildCrumb(collection);
    } else {
      balloon._repopulateCrumb(e.originalEvent.state.parents);
    }
  },


  /**
   * Build breadcrumb with parents
   *
   * @param   string collection
   * @return  void
   */
  buildCrumb: function(collection) {
    if(collection === null) {
      return;
    }

    balloon.xmlHttpRequest({
      url: balloon.base+'/nodes/parents',
      type: 'GET',
      dataType: 'json',
      data: {
        id: collection,
        attributes: ['id', 'name'],
        self: true
      },
      success: function(body) {
        balloon._repopulateCrumb(body.reverse());
      },
    });
  },


  /**
   * Rebuild breadcrum with existing node list
   *
   * @param   array nodes
   * @return  void
   */
  _repopulateCrumb: function(nodes) {
    balloon.resetDom(['breadcrumb-home','breadcrumb-search']);
    for(var node in nodes) {
      balloon.addCrumbRegister(nodes[node]);
    }
  },


  /**
   * Push state
   *
   * @param  bool replace
   * @param  bool reset_selected
   * @return void
   */
  pushState: function(replace, reset_selected) {
    if (!window.history || !window.history.pushState) {
      return true;
    }

    var list = [];
    var selected = [];

    if(balloon.getSelected() === null) {
      return;
    }

    if(reset_selected !== true) {
      if(balloon.isMultiSelect()) {
        selected = balloon.getSelected();
      } else {
        selected.push(balloon.getSelected());
      }

      for(var node in selected) {
        list.push(selected[node].id);
      }
    } else {
      balloon.last = null;
      balloon.previous = null;
    }

    var exec;
    if(replace === true) {
      exec = 'replaceState';
    } else {
      exec = 'pushState';
    }

    var url = '?'+balloon.param('menu', balloon.getMenuName())+'&'+balloon.param('menu')+'&'+balloon.param('collection', balloon.getCurrentCollectionId())+'&'
         +balloon.param('selected', list)+'&'+balloon.param('view', balloon.getViewName());

    if(balloon.history_last_url !== url) {
      window.history[exec](
        {parents: balloon.getCrumbParents()},
        balloon.getCurrentCollectionId(),
        url
      );

      balloon.history_last_url = url;
    }
  },



  /**
   * Read query string param
   *
   * @param   string key
   * @param   string target
   * @return  mixed
   */
  getURLParam: function(key, target) {
    var values = [];
    if(!target) {
      target = document.location.href;
    }

    key = key.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");

    var pattern = key + '=([^&#]+)';
    var o_reg = new RegExp(pattern,'ig');
    while(true) {
      var matches = o_reg.exec(target);
      if(matches && matches[1]) {
        values.push(matches[1]);
      }      else {
        break;
      }
    }

    if(!values.length) {
      return null;
    }    else if(key.slice(-4) == '\\[\\]') {
      return values;
    }    else {
      return values.length == 1 ? values[0] : values;
    }
  },


  /**
   * Display user profile
   *
   * @return void
   */
  displayUserProfile: function() {
    balloon.resetDom('user-profile');

    var $fs_profile_win = $('#fs-profile-window');
    $fs_profile_win.kendoBalloonWindow({
      title: $fs_profile_win.attr('title'),
      resizable: false,
      modal: true,
      height: '60%',
      width: '40%',
      open: function() {
        balloon.xmlHttpRequest({
          url: balloon.base+'/users/avatar',
          type: 'GET',
          success: function(body) {
            var $avatar = $('#fs-profile-avatar');
            $avatar.css('background-image', 'url(data:image/jpeg;base64,'+body+')');
          },
          error: function() {
            var $avatar = $('#fs-profile-avatar');
            $avatar.css('background-image', '');
          }
        });

        balloon.xmlHttpRequest({
          url: balloon.base+'/users/whoami',
          type: 'GET',
          success: function(body) {
            // Quota
            var used = balloon.getReadableFileSizeString(body.quota.used);
            var max;
            var free;
            var percentage;
            var percentageText;

            if(body.quota.hard_quota === -1) {
              max = i18next.t('profile.quota_unlimited');
              free = max;
              percentage = 0;
              percentageText = max;
            } else {
              percentage = Math.round(body.quota.used/body.quota.hard_quota*100);
              percentageText = percentage + '%';

              max  = balloon.getReadableFileSizeString(body.quota.hard_quota),
              free = balloon.getReadableFileSizeString(body.quota.hard_quota - body.quota.used);
            }

            var $fs_quota = $('#fs-quota-circle');
            $fs_quota.find('.css-fallback').removeClass(function(index, className) {
              return (className.match(/(^|\s)chart-\S+/g) || []).join(' ');
            }).addClass('chart-'+percentage);
            $fs_quota.find('.percent-text').text(percentageText);
            $fs_quota.find('.chart').removeClass(function(index, className) {
              return (className.match(/(^|\s)chart-\S+/g) || []).join(' ');
            }).addClass('chart-'+percentage);


            $('#fs-profile-quota-used').find('td').html(used);
            $('#fs-profile-quota-max').find('td').html(max);
            $('#fs-profile-quota-left').find('td').html(free);


            // User attributes
            var $table = $('#fs-profile-user').find('table');
            var attributes = ['id', 'username', 'created'];
            for(var i=0; i<attributes.length; i++) {
              var attribute = attributes[i];
              var value = body[attribute];

              switch(attribute) {
              case 'created':
              case 'last_attr_sync':
                var date   = new Date(value),
                  format = kendo.toString(date, kendo.culture().calendar.patterns.g),
                  since  = balloon.timeSince(date);

                $table.append('<tr><th>'+i18next.t('profile.attribute.'+attribute)+'</th><td>'+i18next.t('view.history.changed_since', since, format)+'</td></tr>');
                break;

              default:
                $table.append('<tr><th>'+i18next.t('profile.attribute.'+attribute)+'</th><td>'+value+'</td></tr>')
                break;
              }
            }
          }
        });
      }
    }).data("kendoBalloonWindow").center().open();
  },


  /**
   * Get and display event log
   *
   * @param   object $dom
   * @param   object|string node
   * @return  void
   */
  displayEvents: function($dom, node, params) {
    if(balloon._event_limit === true) {
      return;
    }

    var $elements = $dom.find('li');

    if(params === undefined) {
      $elements.remove();
      params = {limit: 50};
    }

    if(node !== undefined) {
      params.id = balloon.id(node);
    }

    var share_events = [
      'deleteCollectionReference',
      'deleteCollectionShare',
      'forceDeleteCollectionReference',
      'forceDeleteCollectionShare',
      'undeleteCollectionReference',
      'undeleteCollectionShare',
      'addCollectionShare',
      'addCollectionReference',
      'renameCollectionShare',
      'renameCollectionReference',
      'moveCollectionReference',
      'moveCollectionShare',
      'copyCollectionReference'
    ];

    balloon.xmlHttpRequest({
      url: balloon.base+'/nodes/event-log',
      data: params,
      type: 'GET',
      success: function(body) {
        var $node,
          $icon,
          $text,
          $action,
          icon,
          $undo,
          undo,
          username,
          operation,
          date,
          that = this;

        if(body.data.length === 0) {
          balloon._event_limit = true;
        }

        if(body.data.length === 0 && $elements.length === 0) {
          $dom.append('<li>'+i18next.t('events.no_events')+'</li>');
          return;
        }

        for(var log in body.data) {
          if(body.data[log].user === null) {
            username = '<user removed>';
          } else if(body.data[log].user.name == login.getUsername()) {
            username = body.data[log].user.name+' ('+i18next.t('events.you')+')';
          } else {
            username = body.data[log].user.name;
          }

          undo    = false;
          date    = kendo.toString(new Date((body.data[log].timestamp)), kendo.culture().calendar.patterns.g);
          operation = balloon.camelCaseToUnderline(body.data[log].operation);

          switch(body.data[log].operation) {
          case 'deleteCollectionReference':
          case 'deleteCollectionShare':
          case 'deleteCollection':
          case 'deleteFile':
            undo = true;
            icon = 'trash';
            break;
          case 'forceDeleteCollectionReference':
          case 'forceDeleteCollectionShare':
          case 'forceDeleteCollection':
          case 'forceDeleteFile':
            icon = 'trash';
            break;
          case 'addCollection':
            undo = true;
            icon = 'folder-add';
            break;
          case 'addFile':
            undo = true;
            icon = 'file-add';
            break;
          case 'addCollectionShare':
          case 'addCollectionReference':
            undo = true;
            icon = 'group';
            break;
          case 'unshareCollection':
            undo = false;
            icon = 'group';
            break;
          case 'editFile':
            undo = true;
            icon = 'pencil';
            break;
          case 'undeleteFile':
          case 'undeleteCollection':
          case 'undeleteCollectionReference':
          case 'undeleteCollectionShare':
            undo = true;
            icon = 'restore-trash';
            break;
          case 'restoreFile':
            undo = true;
            icon = 'restore';
            break;
          case 'renameFile':
          case 'renameCollection':
          case 'renameCollectionShare':
          case 'renameCollectionReference':
            undo = true;
            icon = 'italic';
            break;
          case 'moveFile':
          case 'moveCollection':
          case 'moveCollectionReference':
          case 'moveCollectionShare':
            undo = true;
            icon = 'paste';
            break;
          case 'copyFile':
          case 'copyCollection':
          case 'copyCollectionReference':
            undo = true;
            icon = 'copy';
            break;
          }

          $node = $('<li></li>');

          $icon = $('<div class="fs-events-icon"><svg class="gr-icon"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#undo"></use></svg></div>');
          balloon._spriteIcon($icon, icon);
          $node.append($icon);

          $text = $('<div class="fs-events-text"></div>');
          $action = $('<p></p>');
          $text.append($action);

          $node.append($text);

          if(body.data[log].share && share_events.indexOf(body.data[log].operation) == -1) {
            $action.append(i18next.t('events.share', {
              share:  body.data[log].share.name,
            })+' ');
          }

          if(body.data[log].parent && !body.data[log].parent.name) {
            body.data[log].parent.name = "<"+i18next.t('events.root_folder')+'>';
          }

          if(body.data[log].previous && body.data[log].previous.parent) {
            if(!body.data[log].previous.parent.name) {
              body.data[log].previous.parent.name = "<"+i18next.t('events.root_folder')+'>';
            }
          } else if(body.data[log].previous && !body.data[log].previous.parent) {
            body.data[log].previous.parent = {name: "<"+i18next.t('events.deleted_folder')+'>'};
          }

          if(!body.data[log].parent) {
            body.data[log].parent = {name: "<"+i18next.t('events.deleted_folder')+'>'};
          }

          $action.append(i18next.t('events.'+operation, {
            user:   username,
            name:   body.data[log].name,
            previous: body.data[log].previous,
            parent: body.data[log].parent
          }));

          if(!body.data[log].node) {
            undo = false;
          }

          var app = body.data[log].client.type;

          if(body.data[log].client.app !== null) {
            app = body.data[log].client.app;
          }

          if(app === null) {
            var via = i18next.t('events.date',{
              date: date
            });
          } else {
            var via = i18next.t('events.via',{
              date: date,
              app: app
            });
          }

          if(body.data[log].client.hostname !== null) {
            via += ' ('+body.data[log].client.hostname+')';
          }

          $text.append('<p class="fs-event-time">'+via+'</p>');


          if(undo === true) {
            $undo = $('<div class="fs-events-undo"><svg class="gr-icon gr-i-undo"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#undo"></use></svg></div>').unbind('click').bind('click',
              body.data[log], balloon._undoEvent);
            $node.append($undo);
          }

          $dom.append($node);
        }
      },
    });
  },


  /**
   * Infinite scroll events
   *
   * @param  object $list
   * @param  object node
   * @return void
   */
  displayEventsInfiniteScroll: function($list, node) {
    balloon._event_limit = false;
    var skip = 0;
    $list.unbind('scroll').bind('scroll', function() {
      if(($list.scrollTop() + 700) >= $list[0].scrollHeight) {
        skip = skip + 50;
        balloon.displayEvents($list, node, {skip: skip, limit: 50});
      }
    });
  },


  /**
   * Display events
   *
   * @return void
   */
  displayEventsWindow: function() {
    var $fs_event_win   = $('#fs-event-window'),
      $fs_event_list  = $fs_event_win.find('ul'),
      datastore     = [];

    if($fs_event_win.is(':visible')) {
      balloon.displayEventsInfiniteScroll($fs_event_list);
      balloon.displayEvents($fs_event_list);
    } else {
      balloon.resetDom('events-win');
      $fs_event_win   = $('#fs-event-window'),
      $fs_event_list  = $fs_event_win.find('ul'),
      balloon.displayEventsInfiniteScroll($fs_event_list);

      $fs_event_win.kendoBalloonWindow({
        title: $fs_event_win.attr('title'),
        resizable: false,
        modal: true,
        height: '400px',
        width: '800px',
        open: function() {
          balloon.displayEvents($fs_event_list);
        }
      }).data("kendoBalloonWindow").center().open();
    }
  },


  /**
   * Undo event
   *
   * @param  object e
   * @return void
   */
  _undoEvent: function(e) {
    var successAction;
    if($('#fs-event-window.k-window-content').is(':visible')) {
      successAction = {action: 'displayEventsWindow'};
    } else {
      successAction = {
        action: 'switchView',
        params: ['events']
      };
    }

    switch(e.data.operation) {
    case 'deleteCollectionReference':
    case 'deleteCollectionShare':
    case 'deleteCollection':
    case 'deleteFile':
      var msg  = i18next.t('events.prompt.trash_restore', e.data.node.name);
      balloon.promptConfirm(msg, [
        {
          action: 'undelete',
          params: [e.data.node.id]
        }, successAction
      ]);
      break;
    case 'addCollectionShare':
      var msg  = i18next.t('events.prompt.unshare', e.data.node.name);
      balloon.promptConfirm(msg, [
        {
          action: '_shareCollection',
          params: [e.data.node, {options: {shared: false}}]
        }, successAction
      ]);
      break;
    case 'addCollection':
    case 'addFile':
    case 'addCollectionReference':
    case 'undeleteFile':
    case 'undeleteCollection':
    case 'undeleteCollectionReference':
    case 'undeleteCollectionShare':
    case 'copyCollection':
    case 'copyCollectionReference':
    case 'copyFile':
      if(successAction.action == 'switchView') {
        successAction = null;
      }

      var msg  = i18next.t('events.prompt.trash_delete', e.data.node.name);
      balloon.promptConfirm(msg, [
        {
          action: 'remove',
          params: [e.data.node.id]
        }, successAction
      ]);
      break;
    case 'editFile':
    case 'restoreFile':
      var msg  = i18next.t('events.prompt.restore', e.data.node.name, e.data.previous.version);
      balloon.promptConfirm(msg, [
        {
          action: 'restoreVersion',
          params: [e.data.node.id, e.data.previous.version]
        }, successAction
      ]);
      break;
    case 'renameFile':
    case 'renameCollection':
    case 'renameCollectionShare':
    case 'renameCollectionReference':
      var msg  = i18next.t('events.prompt.rename', e.data.node.name, e.data.previous.name);
      balloon.promptConfirm(msg, [
        {
          action: 'rename',
          params: [e.data.node.id, e.data.previous.name]
        }, successAction
      ]);
      break;
    case 'moveFile':
    case 'moveCollection':
    case 'moveCollectionReference':
    case 'moveCollectionShare':
      var msg  = i18next.t('events.prompt.move', e.data.node.name, e.data.previous.parent.name);
      balloon.promptConfirm(msg, [
        {
          action: 'move',
          params: [e.data.node.id, e.data.previous.parent]
        }, successAction
      ]);
      break;
    }
  },


  /**
   * Convert camelCase string to underline separated string
   *
   * @param   string string
   * @return  string
   */
  camelCaseToUnderline: function(string) {
    return string.replace(/(?:^|\.?)([A-Z])/g, function (x,y){
      return "_" + y.toLowerCase()
    }).replace(/^_/, "")
  },


  /**
   * Get view name
   *
   * @return string
   */
  getViewName: function() {
    var name = $('#fs-content-view dt.active').attr('id');

    if(name === undefined) {
      return null;
    }

    return name.replace('fs-content-view-title-', '');
  },


  /**
   * Get menu name
   *
   * @return string
   */
  getMenuName: function() {
    return $('.fs-menu-left-active').attr('id').substr(8);
  },


  /**
   * User menu
   *
   * @return void
   */
  _menuRightAction: function() {
    var $that  = $(this);
    var action = $that.attr('id').substr(13);

    switch(action) {
    case 'events':
      balloon.displayEventsWindow();
      break;

    case 'profile':
      balloon.displayUserProfile();
      break;
    }
  },


  /**
   * Get current menu
   *
   * @return string
   */
  getCurrentMenu: function() {
    return $('.fs-menu-left-active').attr('id').substr(8);
  },


  /**
   * Main menu
   *
   * @return void
   */
  menuLeftAction: function(menu, exec) {
    if(menu === null) {
      menu = 'cloud';
    }

    if(typeof(menu) === 'string') {
      var $that  = $('#fs-menu-'+menu);
      var action = menu;
    } else {
      var $that  = $(this);
      var action = $that.attr('id').substr(8);
    }

    if(balloon.getCurrentMenu() != action) {
      $("#fs-action-filter-select").find('input[name=deleted]').prop('checked', false);
      balloon.tree.filter.deleted = 0;
    }

    $that.parent().find('li').removeClass('fs-menu-left-active');
    $that.addClass('fs-menu-left-active');
    //TODO pixtron - do we really need to toggle the pannel here?
    balloon.togglePannel('content');
    balloon.resetDom(['search']);

    if(action === 'cloud') {
      balloon.resetDom('breadcrumb-home');
      $('#fs-crumb-search-list').hide();
      $('#fs-crumb-home-list').show();
      $('#fs-browser-action').show();
    } else {
      balloon.resetDom('breadcrumb-search');
      $('#fs-crumb-home-list').hide();
      $('#fs-crumb-search-list').show();
    }

    if(exec === false) {
      return;
    }

    balloon.pushState(false, true);

    switch(action) {
    case 'cloud':
      balloon.refreshTree('/collections/children', {}, {});
      break;

    case 'shared_for_me':
      balloon.refreshTree('/nodes', {query: {shared: true, reference: {$exists: 1}}}, {});
      break;

    case 'shared_from_me':
      balloon.refreshTree('/nodes', {query: {shared: true, reference: {$exists: 0}}}, {});
      break;

    case 'shared_link':
      balloon.refreshTree('/nodes', {query: {"app.Balloon\\App\\Sharelink.token": {$exists: 1}}}, {});
      break;

    case 'trash':
      balloon.tree.filter.deleted = 1;
      balloon.refreshTree('/nodes/trash', {}, {});
      break;
    }
  },


  /**
   * Switch view
   *
   * @return void
   */
  switchView: function(view) {
    $('#fs-content-view').find('dt,dd').removeClass('active');
    var $title = $('#fs-content-view-title-'+view).addClass('active');
    $title.next().addClass('active');

    var viewConfig = balloon._getViewConfig(view);

    if(viewConfig.onActivate) viewConfig.onActivate.call(this);

    balloon.pushState();
  },


  /**
   * Gets the config for a given view
   *
   * @param   string id of the view
   * @return  object
   */
  _getViewConfig: function(view) {
    for(var i=0; i<balloon.fs_content_views.length; i++) {
      if(balloon.fs_content_views[i].id === view) return balloon.fs_content_views[i];
    }

    return null;
  },


  /**
   * Advanced operations
   *
   * @param   object node
   * @return  void
   */
  advancedOperations: function(node) {
    balloon.resetDom('advanced');

    var $fs_advanced   = $('#fs-advanced'),
      $fs_destroy_at = $fs_advanced.find('input[name=destroy_at]'),
      $fs_readonly   = $fs_advanced.find('input[name=readonly]'),
      $fs_submit   = $fs_advanced.find('input[name=submit]'),
      formatted    = '';

    if(node.destroy !== undefined) {
      var date = new Date(node.destroy);
      formatted = kendo.toString(date, kendo.culture().calendar.patterns.g);

      $fs_destroy_at.val(formatted);
    }

    if(node.readonly === true) {
      $fs_readonly.prop('checked', true);
    }

    $fs_destroy_at.kendoDateTimePicker({
      format: kendo.culture().calendar.patterns.g,
      min: new Date(),
    });

    $fs_submit.off('click').on('click', function(){
      var ts = $fs_destroy_at.val();
      if(ts !== formatted) {
        formatted = ts;
        if(ts === '') {
          balloon.selfDestroyNode(node, ts);
        } else {
          var msg  = i18next.t('view.advanced.prompt_destroy', ts, node.name);
          balloon.promptConfirm(msg, 'selfDestroyNode', [node, ts]);
        }
      }

      if(node.readonly !== $fs_readonly.is(':checked')) {
        node.readonly = $fs_readonly.is(':checked');
        balloon.xmlHttpRequest({
          url: balloon.base+'/nodes',
          type: 'PATCH',
          data: {
            id: balloon.id(node),
            readonly: node.readonly
          },
        });
      }
    });
  },


  /**
   * Set self destroy node
   *
   * @param object node
   * @param string ts
   */
  selfDestroyNode: function(node, ts) {
    var url;

    if(ts !== '') {
      ts = kendo.parseDate(ts, kendo.culture().calendar.patterns.g);

      if(ts !== null) {
        ts = Math.round(ts.getTime() / 1000);
      }

      url = balloon.base+'/nodes?id='+balloon.id(node)+'&'+'at='+ts;
    } else {
      url = balloon.base+'/nodes?id='+balloon.id(node)+'&at=0';
    }

    balloon.xmlHttpRequest({
      url: url,
      type: 'DELETE',
    });
  },


  /**
   * Tree touch move
   *
   * @return void
   */
  _treeTouchMove: function(e) {
    balloon.touch_move = true;
  },


  /**
   * Tree touch start on tree node
   *
   * @param   object e
   * @return  void
   */
  _treeTouch: function(e) {
    balloon.touch_move = false;
    balloon.long_touch = false;

    if(balloon.lock_touch_timer){
      return;
    }

    balloon.touch_timer = setTimeout(function(){
      if(balloon.touch_move !== true) {
        setTimeout(balloon._treeLongtouch(e), 50);
      }
    }, 650);
    balloon.lock_touch_timer = true;
  },


  /**
   * touch end from a tree node
   *
   * @param   object e
   * @return  void
   */
  _treeTouchEnd: function(e) {
    if(balloon.touch_move === true)  {
      clearTimeout(balloon.touch_timer);
      balloon.lock_touch_timer = false;
      return;
    }

    if(balloon.touch_timer) {
      clearTimeout(balloon.touch_timer);
      balloon.lock_touch_timer = false;
    }

    if(!balloon.long_touch) {
      //call dblclick with a timeout of 50ms, otherwise balloon._treeSelect() would be fired after
      setTimeout(function(){
        balloon._treeDblclick(e);
      }, 50);
    }
  },


  /**
   * Long toch event on a tree node
   *
   * @param  object e
   * @return void
   */
  _treeLongtouch: function(e) {
    balloon.long_touch = true;
    var $node = $(e.target).parents('li'),
      $k_tree = $('#fs-browser-tree').data('kendoTreeView');

    //need to fire balloon._treeSelect() since select() would not be fired when _treeLongtouch is called
    $k_tree.select($node);
    $k_tree.trigger('select', {node: $node});

    balloon.long_touch = true;
    //TODO pixtron - should pannel really open here?
    balloon.togglePannel('content', true);

    if(!balloon.isSystemNode(balloon.last)) {
      $('#fs-browser-tree').find('.k-in').removeClass('k-state-selected');

      if(balloon.isMultiSelect()) {
        balloon.multiSelect(balloon.getCurrentNode());
      } else {
        balloon.multiSelect(balloon.getCurrentNode());
      }

      balloon.pushState();
    }
  },


  /**
   * treeview select click event (triggered after select())
   *
   * @param   object e
   * @return  void
   */
  _treeClick: function(e) {
    if(balloon.touch_move === true)  {
      return;
    }
    balloon.last_click_event = e;

    if(balloon.rename_node !== null && balloon.rename_node !== undefined) {
      balloon._rename();
    }

    if(!balloon.isSystemNode(balloon.last)) {
      if(e.ctrlKey || e.metaKey) {
        $('#fs-browser-tree').find('.k-in').removeClass('k-state-selected');

        if(balloon.isMultiSelect()) {
          balloon.multiSelect(balloon.getCurrentNode());
        } else {
          balloon.multiSelect(balloon.previous, true);
          balloon.multiSelect(balloon.getCurrentNode());
        }
      } else if(e.shiftKey) {
        balloon.resetDom('multiselect');

        var last_pos  = balloon.datasource._pristineData.indexOf(balloon.getCurrentNode());
        var prev_pos  = balloon.datasource._pristineData.indexOf(balloon.previous);

        if(prev_pos == -1) {
          prev_pos = last_pos;
        }

        if(balloon._shift_start === undefined) {
          balloon._shift_start = prev_pos;
        } else {
          prev_pos = balloon._shift_start;
        }

        if(prev_pos > last_pos) {
          var _last_pos = last_pos;
          var _prev_pos = prev_pos;
          last_pos = _prev_pos;
          prev_pos = _last_pos;
        }

        for(var node=prev_pos; node <= last_pos; node++) {
          balloon.multiSelect(balloon.datasource._data[node]);
        }
      } else {
        balloon._shift_start = undefined;
        balloon.resetDom('multiselect');
      }

      balloon._updateCheckAllState();
      balloon.pushState();
    }
  },

  /**
   * Updates the state of the check all checkbox in browser tree
   *
   * @return void
   */
  _updateCheckAllState: function() {
    var $fs_browser_header_checkbox = $('#fs-browser-header-checkbox');
    var nodeCount = balloon.datasource._pristineData.length;

    $fs_browser_header_checkbox.removeClass('fs-browser-header-checkbox-checked');
    $fs_browser_header_checkbox.removeClass('fs-browser-header-checkbox-undetermined');

    if(balloon.isMultiSelect()) {
      if(balloon.multiselect.length === nodeCount) {
        $fs_browser_header_checkbox.addClass('fs-browser-header-checkbox-checked');
      } else {
        $fs_browser_header_checkbox.addClass('fs-browser-header-checkbox-undetermined');
      }
    } else if(balloon.last) {
      //one node selected
      if(nodeCount === 1) {
        $fs_browser_header_checkbox.addClass('fs-browser-header-checkbox-checked');
      } else {
        $fs_browser_header_checkbox.addClass('fs-browser-header-checkbox-undetermined');
      }
    }
  },

  /**
   * Is touch device?
   *
   * @return bool
   */
  isTouchDevice: function() {
    if(balloon.DEBUG_SIMULATOR.touch === true) {
      return true;
    }

    return ('ontouchstart' in window || window.DocumentTouch && document instanceof DocumentTouch);
  },


  /**
   * Is mobile view
   *
   * @return bool
   */
  isMobileViewPort: function() {
    if(balloon.DEBUG_SIMULATOR.mobileport === true) {
      return true;
    }

    if(window.innerWidth > 800)  {
      return false;
    } else {
      return true;
    }
  },


  /**
   * treeview dblclick
   *
   * @param   object e
   * @return  void
   */
  _treeDblclick: function(e) {
    if(balloon.last.directory === true) {
      balloon.resetDom('selected');
    }

    if(balloon.last !== null && balloon.last.directory) {
      balloon.togglePannel('content', false);

      var $k_tree = $("#fs-browser-tree").data("kendoTreeView");

      if(balloon.last.id == '_FOLDERUP') {
        var params = {},
          id   = balloon.getPreviousCollectionId();

        if(id !== null) {
          params.id = id;
          balloon.refreshTree('/collections/children', params, null, {action: '_FOLDERUP'});
        } else {

          balloon.menuLeftAction(balloon.getCurrentMenu());
        }
      } else {
        balloon.refreshTree('/collections/children', {id: balloon.getCurrentNode().id}, null, {action: '_FOLDERDOWN'});
      }

      balloon.resetDom(
        ['selected','properties','preview','action-bar','multiselect','view-bar',
          'history','share','share-link']
      );
    } else if(balloon.isEditable(balloon.last.mime)) {
      balloon.editFile(balloon.getCurrentNode());
    } else if(balloon.isViewable(balloon.last.mime)) {
      balloon.displayFile(balloon.getCurrentNode());
    } else {
      balloon.downloadNode(balloon.getCurrentNode());
    }

    balloon.pushState();
  },


  /**
   * Keyup in search (when a char was entered)
   *
   * @param   object e
   * @return  void
   */
  _searchKeyup: function(e){
    var $that = $(this);
    $('.fs-search-reset-button').show();

    if(e.keyCode == 13) {
      balloon.search($(this).val());
      return;
    }
  },


  /**
   * When the reset button in the searchbar is clicked
   *
   * @param   object e
   * @return  void
   */
  resetSearch: function(e) {
    balloon.menuLeftAction(balloon.getCurrentMenu());
    $('#fs-browser-action').show();
    $('#fs-search-filter').hide();

    var $fs_crumb_search_list = $('#fs-crumb-search-list');
    $fs_crumb_search_list.find('li').remove();
    $fs_crumb_search_list.append('<li fs-id="" id="fs-crumb-search">'+i18next.t('search.results')+'</li>');

    balloon.resetDom(['selected', 'properties', 'preview', 'action-bar', 'multiselect',
      'view-bar', 'history', 'share', 'share-link', 'search']);
  },


  /**
   * Does node exists?
   *
   * @param   string name
   * @return  bool
   */
  nodeExists: function(name) {
    for(var node=0; node < balloon.datasource._data.length; node++) {
      if(balloon.datasource._data[node].name.toLowerCase() === name.toLowerCase()) {
        return true;
      }
    }
    return false;
  },


  /**
   * Tree sort/filter
   *
   * @var object
   */
  tree:  {
    sort:  {
      field: 'name',
      dir:   'asc',
    },
    filter:  {
      hidden:  false,
      directory: true,
      file:    true,
      share:   true,
      deleted:   0,
    }
  },


  /**
   * Create datasource
   *
   * @return HierarchicalDataSource
   */
  createDatasource: function() {
    balloon.datasource = new kendo.data.HierarchicalDataSource({
      transport: {
        read: function(operation, a) {
          balloon.resetDom('upload');
          if(balloon.datasource._url == undefined) {
            balloon.datasource._url = balloon.base+'/collections/children';
          }

          if(balloon.isSystemNode(operation.data)) {
            return;
          }

          var attributes = [];

          if(balloon.datasource._ds_params === undefined) {
            balloon.datasource._ds_params = {action: '', nostate: false};
          }
          if(balloon.datasource._static_request_params === undefined) {
            balloon.datasource._static_request_params = {};
          }
          if(balloon.datasource._dynamic_request_params === undefined) {
            balloon.datasource._dynamic_request_params = {};
          }
          if(!('attributes' in balloon.datasource._static_request_params)) {
            balloon.datasource._static_request_params.attributes = attributes;
          }

          balloon.datasource._static_request_params.deleted = balloon.tree.filter.deleted;

          operation.data = $.extend(operation.data, balloon.datasource._request_params);
          var params = JSON.parse(JSON.stringify(balloon.datasource._static_request_params));
          $.extend(params, balloon.datasource._dynamic_request_params);
          operation.data = params;
          balloon.datasource._dynamic_request_params = {};

          var collection = balloon.getURLParam('collection');
          if(collection !== null && balloon.last === null && !('id' in params)) {
            operation.data.id = collection;
          }

          if(balloon.datasource._ds_params.sort === true) {
            balloon.datasource._ds_params = false;
            var sorted = balloon._sortDatasource(
              balloon._filterDatasource(balloon.datasource._raw_data, balloon.tree.filter),
              balloon.tree.sort.field,
              balloon.tree.sort.dir
            );
            balloon._rebuildTree(sorted, operation);

            return;
          }

          operation.data.limit = 1000;

          balloon.xmlHttpRequest({
            url: balloon.datasource._url,
            type: 'GET',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify(operation.data),
            processData: false,
            success: function(pool, msg, http) {
              /*for(var node in pool.data) {
                pool.data[node].spriteCssClass = balloon.getSpriteClass(pool.data[node]);
              }*/

              if(balloon.datasource._ds_params.action == '_FOLDERDOWN') {
                balloon.addCrumbRegister(balloon.getCurrentNode());
              } else if(balloon.datasource._ds_params.action == '_FOLDERUP') {
                var crumbs = balloon.getCrumb().find('li').filter(':hidden').get()/*.reverse()*/;
                crumbs = crumbs.slice(-1);
                $(crumbs).show();
                balloon.getCrumb().find('li:last-child').remove();
              }

              if(balloon.datasource._ds_params.nostate !== true && balloon.getCurrentNode() !== null) {
                balloon.pushState();
              }
              balloon.datasource._ds_params.nostate = false;


              var depth = balloon.getFolderDepth(),
                param_col = balloon.getURLParam('collection');

              if(pool.count == 0 && depth == 1 && param_col  === null) {
                $('#fs-browser-fresh').show();
              } else {
                $('#fs-browser-fresh').hide();
              }

              if(depth != 1 && balloon.isSearch() === false || 'id' in operation.data && operation.data.id !== null && operation.id !== null) {
                pool.data.unshift({
                  id: '_FOLDERUP',
                  name: i18next.t('tree.folderup'),
                  directory: true,
                  spriteCssClass: 'gr-i-arrow-w',
                });
              }

              balloon.datasource._raw_data = pool.data;
              var sorted = balloon._sortDatasource(
                balloon._filterDatasource(pool.data, balloon.tree.filter),
                balloon.tree.sort.field,
                balloon.tree.sort.dir
              );
              balloon._rebuildTree(sorted, operation)
            },
            error: function(e) {
              if(balloon.datasource._raw_data === undefined) {
                operation.success([]);
              } else {
                balloon._sortDatasource(
                  balloon._filterDatasource(balloon.datasource._raw_data, balloon.tree.filter),
                  balloon.tree.sort.field,
                  balloon.tree.sort.dir,
                  operation
                );
              }

              balloon.displayError(e);
            },
          });
        }
      },
      schema: {
        model: {
          id: "id",
          hasChildren: false,
        }
      },
    });
  },


  /**
   * Check if node has a hidden name (begins with ".")
   *
   * @param   string|object node
   * @return  bool
   */
  isHidden: function(node) {
    if(typeof(node) == 'object') {
      node = node.name;
    }
    var regex = /^\..*/;
    return regex.test(node);
  },


  /**
   * Sort tree by field and dir
   *
   * @param   string field
   * @param   string dir
   * @return  void
   */
  sortTree: function(field, dir) {
    balloon.tree.sort = { field: field, dir: dir };
    balloon.refreshTree(null, {id: balloon.getCurrentCollectionId()}, null, {
      sort: true,
    });
  },


  /**
   * Sort tree (click callback)
   *
   * @return void
   */
  _sortTree: function() {
    var field = $(this).attr('id').substr(18);

    $('#fs-browser-header').find('span').removeAttr('class');

    var dir;

    if(balloon.tree.sort.field == field) {
      if(balloon.tree.sort.dir == 'asc') {
        dir = 'desc';
      } else {
        dir = 'asc';
      }
    } else {
      dir = 'asc';
    }

    if(dir == 'asc') {
      $(this).find('span').addClass('k-icon').addClass('k-i-arrow-s');
    } else {
      $(this).find('span').addClass('k-icon').addClass('k-i-arrow-n');
    }

    balloon.sortTree(field, dir);
  },


  /**
   * Sort datasource by field and dir (This is an
   * internal method, use sortTree() to make use of data sorting)
   *
   * @param   array data
   * @param   string field
   * @param   string dir
   * @param   object operation
   * @return  void
   */
  _sortDatasource: function(data, field, dir) {
    //sort folders first, 2nd abc
    data.sort(function(a, b) {
      var aname, bname;

      if(balloon.isSystemNode(a) && !balloon.isSystemNode(b)) {
        return -1;
      } else if(balloon.isSystemNode(a) && balloon.isSystemNode(b)) {
        return 1;
      } else if(a.directory && !b.directory) {
        return -1;
      } else if(!a.directory && b.directory) {
        return 1;
      }

      if(field == 'name') {
        aname = a[field].toLowerCase();
        bname = b[field].toLowerCase();
      } else if(field == 'size') {
        aname = parseInt(a.size);
        bname = parseInt(b.size);
      } else if(field == 'changed') {
        aname = a[field];
        bname = b[field];
      }

      if(dir == 'asc') {
        if(aname < bname) {
          return -1;
        } else if(aname > bname) {
          return 1
        } else {
          return 0;
        }
      }      else if(dir == 'desc') {
        if(aname > bname) {
          return -1;
        } else if(aname < bname) {
          return 1
        } else {
          return 0;
        }
      }
    });

    return data;
  },

  /**
   * Rebuild tree
   *
   * @param array data
   * @param object operation
   */
  _rebuildTree: function(data, operation) {
    operation.success(data);

    // TODO pixtron - this might be removed as balloon.post_rename_reload is never true?
    /*if (balloon.post_rename_reload) {
      balloon.showAction(['menu','add','upload','filter','refresh','download','delete','restore','copy','cut']);
      balloon.post_rename_reload = false;
    }*/
  },


  /**
   * Filter datasource
   *
   * @param   array data
   * @param   object filter
   * @return  void
   */
  _filterDatasource: function(data, filter) {
    var filtered = []

    var def = {
      hidden:  false,
      directory: true,
      file:    true,
      share:   true,
    };

    $.extend(def, filter);
    filter = def;

    for(var node in data) {
      var result = true;
      for(var n in filter) {
        if(filter[n] === true) {
          continue;
        }

        switch(n) {
        case 'hidden':
          if(balloon.isHidden(data[node]) && !balloon.isSystemNode(data[node])) {
            result = false;
            break;
          }
          break;

        case 'directory':
          if(data[node].directory === true  && !balloon.isSystemNode(data[node])) {
            result = false;
            break;
          }
          break;

        case 'share':
          if(data[node].directory === true  && !balloon.isSystemNode(data[node]) && data[node].shared === true) {
            result = false;
            break;
          }
          break;

        case 'file':
          if(data[node].directory === false  && !balloon.isSystemNode(data[node])) {
            result = false;
            break;
          }
          break;
        }
      }

      if(result === true) {
        filtered.push(data[node]);
      }
    }
    return filtered;
  },

  /**
   * Rename the selected node
   *
   * @return  void
   */
  initRename: function() {
    if(balloon.rename_node !== null && balloon.rename_node !== undefined ){
      return;
    }

    var node = balloon.getSelected(),
      $target = $('#fs-browser').find('li[fs-id='+node.id+']').find('.fs-browser-column-name'),
      $input = $('<input class="fs-filename-rename" type="text" value="'+ node.name +'" />');

    balloon.rename_node = node;
    balloon.rename_input = $input;
    balloon.rename_original = $target.html();

    $target.html($input);

    $input.focus();

    var ext = balloon.getFileExtension(node);
    if(ext === null) {
      $input.select();
    } else {
      var length = node.name.length - ext.length - 1;
      $input[0].setSelectionRange(0, length);
    }

    $input.focusout(function(e) {
      balloon._rename();
    });

    $input.keyup(function(e) {
      e.stopImmediatePropagation();
      if(e.which === 27) {
        balloon._resetRenameView();
      } else if(e.keyCode == 13) {
        balloon._rename();
      }
    });
  },

  /**
   * Reset normal fs-value-name view
   *
   * @return void
   */
  _resetRenameView: function(){
    if(balloon.rename_input && balloon.rename_original) {
      balloon.rename_input.parent().append(balloon.rename_original);
    }

    if(balloon.rename_input) {
      balloon.rename_input.remove();
    }

    balloon.rename_node = undefined;
    balloon.rename_original = undefined;
    balloon.rename_input = null;
  },


  /**
   * Rename node
   *
   * @return void
   */
  _rename: function() {
    if(balloon.rename_input === null || balloon.rename_input === undefined || balloon.rename_node === null) {
      return;
    }

    var new_value = balloon.rename_input.val();

    balloon.rename_input.unbind('keyup');

    if(new_value != balloon.rename_node.name) {
      balloon.rename(balloon.rename_node, new_value);
    } else {
      balloon._resetRenameView();
    }
  },


  /**
   * Rename node
   *
   * @param   object node
   * @param   string new_name
   * @return  void
   */
  rename: function(node, new_name) {
    balloon.xmlHttpRequest({
      url: balloon.base+'/nodes?id='+balloon.id(node),
      type: 'PATCH',
      dataType: 'json',
      data: {
        name: new_name,
      },
      success: function(data) {
        var newNode = data;

        if(typeof(newNode) === 'object') {
          newNode.spriteCssClass = balloon.getSpriteClass(node);
          balloon.displayProperties(newNode);
        }

        balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
        balloon.rename_node = null;
      },
      error: function(response) {
        balloon.rename_node = null;
        balloon._resetRenameView();
        balloon.displayError(response);
      }
    });
  },


  /**
   * Select multiple nodes
   *
   * @param   object node
   * @param   bool stay
   * @return  void
   */
  multiSelect: function(node, stay) {
    if(stay === undefined) {
      stay = false;
    }

    if(node == undefined || node == null) {
      balloon.resetDom('multiselect');
      return;
    }

    if(typeof(balloon.multiselect) != 'object') {
      balloon.multiselect = [];
    }

    balloon.resetDom(['upload', 'preview', 'properties', 'history', 'selected', 'view-bar']);
    balloon.togglePannel('content', true);

    var index = balloon.multiselect.indexOf(node);
    var $selected = $('#fs-browser-tree').find('li[fs-id='+balloon.id(node)+']');

    if(index >= 0 && stay === false) {
      balloon.multiselect.splice(index, 1);

      $selected.removeClass('fs-multiselected');
    } else if(index <= 0) {
      balloon.multiselect.push(node);
      $selected.addClass('fs-multiselected');
    }

    $('#fs-browser-summary').html(i18next.t('tree.selected', {count: balloon.multiselect.length})).show();
  },


  /**
   * Deselects all currently selected nodes
   *
   * @return  void
   */
  deselectAll: function() {
    var $k_tree = $("#fs-browser-tree").data('kendoTreeView');

    for(var i=0; i<balloon.datasource._pristineData.length; i++) {
      var node = balloon.datasource._pristineData[i];
      var $node = $('#fs-browser-tree').find('li[fs-id='+balloon.id(node)+']');
      $node.removeClass('fs-multiselected');
    }
    $k_tree.select($());

    balloon.multiselect = [];
    balloon.togglePannel('content', false);
    balloon.pushState(false, true);
  },

  /**
   * Selects all currently displayed nodes
   *
   * @return  void
   */
  selectAll: function() {
    var $fs_browser_tree = $('#fs-browser-tree');
    var $k_tree = $fs_browser_tree.data('kendoTreeView');

    for(var i=0; i<balloon.datasource._pristineData.length; i++) {
      var node = balloon.datasource._pristineData[i];
      var id = balloon.id(node);

      //do not select _FOLDERUP
      if(id === '_FOLDERUP') continue;

      balloon.multiSelect(node);

      var dom_node = $fs_browser_tree.find('.k-item[fs-id='+balloon.id(node)+']');
      $k_tree.select(dom_node);
      $k_tree.trigger('select', {node: dom_node});
    }

    balloon.pushState();
  },

  /**
   * Check if node is selected
   *
   * @param   object node
   * @return  bool
   */
  isSelected: function(node) {
    if(balloon.isMultiSelect()) {
      return (balloon.multiselect.indexOf(node) >= 0);
    }    else {
      return (node.id === balloon.getCurrentNode().id);
    }
  },


  /**
   * Is multi select running
   *
   * @return bool
   */
  isMultiSelect: function() {
    return (typeof(balloon.multiselect) == 'object' && balloon.multiselect.length > 0);
  },


  /**
   * Get node by id
   *
   * @param   string id
   * @return  object
   */
  getNodeById: function(id) {
    return $("#fs-browser-tree").data("kendoTreeView")
      .dataSource.getByUid($('.k-item[fs-id='+id+']').attr('data-uid'));
  },


  /**
   * Get node id either from object node or directly
   *
   * Return value NULL means root collection.
   *
   * @param   string|object node
   * @return  string
   */
  getSelected: function(node) {
    if(balloon.isMultiSelect()) {
      return balloon.multiselect;
    }    else {
      if(node !== undefined) {
        return node;
      }      else {
        return balloon.getCurrentNode();
      }
    }
  },


  /**
   * Parse error response
   *
   * @param  mixed response
   * @return mixed
   */
  parseError: function(response) {
    if(typeof(response) === 'object' && response instanceof Error) {
      return false;
    }    else {
      if('XMLHttpRequest' in response) {
        response = response.XMLHttpRequest;
      }

      if(response.statusText == 'abort' && response.status == 0) {
        return;
      }

      try {
        var body = JSON.parse(response.responseText);
      }      catch(err) {
        body = false;
        var js_error = err.message;
      }

      return body;
    }
  },


  /**
   * Display error
   *
   * @param   object response
   * @return  void
   */
  displayError: function(response) {
    var $fs_error_win = $('#fs-error-window'),
      $fs_error_single = $fs_error_win.find('fieldset:first').hide(),
      $fs_error_multi = $fs_error_win.find('fieldset:last').hide(),
      $list = $fs_error_win.find('ul');

    $list.find('li').remove();
    $fs_error_win.find('td').html('');

    var result = balloon.parseError(response)

    if(typeof(response) === 'object' && response instanceof Error) {
      $fs_error_single.show();
      $("#fs-error-status").html(0);
      $("#fs-error-code").html(0);
      $("#fs-error-message").html(response.message);
      $("#fs-error-error").html(response.name);
    } else {
      if('XMLHttpRequest' in response) {
        response = response.XMLHttpRequest;
      }

      if(response.statusText == 'abort' && response.status == 0) {
        return;
      }

      try {
        var body = JSON.parse(response.responseText);
      } catch(err) {
        body = false;
        var js_error = err.message;
      }

      if(body != false) {
        if(body instanceof Array) {
          $fs_error_multi.show();
          var dom;

          for(var i in body) {
            dom = '<li><table>'+
                '<tr>'+
                  '<th>'+i18next.t('error.node')+'</th>'+
                  '<td>'+body[i].name+'</td>'+
                '</tr>'+
                '<tr>'+
                  '<th>'+i18next.t('error.classification')+'</th>'+
                  '<td>'+body[i].error+'</td>'+
                '</tr>'+
                '<tr>'+
                  '<th>'+i18next.t('error.code')+'</th>'+
                  '<td>'+body[i].code+'</td>'+
                '</tr>'+
                '<tr>'+
                  '<th>'+i18next.t('error.message')+'</th>'+
                  '<td>'+body[i].message+'</td>'+
                '</tr>'+
                '</table></li>';

            $list.append(dom);
          }
        } else {
          $fs_error_single.show();
          $("#fs-error-status").html(response.status);
          $("#fs-error-code").html(body.code);
          $("#fs-error-error").html(body.error);
          $("#fs-error-message").html(body.message);
        }
      } else {
        $fs_error_single.show();
        $("#fs-error-status").html(response.status);
        $("#fs-error-message").html(response.statusText);
        $("#fs-error-error").html('parseJSONResponse');
      }
    }

    var $k_win = $fs_error_win.data('kendoBalloonWindow');
    if($k_win != undefined) {
      $k_win.destroy();
    }

    $fs_error_win.kendoBalloonWindow({
      title: $fs_error_win.attr('title'),
      resizable: false,
      width: '600px',
      modal: true,
      open: function() {
        $fs_error_win.parent().addClass('fs-error-window');
        var $icon = '<svg class="gr-icon gr-i-warning-fill" viewBox="0 0 24 24"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#warning-fill"></use></svg>';
        $fs_error_win.prev().find('.k-window-title').prepend($icon);

        $fs_error_win.find('input[name="ok"]').off('click').on('click', function() {
          $fs_error_win.data('kendoBalloonWindow').close();
        });
      },
      close: function() {
        // TODO pixtron - is this really needed?
        balloon.showAction(['menu', 'download', 'add', 'upload', 'refresh', 'delete', 'cut', 'copy', 'filter', 'rename']);
      }
    }).data("kendoBalloonWindow").center().open();
  },


  /**
   * Get node id either from object node or directly
   *
   * Returning value NULL means root collection.
   * Returning an array means multiple node id's.
   *
   * @param   string|object|array node
   * @return  string
   */
  id: function(node) {
    if(node === null || node === '' || node === undefined) {
      return null;
    }    else if(node instanceof Array) {
      var id = [];
      for(var i in node) {
        if(typeof(node[i]) === 'string') {
          id.push(node[i]);
        } else {
          id.push(node[i].id);
        }
      }

      return id;
    }    else if(typeof(node) == 'string') {
      return node;
    }    else {
      return node.id;
    }
  },


  /**
   * Encode string|array to uri query string
   *
   * @param   string attr
   * @param   string|array value
   * @return  string
   */
  param: function(attr, value) {
    var str = '';
    if(value instanceof Array) {
      for(var i in value) {
        if(str.length != 0) {
          str += '&';
        }
        str += attr+'[]='+value[i];
      }
    }    else if(value === null || value === undefined) {
      return '';
    }    else {
      str = attr+'='+value;
    }

    return str;
  },


  /**
   * Show spinner
   *
   * @return  void
   */
  showSpinner: function() {
    var $fs_spinner = $('#fs-spinner');

    if(!$fs_spinner.is(':visible')) {
      $('#fs-namespace').addClass('fs-loader-cursor');
      $fs_spinner.show();
    }
  },


  /**
   * Hide spinner
   *
   * @return  void
   */
  hideSpinner: function() {
    var $fs_spinner = $('#fs-spinner');

    if($fs_spinner.is(':visible')) {
      $('#fs-namespace').removeClass('fs-loader-cursor');
      $fs_spinner.hide();
    }
  },


  /**
   * Navigate crumb
   *
   * @return  void
   */
  initCrumb: function() {
    $('#fs-crumb-search-list').hide();

    $('#fs-crumb').on('click', 'li', function() {
      var $k_tree = $("#fs-browser-tree").data("kendoTreeView"),
        $that = $(this),
        id = $that.attr('fs-id');

      if(id === '') {
        balloon.menuLeftAction(balloon.getCurrentMenu());
      } else {
        balloon.refreshTree('/collections/children', {id: id}, null, {action: false});
      }

      var $next = $that.nextAll();
      if($next.length === 0) {
        return;
      }

      var crumbs = $that.parent().find('li').filter(':hidden').get();
      crumbs = crumbs.slice($next.length * -1);
      $(crumbs).show();
      $next.remove();
      //balloon.resetDom('search');
    });
  },


  /**
   * Get crumb
   *
   * @return object
   */
  getCrumb: function() {
    if(balloon.isSearch()) {
      return $("#fs-crumb-search-list");
    } else {
      return $("#fs-crumb-home-list");
    }
  },


  /**
   * Get crumb parents
   *
   * @return array
   */
  getCrumbParents: function() {
    var list  = [];
    $('#fs-crumb-home-list').find('li').each(function() {
      var $that = $(this);

      if($that.attr('id') != 'fs-crumb-home') {
        list.push({
          name: $that.find('div').html(),
          id:   $that.attr('fs-id'),
        });
      }
    });

    return list;
  },


  /**
   * Add crumb register
   *
   * @param   object node
   * @return  void
   */
  addCrumbRegister: function(node) {
    var exists = false;
    $('#fs-crumb-home-list').find('li').each(function(){
      if($(this).attr('fs-id') == node.id) {
        exists = true;
      }
    });

    if(exists === true) {
      return;
    }

    var $crumbs = $('#fs-crumb').find('li:not(#fs-crumb-home,#fs-crumb-search)').filter(':visible');
    if($crumbs.length > 2) {
      $($crumbs[0]).hide();
    }

    var child = '<li fs-id="'+node.id+'">'+node.name+'</li>';
    balloon.getCrumb().append(child);
  },


  /**
   * Get folder depth
   *
   * @return void
   */
  getFolderDepth: function() {
    return balloon.getCrumb().find('li').length;
  },


  /**
   * Get current collection id
   *
   * @return string|null
   */
  getCurrentCollectionId: function() {
    var last = balloon.getCrumb().find('li:last-child');
    return balloon.id(last.attr('fs-id'));
  },


  /**
   * Get current selected node
   *
   * @return object
   */
  getCurrentNode: function() {
    if(balloon.isSystemNode(balloon.last)) {
      return balloon.previous;
    } else {
      return balloon.last;
    }
  },


  /**
   * Get previous collection id
   *
   * @return string|null
   */
  getPreviousCollectionId: function() {
    var last = balloon.getCrumb().find('li:last-child');
    var up = last.prev();
    return balloon.id(up.attr('fs-id'));
  },


  /**
   * Refresh tree
   *
   * @return  void
   */
  refreshTree: function(url, dynamic_params, static_params, ds_params) {
    if(typeof(ds_params) === 'object') {
      if(!('action' in ds_params)) {
        ds_params.action = '';
      }
      if(!('nostate' in ds_params)) {
        ds_params.nostate = false;
      }
    } else {
      ds_params = {action: '', nostate: false};
    }

    balloon.datasource._ds_params = ds_params;
    var $k_tree = $("#fs-browser-tree").data("kendoTreeView");

    if(url !== undefined && url !== null) {
      balloon.datasource._url = balloon.base+url;
    }

    if(dynamic_params !== undefined) {
      balloon.datasource._dynamic_request_params = dynamic_params;
    }

    if(static_params !== undefined && static_params != null) {
      balloon.datasource._static_request_params = static_params;
    }

    if($k_tree != undefined) {
      $k_tree.dataSource.read();
    }
  },


  /**
   * Add node
   */
  addNode: function() {
    $('body').off('click').on('click', function(e){
      var $target = $(e.target);

      if($target.attr('id') != "fs-action-add") {
        $('#fs-action-add-select').hide();
      }
    });

    var $select = $('#fs-action-add-select');
    var $spike = $select.find('.fs-action-dropdown-spike');

    $('#fs-action-add-select').find('span').show();
    $('#fs-action-add-select').find('input').hide().val('');

    $select.show();

    var spikeLeft = ($(this).offset().left + $(this).width() / 2) - $select.offset().left - ($spike.outerWidth() / 2);
    $spike.css('left', spikeLeft+'px');

    $select.off('click', 'li')
      .on('click', 'li', function(e) {
        e.stopPropagation();
        $('#fs-action-add-select').find('span').show();
        $('#fs-action-add-select').find('input').hide().val('');

        $(this).find('span').last().hide();
        var type = $(this).attr('data-type');

        var $input = $(this).find('input');
        if(type === 'folder') {
          $input.val(i18next.t('tree.new_folder'));
        } else {
          $input.val(i18next.t('tree.new_file'));
        }

        $input.select();

        $input.show().focus().off('keydown').on('keydown', function(e) {
          e.stopImmediatePropagation();
          var name = $(this).val();

          if(type !== 'folder') {
            name = name+'.'+type;
          }

          if(balloon.nodeExists(name)) {
            $(this).addClass('fs-node-exists');
            return;
          } else {
            $(this).removeClass('fs-node-exists');
          }

          if(e.keyCode === 13) {
            if(balloon.add_file_handlers[type]) {
              balloon.add_file_handlers[type](name, type);
            }

            setTimeout(function(){
              $('#fs-action-add-select').hide();
            }, 100);
          }
        });
      });

  },

  /**
   * Add folder
   *
   * @param string name
   * @return  void
   */
  addFolder: function(name) {
    balloon.xmlHttpRequest({
      url: balloon.base+'/collections',
      type: 'POST',
      data: {
        id:   balloon.getCurrentCollectionId(),
        name: name,
      },
      dataType: 'json',
      success: function(data) {
        balloon.added = data.id;
        balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
      },
    });
  },


  /**
   * Add new file
   *
   * @param string name
   * @return void
   */
  addFile: function(name) {
    name = encodeURI(name);

    balloon.xmlHttpRequest({
      url: balloon.base+'/files?name='+name+'&'+balloon.param('collection', balloon.getCurrentCollectionId()),
      type: 'PUT',
      success: function(data) {
        balloon.added = data.id;
        balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
      },
    });
  },


  /**
   * Create random string
   *
   * @param  int length
   * @param  string set
   * @return string
   */
  randomString: function(length, set) {
    set = set || 'abcdefghijklmnopqrstuvwxyz0123456789';
    var randomString = '';
    for (var i = 0; i < length; i++) {
      var randomPoz = Math.floor(Math.random() * set.length);
      randomString += set.substring(randomPoz,randomPoz+1);
    }

    return randomString;
  },


  /**
   * Check if system node
   *
   * @param   object node
   * @return  bool
   */
  isSystemNode: function(node) {
    var system = [
      '_ROOT',
      '_SEARCH',
      '_TRASH',
      '_FOLDERUP',
      '_NEWFOLDER'
    ];

    if(node === null || typeof(node) != 'object') {
      return true;
    }    else {
      return system.indexOf(node.id) > 0;
    }
  },

  /**
   * Share node
   *
   * @param   object|string node
   * @return  void
   */
  shareCollection: function(node) {
    if(node.directory === false) {
      return false;
    }

    balloon.resetDom('share');

    var $fs_share = $('#fs-share');
    var $fs_share_create = $fs_share.find('#fs-share-create');
    var $fs_share_edit = $fs_share.find('#fs-share-edit');
    var $fs_share_delete = $fs_share.find('#fs-share-delete');

    $fs_share_create.off('click').on('click', balloon.showShare);

    $fs_share_edit.off('click').on('click', balloon.showShare);

    $fs_share_delete.off('click').on('click', function() {
      balloon.deleteShare(node);
    });

    if(!node.shared && !node.reference) {
      $fs_share_create.show();
      $fs_share_edit.hide();
      $fs_share_delete.hide();

      balloon.prepareShareConsumerPreview(node, []);
    } else {
      $fs_share_create.hide();
      $fs_share_edit.show();
      $fs_share_delete.show();

      balloon.xmlHttpRequest({
        url: balloon.base+'/collections/share',
        type: 'GET',
        dataType: 'json',
        data: {
          id: balloon.id(node),
        },
        success: function(data) {
          balloon.prepareShareConsumerPreview(node, data.acl);
        },
      });
    }
  },

  /**
   * Prepares the share consumer preview
   *
   * @param object node
   * @param array acl
   * @return void
   */
  prepareShareConsumerPreview: function(node, acl) {
    var $fs_share_consumers = $('#fs-share-consumers');
    var $fs_share_consumers_ul = $fs_share_consumers.find('ul');

    var $li_owner = $('<li></li>');
    $fs_share_consumers_ul.append($li_owner);

    $fs_share_consumers_ul.off('click').on('click', balloon.showShare);

    balloon.xmlHttpRequest({
      url: balloon.base+'/users/avatar',
      type: 'GET',
      success: function(body) {
        $li_owner.css('background-image', 'url(data:image/jpeg;base64,'+body+')');
      },
      error: function() {
        //empty method to avoid error message bubbling up
      }
    });

    if(!node.shared && !node.reference) {
      $fs_share_consumers.find('.fs-share-hint-owner-only').show();
    } else {
      var numConsumers = acl.length + 1;
      var maxConsumersDisplayed = 5;

      for(var i=0; i < maxConsumersDisplayed-1 && i < numConsumers; i++) {
        var curAcl = acl[i];
        var $li_consumer = $('<li><div><span></span><p>'+ i18next.t('view.share.privilege_text_'+curAcl.privilege, curAcl.role.name) +'</p></div></li>');
        $fs_share_consumers_ul.append($li_consumer);

        //TODO pixtron - add users avatar to li as inline background-image
        /*balloon.xmlHttpRequest({
          url: balloon.base+'/users/' + curAcl.id + '/avatar',
          type: 'GET',
          success: function(body) {
            $li_consumer.css('background-image', 'url(data:image/jpeg;base64,'+body+')');
          },
          error: function() {
            //empty method to avoid error message bubbling up
          }
        });*/
      }

      if(maxConsumersDisplayed < numConsumers) {
        var $li_additional = $('<li class="fs-share-consumers-additional"><span>' + (numConsumers - maxConsumersDisplayed) + '+</span></li>');
        $fs_share_consumers_ul.append($li_additional);
      }
    }
  },

  /**
   * Shows popup for share creating/edting
   *
   * @return bool
   */
  showShare: function() {
    var acl = [];
    var node = balloon.getCurrentNode();

    if(!node || !node.directory) return;

    var $fs_share_win = $('#fs-share-window');
    var $fs_share_win_create = $fs_share_win.find('input[name=create]');
    var $fs_share_win_save = $fs_share_win.find('input[name=save]');
    var $fs_share_win_cancel = $fs_share_win.find('input[name=cancel]');
    var $fs_share_win_remove = $fs_share_win.find('#fs-share-window-remove');
    var $fs_share_win_remove_btn = $fs_share_win.find('input[name=unshare]');
    var $share_name = $fs_share_win.find('input[name=share_name]');

    $fs_share_win.find('#fs-share-window-consumers').empty().hide();

    if(node.shared === false) {
      $fs_share_win_create.show();
      $fs_share_win_save.hide();
      $fs_share_win_remove.hide();
    } else {
      $fs_share_win_create.hide();
      $fs_share_win_save.show();
      $fs_share_win_remove.show();
    }

    if(!node.shared && !node.reference) {
      $share_name.val(node.name);
      balloon.prepareShareWindow(node, acl);
    } else {
      balloon.xmlHttpRequest({
        url: balloon.base+'/collections/share',
        type: 'GET',
        dataType: 'json',
        data: {
          id: balloon.id(node),
        },
        success: function(data) {
          $share_name.val(data.name);

          for(var i in data.acl) {
            var consumer = data.acl[i];
            balloon._addShareConsumer(consumer, acl);
          }

          balloon.prepareShareWindow(node, acl);
        },
      });
    }

    var $k_win = $fs_share_win.kendoBalloonWindow({
      title: node.name,
      resizable: false,
      modal: true
    }).data('kendoBalloonWindow').center().open();

    $fs_share_win.find('input[name="new_share_consumer_privilege"]').off('change').on('change', function() {
      var newPrivilege = $(this).val();
      $fs_share_win.find('#fs-share-window-search-role .fs-share-window-selected-privilege-label').html(i18next.t('view.share.privilege_' + newPrivilege));
    });

    $fs_share_win_remove_btn.off('click').on('click', function() {
      balloon.deleteShare(node);
      $k_win.close();
    });

    $fs_share_win_create.off('click').on('click', function() {
      if(balloon._saveShare(acl, node)) {
        $k_win.close();
      }
    });

    $fs_share_win_save.off('click').on('click', function() {
      if(balloon._saveShare(acl, node)) {
        $k_win.close();
      }
    });

    $fs_share_win_cancel.off('click').on('click', function() {
      $k_win.close();
    });
  },

  /**
   * Prepare share functionality
   *
   * @param object node
   * @param array acl
   * @return void
   */
  prepareShareWindow: function(node, acl) {
    var $fs_share_win = $('#fs-share-window');
    var $share_consumer_search = $fs_share_win.find('input[name=share_consumer_search]');
    var $share_name = $fs_share_win.find('input[name=share_name]');

    $fs_share_win.find('.fs-window-secondary-actions input[type="submit"]').prop('disabled', ($share_name.val() === '' || acl.length === 0));

    $share_name.off('change').on('change', function() {
      if($(this).val() !== '') {
        if(acl.length > 0) {
          $fs_share_win.find('.fs-window-secondary-actions input[type="submit"]').prop('disabled', false);
        }
      } else {
        $fs_share_win.find('.fs-window-secondary-actions input[type="submit"]').prop('disabled', true);
      }
    });

    $share_consumer_search.kendoAutoComplete({
      minLength: 3,
      dataTextField: "name",
      filter: "contains",
      dataSource: new kendo.data.DataSource({
        serverFiltering: true,
        transport: {
          read: function(operation) {
            var value = $share_consumer_search.data("kendoAutoComplete").value()
            if(value === '' || value === undefined) {
              operation.success({data:null});
              return;
            }

            var filter = JSON.stringify({'query': {'name': {
              "$regex": $share_consumer_search.data("kendoAutoComplete").value(),
              "$options": "i"
            }}});

            var consumers = null;

            balloon.xmlHttpRequest({
              url: balloon.base+'/groups?'+filter,
              contentType: "application/json",
              success: function(data) {
                for(var i in data.data) {
                  data.data[i].type = 'group';
                  data.data[i].role = $.extend({}, data.data[i]);
                }

                if(consumers !== null) {
                  operation.success(data.data.concat(consumers));
                } else {
                  consumers = data.data;
                }
              }
            });

            filter = JSON.stringify({'query': {'username': {
              "$regex": $share_consumer_search.data("kendoAutoComplete").value(),
              "$options": "i"
            }}});

            balloon.xmlHttpRequest({
              url: balloon.base+'/users?'+filter,
              contentType: "application/json",
              dataType: 'json',
              success: function(data) {
                for(var i in data.data) {
                  data.data[i].type = 'user';
                  data.data[i].role = $.extend({}, data.data[i]);
                }

                if(consumers !== null) {
                  operation.success(data.data.concat(consumers));
                } else {
                  consumers = data.data;
                }
              }
            });
          }
        },
        sort: {
          dir: 'asc',
          field: 'name'
        },
      }),
      change: function(e) {
        this.dataSource.read();
      },
      select: function(e) {
        setTimeout(function(){
          $share_consumer_search.val('').focus();
        },50);

        $share_consumer_search.val('');
        var item = this.dataItem(e.item.index());
        balloon._addShareConsumer(item, acl);
      }
    });
  },

  /**
   * Add a share consumer to list
   *
   * @param  object item
   * @param  Array acl
   * @return object
   */
  _addShareConsumer: function(item, acl) {
    var $fs_share_win_consumers = $('#fs-share-window-consumers');

    if(acl.filter(function(role) {
      return role.id === item.role.id;
    }).length > 0) {
      //added item is already present in acl.
      return;
    }

    var name = item.role.name;

    var privilege = item.privilege || $('input[name="new_share_consumer_privilege"]:checked').val();

    acl.push({
      type: item.type,
      id: item.role.id,
      privilege: privilege,
    });

    var $consumer = $('<li id="fs-share-window-consumer-' + item.role.id + '">'+name+'</li>');

    var $consumer_privilege = $(
      '<div class="fs-share-window-privilege-selector">'+
        '<div class="fs-share-window-selected-privilege">'+
            '<span class="fs-share-window-selected-privilege-label">' + i18next.t('view.share.privilege_' + privilege) + '</span>'+
            '<svg class="gr-icon gr-i-expand"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#expand"></use></svg>'+
        '</div>'+
      '</div>'
    );

    var $consumer_privilege_selector = $('<ul class="fs-share-window-privileges"></ul>');

    var privileges = ['m', 'r', 'rw', 'w+'];
    for(var i in privileges) {
      var itemPrivilege = privileges[i];
      var itemId = item.role.id;
      $consumer_privilege_selector.append(
        '<li>'+
            '<input id="priv_' + itemId + '_' + itemPrivilege + '" type="radio" name="priv_'+item.role.id+'" value="' + itemPrivilege + '" ' + (itemPrivilege === privilege ? ' checked' : '') + ' />'+
            '<label for="priv_'  + itemId + '_' + itemPrivilege + '">'+
                '<svg viewBox="0 0 24 24" class="gr-icon gr-i-checkmark"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#checkmark"></use></svg>'+
                '<span class="fs-share-window-privilege-label">' + i18next.t('view.share.privilege_' + itemPrivilege) + '</span>'+
            '</label>'+
        '</li>'
      );
    }

    var $consumer_privilege_selector_item_remove = $(
      '<li class="fs-share-window-privilege-remove">'+
          '<label>'+
              '<span class="fs-share-window-privilege-label">' + i18next.t('view.share.remove_privilege') + '</span>'+
          '</label>'+
      '</li>'
    );

    $consumer_privilege_selector.append($consumer_privilege_selector_item_remove);

    $consumer_privilege.append($consumer_privilege_selector);
    $consumer.append($consumer_privilege);

    $fs_share_win_consumers.append($consumer);
    $fs_share_win_consumers.show();

    $('#fs-share-window .fs-window-secondary-actions input[type="submit"]').prop('disabled', ($('#fs-share-window input[name=share_name]').val() === ''));

    $consumer_privilege_selector.find('input[type="radio"]').off('change').on('change', function() {
      var newPrivilege = $(this).val();

      for(var i in acl) {
        if(acl[i].id == item.role.id) {
          acl[i].privilege = newPrivilege;
          break;
        }
      }

      $consumer_privilege.find('.fs-share-window-selected-privilege-label').html(i18next.t('view.share.privilege_' + newPrivilege));
    });

    $consumer_privilege_selector_item_remove.off('click').on('click', function() {
      balloon._removeShareConsumer(item.role.id, acl);
    });

    return acl;
  },

  /**
   * Remove a share consumer from list
   *
   * @param  string role
   * @param  Array acl
   * @return object
   */
  _removeShareConsumer: function(role, acl) {
    $('#fs-share-window-consumer-' + role).remove();

    for(var i in acl) {
      if(acl[i].id == role) {
        acl.splice(acl.indexOf(acl[i]), 1);
        break;
      }
    }

    if(acl.length === 0) {
      $('#fs-share-window-consumers').hide();
      $('#fs-share-window .fs-window-secondary-actions input[type="submit"]').prop('disabled', true);
    }
  },

  /**
   * Save acl for given node
   *
   * @param  Array acl
   * @param  object node
   * @return object
   */
  _saveShare: function(acl, node) {
    var $share_name = $('#fs-share-window input[name=share_name]');

    if($share_name.val() === '') {
      $share_name.focus();
      return false;
    } else if(acl.length === 0) {
      $('#fs-share-window input[name=share_consumer_search]').focus();
      return false;
    } else {
      balloon._shareCollection(node, acl, $share_name.val());
      return true;
    }
  },

  /**
   * Deleted share
   *
   * @param  object node
   * @return void
   */
  deleteShare: function(node) {
    var msg = i18next.t('view.share.prompt_remove_share', node.name);
    balloon.promptConfirm(msg, '_deleteShare', [node]);
  },

  /**
   * Deleted share
   *
   * @param  object node
   * @return void
   */
  _deleteShare: function(node) {
    var url = balloon.base+'/collections/share?id='+balloon.id(node);

    balloon.xmlHttpRequest({
      url: url,
      type: 'DELETE',
      dataType: 'json',
      statusCode: {
        204: function(e) {
          balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
          balloon.last.shared = false;
          if(balloon.id(node) == balloon.id(balloon.last)) {
            balloon.switchView('share');
          }
        }
      },
    });
  },

  /**
   * Save share collection
   *
   * @param   object node
   * @param   array acl
   * @param   string name
   * @return  void
   */
  _shareCollection: function(node, acl, name) {
    var url = balloon.base+'/collections/share?id='+balloon.id(node);

    balloon.xmlHttpRequest({
      url: url,
      type: 'POST',
      dataType: 'json',
      data: {
        acl: acl,
        name: name
      },
      success: function() {
        node.shared = true;
        balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
        if(balloon.id(node) == balloon.id(balloon.last)) {
          balloon.switchView('share');
        }
      },
    });
  },

  /**
   * Share node
   *
   * @param   object|string node
   * @return  void
   */
  shareLink: function(node) {
    balloon.resetDom('share-link');

    var $fs_share_link_edit = $('#fs-share-link-edit');
    var $fs_share_link_delete = $('#fs-share-link-delete');
    var $fs_share_link_create = $('#fs-share-link-create');

    if(node.sharelink_token) {
      $fs_share_link_edit.show();
      $fs_share_link_delete.show();
      $fs_share_link_create.hide();
    } else {
      $fs_share_link_edit.hide();
      $fs_share_link_delete.hide();
      $fs_share_link_create.show();
    }

    $fs_share_link_edit.off('click').on('click', balloon.showShareLink);
    $fs_share_link_delete.off('click').on('click', function() {
      balloon.removeShareLink();
    });
    $fs_share_link_create.off('click').on('click', balloon.showShareLinkSettings);
  },


  /**
   * Shows popup for share link settings
   *
   * @return bool
   */
  showShareLinkSettings: function() {
    var node = balloon.getCurrentNode();

    if(!node) return;

    var $fs_share_link_settings_win = $('#fs-share-link-settings-window');

    var $k_win = $fs_share_link_settings_win.kendoBalloonWindow({
      title: i18next.t('view.share_link.settings.title', node.name),
      resizable: false,
      modal: true,
      open: function() {
        var token;

        var $fs_share_expr_check = $fs_share_link_settings_win.find('#fs-share-link-expiration-check');
        var $fs_share_pw_check = $fs_share_link_settings_win.find('#fs-share-link-password-check');
        var $fs_share_pw = $fs_share_link_settings_win.find('input[name=share_password]');


        var $k_fs_share_expr_date = $fs_share_link_settings_win.find('input[name=share_expiration_date]').kendoBalloonDatePicker({
          format: kendo.culture().calendar.patterns.d,
          min: new Date(),
        }).data('kendoBalloonDatePicker');

        var $k_fs_share_expr_time = $fs_share_link_settings_win.find('input[name=share_expiration_time]').kendoBalloonTimePicker({
          format: kendo.culture().calendar.patterns.t
        }).data('kendoBalloonTimePicker');

        if(node.sharelink_token) {
          token = node.sharelink_token;

          if(node.sharelink_expire) {
            var curDate = new Date(node.sharelink_expire);
            var curTime = new Date(0);

            curTime.setHours(curDate.getHours());
            curTime.setMinutes(curDate.getMinutes());

            curDate.setHours(0);
            curDate.setMinutes(0);

            $k_fs_share_expr_date.value(curDate);
            $k_fs_share_expr_time.value(curTime);
            $fs_share_expr_check.prop('checked', true);
          }
        }

        $fs_share_expr_check.off('change').on('change', function() {
          if($fs_share_expr_check.prop('checked') === false) {
            $k_fs_share_expr_date.value(null);
            $k_fs_share_expr_time.value(null);
          } else {
            if($k_fs_share_expr_date.value() === null) {
              var defaultDate = new Date();
              defaultDate.setDate(defaultDate.getDate() + 1);
              $k_fs_share_expr_date.value(defaultDate);
            }

            $k_fs_share_expr_date.open();
          }
        });

        $k_fs_share_expr_date.unbind().bind('change', function() {
          $fs_share_expr_check.prop('checked', $k_fs_share_expr_date.value() !== null);
        });

        $fs_share_pw_check.off('change').on('change', function() {
          if($fs_share_pw_check.prop('checked') === false) {
            $fs_share_pw.val('');
          } else {
            $fs_share_pw.focus();
          }
        });

        $fs_share_pw.off('keyup').on('keyup', function() {
          $fs_share_pw_check.prop('checked', $fs_share_pw.val() !== '');
        });

        $fs_share_link_settings_win.find('input:submit').unbind().click(function() {
          var date = $k_fs_share_expr_date.value();
          var time = $k_fs_share_expr_time.value();

          if(date !== null) {
            date.setHours(0);
            date.setMinutes(0);
            date.setSeconds(0);
          }

          if(date !== null && time !== null) {
            date.setTime(date.getTime() + ((time.getHours() * 60 + time.getMinutes()) * 60 * 1000));
          }

          if(date != null) {
            date = Math.round(date.getTime() / 1000);
          }

          balloon.xmlHttpRequest({
            type: 'POST',
            url: balloon.base+'/nodes/share-link',
            data: {
              id: balloon.id(node),
              options: {
                expiration: date,
                token: token,
                password: $fs_share_pw.val()
              },
            },
            complete: function() {
              $k_win.close();
              balloon.showShareLink();
            },
            success: function(body) {
              balloon.last = body;
              balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
              balloon.switchView('share-link');
            }
          });
        });

        $fs_share_link_settings_win.find('input:button').unbind().click(function() {
          $k_win.close();
          if(token) balloon.showShareLink();
        });
      }
    }).data('kendoBalloonWindow').center().open();
  },

  /**
   * Shows popup for share link edting
   *
   * @return bool
   */
  showShareLink: function() {
    var node = balloon.getCurrentNode();

    if(!node) return;

    var $fs_share_link_win = $('#fs-share-link-window');
    var $fs_share_link = $fs_share_link_win.find('input[name=file_url]');
    var $fs_share_link_settings = $fs_share_link_win.find('input[name=link_settings]');
    var $fs_share_link_delete = $fs_share_link_win.find('#fs-share-link-window-delete');

    var ext = balloon.getFileExtension(node);
    var winTitle = node.name

    if(ext != null && node.directory == false) {
      winTitle = node.name.substr(0, node.name.length-ext.length-1) + ' (' + ext.toUpperCase() + ')';
    }

    var $k_win = $fs_share_link_win.kendoBalloonWindow({
      title: winTitle,
      resizable: false,
      modal: true,
      open: function() {
        $fs_share_link.val(window.location.origin+'/share/'+node.sharelink_token);
        $fs_share_link.unbind('click').bind('click', function() {
          this.select();
          document.execCommand('copy');
          this.selectionEnd = this.selectionStart;
          balloon.showSnackbar({message: 'view.share_link.link_copied'});
        });

        $fs_share_link_settings.off('click').on('click', function() {
          $k_win.close();
          balloon.showShareLinkSettings();
        });

        $fs_share_link_delete.off('click').on('click', function(){
          balloon.removeShareLink().then(function() {
            $k_win.close();
          });
        });
      }
    }).data('kendoBalloonWindow').center().open();
  },

  removeShareLink: function() {
    var node = balloon.getCurrentNode();

    if(!node) return;

    return balloon.xmlHttpRequest({
      url: balloon.base+'/nodes/share-link?id='+balloon.id(node),
      type: 'DELETE',
      success: function(body) {
        delete balloon.last.sharelink_token;
        balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});

        $('#fs-share-link-edit').hide();
        $('#fs-share-link-delete').hide();
        $('#fs-share-link-create').show();
      }
    });
  },

  /**
   * Check if we're running in an iOS devie
   *
   * (This stupid browser can't handle downloads, therefore we try to display it)
   *
   * @return bool
   */
  isiOS: function() {
    if(balloon.DEBUG_SIMULATOR.idevice === true) {
      return true;
    }

    var iDevices = [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ];

    while (iDevices.length) {
      if(navigator.platform === iDevices.pop()) {
        return true;
      }
    }

    return false;
  },


  /**
   * Download node
   *
   * @param   object|array node
   * @return  void
   */
  downloadNode: function(node) {
    var $iframe = $("#fs-fetch-file");
    var id = balloon.id(node);

    if(typeof(id) === 'array') {
      name += '&name=selected.zip';
    }

    var url = balloon.base+'/nodes/content?'+balloon.param('id', id)+''+name;

    if(typeof(login) === 'object' && !login.getAccessToken()) {
      url += '&access_token='+login.getAccessToken();
    }

    if((node.directory == true || !balloon.isMobileViewPort()) && !balloon.isiOS()) {
      url += "&download=true";
      $iframe.attr('src', url).load(url);
    } else {
      window.location.href = url;
    }
  },


  /**
   * Extended search popup
   *
   * @param   object e
   * @return  void
   */
  advancedSearch: function(e) {
    balloon.resetDom(['breadcrumb-search']);
    $('#fs-crumb-home-list').hide();
    $('#fs-browser-action').hide();
    $('#fs-crumb-search-list').show();

    $('#fs-crumb-search').find('li:first-child').html(i18next.t('search.results'));

    var $fs_search = $('#fs-search');
    var $fs_search_input = $fs_search.find('#fs-search-input');
    var $fs_search_filter = $('#fs-search-filter');

    balloon.showAction([]);

    if(!$fs_search_input.is(':focus')) $fs_search_input;
    $fs_search_input.off('keyup').on('keyup', balloon.buildExtendedSearchQuery);

    balloon.xmlHttpRequest({
      url: balloon.base+'/users/node-attribute-summary',
      type: 'GET',
      dataType: 'json',
      data: {
        attributes: ['meta.color', 'meta.tags', 'mime']
      },
      success: function(body) {
        var $color_list = $('#fs-search-filter-color').find('div:first'),
          colors = body['meta.color'],
          children = [];

        for(var i in colors) {
          if(balloon.isValidColor(colors[i]._id)) {
            children.push('<li data-item="'+colors[i]._id+'" class="fs-color-'+colors[i]._id+'"></li>');
          }
        }

        if(children.length >= 1) {
          $color_list.html('<ul>'+children.join('')+'</ul>');
        }

        var $tag_list = $('#fs-search-filter-tags').find('div:first'),
          tags = body['meta.tags'],
          children = [];

        for(var i in tags) {
          children.push('<li data-item="'+tags[i]._id+'" >'+tags[i]._id+' ('+tags[i].sum+')</li>');
        }

        if(children.length >= 1) {
          $tag_list.html('<ul>'+children.join('')+'</ul>');
        }

        var $mime_list = $('#fs-search-filter-mime').find('div:first'),
          mimes = body['mime'],
          children = [];

        for(var i in mimes) {
          var ext = balloon.mapMimeToExtension(mimes[i]._id);

          var spriteClass = ext !== false ? balloon.getSpriteClass(ext) : 'gr-i-file';
          children.push(
            '<li data-item="'+mimes[i]._id+'">'+
              '<svg class="gr-icon  ' + spriteClass + '"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#' + spriteClass.replace('gr-i-', '') + '"></use></svg>'+
              '<div>['+mimes[i]._id+']</div></li>'
          );
        }

        if(children.length >= 1) {
          $mime_list.html('<ul>'+children.join('')+'</ul>');
        }

        $fs_search_filter.find('li').unbind('click').bind('click', function() {
          $(this).toggleClass('fs-search-filter-selected');
        });

        $fs_search_filter.find('input[name=fs-search-filter-apply]').off('click').on('click', function() {
          balloon.buildExtendedSearchQuery();
          $fs_search_filter.hide();
        });

        $fs_search_filter.find('.fs-search-filter-section-reset').unbind('click').bind('click', function() {
          var $this = $(this);
          var filter = $this.parent().attr('id').replace('fs-search-filter-', '');

          balloon.resetSearchFilter(filter);
        });

        $fs_search_filter.find('input[name=fs-search-filter-reset]').off('click').on('click', function() {
          balloon.resetSearchFilter(['tags', 'color', 'mime']);
          balloon.buildExtendedSearchQuery();
          $fs_search_filter.hide();
        });

        balloon.buildExtendedSearchQuery();
      },
    });
  },

  /**
   * Resets given search filter
   *
   * @param string|array filters Filter(s) to reset
   * @return void
   */
  resetSearchFilter: function(filters) {
    if(typeof filters === 'string') {
      filters = [filters];
    }

    filters.forEach(function(filter) {
      $('#fs-search-filter-'+filter+ ' li').removeClass('fs-search-filter-selected');
    });
  },

  /**
   * Build query & search
   *
   * @return void
   */
  buildExtendedSearchQuery: function() {
    var must = [];

    var should1 = [];
    $('#fs-search-filter-mime').find('li.fs-search-filter-selected').each(function(){
      should1.push({
        'query_string': {
          'query': '(mime:"'+$(this).attr('data-item')+'")'
        }
      });
    });

    var should2 = [];
    $('#fs-search-filter-tags').find('li.fs-search-filter-selected').each(function(){
      should2.push({
        term: {
          'meta.tags': $(this).attr('data-item')
        }
      });
    });

    var should3 = [];
    $('#fs-search-filter-color').find('li.fs-search-filter-selected').each(function(){
      should3.push({
        match: {
          'meta.color': $(this).attr('data-item')
        }
      });
    });

    must = [
      {bool: {should: should1}},
      {bool: {should: should2}},
      {bool: {should: should3}},
    ];

    var content = $('#fs-search-input').val();
    var query   = balloon.buildQuery(content, must);
    $('.fs-search-reset-button').show();

    if(should1.length > 0 || should2.length > 0 || should3.length > 0) {
      $('#fs-search').addClass('fs-search-filtered');
    } else {
      $('#fs-search').removeClass('fs-search-filtered');
    }

    if(content.length < 3 && should1.length == 0 && should2.length == 0 && should3.length == 0) {
      query = undefined;
    }

    if(query == undefined) {
      balloon.datasource.data([]);
      return;
    }

    balloon.refreshTree('/files/search', {query: query});
  },


  /**
   * build query
   *
   * @param   string value
   * @param   object filter
   * @return  object
   */
  buildQuery: function(value, filter) {
    var a = value.split(':');
    var attr, type;

    if(a.length > 1) {
      attr  = a[0];
      value = a[1];
    }

    var query = {
      body: {
        from: 0,
        size: 500,
        query: {bool: {}}
      }
    };

    if(attr == undefined && value == "" && filter !== undefined) {
      query.body.query.bool.must = filter;
    } else if(attr == undefined) {
      var should = [
        {
          match: {
            "content.content": {
              query:value,
              minimum_should_match: "90%"
            }
          }
        },
        {
          match: {
            name: {
              query:value,
              minimum_should_match: "90%"
            }
          }
        }
      ];

      if(filter === undefined) {
        query.body.query.bool.should = should;
      } else {
        query.body.query.bool.should = should;
        query.body.query.bool.minimum_should_match = 1;
        query.body.query.bool.must = filter;
      }
    } else{
      query.body.query.bool = {must:{term:{}}};
      query.body.query.bool.must.term[attr] = value;

      if(filter !== undefined) {
        query.body.query.bool.must = filter;
      }
    }

    return query;
  },


  /**
   * Search node
   *
   * @param   string search_query
   * @return  void
   */
  search: function(search_query) {
    var value = search_query, query;
    if(value == '') {
      return balloon.resetSearch();
    }

    balloon.showAction([]);
    if(typeof(search_query) === 'object') {
      query = search_query;
    } else {
      query = balloon.buildQuery(search_query);
    }

    $('#fs-search').show();
    $('#fs-action-search').find('input:text').val(search_query);

    if(query === undefined) {
      return;
    }

    balloon.refreshTree('/files/search', {query: query});
  },


  /**
   * Check if search window is active
   *
   * @return bool
   */
  isSearch: function() {
    return $('#fs-crumb-search-list').is(':visible');
  },


  /**
   * Delete node
   *
   * @param   string|object node
   * @param   bool ignore_flag
   * @return  void
   */
  deletePrompt: function(node, ignore_flag) {
    if(ignore_flag === undefined) {
      ignore_flag = false;
    }

    var delete_msg = i18next.t('prompt.force_delete'),
      todelete   = 0,
      totrash  = 0,
      trash_msg  = i18next.t('prompt.trash_delete');

    trash_msg  += '<ul>';
    delete_msg += '<ul>';

    if(balloon.isMultiSelect()) {
      for(var n in node) {
        if(node[n].deleted !== false || ignore_flag === true) {
          todelete++;
          delete_msg += '<li>'+node[n].name+'</li>';
        } else {
          totrash++;
          trash_msg += '<li>'+node[n].name+'</li>';
        }
      }
    } else if(node.deleted || ignore_flag === true) {
      todelete++;
      delete_msg += '<li>'+node.name+'</li>';
    }

    delete_msg += '</ul>';
    trash_msg  += '</ul>';

    if(todelete > 0 && totrash > 0) {
      balloon.promptConfirm(delete_msg+'</br>'+trash_msg, 'remove', [node, true, ignore_flag]);
    } else if(todelete > 0) {
      balloon.promptConfirm(delete_msg, 'remove', [node, true, ignore_flag]);
    } else {
      balloon.remove(node);
    }
  },


  /**
   * Confirm prompt
   *
   * @param   string msg
   * @param   string action
   * @return  void
   */
  promptConfirm: function(msg, action, params) {
    balloon.resetDom('prompt');
    var $div = $("#fs-prompt-window"),
      $k_prompt = $div.data('kendoBalloonWindow');
    $('#fs-prompt-window-content').html(msg);

    var $k_prompt = $div.kendoBalloonWindow({
      title: $div.attr('title'),
      resizable: false,
      modal: true,
      activate: function() {
        setTimeout(function() {
          $div.find('input[name=cancel]').focus()
        },200);
      }
    }).data("kendoBalloonWindow").center().open();

    $div.unbind('keydown').keydown(function(e) {
      if(e.keyCode === 27) {
        e.stopImmediatePropagation();
        $k_prompt.close();
      }
    });

    $div.find('input[name=cancel]').unbind('click').bind('click', function(e) {
      e.stopImmediatePropagation();
      $k_prompt.close();
    });

    var $parent = this;
    $div.find('input[name=confirm]').unbind('click').click(function(e) {
      e.stopImmediatePropagation();
      if(action.constructor === Array) {
        for(var i in action) {
          if(action[i] !== null) {
            $parent[action[i].action].apply($parent,action[i].params);
          }
        }
      } else if(typeof action === 'string') {
        $parent[action].apply($parent,params);
      } else {
        action.apply($parent,params);
      }
      $k_prompt.close();
    });
  },


  /**
   * Delete node
   *
   * @param   string|object node
   * @param   bool force
   * @param   bool ignore_flag
   * @return  void
   */
  remove: function(node, force, ignore_flag) {
    if(force === undefined) {
      force = false;
    }

    if(ignore_flag === undefined) {
      ignore_flag = false;
    }

    node = balloon.id(node);

    balloon.xmlHttpRequest({
      url: balloon.base+'/nodes?ignore_flag='+ignore_flag+'&force='+force+'&'+balloon.param('id', node),
      type: 'DELETE',
      dataType: 'json',
      beforeSend: function() {
        balloon.resetDom(['selected', 'properties', 'preview', 'action-bar', 'multiselect',
          'view-bar', 'history', 'share', 'share-link', 'search', 'events']);

        var $tree = $('#fs-browser-tree').find('ul');

        if(node instanceof Array) {
          for(var n in node) {
            $tree.find('.k-item[fs-id='+node[n].id+']').hide(1000);
          }
        } else {
          $tree.find('.k-item[fs-id='+balloon.id(node)+']').hide(1000);
        }
      },
      complete: function() {
        balloon.resetDom('multiselect');
      },
      success: function(data) {
        var count = 1;
        if(node instanceof Array) {
          count = node.length;
        }
        balloon.displayQuota();

        if(balloon.getCurrentCollectionId() === null) {
          balloon.menuLeftAction(balloon.getCurrentMenu());
        } else {
          balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
        }
      },
    });
  },


  /**
   * Prompt: Undelete
   *
   * @param   string|object node
   * @return  void
   */
  undeletePrompt: function(node) {
    var restore_msg   = i18next.t('prompt.restore'),
      torestore   = 0,
      untouched   = 0,
      clean     = [],
      untouched_msg = i18next.t('prompt.untouched');

    untouched_msg += '<ul>';
    restore_msg   += '<ul>';

    if(balloon.isMultiSelect()) {
      for(var n in node) {
        if(node[n].deleted !== false) {
          clean.push(node[n]);
          torestore++;
          restore_msg += '<li>'+node[n].name+'</li>';
        } else {
          untouched++;
          untouched_msg += '<li>'+node[n].name+'</li>';
        }
      }
    } else if(node.deleted) {
      torestore++;
      clean = node;
      restore_msg += '<li>'+node.name+'</li>';
    }

    restore_msg   += '</ul>';
    untouched_msg += '</ul>';

    if(torestore == 0) {
      return;
    } else if(torestore > 0 && untouched > 0) {
      balloon.promptConfirm(restore_msg+'</br>'+untouched_msg, 'undelete', [clean]);
    } else {
      balloon.undelete(node);
    }
  },


  /**
   * Undelete node
   *
   * @param   string|object node
   * @return  void
   */
  undelete: function(node, move, parent, conflict) {
    node = balloon.id(node);

    balloon.xmlHttpRequest({
      url: balloon.base+'/nodes/undelete?'+balloon.param('id', node),
      type: 'POST',
      data: {
        move: move,
        destid: parent,
        conflict: conflict
      },
      dataType: 'json',
      complete: function() {
        balloon.resetDom('multiselect');
      },
      success: function(data) {
        balloon.displayQuota();

        if(balloon.getCurrentCollectionId() === null) {
          balloon.menuLeftAction(balloon.getCurrentMenu());
        } else {
          balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
        }
      },
      error: function(response) {
        var data = balloon.parseError(response);

        if(data === false || response.status != 422 && response.status != 404) {
          balloon.displayError(response);
        } else {
          switch(data.code) {
          case 0:
          case 21:
            setTimeout(function(){
              balloon.promptConfirm(i18next.t('prompt.restore_to_root'), 'undelete', [node, true, null]);
            }, 500);
            break;

          case 19:
            setTimeout(function(){
              balloon.promptConfirm(i18next.t('prompt.merge'), 'undelete', [node, move, null, 2]);
            }, 500);
            break;

          default:
            balloon.displayError(response);
          }
        }
      }
    });
  },


  /**
   * clone node
   *
   * @param   string|object|array source
   * @param   string|object|array destination
   * @param   int conflict
   * @return  void
   */
  clone: function(source, destination, conflict) {
    return balloon.move(source, destination, conflict, true);
  },


  /**
   * move node
   *
   * @param   string|object|array source
   * @param   string|object|array destination
   * @param   int conflict
   * @param   bool clone
   * @return  void
   */
  move: function(source, destination, conflict, clone) {
    if(clone === true) {
      var action = 'clone'
    } else {
      var action = 'move';
    }

    balloon.xmlHttpRequest({
      url: balloon.base+'/nodes/'+action,
      type: 'POST',
      dataType: 'json',
      data: {
        id: balloon.id(source),
        destid: balloon.id(destination),
        conflict: conflict
      },
      complete: function() {
        balloon.resetDom('multiselect');
        balloon.deselectAll();
      },
      success: function(data) {
        var count = 1;
        if(source instanceof Array) {
          count = source.length;
        }

        balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
      },
      error: function(data) {
        if(data.status === 400 && data.responseJSON && data.responseJSON.code === 19 && conflict !== 2) {
          var body = data.responseJSON;
          if(typeof(balloon.id(source)) == 'string') {
            var nodes = [source];
          } else {
            var nodes = body;
          }

          var id   = [];
          var list = i18next.t('prompt.merge');
          list += '<ul>';

          for(var i in nodes) {
            id.push(nodes[i].id);
            list += '<li>'+nodes[i].name+'</li>';
          }

          list   += '</ul>';

          if(typeof(balloon.id(source)) === 'string') {
            id = balloon.id(source);
          }

          balloon.promptConfirm(list, 'move', [id, destination, 2, clone]);
        } else {
          balloon.displayError(data);
        }
      }
    });
  },


  /**
   * Map mime to file extension
   *
   * @param   string mime
   * @return  string|bool
   */
  mapMimeToExtension: function(mime) {
    var map = {
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

    if(mime in map) {
      return map[mime];
    } else {
      return false;
    }
  },


  /**
   * Extension => Sprite classname mapper
   *
   * @param  object|string node
   * @return string
   */
  getSpriteClass: function(node) {
    if(typeof(node) === 'object') {
      if(node.directory) {
        if(node.filtered === true) {
          if(node.shared === true && node.reference === true) {
            return 'gr-i-folder-filter-received';
          }          else if(node.shared === true) {
            return 'gr-i-folder-filter-shared';
          }          else {
            return 'gr-i-folder-filter';
          }
        } else if(node.shared === true && node.reference === true) {
          return 'gr-i-folder-received';
        } else if(node.shared === true) {
          return 'gr-i-folder-shared';
        } else if(node.spriteCssClass) {
          return node.spriteCssClass;
        } else {
          return 'gr-i-folder';
        }
      }
      var extension = balloon.getFileExtension(node);
    }    else {
      var extension = node;
    }

    var map = {
      pdf:  'gr-i-file-pdf',
      dll:  'gr-i-file-archive',
      rpm:  'gr-i-file-archive',
      deb:  'gr-i-file-archive',
      bundle: 'gr-i-file-archive',
      jar:  'gr-i-file-archive',
      dmg:  'gr-i-file-archive',
      txt:  'gr-i-file-text',
      log:  'gr-i-file-text',
      css:  'gr-i-file-text',
      xml:  'gr-i-file-text',
      eml:  'gr-i-mail',
      gpg:  'gr-i-lock',
      pem:  'gr-i-lock',
      p12:  'gr-i-lock',
      cert: 'gr-i-lock',
      rar:  'gr-i-file-archive',
      zip:  'gr-i-file-archive',
      xz:   'gr-i-file-archive',
      gz:   'gr-i-file-archive',
      tgz:  'gr-i-file-archive',
      tar:  'gr-i-file-archive',
      bz2:  'gr-i-file-archive',
      swf:  'gr-i-file-movie',
      flv:  'gr-i-file-movie',
      jpeg:   'gr-i-file-image',
      tiff:   'gr-i-file-image',
      svg:  'gr-i-file-image',
      ico:  'gr-i-file-image',
      gif:  'gr-i-file-image',
      psd:  'gr-i-file-image',
      png:  'gr-i-file-image',
      jpg:  'gr-i-file-image',
      xls:  'gr-i-file-excel',
      xlsx:   'gr-i-file-excel',
      csv:  'gr-i-file-excel',
      ods:  'gr-i-file-excel',
      doc:  'gr-i-file-word',
      docx:   'gr-i-file-word',
      odt:  'gr-i-file-word',
      iso:  'gr-i-file-archive',
      ppt:  'gr-i-file-powerpoint',
      pptx:   'gr-i-file-powerpoint',
      odp:  'gr-i-file-powerpoint',
      sql:  'gr-i-file-text',
      html:   'gr-i-file-text',
      rss:  'gr-i-rss-feed',
      avi:  'gr-i-file-movie',
      mkv:  'gr-i-file-movie',
      mp4:  'gr-i-file-movie',
      mpeg:   'gr-i-file-movie',
      mov:  'gr-i-file-movie',
      mp3:  'gr-i-file-music',
      wav:  'gr-i-file-music',
      flac:  'gr-i-file-music',
      ogg:  'gr-i-file-music',
      acc:  'gr-i-file-music'
    };

    if(extension in map) {
      return map[extension];
    }    else {
      return 'gr-i-file-text';
    }
  },


  /**
   * Modify file
   *
   * @param   object node
   * @return  void
   */
  editFile: function(node) {
    if(node.size > balloon.EDIT_TEXT_SIZE_LIMIT) {
      var msg  = i18next.t('prompt.open_big_file', node.name);
      balloon.promptConfirm(msg, '_editFile', [node]);
    } else {
      balloon._editFile(node);
    }
  },


  /**
   * Modify file
   *
   * @param   object node
   * @return  void
   */
  _editFile: function(node) {
    balloon.resetDom('edit');
    var $div = $('#fs-edit-live'),
      $textarea = $div.find('textarea');

    var ext = balloon.getFileExtension(node);
    var winTitle = node.name

    if(ext != null && node.directory == false) {
      winTitle = node.name.substr(0, node.name.length-ext.length-1) + ' (' + ext.toUpperCase() + ')';
    }

    balloon.xmlHttpRequest({
      url: balloon.base+'/files/content',
      type: 'GET',
      data: {
        id: balloon.id(node),
      },
      dataType: 'text',
      success: function (data) {
        $textarea.val(data);

        var $k_display = $div.kendoBalloonWindow({
          title: winTitle,
          width: '70%',
          height: '70%',
          resizable: false,
          modal: true,
          keydown: function(e) {
            if(e.originalEvent.keyCode !== 27) {
              return;
            }

            if(data == $textarea.val()) {
              $k_display.close();
              return;
            }

            e.stopImmediatePropagation();
            var msg  = i18next.t('prompt.close_save_file', node.name);
            balloon.promptConfirm(msg, function(){
              balloon.saveFile(node, $textarea.val());
              $k_display.close();
            });

            $("#fs-prompt-window").find('input[name=cancel]').unbind('click').bind('click', function(){
              $("#fs-prompt-window").data('kendoBalloonWindow').close();
              $k_display.close();
            });
          },
          open: function(e) {
            setTimeout(function(){
              e.sender.wrapper.find('textarea').focus();
            }, 600);

            e.sender.wrapper.find('textarea').unbind('change').bind('change',function(){
              data = $textarea.val();
            });

            $(this.wrapper).find('.gr-i-close').unbind('click.fix').bind('click.fix', function(e){
              e.stopImmediatePropagation();

              if(data == $textarea.val()) {
                $k_display.close();
                return;
              }
              var msg  = i18next.t('prompt.close_save_file', node.name);
              balloon.promptConfirm(msg, function(){
                balloon.saveFile(node, $textarea.val());
                $k_display.close();
              });

              $("#fs-prompt-window").find('input[name=cancel]').unbind('click').bind('click', function(){
                $("#fs-prompt-window").data('kendoBalloonWindow').close();
                $k_display.close();
              });
            });
          }
        }).data("kendoBalloonWindow").center().open();
      }
    });

    $div.find('input[type=submit]').off('click').on('click', function(e) {
      balloon.saveFile(node, $textarea.val());
    });
  },


  /**
   * Change file content
   *
   * @param  object node
   * @param  string content
   * @return void
   */
  saveFile: function(node, content) {
    balloon.xmlHttpRequest({
      url: balloon.base+'/files?id='+balloon.id(node),
      type: 'PUT',
      data: content,
      success: function(data) {
        balloon.resetDom('edit');
      }
    });
  },


  /**
   * Display file
   *
   * @param   object node
   * @return  void
   */
  displayFile: function(node) {
    var $div = $('#fs-display-live');
    $('#fs-display-left').hide();
    $('#fs-display-right').hide();

    var options = {
      draggable: false,
      resizable: false,
      modal: false,
      open: function(e) {
        $('#fs-display-live_wnd_title').html(
          $('#fs-browser-tree').find('li[fs-id="'+node.id+'"]').find('.k-in').find('> span').clone()
        );

        $(this.wrapper).addClass('fs-transparent-window');
        $div.addClass('fs-transparent-window');
        $('body').append('<div class="fs-display-overlay"></div>');
      },
      close: function() {
        $('.fs-display-overlay').remove();
        $('#fs-display-content > *').remove();
      }
    };

    if($div.is(':visible')) {
      options.close();
      options.open();
    } else {
      var $k_display = $div.kendoBalloonWindow(options).data("kendoBalloonWindow").open().maximize();
    }

    var url = balloon.base+'/files/content?id='+node.id+'&hash='+node.hash;
    if(typeof(login) === 'object' && !login.getAccessToken()) {
      url += '&access_token='+login.getAccessToken();
    }
    var $div_content = $('#fs-display-content').html('').hide(),
      $element,
      type = node.mime.substr(0, node.mime.indexOf('/'));
    $div_content.css({width: 'inherit', height: 'inherit'});

    if(type == 'image') {
      $element = $('<img src="'+url+'"/>');
    } else if(type == 'video') {
      $element = $('<video autoplay controls><source src="'+url+'" type="'+node.mime+'"></video>');
    } else if(type == 'audio' || node.mime == 'application/ogg') {
      $element = $('<audio autoplay controls><source src="'+url+'" type="'+node.mime+'">Not supported</audio>');
    } else if(node.mime == 'application/pdf') {
      $div_content.css({width: '90%', height: '90%'})
      $element = $('<embed src="'+url+'" pluginspage="http://www.adobe.com/products/acrobat/readstep2.html">');
    }
    $div_content.show().html($element);

    var index = balloon.datasource._pristineData.indexOf(node);
    var data = balloon.datasource._pristineData;

    for(var i=++index; i<=data.length; i++) {
      if(i in data && data[i].mime && balloon.isViewable(data[i].mime)) {
        $('#fs-display-right').show().unbind('click').bind('click', function(){
          balloon.displayFile(data[i]);
        });
        break;
      }
    }

    index = data.indexOf(node) ;

    for(var i2=--index; i2!=-1; i2--) {
      if(i2 in data && data[i2].mime && balloon.isViewable(data[i2].mime)) {
        $('#fs-display-left').show().unbind('click').bind('click', function(){
          balloon.displayFile(data[i2]);
        });
        break;
      }
    }

  },


  /**
   * Display user quota
   *
   * @return void
   */
  displayQuota: function() {
    var $fs_quota_usage = $('#fs-quota-usage'),
      $k_progress = $fs_quota_usage.data('kendoProgressBar');

    if($k_progress == undefined) {
      $k_progress = $fs_quota_usage.kendoProgressBar({
        type: "percent",
        value: 1,
        animation: {
          duration: 1500
        }
      }).data("kendoProgressBar");
    }

    balloon.xmlHttpRequest({
      url: balloon.base+'/users/whoami',
      data: {
        attributes: ['quota']
      },
      type: 'GET',
      dataType: 'json',
      success: function(data) {
        data = data.quota;
        var used = balloon.getReadableFileSizeString(data.used),
          max  = balloon.getReadableFileSizeString(data.hard_quota),
          free = balloon.getReadableFileSizeString(data.hard_quota - data.used);

        if(data.hard_quota === -1) {
          $('#fs-quota-usage').hide();
          $('#fs-quota-percent').hide();
          $('#fs-quota-total').html(i18next.t('user.quota_unlimited', used));
        } else {
          var percentage = Math.round(data.used/data.hard_quota*100);
          $k_progress.value(percentage);

          if(percentage >= 90) {
            $fs_quota_usage.find('.k-state-selected').addClass('fs-quota-high');
          } else {
            $fs_quota_usage.find('.k-state-selected').removeClass('fs-quota-high');
          }

          balloon.quota = data;

          $('#fs-quota-percent').html(percentage+'%');
          $('#fs-quota-total').html(i18next.t('user.quota_left', free));
          $('#fs-quota').attr('title', i18next.t('user.quota_detail', used, max,
            percentage, free));
        }
      },
    });
  },


  /**
   * Convert bytes to human readable size
   *
   * @param   int bytes
   * @return  string
   */
  getReadableFileSizeString: function(bytes) {
    if(bytes === null) {
      return '0B';
    }

    if(bytes < 1024) {
      return bytes+' B';
    }

    var i = -1;
    var units = ['kB', 'MB', 'GB', ' TB', 'PB', 'EB', 'ZB', 'YB'];
    do {
      bytes = bytes / 1024;
      i++;
    } while (bytes >= 1024);

    return Math.max(bytes, 0.1).toFixed(1) + ' ' + units[i];
  },


  /**
   * Get time since
   *
   * @param   Date date
   * @return  string
   */
  timeSince: function(date) {
    var seconds = Math.floor((new Date() - date) / 1000);

    if(seconds < -1) {
      seconds *= -1;
    }

    var interval = Math.floor(seconds / 31536000);

    if (interval >= 1) {
      return i18next.t('time.year', {count: interval});
    }
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
      return i18next.t('time.month', {count: interval});
    }
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
      return i18next.t('time.day', {count: interval});
    }
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
      return i18next.t('time.hour', {count: interval});
    }
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
      return i18next.t('time.minute', {count: interval});
    }

    seconds = Math.round(seconds);
    if(seconds < 0) {
      seconds = 0;
    }

    return i18next.t('time.second', {count: seconds});
  },


  /**
   * Check if can edit a file via browser
   *
   * @param   string mime
   * @return  bool
   */
  isEditable: function(mime) {
    if(balloon.isMobileViewPort()) {
      return false;
    }

    var type = mime.substr(0, mime.indexOf('/'));
    if(type == 'text') {
      return true;
    }

    var valid = [
      'application/xml',
      'application/json',
      'inode/x-empty'
    ];

    return valid.indexOf(mime) > -1;
  },


  /**
   * Check if we can display the file live
   *
   * @param   string
   * @return  bool
   */
  isViewable: function(mime) {
    if(balloon.isMobileViewPort()) {
      return false;
    }

    var type = mime.substr(0, mime.indexOf('/'));

    if(type == 'image' || type == 'video' || type == 'audio') {
      return true;
    }

    var valid = [
      'application/ogg',
      'application/pdf',
    ];

    return valid.indexOf(mime) > -1;
  },


  /**
   * Get node file extension
   *
   * @param   object node
   * @return  void|string
   */
  getFileExtension: function(node) {
    if(typeof(node) == 'object' && node.directory == true) {
      return null;
    }
    var ext;
    if(typeof(node) == 'string') {
      ext = node.split('.');
    }    else {
      ext = node.name.split('.');
    }

    if(ext.length == 1) {
      return null;
    }    else {
      return ext.pop();
    }
  },


  /**
   * Display file history
   *
   * @param   object node
   * @return  void
   */
  displayHistory: function(node) {
    balloon.resetDom('history');

    var $view = $("#fs-history"),
      $fs_history = $view.find("> ul");

    balloon.xmlHttpRequest({
      dataType: "json",
      url: balloon.base+'/files/history',
      type: "GET",
      data: {
        id: balloon.id(node)
      },
      success: function(data) {
        var action, dom_node, ts, since, radio;
        data.data.reverse();

        for(var i in data.data) {
          switch(data.data[i].type) {
          case 0:
            action = '<span class="fs-history-text-action">'+ i18next.t('view.history.added')+'</span>';
            break;

          case 1:
            action = '<span class="fs-history-text-action">'+ i18next.t('view.history.modified')+'</span>';
            break;

          case 2:
            if(data.data[i].origin != undefined) {
              action = '<span class="fs-history-text-action">'+i18next.t('view.history.restored_from', data.data[i].origin)+'</span>';
            } else {
              action = '<span class="fs-history-text-action">'+ i18next.t('view.history.restored')+'</span>';
            }
            break;

          case 3:
            action = '<span class="fs-history-text-action">'+ i18next.t('view.history.deleted')+'</span>';
            break;

          case 4:
            action = '<span class="fs-history-text-action">'+ i18next.t('view.history.undeleted')+'</span>';
            break;
          }

          since = balloon.timeSince(new Date((data.data[i].changed))),
          ts = kendo.toString(new Date((data.data[i].changed)), kendo.culture().calendar.patterns.g)

          if(i != 0) {
            radio = '<div class="fs-history-select"><input type="radio" name="version" value="'+data.data[i].version+'"/></div>';
          } else {
            radio = '<div class="fs-history-select"><input type="radio" name="version" value="'+data.data[i].version+'"/></div>';
          }

          if(data.data[i].user) {
            var username = data.data[i].user.name;
          } else {
            var username = i18next.t('view.history.user_deleted');
          }

          dom_node = '<li' + (i == 0 ? ' class="selected"' : '') + '>'
              + '<div class="fs-history-select"><input type="radio" name="version" value="'+data.data[i].version+'"' + (i == 0 ? ' checked' : '') + '/></div>'
              + '<div class="fs-history-text">'
                + '<h6><span class="fs-history-text-version">'+i18next.t('view.history.version', data.data[i].version)+'</span>'+action+'</h6>'
                + '<p class="fs-history-label">'+i18next.t('view.history.changed_by', username, since, ts)+'</p>'
            + '</div>';
          + '</li>';

          $fs_history.append(dom_node);
        }

        var $submit = $view.find('input[type=submit]');
        if(data.data.length > 1) {
          $submit.show();
        }

        $fs_history.find('input').off('focus').on('focus', function(event) {
          $fs_history.find('li').removeClass('selected');
          $(this).parents().filter('li').addClass('selected');
        });

        $submit.off('click').on('click', function(){
          var version = $fs_history.find('input[name=version]:checked').val();
          if(version !== undefined) {
            balloon.restoreVersion(node, version);
          }
        });
      }
    });
  },


  /**
   * Restore file to a previous version
   *
   * @param   string|object node
   * @param   int version
   * @return  void
   */
  restoreVersion: function(node, version) {
    balloon.xmlHttpRequest({
      url: balloon.base+'/files/restore?id='+balloon.id(node),
      type: 'POST',
      dataType: 'json',
      data: {
        version: version
      },
      success: function(data) {
        balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
        balloon.displayHistory(node);
      }
    });
  },


  /**
   * Save editable meta attributes
   *
   * @return void
   */
  _saveMetaAttributes: function() {
    var $that = $(this),
      value = $that.val(),
      name  = $that.attr('id').substr(14),
      attrs = {};

    attrs[name] = value;

    if(balloon.getCurrentNode().meta[name] != value) {
      balloon.saveMetaAttributes(balloon.getCurrentNode(), attrs);
    }
  },


  /**
   * Display properties of one node
   *
   * @param   object node
   * @return  void
   */
  displayProperties: function(node) {
    var $fs_prop_collection = $("#fs-properties-collection").hide(),
      $fs_prop_file     = $("#fs-properties-file").hide();

    $('#fs-properties').off('focusout').on('focusout', 'textarea,input,select', balloon._saveMetaAttributes);

    if(node.directory == true) {
      $fs_prop_collection.show();
    } else {
      $fs_prop_file.show();
    }

    $("#fs-properties-node").show();
    var $field;

    //TODO pixtron - rename prop to attribute
    for(var prop in node) {
      $field = $('#fs-properties-'+prop).find('.fs-value');
      $('#fs-properties-'+prop).parent().show();

      switch(prop) {
      case 'changed':
      case 'deleted':
      case 'created':
        if(node[prop] !== null) {
          var date   = new Date(node[prop]),
            format = kendo.toString(date, kendo.culture().calendar.patterns.g),
            since  = balloon.timeSince(date);

          $field.html(i18next.t('view.history.changed_since', since, format));
        }
        break;

      case 'size':
        if(node.directory === true) {
          $field.html(i18next.t('view.prop.data.childcount', {count: node[prop]}));
        } else {
          $field.html(i18next.t('view.prop.data.size', balloon.getReadableFileSizeString(node[prop]), node[prop]));
        }
        break;

      case 'name':
        var $fs_prop_name = $("#fs-properties-name");

        var ext = balloon.getFileExtension(node),
          name = node[prop];

        if(ext != null && node.directory == false) {
          $fs_prop_name.find(".fs-ext").html('('+ext+')');
          $field.html(name.substr(0, name.length-ext.length-1));
        } else {
          $fs_prop_name.find(".fs-ext").html('');
          $field.html(name);
        }
        break;

      case 'meta':
        for(var meta_attr in node.meta) {
          $field = $('#fs-properties-'+meta_attr).find('.fs-value');
          switch(meta_attr) {
          case 'description':
            $field = $('#fs-properties-'+meta_attr).find('textarea');
            $field.val(node.meta[meta_attr]);
            break;

          default:
            $field = $('#fs-properties-'+meta_attr);
            $field.val(node.meta[meta_attr]);
            break;
          }
        }
        break;
      case 'share':
      case 'shared':
        //TODO pixtron - implement this or revert this change from merging master
        if('shareowner' in node) {
          $field = $('#fs-properties-share').find('.fs-value');
          $('#fs-properties-share').parent().show();
          var access = i18next.t('view.share.privilege_'+node.access);

          if(node.shared === true) {
            var msg = i18next.t('view.prop.head.share_value', node.sharename, node.shareowner.name, access);
          } else if(node.share) {
            var msg = i18next.t('view.prop.head.share_value', node.share.name, node.shareowner.name, access);
          } else {
            continue;
          }

          $field.html(msg)
            .parent().parent().css('display','table-row');

          var sclass = '';
          if(node.shareowner.name == login.username) {
            sclass = 'gr-icon gr-i-folder-shared';
          } else {
            sclass = 'gr-icon gr-i-folder-received';
          }

          $field.parent().find('div:first-child').attr('class', sclass);
        }
        break;

      default:
        if($field.length != 0 && prop !== 'access' && prop != 'shareowner') {
          $field.html(node[prop]);
        }
        break;
      }
    }
  },

  /**
   * Check if valid color tag is given
   *
   * @return string
   */
  isValidColor: function(color) {
    var map = [
      'magenta',
      'purple',
      'blue',
      'green',
      'yellow',
    ];

    return map.indexOf(color) !== -1
  },

  /**
   * Auto complete tags
   *
   * @return void
   */
  initMetaTagCompletion: function() {
    var $meta_tags = $('#fs-properties-meta-tags-tags'),
      $meta_tags_parent = $meta_tags.parent(),
      $input = $meta_tags_parent.find('input');

    $input.kendoAutoComplete({
      minLength: 0,
      dataTextField: "_id",
      dataSource: new kendo.data.DataSource({
        transport: {
          read: function(operation) {
            balloon.xmlHttpRequest({
              url: balloon.base+'/users/node-attribute-summary',
              data: {
                attributes: ['meta.tags']
              },
              success: function(data) {
                data['meta.tags'].sort();
                operation.success(data['meta.tags']);
              }
            });
          }
        },
      }),
      sort: {
        dir: 'asc',
        field: '_id'
      },
      change: function(e) {
        this.dataSource.read();
      },
    });

    $input.unbind('focus').bind('focus', function() {
      $meta_tags.addClass('fs-select-tags');
      $input.data('kendoAutoComplete').search();
    });

    $input.unbind('blur').bind('blur', function() {
      $meta_tags.removeClass('fs-select-tags');
    });
  },


  /**
   * Display preview
   *
   * @param   object node
   * @return  void
   */
  displayPreview: function(node) {
    balloon.resetDom('preview');

    if(node.meta.color) {
      var $fs_prop_color = $('#fs-properties-meta-color');
      $fs_prop_color.find('.fs-color-'+node.meta.color).addClass('fs-color-selected');
    }

    var $fs_prop_tags = $('#fs-properties-meta-tags-tags').show();
    if(node.meta.tags) {
      var $fs_prop_tags_list = $fs_prop_tags.find('ul');

      $fs_prop_tags_list.empty();

      for(var tag in node.meta.tags) {
        $fs_prop_tags_list.append('<li><div class="tag-name">'+node.meta.tags[tag]+'</div><div class="fs-delete"><svg viewBox="0 0 24 24" class="gr-icon gr-i-close"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#close"></use></svg></div></li>');
      }
    }

    var $fs_prop_color = $("#fs-properties-meta-color");
    $fs_prop_color.find("li").unbind('click').click(function(e){
      var color = $(this).attr('class').substr(9);
      var current = $(this).hasClass('fs-color-selected');
      $fs_prop_color.find('.fs-color-selected').removeClass('fs-color-selected');

      var $fs_color_tag = $('#fs-browser-tree').find('li[fs-id='+balloon.getCurrentNode().id+']').find('.fs-color-tag');

      if(current) {
        var color = null;
        $fs_color_tag.removeClass(function(index, className) {
          return (className.match(/(^|\s)fs-color-tag-\S+/g) || []).join(' ');
        });
      } else {
        $(this).addClass('fs-color-selected');
        $fs_color_tag.removeClass(function(index, className) {
          return (className.match(/(^|\s)fs-color-tag-\S+/g) || []).join(' ');
        });
        $fs_color_tag.addClass('fs-color-tag-'+color);
      }

      balloon.saveMetaAttributes(balloon.getCurrentNode(), {color: color});
    });

    balloon.handleTags(node);

    var $fs_preview_outer = $("#fs-preview-thumb"),
      $fs_preview     = $fs_preview_outer.find("div");

    if(node.directory == true) {
      return;
    } else {
      $fs_preview_outer.show();
    }

    balloon.xmlHttpRequest({
      url: balloon.base+'/files/preview?encode=base64&id='+balloon.id(node),
      type: 'GET',
      timeout: 5000,
      beforeSend: function() {
        $fs_preview_outer.show();
        // TODO pixtron - what is this class used for?
        $fs_preview.addClass('fs-loader');
      },
      complete: function() {
        // TODO pixtron - what is this class used for?
        $fs_preview.removeClass('fs-loader');

        $fs_preview.find('*').unbind('click').bind('click', function() {
          if(balloon.isViewable(node.mime)) {
            balloon.displayFile(node);
          } else {
            balloon.downloadNode(node);
          }
        });
      },
      success: function(data) {
        if(data == '') {
          this.error();
        } else {
          var img = document.createElement('img');
          img.src = 'data:image/jpeg;base64,' + data;
          $fs_preview.html(img);
        }
      },
      error: function() {
        $fs_preview.html('<div class="fs-preview-placeholder">'+i18next.t('view.preview.failed')+'</div>');
      }
    });
  },


  /**
   * Manage meta tags
   *
   * @param   object node
   * @return  void
   */
  handleTags: function(node) {
    var last_tag,
      $fs_prop_tags = $('#fs-properties-meta-tags-tags'),
      $fs_prop_tags_parent = $fs_prop_tags.parent();

    $fs_prop_tags_parent.find('.fs-add').unbind('click').bind('click', function(){
      balloon.initMetaTagCompletion();
      $('#fs-preview-add-tag').show();
      $fs_prop_tags_parent
        .find('input:text')
        .focus()
        .data('kendoAutoComplete').search();
    });

    $fs_prop_tags.unbind('click').on('click', 'li', function(e) {
      if($(e.target).attr('class') == 'fs-delete' || ($(e.target).parents().filter('.fs-delete').length > 0)) {
        $(this).remove();

        var tags = $fs_prop_tags.find('li').map(function() {
          return $(this).find('.tag-name').text();
        }).get();

        if(tags.length === 0) {
          tags = '';
        }

        balloon.saveMetaAttributes(node, {tags: tags});
        return;
      }

      //TODO pixtron - search: fix advanced search
      balloon.advancedSearch();
      var value = 'meta.tags:'+$(this).find('.tag-name').text();
      balloon.search(value);
    });

    $fs_prop_tags_parent.find('input[name=add_tag]').unbind('keypress').keypress(function(e) {
      balloon.resetDom('upload');

      $(document).unbind('click').click(function(e) {
        return balloon._metaTagHandler(node, e, last_tag);
      });

      last_tag = $(this);
      return balloon._metaTagHandler(node, e, last_tag);
    }).unbind('focusout').bind('focusout', function() {
      $('#fs-preview-add-tag').hide();
    });
  },


  /**
   * Manage meta tags
   *
   * @param   object node
   * @return  void
   */
  _metaTagHandler: function(node, e, $last_tag) {
    var code  = (!e.charCode ? e.which : e.charCode),
      strcode = String.fromCharCode(!e.charCode ? e.which : e.charCode);

    if(e.type == 'click' || code == 13 || code == 32 || code == 0) {
      var value = $last_tag.val();

      if(value == '') {
        return;
      }

      if(node.meta.tags !== undefined && node.meta.tags.indexOf(value) != -1) {
        return false;
      }

      var $fs_prop_tags = $('#fs-properties-meta-tags-tags');
      if($last_tag.attr('name') == 'add_tag') {
        $fs_prop_tags.find('ul').append('<li><div class="tag-name">'+value+'</div><div class="fs-delete"><svg viewBox="0 0 24 24" class="gr-icon gr-i-close"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#close"></use></svg></div></li>');
        $last_tag.val('').focus();
      } else {
        var $parent = $last_tag.parent();
        $last_tag.remove();
        $parent.html('<div class="tag-name">'+value+'</div><div class="fs-delete"><svg viewBox="0 0 24 24" class="gr-icon gr-i-close"><use xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#close"></use></svg></div>');
      }

      var tags = $fs_prop_tags.find('li').map(function () {
        return $(this).find('.tag-name').text();
      }).get();

      $(document).unbind('click');
      $last_tag = undefined;

      balloon.saveMetaAttributes(node, {tags: tags});

      e.preventDefault();
    }

    return true;
  },


  /**
   * Save meta attributes
   *
   * @param   object node
   * @param   object meta
   * @return  void
   */
  saveMetaAttributes: function(node, meta) {
    balloon.xmlHttpRequest({
      url: balloon.base+'/nodes?id='+balloon.id(node),
      type: 'PATCH',
      data: {meta: meta},
      success: function() {
        for(var attr in meta) {
          if(meta[attr] == '') {
            delete node.meta[attr];
          } else {
            node.meta[attr] = meta[attr];
          }
        }

      },
    });
  },


  /**
   * Show view
   *
   * @param   string|array elements
   * @return  void
   */
  showView: function(elements) {
    balloon.resetDom('view-bar');

    if(elements == undefined) {
      return;
    } else if(typeof(elements) == 'string') {
      return balloon.showView([
        elements,
      ]);
    }

    for(var element in elements) {
      var $title = $('#fs-content-view-title-'+elements[element]).removeClass('disabled');
      $title.next().removeClass('disabled');
    }
  },


  /**
   * Show action
   *
   * @param   string|array elements
   * @param   bool reset
   * @return  void
   */
  showAction: function(elements, reset) {
    if(reset === true || reset === undefined) {
      balloon.resetDom('action-bar');
    }

    if(elements == undefined) {
      return;
    } else if(typeof(elements) == 'string') {
      return balloon.showAction([
        elements
      ], reset);
    }

    for(var element in elements) {
      $('#fs-action-'+elements[element]).removeClass('fs-action-disabled');
    }
  },


  /**
   * Toggle pannel
   *
   * @param  string pannel
   * @param boolean expand (optional) See https://docs.telerik.com/kendo-ui/api/javascript/ui/splitter/methods/toggle
   * @return void
   */
  togglePannel: function(pannel, expand) {
    var $k_splitter = $('#fs-browser-layout').data('kendoSplitter');

    $k_splitter.toggle('#fs-'+pannel, expand);
  },


  /**
   * Do a node action
   *
   * @param  string name
   * @return void
   */
  doAction: function(name) {
    if(typeof(name) !== 'string') {
      var $that = $(this);
      name = $that.attr('id').substr(10);

      if($that.hasClass('fs-action-disabled')) {
        return;
      }
    }

    switch(name) {
    //TODO pixtron - remove the left menu is not a kendo splitter pannel anymore
    /*case 'menu':
      balloon.togglePannel('menu-left');
      break;*/
    case 'upload':
      var $files = $('#fs-files');
      $files.unbind('change').change(function(e) {
        balloon._handleFileSelect(e, balloon.getCurrentCollectionId());
      });
      $files.click();
      break;
    case 'add':
      balloon.addNode.call(this);
      break;
    case 'delete':
      balloon.deletePrompt(balloon.getSelected(balloon.getCurrentNode()));
      break;
    case 'restore':
      balloon.undeletePrompt(balloon.getSelected(balloon.getCurrentNode()));
      break;
    case 'download':
      balloon.downloadNode(balloon.getSelected(balloon.getCurrentNode()));
      break;
    case 'refresh':
      balloon.displayQuota();
      if(balloon.getCurrentCollectionId() === null) {
        balloon.menuLeftAction(balloon.getCurrentMenu());
      } else {
        balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
      }
      break;

    case 'cut':
    case 'copy':
      balloon.selected_action.command  = name;
      balloon.selected_action.nodes    = balloon.getSelected(balloon.getCurrentNode());
      balloon.selected_action.collection = balloon.getCurrentCollectionId();
      balloon.showAction('paste', false);
      break;

    case 'paste':
      var parent;
      if(balloon.getCurrentNode() !== null) {
        parent = balloon.getCurrentCollectionId()
      } else if(!balloon.isMultiSelect()) {
        parent = balloon.getSelected(balloon.getCurrentNode());
      }

      if(balloon.selected_action.command === 'cut') {
        if(balloon.selected_action.collection == parent) {
          balloon.showAction(['download', 'add', 'upload', 'refresh', 'delete', 'cut', 'copy', 'filter', 'rename']);
        } else {
          balloon.move(balloon.selected_action.nodes, parent);
        }
      } else if(balloon.selected_action.command === 'copy') {
        if(balloon.selected_action.collection == parent) {
          balloon.clone(balloon.selected_action.nodes, parent, 1);
        } else {
          balloon.clone(balloon.selected_action.nodes, parent);
        }
      }

      balloon.selected_action = {nodes: null, command: null, collection: null};
      break;

    case 'filter':
      var $select = $('#fs-action-filter-select');

      if($select.is(':visible')) {
        $select.hide();
        return;
      }

      $(document).off('click.action-filter').on('click.action-filter', function(e){
        var $target = $(e.target);

        if($target.attr('id') != "fs-action-filter") {
          $select.hide();
        }
      })

      $select.show().off('change', 'input[type=checkbox]').on('change', 'input[type=checkbox]', balloon._filterTree);
      break;

    case 'rename':
      balloon.initRename();
      break;

    }
  },


  /**
   * Filter tree
   *
   * @return void
   */
  _filterTree: function(e) {
    e.stopImmediatePropagation();

    var $that   = $(this),
      name  = $that.attr('name'),
      checked = $that.is(':checked');

    balloon.tree.filter[name] = checked;
    $('#fs-action-filter-select').hide();

    if(name === 'deleted' && balloon.tree.filter[name]) {
      balloon.tree.filter.deleted = 2;
      balloon.refreshTree(null, {id: balloon.getCurrentCollectionId()}, {deleted: 2});
    } else {
      balloon.tree.filter.deleted = 0;
      balloon.refreshTree(null, {id: balloon.getCurrentCollectionId()}, {deleted: 0});
    }
  },


  /**
   * Reset dom elements to default
   *
   * @param   string|array elements
   * @return  void
   */
  resetDom: function(elements) {
    if(elements == undefined) {
      return balloon.resetDom([
        'shortcuts',
        'selected',
        'properties',
        'preview',
        'action-bar',
        'multiselect',
        'view-bar',
        'history',
        'share',
        'share-link',
        'advanced',
        'search',
        'prompt',
        'tree',
        'edit',
        'events',
        'events-win',
        'breadcrumb-search',
        'breadcrumb-home',
      ]);
    } else if(typeof(elements) == 'string') {
      return balloon.resetDom([
        elements,
      ]);
    }

    for(var element in elements) {
      switch(elements[element]) {
      case 'upload-progress':
        $("#fs-upload-progress").hide();
        var $fs_upload_progress_bar = $("#fs-upload-progress-bar");

        $fs_upload_progress_bar.find("> div").remove();
        $fs_upload_progress_bar.append('<div class="fs-total-progress"></div>');
        $('#fs-upload-progress-info-icon-loading').show();
        $('#fs-upload-progress-info-icon-complete').hide();
        break;

      case 'uploadmgr-progress':
        var $fs_up_total_prog =  $("#fs-uploadmgr-total-progress");
        var $fs_up_files_prog =  $("#fs-uploadmgr-files-progress");
        $fs_up_total_prog.find("> div").remove();
        $fs_up_total_prog.append('<div></div>');
        $fs_up_files_prog.find("> div").remove();
        $fs_up_files_prog.append('<div></div>');
        break;

      case 'uploadmgr-progress-files':
        $("#fs-upload-list > div").remove();
        break;

      case 'user-profile':
        $('#fs-profile-user').find('tr').remove();
        balloon.resetWindow('fs-profile-window');
        break;

      case 'properties':
        //TODO pixtron - is this still needed?
        balloon._rename();
        balloon._resetRenameView();
        var $fs_prop = $('#fs-properties');
        $fs_prop.find('tr:not(.fs-editable)').hide();
        $fs_prop.find('textarea').val('');
        $fs_prop.find('input').val('');
        $fs_prop.find('select').val('');
        $fs_prop.find('.fs-searchable').hide();

        $fs_prop.find("span").html('');
        $('#fs-properties-root').hide();
        $('#fs-properties-id').parent().show();
        $('#fs-view').hide();
        $("#fs-properties-collection").hide();
        $("#fs-properties-file").hide();
        $("#fs-properties-node").hide();
        break;

      case 'advanced':
        var $fs_advanced   = $('#fs-advanced');
        $fs_advanced.find('input[name=destroy_at]').val(''),
        $fs_advanced.find('input[name=readonly]').prop('checked', false);
        break;

      case 'selected':
        var $name = $("#fs-properties-name").hide();
        $name.find('.fs-sprite').removeAttr('class').addClass('fs-sprite');
        $name.find('.fs-value').html('');
        $name.find('.fs-ext').html('');
        break;

      case 'preview':
        $('#fs-properties-share').parent().hide();

        var $fs_meta_tags = $('#fs-properties-meta-tags-tags');
        $fs_meta_tags.hide();
        $fs_meta_tags.find('ul').empty();

        var $fs_preview_add_tag = $('#fs-preview-add-tag').removeClass('fs-add-tag-active'),
          $add   = $fs_preview_add_tag.find("input"),
          $k_add = $add.data('kendoAutoComplete');

        if($k_add != undefined) {
          $k_add.destroy();
        }

        $fs_preview_add_tag.html('<input type="text" name="add_tag"/>');
        $("#fs-properties-meta-color").find('.fs-color-selected').removeClass('fs-color-selected');
        var $fs_preview_thumb =  $("#fs-preview-thumb");

        $fs_preview_thumb.hide()
          .find('.fs-hint').hide();
        $fs_preview_thumb.find("div").html('');
        break;

      case 'prompt':
        balloon.resetWindow('fs-prompt-window');
        $("#fs-prompt-window").addClass("fs-prompt-window");
        break;

      case 'edit':
        balloon.resetWindow('fs-edit-live');
        break;

      case 'events':
        $('#fs-events').find('li').remove();
        $('#fs-event-window').find('li').remove();
        break;

      case 'events-win':
        balloon.resetWindow('fs-event-window');
        break;

      case 'view-bar':
        $('#fs-content-view').find('dt,dd').addClass('disabled');
        break;

      case 'action-bar':
        $('.fs-action-select-only').addClass('fs-action-disabled');
        $('.fs-action-collection-only').addClass('fs-action-disabled');
        break;

      case 'search':
        var $fs_search = $('#fs-search');
        var $fs_search_input = $fs_search.find('#fs-search-input');

        $fs_search.removeClass('fs-search-focused').removeClass('fs-search-filtered');
        $fs_search_input.val('');
        $('#fs-browser-action').show();
        break;

      case 'history':
        var $view = $("#fs-history");
        $view.find("li").remove();
        $view.find('input[type=submit]').hide();
        break;

      case 'multiselect':
        balloon.multiselect = [];
        $('#fs-browser-summary').html('');
        $('#fs-browser-tree').find('.fs-multiselected')
          .removeClass('fs-multiselected')
          .removeClass('k-state-selected');
        break;

      case 'share':
        var $fs_share = $('#fs-share');

        $fs_share.find('.fs-share-hint-owner-only').hide();
        $fs_share.find('#fs-share-consumers ul').empty();

        $fs_share.find('#fs-share-create').show();
        $fs_share.find('#fs-share-edit').hide();
        $fs_share.find('#fs-share-delete').hide();
        break;

      case 'share-link':
        $('#fs-share-link button').hide();
        break;

      case 'tree':
        var $tree   = $("#fs-browser-tree"),
          $k_tree = $tree.data('kendoTreeView');

        if($k_tree !== undefined) {
          $k_tree.destroy();
          $tree.remove();
          $("#fs-browser").append('<div id="fs-browser-tree"></div>');
        }
        $('#fs-browser-fresh').hide();
        break;

      case 'breadcrumb-home':
        var $crumb = $('#fs-crumb-home-list');
        $crumb.find('li').remove();
        $crumb.append('<li id="fs-crumb-home" fs-id="">'+i18next.t('menu.cloud')+'</li>');
        break;

      case 'breadcrumb-search':
        var $crumb = $('#fs-crumb-search-list');
        $crumb.find('li').remove();
        $crumb.append('<li id="fs-crumb-search" fs-id="">'+i18next.t('search.results')+'</li>');
        break;

      case 'shortcuts':
        $(document).unbind('keyup');
        break;
      }
    }
  },


  /**
   * reset kendow window
   *
   * @return void
   */
  resetWindow: function(id) {
    var $win = $('#'+id);
    $win.find('li').remove();
    if($win.data('kendoBalloonWindow') !== undefined) {
      $win.data('kendoBalloonWindow').close().destroy();
      var html = $win.html(),
        title= $win.attr('title');
      $win.remove();
      $('#fs-namespace').append('<div id="'+id+'" title="'+title+'">'+html+'</div>');
    }
  },


  /**
   * Perform file uploads
   *
   * @param   object|string parent_node
   * @param   object dom_node
   * @return  void
   */
  fileUpload: function(parent_node, dom_node) {
    var dn,
      directory,
      $fs_browser_tree = $('#fs-browser-tree');

    if(dom_node != undefined) {
      dn = dom_node;
    } else {
      dn = $('#fs-browser-tree').find('.k-item[fs-id='+balloon.id(parent_node)+']');
    }

    if(typeof(parent_node) == 'string' || parent_node === null) {
      directory = true;
    } else {
      directory = parent_node.directory;
    }

    function handleDragOver(e) {
      e.stopPropagation();
      e.preventDefault();

      // Explicitly show this is a copy.
      e.originalEvent.dataTransfer.dropEffect = 'copy';
    };

    dn.unbind('drop').on('drop', function(e) {
      $fs_browser_tree.removeClass('fs-file-dropable');
      $fs_browser_tree.find('.fs-file-drop').removeClass('fs-file-drop');
      $('#fs-upload').removeClass('fs-file-dropable');

      balloon._handleFileSelect(e, parent_node);
    });
  },


  /**
   * Prepare selected files for upload
   *
   * @param   object e
   * @param   object|string parent_node
   * @return  void
   */
  _handleFileSelect: function(e, parent_node) {
    if(balloon.isSearch() && balloon.getCurrentCollectionId() === null) {
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    if('originalEvent' in e && 'dataTransfer' in e.originalEvent) {
      var blobs = e.originalEvent.dataTransfer.files;
    } else {
      var blobs = e.target.files;
    }

    balloon.uploadFiles(blobs, parent_node);
  },

  /**
   * Prepare selected files for upload
   *
   * @param   array files
   * @param   object|string parent_node
   * @return  void
   */
  uploadFiles: function(files, parent_node) {
    var $div = $('#fs-uploadmgr');
    var $k_manager_win = $div.kendoBalloonWindow({
      title: $div.attr('title'),
      resizable: false,
      modal: true,
    }).data("kendoBalloonWindow");

    balloon.resetDom(['upload-progress', 'uploadmgr-progress']);

    if(balloon.upload_manager === null ||
    balloon.upload_manager.count.transfer === balloon.upload_manager.count.upload) {
      balloon.resetDom('uploadmgr-progress-files');

      balloon.upload_manager = {
        parent_node: parent_node,
        progress: {
          mgr_percent: null,
          notifier_percent: null,
          mgr_chunk:   null,
        },
        files: [],
        upload_bytes: 0,
        transfered_bytes: 0,
        count: {
          upload:   0,
          transfer: 0,
          success:  0,
          last_started: 0
        },
        start_time: new Date(),
      };
    }

    var $upload_list = $('#fs-upload-list');
    for(var i = 0, progressnode, file, last = balloon.upload_manager.count.last_started; file = files[i]; i++, last++) {
      if(file instanceof Blob) {
        file = {
          name: file.name,
          blob: file
        }
      }

      if(file.blob.size === 0) {
        balloon.displayError(new Error('Upload folders or empty files is not yet supported'));
      } else if(file.blob.size+balloon.quota.used > balloon.quota.hard_quota) {
        balloon.displayError(new Error('Quota is too low to upload this file'));
      } else if(file.blob.size != 0) {
        var progressId = 'fs-upload-'+last;
        progressnode = $('<div id="'+progressId+'" class="fs-uploadmgr-progress"><div id="'+progressId+'-progress" class="fs-uploadmgr-progressbar"></div></div>');
        $upload_list.append(progressnode);

        $('#'+progressId+'-progress').kendoProgressBar({
          type: 'percent',
          animation: {
            duration: 10
          },
        });

        balloon.upload_manager.files.push({
          progress:   progressnode,
          blob:     file.blob,
          name:     file.name,
          index:    1,
          start:    0,
          end:    0,
          transfered_bytes: 0,
          success:  Math.ceil(file.blob.size / balloon.BYTES_PER_CHUNK),
          slices:   Math.ceil(file.blob.size / balloon.BYTES_PER_CHUNK),
          manager:  balloon.upload_manager,
          request:  null,
          status:   1,
        });

        progressnode.prepend('<div class="fs-progress-filename">'+file.name+'</div>');
        progressnode.append('<div class="fs-progress-icon"><svg viewBox="0 0 24 24" class="gr-icon gr-i-close"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#close"></use></svg></div>');

        balloon.upload_manager.upload_bytes += file.blob.size;
      }
    }

    if(balloon.upload_manager.files.length <= 0) {
      return;
    }

    $('#fs-upload-list').on('click', '.fs-progress-icon', function() {
      var i  = parseInt($(this).parent().attr('id').substr(10)),
        file = balloon.upload_manager.files[i];

      if(file.status !== 1) {
        return;
      }

      file.status = 0;
    });

    balloon.upload_manager.count.upload  = balloon.upload_manager.files.length;
    balloon._initProgress(balloon.upload_manager);

    $('#fs-upload-progress').unbind('click').click(function(){
      $k_manager_win.center().open();
    });

    $('#fs-uploadmgr-files').html(
      i18next.t('uploadmgr.files_uploaded', "0", balloon.upload_manager.count.upload)
    );

    $('#fs-uploadmgr-bytes').html('<span>0</span> / '+balloon.getReadableFileSizeString(balloon.upload_manager.upload_bytes));

    $('#fs-upload-progree-info-status-uploaded').html('0');
    $('#fs-upload-progree-info-status-total').html(balloon.getReadableFileSizeString(balloon.upload_manager.upload_bytes));

    for(var i = balloon.upload_manager.count.last_started; i < balloon.upload_manager.count.upload; i++) {
      balloon.upload_manager.count.last_started = i + 1;
      balloon._chunkUploadManager(balloon.upload_manager.files[i]);
    }
  },


  /**
   * Init upload progress bars
   *
   * @param  object manager
   * @return void
   */
  _initProgress: function(manager) {
    $("#fs-upload-progress").show();
    $('#fs-uploadmgr-transfer-icon-complete').hide();
    $('#fs-uploadmgr-transfer-icon-loading').show();

    manager.progress.mgr_percent = $("#fs-uploadmgr-total-progress > div").kendoProgressBar({
      type: 'percent',
      animation: {
        duration: 10
      },
      complete: function() {
        $('#fs-uploadmgr-transfer-icon-loading').hide();
        $('#fs-uploadmgr-transfer-icon-complete').show();
      }
    }).data("kendoProgressBar");

    manager.progress.notifier_percent = $("#fs-upload-progress-bar > div").kendoProgressBar({
      type: 'percent',
      animation: {
        duration: 10
      },
    }).data("kendoProgressBar");

    if(manager.count.upload > 1) {
      manager.progress.mgr_chunk = $("#fs-uploadmgr-files-progress > div").kendoProgressBar({
        type: 'chunk',
        animation: {
          duration: 10
        },
        value: manager.count.transfer,
        min: 0,
        max: manager.count.upload,
        chunkCount: manager.count.upload,
      }).data("kendoProgressBar");
    } else {
      manager.progress.mgr_chunk = $("#fs-uploadmgr-files-progress").find("> div").kendoProgressBar({
        type: 'value',
        animation: {
          duration: 10
        },
        value: manager.count.transfer,
        min: 0,
        max: 1,
      }).data("kendoProgressBar");
    }
  },


  /**
   * Chunked file upload
   *
   * @param   object file
   * @return  void
   */
  _chunkUploadManager: function(file) {
    //Check if all chunks of one blob have been uploaded
    if(file.index > file.slices) {
      if(file.success == file.slices) {
        file.status = 3;
        file.manager.count.transfer++;
        file.manager.count.success++;
        file.manager.progress.mgr_chunk.value(file.manager.count.transfer);

        file.progress.find('.fs-progress-icon').replaceWith('<div class="fs-progress-icon fs-progress-complete"><svg viewBox="0 0 24 24" class="gr-icon gr-i-checkmark"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#checkmark"></use></svg></div>');
        file.progress.find('.fs-progress-icon').off('click');

        $('#fs-uploadmgr-files').html(i18next.t('uploadmgr.files_uploaded',
          file.manager.count.success.toString(), file.manager.count.upload)
        );
      }

      return;
    }

    //Abort upload (stop uploading next chunks)
    if(file.status === 0 ) {
      file.progress.find('.fs-progress-icon').remove();

      $('#fs-uploadmgr-bandwidth').html('(0 B/s)');
      file.progress.find('.fs-uploadmgr-progressbar').data("kendoProgressBar").value(0);
      file.progress.find('.k-state-selected').addClass('fs-progress-error');

      file.manager.upload_bytes = file.manager.upload_bytes - file.blob.size;
      file.manager.transfered_bytes = file.manager.transfered_bytes - file.transfered_bytes;

      file.manager.progress.mgr_chunk.value(file.manager.count.transfer);
      $($('#fs-uploadmgr-files-progress .k-item')[file.manager.count.transfer]).addClass('fs-progress-error');

      file.manager.count.transfer++;
    } else {
      file.end = file.start + balloon.BYTES_PER_CHUNK;

      if(file.end > file.blob.size) {
        file.end = file.blob.size;
      }

      balloon._chunkUpload(file);

      file.start = file.end;
      file.index++;
    }
  },


  /**
   * Check if all files were proceeded
   *
   * @return void
   */
  _checkUploadEnd: function() {
    if(balloon.upload_manager.count.transfer >= balloon.upload_manager.count.upload) {
      $('#fs-uploadmgr-bandwidth').html('(0 B/s)');
      $('#fs-uploadmgr-time').html(
        i18next.t('uploadmgr.finished')
      );

      $('#fs-upload-progress-info-icon-loading').hide();
      $('#fs-upload-progress-info-icon-complete').show();

      balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
      balloon.displayQuota();

      setTimeout(function() {
        balloon.resetDom('upload-progress');
      }, 3000);
    }
  },

  /**
   * transfer selected files to the server
   *
   * @param   object file
   * @return  void
   */
  _chunkUpload: function(file) {
    var url = balloon.base + '/files/chunk?name=' + encodeURI(file.name) + '&index=' +
      file.index + '&chunks=' + file.slices + '&size=' + file.blob.size;

    if(file.session) {
      url += '&session='+file.session;
    }

    if(file.manager.parent_node !== null) {
      url += '&collection='+balloon.id(file.manager.parent_node);
    }

    var chunk = file.blob.slice(file.start, file.end),
      size  = file.end - file.start,
      last  = 0;

    balloon.xmlHttpRequest({
      xhr: function() {
        var xhr = new window.XMLHttpRequest();
        xhr.upload.addEventListener("progress", function(e) {
          if (e.lengthComputable) {
            var add  = e.loaded - last;
            file.manager.transfered_bytes += add;
            file.transfered_bytes += add;
            last = e.loaded;

            var file_complete = file.transfered_bytes / file.blob.size;
            file_complete = Math.round(file_complete * 100);
            file.progress.find('.fs-uploadmgr-progressbar').data("kendoProgressBar").value(file_complete);

            var total_complete = file.manager.transfered_bytes / file.manager.upload_bytes;
            total_complete = Math.round(total_complete * 100);
            file.manager.progress.mgr_percent.value(total_complete);
            file.manager.progress.notifier_percent.value(total_complete);


            $("#fs-upload-progress-info-percent").html(total_complete + "%");
            $('#fs-upload-progree-info-status-uploaded').html(balloon.getReadableFileSizeString(file.manager.transfered_bytes));

            $('#fs-uploadmgr-bytes > span').html(balloon.getReadableFileSizeString(file.manager.transfered_bytes));

            var now  = new Date();
            var took = now.getTime() - file.manager.start_time.getTime();
            var bytes_left = file.manager.upload_bytes - file.manager.transfered_bytes;
            var end = new Date(now.getTime() + (Math.round(took / file.manager.transfered_bytes * bytes_left)));

            var rate = file.manager.transfered_bytes / (took / 1000);
            $('#fs-uploadmgr-bandwidth').html('(' + balloon.getReadableFileSizeString(rate)+'/s)');

            if(bytes_left > 0) {
              $('#fs-uploadmgr-time').html(i18next.t('uploadmgr.time_left', balloon.timeSince(end)));
            }
          }

        }, false);

        file.request = xhr;

        return xhr;
      },
      url: url,
      type: 'PUT',
      data: chunk,
      processData: false,
      complete: function() {
        if(file.transfered_bytes === 0)  {
          file.transfered_bytes += size;
          file.manager.transfered_bytes += size;
        }

        var file_complete = file.transfered_bytes / file.blob.size;
        file_complete = Math.round(file_complete * 100);
        file.progress.find('.fs-uploadmgr-progressbar').data("kendoProgressBar").value(file_complete);

        var total_complete;
        if(file.manager.upload_bytes === 0) {
          total_complete = 0;
        } else {
          total_complete = file.manager.transfered_bytes / file.manager.upload_bytes;
          total_complete = Math.round(total_complete * 100);
        }

        file.manager.progress.mgr_percent.value(total_complete);
        file.manager.progress.notifier_percent.value(total_complete);

        $('#fs-uploadmgr-bytes > span').html(balloon.getReadableFileSizeString(file.manager.transfered_bytes));
        $('#fs-upload-info > span').html(balloon.getReadableFileSizeString(file.manager.transfered_bytes));
      },
      success: function(response) {
        file.session = response.session;
        balloon._chunkUploadManager(file);
        balloon._checkUploadEnd();
      },
      error: function(e) {
        file.success--;

        $('#fs-uploadmgr-bandwidth').html('0 B/s');

        file.manager.progress.mgr_chunk.value((file.manager.count.transfer + 1));

        if(file.manager.count.upload == 1) {
          $('#fs-uploadmgr-files-progress .k-state-selected').addClass('fs-progress-error');
        } else {
          $($('#fs-uploadmgr-files-progress .k-item')[file.manager.count.transfer]).addClass('fs-progress-error');
        }

        file.progress.find('.k-state-selected').addClass('fs-progress-error');
        file.progress.find('.fs-progress-icon').addClass('fs-progress-error').replaceWith('<div class="fs-progress-icon"><svg viewBox="0 0 24 24" class="gr-icon gr-i-error"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#error"></use></svg></div>');
        file.progress.find('.fs-progress-icon').off('click');

        file.status = 2;
        file.manager.count.transfer++;
        balloon._checkUploadEnd();

        var data = balloon.parseError(e);
        if(data === false || data.status != 403) {
          balloon.displayError(response);
        } else {
          if(data.code === 40) {
            var new_name = balloon.getCloneName(file.blob.name);
            var new_file = {
              name: new_name,
              blob: file.blob
            };

            balloon.promptConfirm(i18next.t('prompt.auto_rename_node', file.blob.name, new_name), 'uploadFiles', [[new_file], file.manager.parent_node]);
          } else {
            balloon.displayError(e);
          }
        }
      }
    });
  },


  /**
   * Get clone name
   *
   * @param  string name
   * @return string
   */
  getCloneName: function(name) {
    var ext = balloon.getFileExtension(name);
    if(ext === null) {
      return name+' ('+balloon.randomString(4)+')';
    } else {
      name = name.substr(0, name.length - (ext.length+1));
      name = name+' ('+balloon.randomString(4)+').'+ext;
      return name;
    }
  },

  _spriteIcon: function($icon, icon) {
    var iconUrl = $icon.find('use').attr('xlink:href');

    $icon.find('svg').removeAttr('class')
      .addClass('gr-icon')
      .addClass('gr-i-'+icon);

    $icon.find('use').attr('xlink:href', iconUrl.substr(0, iconUrl.indexOf('#')+1) + icon);
  }
};

import './app.js';
export default balloon;
