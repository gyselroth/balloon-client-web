/**
 * balloon
 *
 * @copyright Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license   GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import {qrcode, modes, ecLevel} from 'qrcode.es';
import kendoAutoComplete from 'kendo-ui-core/js/kendo.autocomplete.js';
import kendoProgressBar from 'kendo-ui-core/js/kendo.progressbar.js';
import kendoTreeview from 'kendo-ui-web/scripts/kendo.treeview.min.js';
import balloonWindow from './widget-balloon-window.js';
import balloonDatePicker from './widget-balloon-datepicker.js';
import balloonTimePicker from './widget-balloon-timepicker.js';
import dataTransferItemsHandler from './data-transfer-items-handler.js';
import login from './auth.js';
import i18next from 'i18next';
import app from './app.js';
import fileExtIconMap from './file-ext-icon-map.js';
import {mimeFileExtMap} from './mime-file-ext-map.js';
import iconsSvg from '@gyselroth/icon-collection/src/icons.svg';

import Slideout from 'slideout';
import pullToRefresh from 'mobile-pull-to-refresh'
import ptrAnimatesIos from 'mobile-pull-to-refresh/dist/styles/ios/animates'

window.$ = $;
$.ajaxSetup({
  beforeSend:function(jqXHR,settings){
    if (settings.dataType === 'binary'){
      settings.xhr().responseType='arraybuffer';
      settings.processData=false;
    }
  }
});

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
   * Separator used to separate multiple selected nodes in url's
   */
  URL_PARAM_SELECTED_SEPARATOR: ',',

  /**
   * Event request limit
   */
  EVENTS_PER_REQUEST: 50,

  /**
   * Map with [FILE EXTENSION]: [SPRITE ICON CLASS]
   */
  fileExtIconMap: fileExtIconMap,

  /**
   * Map with [MIME TYPE] : [FILE EXTENSION]
   */
  mimeFileExtMap: mimeFileExtMap,

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
   * Queue for uploaded collections
    */
  uploadCollectionManager: {
    uploadCreateCollectionQueue: [],
    uploadCreateCollectionPending: {}
  },

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
   * Available search modes
   *
   * @var object
   */
  search_modes: {
    'nodename': {
      label: 'search.mode.nodename',
      buildQuery: function(value, filters) {
        return balloon._buildQueryNodename(value, filters);
      },
      executeQuery: function(query) {
        return balloon.refreshTree('/nodes', {query: query});
      }
    }
  },

  /**
   * Add file menu
   *
   * @var object
   */
  add_file_menu_items: {
    'folder': {
      name: 'folder',
      label: 'tree.folder',
      icon: 'folder',
      callback: function(type) {
        return balloon.showNewNode(type, balloon.addFolder);
      }
    },
    'txt': {
      name: 'txt',
      label: 'tree.txt_file',
      icon: 'file-text',
      callback: function(type) {
        return balloon.showNewNode(type, balloon.addFile);
      }
    }
  },

  /**
   * File handlers
   *
   * @var array
   */
  file_handlers: [],

  /**
   * Menu handlers
   *
   * @var object
   */
  menu_left_items: {
    'cloud': {
      name: 'cloud',
      label: 'menu.cloud',
      icon: 'cloud',
      callback: function() {
        return balloon.refreshTree('/collections/children', {}, {});
      }
    },
    'shared_for_me': {
      name: 'shared_for_me',
      label: 'menu.shared_for_me',
      icon: 'folder-received',
      callback: function() {
        return balloon.refreshTree('/nodes', {query: {shared: true, reference: {$exists: 1}}}, {});
      }
    },
    'shared_from_me': {
      name: 'shared_from_me',
      label: 'menu.shared_from_me',
      icon: 'folder-shared',
      callback: function() {
        return balloon.refreshTree('/nodes', {query: {shared: true, reference: {$exists: 0}}}, {});
      }
    },
    'shared_link': {
      name: 'shared_link',
      label: 'menu.shared_link',
      icon: 'hyperlink',
      callback: function() {
        return balloon.refreshTree('/nodes', {query: {"app.Balloon\\App\\Sharelink.token": {$exists: 1}}}, {});
      }
    },
    'trash': {
      name: 'trash',
      label: 'menu.trash',
      icon: 'trash',
      callback: function() {
        return balloon.refreshTree('/nodes/trash', {}, {});
      }
    },
  },

  /**
   * Menu handlers
   *
   * @var object
   *
   * if hasDropDown is true, dropDownContent has to be set, otherwise a click callback is required
   */
  identity_menu_items: {
    'help': {
      name: 'help',
      label: 'login.help',
      icon: 'help',
      hasDropDown: false,
      hasCount: false,
      callback: function() {
        balloon.displayHelpWindow();
      }
    },
    'search': {
      name: 'search-trigger-mobile',
      label: 'nav.action.search',
      icon: 'search',
      hasDropDown: false,
      hasCount: false,
      callback: function() {
        $('#fs-search').addClass('fs-search-mobile-visible');
        $('#fs-search-input').focus();
      }
    }
  },

  /**
   *
   */
  hints: [],


  /**
   * Default url params
   *
   * @var object
   */
  defaultUrlParams: {
    'menu': 'cloud',
    'view': 'preview',
    'collection': 'root',
    'selected': null
  },

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
  fs_content_views: {
    'preview': {
      id: 'preview',
      title: 'nav.view.preview',
      isEnabled: function() {
        return true;
      },
      onActivate: function() {
        balloon.displayPreview(balloon.getCurrentNode());
      },
    },
    'share-link': {
      id: 'share-link',
      title: 'nav.view.share_link',
      isEnabled: function() {
        return balloon.last.access != 'r' && !balloon.last.deleted;
      },
      onActivate: function() {
        balloon.shareLink(balloon.getCurrentNode());
      },
    },
    'share': {
      id: 'share',
      title: 'nav.view.share_folder',
      isEnabled: function() {
        return balloon.last.directory && balloon.last.access === 'm' && !balloon.last.share;
      },
      onActivate: function() {
        balloon.shareCollection(balloon.getCurrentNode());
      },
    },
    'metadata': {
      id: 'metadata',
      title: 'nav.view.metadata',
      isEnabled: function() {
        return true;
      },
      onActivate: function() {
        balloon.displayMetadata(balloon.getCurrentNode());
      },
    },
    'history': {
      id: 'history',
      title: 'nav.view.history',
      isEnabled: function() {
        return !balloon.last.directory;
      },
      onActivate: function() {
        balloon.displayHistoryView();
      },
    },
    'events': {
      id: 'events',
      title: 'nav.view.events',
      isEnabled: function() {
        return true;
      },
      onActivate: function() {
        var node = balloon.getCurrentNode();
        var $fs_events_all = $('#fs-events-all').hide();

        var $view_list = $('#fs-events ul');
        $view_list.empty();

        balloon._event_limit = false;
        var req = balloon.displayEvents($view_list, node, {offset: 0, limit: 3});

        req.done(function(body) {
          if(body && body.count < body.total) {
            $fs_events_all.off('click').on('click', function() {
              balloon.displayEventsWindow(node);
            }).show();
          }
        });
      },
    },
    'properties': {
      id: 'properties',
      title: 'nav.view.properties',
      isEnabled: function() {
        return balloon.last.access != 'r';
      },
      onActivate: function() {
        balloon.displayProperties(balloon.getCurrentNode());
      },
    },
  },

  /**
   * Hooks called after tree data is bound, in order to check if fs_browser_actions may be displayed.
   * If one hook returns false fs_browser_actions is not displayed.
   *
   * @var object
   */
  toggle_fs_browser_action_hooks: {},

  /**
   * The different possible states of fs-content overlays in mobile
   *
   * @var array
   */
  fs_content_mobile_states: ['fs-content-mobile-menu', 'fs-content-mobile-more', 'fs-content-mobile-detail'],

  /**
   * Current state of fs-content overlays in mobile
   *
   * @var array
   */
  fs_content_mobile_current_state: 0,

  /**
   * Slideout
   */
  slideout: null,

  /**
   * Generates a uuid v4.
   *
   * @author https://gist.github.com/LeverOne/1308368;
   * @return string uuid4
   */
  // eslint-disable-next-line
  uuid: function(a,b){for(b=a='';a++<36;b+=a*51&52?(a^15?8^Math.random()*(a^20?16:4):4).toString(16):'-');return b},

  /**
   * Init file browsing after current url has been resolved
   *
   * @return void
   */
  init: function() {
    if(balloon.isInitialized()) {
      balloon.resetDom();
    } else {
      this.base = this.base+'/v'+this.BALLOON_API_VERSION;
      if(balloon.isTouchDevice()) $('body').addClass('is-touch');
    }


    balloon._resolveHash(window.location.hash.substr(1)).then(function() {
      balloon._init();
    });
  },

  /**
   * Resolves a given hash to a certain url
   *
   * @param string hash
   * @return $.Deferred()
   */
  _resolveHash: function(hash) {
    var $d = $.Deferred();

    var matches = /^share\/([a-f\d]{24})$/i.exec(hash)

    if(matches !== null) {
      var id = matches[1];

      balloon.xmlHttpRequest({
        url: balloon.base+'/nodes',
        type: 'GET',
        dataType: 'json',
        data: {
          id: id,
          attributes: ['parent']
        },
        success: function(body) {
          var parent = (body.parent && body.parent.id) ? body.parent.id : null;
          var url = balloon._buildUrl(null, parent, null, [id], true);

          login.replaceState(url);
          balloon.history_last_url = '#' + url;
          $d.resolve();
        },
        error: function(body) {
          $d.resolve();
        }
      });
    } else {
      $d.resolve();
    }

    return $d;
  },

  /**
   * Init file browsing
   *
   * @return void
   */
  _init: function() {
    //reset last and previous uppon login
    balloon.previous = null;
    balloon.last = null;

    app.preInit(this);
    balloon.kendoFixes();

    balloon.initFsContentView();
    balloon.initFsMenu();
    balloon.initIdentityMenu();
    balloon.initAddFileMenu();

    balloon.createDatasource();
    balloon.initCrumb();

    balloon._initSwipeEvents();

    $(".fs-action-element").unbind('click').click(balloon.doAction);
    $('#fs-browser-action-mobile').off('click').on('click', function() {
      if($('#fs-browser-action').hasClass('fs-browser-action-mobile-open')) {
        $('#fs-browser-action').removeClass('fs-browser-action-mobile-open');
        $(document).off('click.fs-browser-action-mobile');
      } else {
        $('#fs-browser-action').addClass('fs-browser-action-mobile-open');

        $(document).off('click.fs-browser-action-mobile').on('click.fs-browser-action-mobile', function(event){
          var $target = $(event.target);

          if($target.attr('id') === 'fs-browser-action' || $target.parents('#fs-browser-action').length > 0) return;

          $('#fs-browser-action').removeClass('fs-browser-action-mobile-open');
        });
      }

    });

    $("#fs-browser-header").find("> div.fs-browser-column-sortable").unbind('click').click(function(event) {
      var field = $(this).attr('id').substr(18);

      balloon._sortTree(field);
    });

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
        .off('touchend', '.k-in').on('touchend', '.k-in', balloon._treeTouchEnd)
        .off('touchmove', '.k-in').on('touchmove', '.k-in', balloon._treeTouchMove);
    }

    if(balloon.isTouchDevice()) {
      $fs_browser_tree
        .off('click', '.k-in').on('click', '.k-in', balloon._treeDblclick);
    } else {
      $fs_browser_tree
        .off('click', '.k-in').on('click', '.k-in', balloon._treeClick)
        .off('dblclick', '.k-in').on('dblclick', '.k-in', balloon._treeDblclick);
    }

    balloon.displayQuota();

    var $fs_search = $('#fs-search');
    var $fs_search_input = $fs_search.find('#fs-search-input');
    var $fs_search_filter_toggle = $fs_search.find('#fs-search-toggle-filter');
    var $fs_search_mode_toggle = $fs_search.find('#fs-search-mode-toggle');
    var $fs_search_mode_dropdown_ul = $fs_search.find('#fs-search-mode-dropdown ul');

    $fs_search_input.off('focus').on('focus', function() {
      $fs_search.addClass('fs-search-focused');

      if($('#fs-search-filter').data('initialized') !== true) {
        //populate filters before opening
        balloon.advancedSearch();
      } else {
        balloon.initSearchResultBreadCrumb();
      }
    });

    $fs_search_input.off('blur').on('blur', function() {
      window.setTimeout(function() {
        $fs_search.removeClass('fs-search-focused');
      }, 50);
    });

    $fs_search_input.unbind('keyup').bind('keyup', balloon.buildExtendedSearchQuery);

    $fs_search.find('#fs-search-reset').off('click').on('click', function() {
      balloon.resetSearch();
    });

    $fs_search_filter_toggle.off('click').on('click', function() {
      if($('#fs-search-filter').data('initialized') !== true) {
        //populate filters before opening
        balloon.advancedSearch();
      } else {
        balloon.initSearchResultBreadCrumb();
      }

      $('#fs-search-filter').toggle();

      if($('#fs-search-filter').is(':visible') === false) {
        $(window).off('keydown.search-filter');
      } else {
        $(window).on('keydown.search-filter', function(event) {
          switch(event.keyCode) {
          case 27:
            $('#fs-search-filter').hide();
            $(window).off('keydown.search-filter');
            break;
          }
        });
      }
    });

    var searchModes = Object.keys(balloon.search_modes);
    if(searchModes.length <= 1) {
      $fs_search_mode_toggle.hide();
    } else {
      $fs_search_mode_toggle.show();

      function toggleSearchMode() {
        $fs_search.toggleClass('fs-search-mode-dropdown-open');
        $(document).off('click.fs-search-mode-toggle');

        if($fs_search.hasClass('fs-search-mode-dropdown-open')) {
          $(document).on('click.fs-search-mode-toggle', function(event){
            var $target = $(event.target);
            var parentId = 'fs-search-mode-toggle';

            if($target.attr('id') === parentId || $target.parents('#'+parentId).length > 0) return;

            toggleSearchMode();
          });
        }
      }

      $fs_search_mode_toggle.off('click').on('click', toggleSearchMode);

      $fs_search_mode_dropdown_ul.empty();

      var i;
      for(i=0; i<searchModes.length; i++) {

        var mode = searchModes[i];
        var modeConfig = balloon.search_modes[mode];

        $fs_search_mode_dropdown_ul.append(
          '<li title="' + i18next.t(modeConfig.label) + '">'+
            '<input type="radio" name="fs-search-mode" value="' + mode + '" id="fs-search-mode-' + mode + '"'+ (i===0 ? ' checked="checked"' : '')+' />'+
            '<label for="fs-search-mode-' + mode + '">' + i18next.t(modeConfig.label) + '</label>'+
          '</li>'
        );
      }

      $('input[name="fs-search-mode"]').off('change').change(function() {
        var value = $(this).val();
        $fs_search_mode_toggle.find('span').contents().last().replaceWith(i18next.t(balloon.search_modes[value].label));
        $fs_search.removeClass('fs-search-mode-dropdown-open');
        balloon.advancedSearch();
        $fs_search_input.focus();
      });

    }

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
      balloon._updateFsContentSelectedState();
    });

    $('#fs-content-close').off('click').click(function(event) {
      event.preventDefault();
      event.stopPropagation();
      balloon.deselectAll();
      balloon._updateCheckAllState();
      balloon._updateFsContentSelectedState();
      balloon.selected_action = {nodes: null, command: null, collection: null};
      $('body').removeClass('fs-content-paste-active');
    });

    $('#fs-crumb-back').off('click').on('click', function(event) {
      balloon._folderUp();
      balloon.last = null;
    });

    for(let i=1; i<=25; i++) {
      this.addHint("hint.hint_"+i);
    }

    balloon.addFileHandler({
      app: 'balloon file editor',
      test: balloon.isEditable,
      handler: balloon.editFile
    });

    balloon.addFileHandler({
      app: 'balloon file viewer',
      test: balloon.isViewable,
      handler: balloon.displayFile
    });

    balloon.addFileHandler({
      app: 'balloon preview viewer',
      test: function(node){return node.preview},
      handler: balloon.openPreview
    });

    balloon.addFileHandler({
      app: 'balloon file downloader',
      test: function(node){return true;},
      handler: balloon.downloadNode
    });

    balloon.showHint()

    pullToRefresh({
      container: document.getElementById('fs-browser'),
      scrollable: document.getElementById('fs-layout-left'),
      animates: ptrAnimatesIos,

      refresh: function() {
        return balloon.reloadTree();
      }
    });

    balloon.initialized = true;
    app.postInit(this);
  },

  /**
   * initializes fs-content-view
   *
   * @return void
   */
  initFsContentView: function() {
    var i;
    var $fs_content_view_template = $('#fs-content-view');
    var $fs_content_view = $('<dl id="fs-content-view"></dl>');
    var $fs_content_nav_small = $('#fs-content-nav-small');

    var keys = Object.keys(balloon.fs_content_views);

    for(i=0; i<keys.length; i++) {
      var viewConfig = balloon.fs_content_views[keys[i]];
      var view = viewConfig.id;

      $fs_content_view.append(
        '<dt id="fs-content-view-title-' + view + '" class="disabled">'+
            '<span>' + i18next.t(viewConfig.title) + '</span>'+
            '<svg class="gr-icon gr-i-arrowhead-n"><use xlink:href="'+iconsSvg+'#arrowhead-n"></use></svg>'+
            '<svg class="gr-icon gr-i-arrowhead-s"><use xlink:href="'+iconsSvg+'#arrowhead-s"></use></svg>'+
        '</dt>'
      );

      var $content = viewConfig.$content || $fs_content_view_template.find('#fs-'+view).clone();
      $fs_content_view.append($content);

      var $navItem = $(
        '<li id="fs-content-nav-' + view + '" class="disabled">' +
          '<span>' + i18next.t(viewConfig.title) + '</span>' +
          '<svg viewBox="0 0 24 24" class="gr-icon gr-i-arrowhead-e"><use xlink:href="'+iconsSvg+'#arrowhead-e"></use></svg>'+
        '</li>'
      );

      $fs_content_nav_small.append($navItem);
    }

    $fs_content_view_template.replaceWith($fs_content_view);
  },

  initFsMenu: function() {
    var i;
    var $menu = $('#fs-menu-left-top');
    var keys = Object.keys(balloon.menu_left_items);
    $menu.empty();

    for(i=0; i<keys.length; i++) {
      var item = balloon.menu_left_items[keys[i]];
      var label = i18next.t(item.label);

      var $item = $(
        '<li id="fs-menu-'+item.name+'" title="'+label+'">'+
          '<div class="fs-menu-left-icon">'+
            '<svg class="gr-icon gr-i-'+item.icon+'">'+
              '<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="'+iconsSvg+'#'+item.icon+'">'+
            '</svg>'+
          '</div>'+
          '<div>'+
            '<span>'+label+'</span>'+
          '</div>'+
        '</li>'
      );

      if(i === 0)  $item.addClass('fs-menu-left-active');

      $menu.append($item);
    }

    $menu.off('click').on('click', 'li', balloon.menuLeftAction);
    $('#fs-menu-left-toggl').off('click').on('click', function(event) {
      event.preventDefault();
      balloon.slideout.toggle();
    });
  },

  initIdentityMenu: function() {
    var i;
    var $menu = $('#fs-identity-menu');
    var keys = Object.keys(balloon.identity_menu_items);

    $menu.empty();

    for(i=0; i<keys.length; i++) {
      var item = balloon.identity_menu_items[keys[i]];
      var label = i18next.t(item.label);

      var $item = $(
        '<li id="fs-' + item.name + '" title="' + label + '">'+
            '<svg class="gr-icon gr-i-' + item.icon + '"><use xlink:href="'+iconsSvg+'#' + item.icon + '"></use></svg>'+
            (item.hasCount ? '<div id="fs-' + item.name + '-count" class="fs-identity-count">0</div>' : '')+
        '</li>'
      );
      if(item.hasDropDown) {
        $item.append(
          '<div id="fs-' + item.name + '-dropdown-wrap" class="bln-dropdown fs-identity-dropdown">'+
              '<span  class="bln-dropdown-spike"></span>'+
              '<div id="fs-' + item.name + '-dropdown" class="bln-dropdown-content">' + item.dropDownContent + '</div>'+
          '</div>'
        );
      } else {
        $item.off('click').on('click', item.callback);
      }

      $item.find('[data-i18n]').localize();

      $menu.append($item);
    }

    $('#fs-identity').off('click').on('click', 'li', balloon._menuRightAction);

    $('.fs-identity-dropdown').parent().off('click').on('click', function(event) {
      event.preventDefault();

      var $clicked = $(event.target);
      var parentId = $clicked.attr('id');
      var $dropdown;

      if($clicked.hasClass('fs-identity-count')) {
        $dropdown = $clicked.siblings('.fs-identity-dropdown');
      } else {
        $dropdown = $clicked.find('.fs-identity-dropdown');
      }

      if($dropdown.hasClass('fs-identity-dropdown-open')) {
        $dropdown.removeClass('fs-identity-dropdown-open');

        $(document).off('click.fs-identity-dropdown');
      } else {
        $('.fs-identity-dropdown-open').removeClass('fs-identity-dropdown-open');

        $dropdown.addClass('fs-identity-dropdown-open');

        $dropdown.find('li').off('click.fs-identity-dropdown').on('click.fs-identity-dropdown', function() {
          $dropdown.removeClass('fs-identity-dropdown-open');
        });

        $(document).off('click.fs-identity-dropdown').on('click.fs-identity-dropdown', function(event){
          var $target = $(event.target);

          if($target.attr('id') === parentId || $target.parents('#'+parentId).length > 0) return;

          $dropdown.removeClass('fs-identity-dropdown-open');
        });
      }
    });
  },

  initAddFileMenu() {
    var i;
    var $menu = $('#fs-action-add-select ul');
    var $menuMobile = $('#fs-action-add-select-mobile ul');
    var keys = Object.keys(balloon.add_file_menu_items);

    $menu.empty();
    $menuMobile.empty();

    for(i=0; i<keys.length; i++) {
      var item = balloon.add_file_menu_items[keys[i]];
      var label = i18next.t(item.label);

      var $item = $(
        '<li data-type=' + item.name + ' title="' + label + '">'+
            '<svg class="gr-icon gr-i-' + item.icon + '">'+
              '<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="'+iconsSvg+'#' + item.icon + '">'+
            '</svg>'+
            '<span> ' + label + '</span>'+
        '</li>'
      );

      $menu.append($item);

      var $itemMobile = $(
        '<li data-type=' + item.name + ' title="' + label + '">'+
            '<span> ' + label + '</span>'+
            '<svg class="gr-icon gr-i-arrowhead-e">'+
              '<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="'+iconsSvg+'#arrowhead-e">'+
            '</svg>'+
        '</li>'
      );

      $menuMobile.append($itemMobile);
    }
  },


  /**
   * show hint
   *
   * @return void
   */
  showHint: function() {
    var disabled = localStorage.noHint;
    if(disabled == "true") {
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
   * Push new hint to the store
   */
  addHint: function(key) {
    if(this.hints.indexOf(key) === -1) this.hints.push(key);
  },

  /**
   * show hint
   *
   * @return void
   */
  _showHint: function() {
    var hint  = Math.floor(Math.random() * this.hints.length);

    $('#fs-hint-window-content').html(i18next.t(this.hints[hint]));
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
      options.beforeSend = options.suppressSpinner !== true ? balloon.showSpinner : undefined;
    } else {
      var beforeSend = options.beforeSend;
      options.beforeSend = function(jqXHR, settings) {
        if(options.suppressSpinner !== true) balloon.showSpinner();
        beforeSend(jqXHR, settings);
      };
    }

    var complete = options.complete;
    options.complete = function(jqXHR, textStatus) {
      if(options.suppressSpinner !==true) balloon.hideSpinner();

      var valid = ['POST', 'PUT', 'DELETE', 'PATCH'],
        show  = options.suppressSnackbar !== true && (valid.indexOf(options.type) > -1);

      if(show && jqXHR.status.toString().substr(0, 1) === '2') {
        balloon.showSnackbar((options.snackbar || {}), jqXHR.responseJSON);
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
  showSnackbar: function(options, response) {
    var options = options || {};
    var $snackbar = $('#fs-snackbar');

    var icon = options.icon || 'check';
    var iconAction = options.iconAction || undefined;
    var message = options.message || 'snackbar.default';
    var values = options.values || {};

    $snackbar.find('.gr-icon').hide();
    $snackbar.find('.gr-i-' + icon).show();

    var $iconWrap = $snackbar.find('#fs-snackbar-icon');

    $iconWrap.removeClass('has-action');
    if(iconAction) $iconWrap.addClass('has-action');

    $iconWrap.off('click').on('click', function() {
      if(iconAction) iconAction(response);
    });

    var i18nextOptions = $.extend(values, {'interpolation': {'escapeValue': false}});
    $snackbar.find('#fs-snackbar-message').html(i18next.t(message, i18nextOptions));
    $snackbar.addClass('show');

    setTimeout(function() {
      $snackbar.removeClass('show');
    }, 3900);
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

    $('#fs-browser-tree').find('li[fs-type=folder]').not('[aria-selected="true"]').not('.fs-multiselected').addClass('fs-file-dropable');
    $('#fs-browser-top').find('li').addClass('fs-file-dropable');
    $('#fs-upload').addClass('fs-file-dropable');
    $('#fs-browser-tree').find('li[fs-type=file]').addClass('fs-file-disabled');

    var $itemCount = balloon.isMultiSelect() ? balloon.multiselect.length : 1;
    var clue = $('.k-drag-clue').html();

    clue = clue.substr(0, clue.search('</span>')+7);

    clue += '<svg viewBox="0 0 24 24" class="gr-icon gr-i-file-drag"><use xlink:href="'+iconsSvg+'#file-drag"></use></svg>';
    clue += '<div class="clue-item-count">' + $itemCount + '</span>';

    $('.k-drag-clue').html(clue);

    // Fix for safari, which does not register :hover while dragging
    // See: https://stackoverflow.com/questions/52133842/safari-only-css-hover-event-not-triggered-on-drag
    // Kendo ads a class, but unfortunately a bit deeper then needed
    $('.fs-file-dropable').off('mouseenter.fs-drag').on('mouseenter.fs-drag', function(event) {
      $(this).addClass('fs-file-dropable-hover');
    });

    $('.fs-file-dropable').off('mouseleave.fs-drag').on('mouseleave.fs-drag', function(event) {
      $(this).removeClass('fs-file-dropable-hover');
    });
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
      balloon._treeDblclick(undefined, true);
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
        balloon.handleAddNode('folder');
      }
      break;

      //add file (shift+a)
    case 65:
      if(e.shiftKey && !(balloon.isSearch() && balloon.getCurrentCollectionId() === null)) {
        balloon.handleAddNode('txt');
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
    $('.fs-file-dropable').off('mouseenter.fs-drag mouseleave.fs-drag');
    $('.fs-file-dropable-hover').removeClass('fs-file-dropable-hover');
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
    } else if(dest === undefined) {
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

    var source = balloon.getSelected(src);
    var parentId = balloon.getCurrentCollectionId();

    if(!Array.isArray(source)) {
      source = [source];
    }

    var moveSrc = [];

    for(var i=0; i<source.length; i++) {
      var src = source[i];
      moveSrc.push({
        id: src.id,
        name: src.name,
        parent: parentId
      });
    }

    balloon.move(moveSrc, dest);
    balloon.deselectAll();
  },


  /**
   * Kendo tree: dataBound event
   *
   * @param   object e
   * @return  void
   */
  _treeDataBound: function(e) {
    balloon.resetDom(['multiselect']);

    if((!balloon.isSearch() || balloon.getCurrentCollectionId() !== null) && balloon._evalToggleFsBrowserActionHooks()) {
      $('#fs-browser-action').show();
    } else {
      $('#fs-browser-action').hide();
    }

    var selected = balloon.getURLParam('selected'),
      $fs_browser_tree = $("#fs-browser-tree"),
      $k_tree = $fs_browser_tree.data('kendoTreeView'),
      select_match = false;

    $fs_browser_tree.find('.k-item').each(function() {
      var $that = $(this), node;
      node = balloon.datasource.getByUid($(this).attr('data-uid'));

      var order = ['icon', 'name', 'meta', 'size', 'changed', 'checkbox'];
      var metaOrder = ['color_tag', 'sharelink_token', 'deleted', 'readonly', 'destroy', 'subscription'];

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
          var size = balloon.nodeSize(node);
          $node_el.append('<div class="fs-browser-column fs-browser-column-size">'+size+'</div>');
          break;

        case 'meta':
          var meta_html_children = [];
          for(var metaProp in metaOrder) {
            switch(metaOrder[metaProp]) {
            case 'sharelink_token':
              if(node.sharelink_token) {
                meta_html_children.push('<div class="fs-node-state" title="' + i18next.t('tree.node_states.sharelink') + '"><svg class="gr-icon gr-i-hyperlink"><use xlink:href="'+iconsSvg+'#hyperlink"></use></svg></div>');
              }
              break;
            case 'deleted':
              if(node.deleted) {
                meta_html_children.push('<div class="fs-node-state" title="' + i18next.t('tree.node_states.deleted') + '"><svg class="gr-icon gr-i-trash"><use xlink:href="'+iconsSvg+'#trash"></use></svg></div>');
              }
              break;
            case 'readonly':
              if(node.readonly) {
                meta_html_children.push('<div class="fs-node-state" title="' + i18next.t('tree.node_states.readonly') + '"><svg class="gr-icon gr-i-lock"><use xlink:href="'+iconsSvg+'#lock"></use></svg></div>');
              }
              break;
            case 'destroy':
              if(node.destroy) {
                meta_html_children.push('<div class="fs-node-state" title="' + i18next.t('tree.node_states.destroy') + '"><svg class="gr-icon gr-i-flag"><use xlink:href="'+iconsSvg+'#flag"></use></svg></div>');
              }
              break;
            case 'subscription':
              if(node.subscription) {
                meta_html_children.push('<div class="fs-node-state" title="' + i18next.t('tree.node_states.subscription') + '"><svg class="gr-icon gr-i-volume-up"><use xlink:href="'+iconsSvg+'#volume-up"></use></svg></div>');
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

          if(balloon.id(node) !== '_FOLDERUP') {
            var sizeAndChanged = balloon.nodeSize(node) + ', ' + balloon.timeSince(new Date(node.changed), true);
            $name_el.append($(
              '<p class="fs-browser-column-name-size-changed" title="' + sizeAndChanged + '">' + sizeAndChanged + '</p>'
            ));
          }

          if(balloon.isSearch() && balloon.id(node) !== '_FOLDERUP') {
            var path = node.path.split('/').slice(1, -1);
            if(path.length === 0) path = [''];

            if(path.length > 5) {
              path = path.slice(path.length - 5);
              path.unshift('...');
            }

            var $path_el = $('<p class="fs-browser-column-name-path"></p>');

            path.forEach(function(item) {
              $path_el.append('<span> / </span><span>' + item + '</span>');
            });

            $name_el.append($path_el);
          }

          $node_el.append($name_el);
          break;

        case 'icon':
          var spriteClass = balloon.getSpriteClass(node);
          $node_el.append('<div class="fs-browser-column fs-browser-column-icon"><svg class="gr-icon  ' + spriteClass + '"><use xlink:href="'+iconsSvg+'#' + spriteClass.replace('gr-i-', '') + '"></use></svg></div>');
          break;

        case 'checkbox':
          var $checkbox = $('<div class="fs-browser-column fs-browser-column-checkbox"><span>&nbsp;</span></div>');

          $checkbox.on('click', function(event) {
            event.stopPropagation();

            var $k_tree = $('#fs-browser-tree').data('kendoTreeView');
            var selected = $k_tree.dataItem($k_tree.select());
            var dom_node = $fs_browser_tree.find('.k-item[fs-id='+balloon.id(node)+']');

            if(balloon.isMultiSelect()) {
              balloon.multiSelect(balloon.datasource._pristineData[node.index]);

              if(balloon.multiselect.length === 1) {
                var selected_dom_node = $fs_browser_tree.find('.k-item[fs-id='+balloon.id(balloon.multiselect[0])+']');
                balloon.deselectAll();

                $k_tree.select(selected_dom_node);
                $k_tree.trigger('select', {node: selected_dom_node});
                balloon.resetDom('multiselect');
              } else {
                var res = balloon.multiselect.filter(function(selectedNode) {
                  return selectedNode.id === node.id;
                });

                if(res.length === 0) {
                  $k_tree.select($());
                }
              }

              balloon.updatePannel(true);
            } else if(selected && selected.id !== node.id) {
              balloon.deselectAll();
              balloon.multiSelect(balloon.datasource._pristineData[node.index]);
              balloon.multiSelect(balloon.datasource._pristineData[selected.index]);
              $k_tree.select($());
              balloon.last = selected;
              balloon.updatePannel(true);
            } else if(selected && selected.id === node.id) {
              $k_tree.select($());
              balloon.updatePannel(false);
              balloon.resetDom('view-bar');
              balloon.last = null;
            } else if(!selected) {
              $k_tree.select(dom_node);
              $k_tree.trigger('select', {node: dom_node});
              balloon.updatePannel(true);
            }

            balloon._updateCheckAllState();
            balloon.pushState();
            balloon._updateFsContentSelectedState();
          });

          $node_el.append($checkbox);
          break;
        }
      }

      if(node.directory && balloon.id(node) !== '_FOLDERUP') {
        balloon.fileUpload(node);
      }

      if(balloon.added == balloon.id(node)) {
        select_match = node;
      }

      if(selected !== null && typeof(selected) === 'object' && selected.indexOf(balloon.id(node)) > -1) {
        if(selected.length > 1) {
          balloon.multiSelect(balloon.datasource._pristineData[node.index]);
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
    balloon._updateFsContentSelectedState();
    balloon.fileUpload(balloon.getCurrentCollectionId(), $('#fs-layout-left'));
  },


  _updateFsContentSelectedState: function() {
    var currentCollectionId = balloon.getCurrentCollectionId();

    $('body').removeClass('fs-content-multiselect-active fs-content-select-active');

    if(balloon.isMultiSelect()) {
      if(balloon.multiselect.length === 1) {
        $('body').addClass('fs-content-select-active');
      } else {
        $('body').addClass('fs-content-multiselect-active');
      }
    } else if(balloon.last && balloon.last.id !== currentCollectionId && balloon.isSystemNode(balloon.last) === false) {
      $('body').addClass('fs-content-select-active');
    }
  },

  /**
   * Kendo tree: select event
   *
   * @param   object e
   * @return  void
   */
  _treeSelect: function(e) {
    var id   = $(e.node).attr('data-uid'),
      dataSourceNode = balloon.datasource.getByUid(id),
      node;

    if(!dataSourceNode) return;

    node = dataSourceNode._childrenOptions.data;

    if(balloon.id(node) === balloon.id(balloon.last)) {
      balloon.last = node;
      return;
    }

    balloon.resetDom(
      ['metadata','preview','view-bar','properties',
        'history','share','share-link'
      ]);

    balloon._updateLastNode(node);

    if(balloon.isSystemNode(node) || balloon.isMultiSelect()) {
      e.preventDefault();
      return;
    }

    if(typeof(balloon.last_click_event) == 'object' && balloon.last_click_event.ctrlKey == false
    && balloon.last_click_event.metaKey == false && balloon.last_click_event.shiftKey == false) {
      balloon.multiSelect();
    }

    $(e.node).find('.k-in').addClass('k-state-selected');

    balloon._updateContentView(node);
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

    balloon._resolveHash(window.location.hash.substr(1)).then(function() {
      var collection = balloon.getURLParam('collection'),
        menu = balloon.getURLParam('menu');

      if(collection !== null) {
        balloon.menuLeftAction(menu, false);
        balloon.refreshTree('/collections/children', {id: collection}, null, {nostate: true});
      } else {
        balloon.menuLeftAction(menu, true, false);
      }

      if(e.originalEvent.state === null) {
        balloon.buildCrumb(collection);
      } else {
        balloon._repopulateCrumb(e.originalEvent.state.parents);
      }
    });
  },

  /**
   * Update last/previous node state
   *
   * @param   object node
   * @return  void
   */
  _updateLastNode: function(node) {
    var copy = balloon.last;
    balloon.last = node;

    if(!balloon.isSystemNode(copy)) {
      balloon.previous = copy;
    }
  },

  /**
   * Update the content view with a given node
   *
   * @param   object node
   * @return  void
   */
  _updateContentView: function(node) {
    balloon.resetDom([
      'selected',
      'metadata',
      'preview',
      'multiselect',
      'view-bar',
      'history',
      'share',
      'share-link',
    ]);

    var view  = balloon.getURLParam('view');

    if(balloon.previous !== null && balloon.previous.id !== balloon.last.id || view === null || balloon.last.id === '_FOLDERUP') {
      view = 'preview';
    }

    var views = [];
    var i;
    var keys = Object.keys(balloon.fs_content_views);

    for(i=0; i<keys.length; i++) {
      var viewConfig = balloon.fs_content_views[keys[i]];
      if(viewConfig.isEnabled && viewConfig.isEnabled()) {
        views.push(viewConfig.id);
      }
    }

    balloon.showView(views);
    balloon.switchView(view);
    $('#fs-properties-name').show();

    balloon.updatePannel(true);

    $('#fs-content-view dt').unbind('click').not('.disabled').click(function() {
      var $that = $(this),
        action = $that.attr('id').substr(22);

      if(balloon.getViewName() != action) {
        balloon.switchView(action);
      }
    });

    $('#fs-content-nav-small li').off('click').not('.disabled').click(function(event) {
      event.stopPropagation();
      event.preventDefault();

      var action = $(this).attr('id').substr(15);
      balloon.switchView(action, true);
      balloon.fsContentMobileNext();
    });

    $('.fs-content-view-back').off('click').click(function(event) {
      event.stopPropagation();
      event.preventDefault();

      $('#fs-content-view dd.active').removeClass('active');

      balloon.fsContentMobilePrev();
    });

    $('#fs-content-nav-small-more li').off('click').on('click', function(event) {
      event.stopPropagation();
      event.preventDefault();

      balloon.fsContentMobileNext();
    });
  },

  navigateTo: function(menu, collection, selected, view) {
    balloon.resetDom('multiselect');
    balloon.resetDom('breadcrumb');

    balloon.menuLeftAction(menu, false);

    var $d = balloon.refreshTree('/collections/children', {id: collection}, null, {nostate: true});
    var $dCrumb = balloon.buildCrumb(collection);

    $.when($d, $dCrumb).done(function() {
      if(selected) {
        balloon.last = selected;
        balloon.scrollToNode(selected);

        var $k_tree = $('#fs-browser-tree').data('kendoTreeView');
        var dom_node = $('#fs-browser-tree').find('.k-item[fs-id='+balloon.id(selected)+']');

        $k_tree.select(dom_node);
        $k_tree.trigger('select', {node: dom_node});
        balloon.updatePannel(true);
      }

      balloon.pushState(false, false);
    });

    return $d;
  },

  reloadTree: function() {
    var menu = balloon.getCurrentMenu();
    var collection =  balloon.getCurrentCollectionId();
    var node = balloon.getCurrentNode();

    if(balloon.isSearchResult() && collection === null) {
      return balloon.buildExtendedSearchQuery();
    } else if(!collection) {
      return balloon.menuLeftAction(menu, true).then(function() {
        if(node) {
          balloon.last = node;
          balloon.scrollToNode(node);

          var $k_tree = $('#fs-browser-tree').data('kendoTreeView');
          var dom_node = $('#fs-browser-tree').find('.k-item[fs-id='+balloon.id(node)+']');

          $k_tree.select(dom_node);
          $k_tree.trigger('select', {node: dom_node});
          balloon.updatePannel(true);
        }
      });
    } else {
      return balloon.navigateTo(menu, collection, node);
    }
  },

  scrollToNode: function(node) {
    var $node = $('li[fs-id="' + balloon.id(node) + '"]');

    if(!$node || $node.length === 0) return;

    $('#fs-layout-left').animate({
      scrollTop: ($node.offset().top - 70)
    }, 1000);
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

    return balloon.xmlHttpRequest({
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

    var menu = balloon.getCurrentMenu();
    if(menu !== 'cloud') {
      balloon.setSearchCrumbTitle(menu);
    }

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
    var view = null;

    var menu = balloon.getMenuName();
    var collection = balloon.getCurrentCollectionId() || balloon.defaultUrlParams['collection'];

    if(reset_selected !== true) {
      if(balloon.isMultiSelect()) {
        selected = balloon.getSelected();
      } else {
        selected.push(balloon.getSelected());
      }

      //remove current collection from selection
      selected = selected.filter(function(node) {
        return node !== null && node.id !== collection;
      });

      for(var node in selected) {
        list.push(selected[node].id);
      }
    } else {
      balloon.last = null;
      balloon.previous = null;
    }

    var exec = replace === true ? 'replaceState' : 'pushState';

    if(selected.length > 0) {
      var curViewId = $('#fs-content-view dd.active').attr('id');
      view = curViewId ? curViewId.replace('fs-', '') : balloon.defaultUrlParams.view;
    }

    var url = balloon._buildUrl(menu, collection, view, list);

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
   * Create url
   *
   * @param string  menu
   * @param string  collection
   * @param string  view
   * @param Array  list array of selected id's
   * @param booelan  excludeHash
   * @return  string
   */
  _buildUrl: function(menu, collection, view, list, excludeHash) {
    if(!menu) menu = balloon.defaultUrlParams.menu;
    if(!view) view = balloon.defaultUrlParams.view;
    if(!collection) collection = balloon.defaultUrlParams.collection;
    if(!list || list.length === 0) list = [];

    var urlParts = [menu, collection];

    if(list.length > 0) {
      urlParts.push(view);
      urlParts.push(list.join(balloon.URL_PARAM_SELECTED_SEPARATOR));
    }

    return (excludeHash ? '' : '#') + urlParts.join('/');
  },


  /**
   * Create perma link for a given node
   *
   * @param string  id
   * @param booelan  excludeOrigin
   * @return  string
   */
  _buildPermaLink: function(id, excludeOrigin) {
    return (excludeOrigin ? '' : window.location.origin) + '/#share/' + id;
  },

  /**
   * Read query string param
   *
   * @param   string key
   * @return  mixed
   */
  getURLParam: function(key) {
    var values = [];
    var target = document.location.hash.substr(1);
    var defaultParam = balloon.defaultUrlParams[key];

    if(target.length === 0) {
      return key === 'view' || key === 'collection' ? null : defaultParam;
    }

    var urlParts = target.split('/');

    if(urlParts[3]) {
      urlParts[3] = urlParts[3].split(balloon.URL_PARAM_SELECTED_SEPARATOR) || balloon.defaultUrlParams['selected'];
    }

    switch(key) {
    case 'menu':
      values = urlParts[0];
      break;
    case 'collection':
      values = urlParts[1] === defaultParam ? null : urlParts[1];
      break;
    case 'view':
      if(urlParts[3] !== balloon.defaultUrlParams['selected']) {
        values = urlParts[2] || defaultParam;
      } else {
        values = null;
      }
      break;
    case 'selected':
      values = urlParts[3];
      break;
    }

    return values;
  },

  /**
   * Base64 encode
   */
  base64Encode: function(str) {
    var CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var out = "", i = 0, len = str.length, c1, c2, c3;
    while (i < len) {
      c1 = str.charCodeAt(i++) & 0xff;
      if (i == len) {
        out += CHARS.charAt(c1 >> 2);
        out += CHARS.charAt((c1 & 0x3) << 4);
        out += "==";
        break;
      }
      c2 = str.charCodeAt(i++);
      if (i == len) {
        out += CHARS.charAt(c1 >> 2);
        out += CHARS.charAt(((c1 & 0x3)<< 4) | ((c2 & 0xF0) >> 4));
        out += CHARS.charAt((c2 & 0xF) << 2);
        out += "=";
        break;
      }
      c3 = str.charCodeAt(i++);
      out += CHARS.charAt(c1 >> 2);
      out += CHARS.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
      out += CHARS.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6));
      out += CHARS.charAt(c3 & 0x3F);
    }
    return out;
  },

  /**
   * Calls api to change password for current user
   *
   * @param string password
   * @param string oldPassword
   * @return void
   */
  _changePassword(password, oldPassword) {
    var data = {
      password: password
    };

    var options = {
      url: balloon.base+'/users/' + login.user.id,
      type: 'PATCH',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success: function(body) {
        if(login.getAdapter() === 'basic') {
          login.doBasicAuth(login.user.username, password);
        }
      }
    };

    if(login.getAdapter() !== 'basic') {
      options.password = oldPassword;
      options.username = login.user.username;
      options.disableToken = true;
    }

    return balloon.xmlHttpRequest(options);
  },

  displayAvatar: function($avatar, userId) {
    $avatar.css('background-image', '').removeClass('has-avatar');

    balloon.xmlHttpRequest({
      url: balloon.base+'/users/'+userId+'/avatar',
      type: 'GET',
      mimeType: "text/plain; charset=x-user-defined",
      cache: false,
      success: function(body) {
        $avatar.addClass('has-avatar').css('background-image', 'url(data:image/jpeg;base64,'+balloon.base64Encode(body)+')');
      },
      error: function() {
        $avatar.css('background-image', '').removeClass('has-avatar');
      }
    });;
  },

  /**
   * Display user profile
   *
   * @return void
   */
  displayUserProfile: function() {
    balloon.resetDom('user-profile');

    //change password should only be possible for internal users
    var mayChangePassword = (login.user && login.user.auth === 'internal');
    $('#fs-profile-window-title-change-password').toggleClass('disabled', !mayChangePassword);
    $('#fs-profile-window-change-password').toggleClass('disabled', !mayChangePassword);

    var mayActivate2FA = (login.getAdapter() !== 'basic' && login.user && login.internalIdp === true);
    $('#fs-profile-window-title-google-authenticator').toggleClass('disabled', !mayActivate2FA);
    $('#fs-profile-window-change-google-authenticator').toggleClass('disabled', !mayActivate2FA);

    $('#fs-profile-window dl dt').not('.disabled').off('click').on('click', function(event) {
      var view = $(this).attr('id').substr(24);
      balloon._userProfileNavigateTo(view);
    });

    balloon._userProfileNavigateTo('overview');

    var $fs_profile_win = $('#fs-profile-window');
    $fs_profile_win.kendoBalloonWindow({
      title: $fs_profile_win.attr('title'),
      resizable: false,
      modal: true,
      open: function() {

      }
    }).data("kendoBalloonWindow").center().open();
  },

  /**
   * Navigates to a given view in the profile window
   *
   * @param   string view
   * @return  void
   */
  _userProfileNavigateTo: function(view) {
    $('#fs-profile-window dl > *').removeClass('active');

    $('#fs-profile-window-title-'+view).addClass('active');
    $('#fs-profile-window-'+view).addClass('active');

    switch(view) {
    case 'overview':
      balloon._displayUserProfileOverview();
      break;
    case 'change-password':
      balloon._displayUserProfileChangePassword();
      break;
    case 'google-authenticator':
      balloon._displayUserProfileGoogleAuthenticator();
      break;
    }

  },

  /**
   * Displays the profile overview
   *
   * @return  void
   */
  _displayUserProfileOverview: function() {
    $('#fs-profile-user').find('tr').remove();
    balloon.displayAvatar($('#fs-profile-avatar'), login.user.id);

    balloon.xmlHttpRequest({
      url: balloon.base+'/users/whoami',
      type: 'GET',
      success: function(body) {
        // Quota
        var used = balloon.getReadableFileSizeString(body.used);
        var max;
        var free;
        var percentage;
        var percentageText;

        if(body.hard_quota === -1) {
          max = i18next.t('profile.quota_unlimited');
          free = max;
          percentage = 0;
          percentageText = max;
        } else {
          percentage = Math.round(body.used/body.hard_quota*100);
          percentageText = percentage + '%';

          max  = balloon.getReadableFileSizeString(body.hard_quota),
          free = balloon.getReadableFileSizeString(body.hard_quota - body.used);
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
          case 'hard_quota':
          case 'soft_quota':
          case 'available':
            break;

          case 'used':
            var used = balloon.getReadableFileSizeString(body.used);
            var max;
            var free;

            if(body.hard_quota === -1) {
              $fs_quota_usage.hide();
              max = i18next.t('profile.quota_unlimited');
              free = max;
            } else {
              var percentage = Math.round(body.used/body.hard_quota*100);
              $k_progress.value(percentage);

              if(percentage >= 90) {
                $fs_quota_usage.find('.k-state-selected').addClass('fs-quota-high');
              } else {
                $fs_quota_usage.find('.k-state-selected').removeClass('fs-quota-high');
              }

              max  = balloon.getReadableFileSizeString(body.hard_quota),
              free = balloon.getReadableFileSizeString(body.hard_quota - body.used);
            }

            $('#fs-profile-quota-used').find('td').html(used);
            $('#fs-profile-quota-max').find('td').html(max);
            $('#fs-profile-quota-left').find('td').html(free);
            break;
          default:
            $table.append('<tr><th>'+i18next.t('profile.attribute.'+attribute)+'</th><td>'+value+'</td></tr>')
            break;
          }
        }
      }
    });
  },

  /**
   * Displays the change password screen
   *
   * @return  void
   */
  _displayUserProfileChangePassword: function() {
    var formValid = false;
    var $view = $('#fs-profile-window-change-password');
    var $btnSave = $view.find('input[name="save"]').attr('disabled', true);;
    var $inputRepeatPw = $view.find('input[name="password_repeat"]').val('');
    var $inputPw = $view.find('input[name="password"]').val('');
    var $inputPwOld = $view.find('input[name="password_old"]').val('');

    $view.find('#fs-profile-window-change-password-form-password-old-wrap').toggle(login.getAdapter() !== 'basic');

    $('#fs-profile-window-change-password-buttons').show();
    $('#fs-profile-window-change-password-form').show();
    $('#fs-profile-window-change-password-success').hide();
    $view.find('input').removeClass('error-input');
    $inputPwOld.focus();

    var fieldsValid = {
      password: false,
      password_repeat: false,
      password_old: false,
    };

    if(login.getAdapter() === 'basic') {
      fieldsValid['password_old'] = true;
    }

    $view.find('input[type="password"]').off('keyup blur').on('keyup blur', function(event) {
      var $this = $(this);
      var fieldName = $this.attr('name');

      if(event.keyCode && event.keyCode === 13) {
        if(formValid) $btnSave.click();
        return;
      }

      if(event.keyCode && event.keyCode === 9) {
        //validating on tab out is performed by blur to get correct fieldName
        return;
      }

      if($this.val() === '') {
        fieldsValid[fieldName] = false;
      } else {
        fieldsValid[fieldName] = true;
        $inputRepeatPw.removeClass('error-input');

        if(
          fieldName !== 'password_old' && $inputRepeatPw.val() !== ''
          && $inputPw.val()!== '' && $inputRepeatPw.val() !== $inputPw.val()
        ) {
          fieldsValid['password_repeat'] = false;
          $inputRepeatPw.addClass('error-input');
        }
      }

      $this.toggleClass('error-input', !fieldsValid[fieldName]);

      formValid = Object.keys(fieldsValid).every(function(key) {
        return fieldsValid[key] === true;
      });

      $btnSave.attr('disabled', !formValid);
    });

    $btnSave.off('click').on('click', function(event){
      event.preventDefault();

      var password = $inputPw.val();
      var oldPassword = $inputPwOld.val();

      balloon._changePassword(password, oldPassword).then(function() {
        $('#fs-profile-window-change-password-buttons').hide();
        $('#fs-profile-window-change-password-form').hide();
        $('#fs-profile-window-change-password-success').show();
      });
    });
  },

  /**
   * Displays the google authenticator screen
   *
   * @return  void
   */
  _displayUserProfileGoogleAuthenticator: function() {
    var $view = $('#fs-profile-window-google-authenticator');
    var $buttons = $view.find('#fs-profile-window-google-authenticator-buttons');
    var $code = $view.find('#fs-profile-window-google-authenticator-qr');
    var $secret = $view.find('#fs-profile-window-google-authenticator-secret');
    var $hintInactive = $view.find('#fs-profile-window-google-authenticator-hint-incative').hide();
    var $hintActive = $view.find('#fs-profile-window-google-authenticator-hint-active').hide();
    var $btnActivate = $buttons.find('input[name="activate"]').hide();
    var $btnDeactivate = $buttons.find('input[name="deactivate"]').hide();

    $code.find('canvas').remove();
    $secret.html('');
    $secret.off('click');

    if(login.user.multi_factor_auth === false) {
      $btnActivate.show();
      $hintInactive.show();
    } else {
      $btnDeactivate.show();
      $hintActive.show();
    }

    $btnActivate.off('click').on('click', function(event) {
      event.preventDefault();

      var msg  = i18next.t('profile.google-authenticator.confirm.activate');

      balloon.promptConfirm(msg, function() {
        var data = {
          multi_factor_auth: true
        };

        $btnActivate.hide();

        balloon.xmlHttpRequest({
          url: balloon.base+'/users/' + login.user.id,
          type: 'PATCH',
          dataType: 'json',
          contentType: 'application/json',
          data: JSON.stringify(data),
          success: function(body) {
            var qrCodeSetting = {
              size: 200,
              ecLevel: ecLevel.QUARTILE,
              minVersion: 8,
              background: '#fff',
              fill: '#39a5ff',
              mode: modes.NORMAL,
              radius: 0,
              mSize: 0.15,
            };

            login.user.multi_factor_auth = true;

            var qrCode = new qrcode($code[0]);
            qrCode.generate(body.multi_factor_uri, qrCodeSetting);

            var secret = body.multi_factor_uri.match(/secret=([A-Z0-9]*)&/)[1];
            $secret.html(secret);

            $secret.on('click', function() {
              balloon.copyToClipboard(secret);

              balloon.showSnackbar({message: 'profile.google-authenticator.secret_copied'});
            });

            $btnDeactivate.show();
          }
        });
      });
    });

    $btnDeactivate.off('click').on('click', function(event) {
      event.preventDefault();

      var msg  = i18next.t('profile.google-authenticator.confirm.deactivate');

      balloon.promptConfirm(msg, function() {
        var data = {
          multi_factor_auth: false
        };

        $btnDeactivate.hide();
        $code.find('canvas').remove();
        $secret.html('');
        $secret.off('click');

        balloon.xmlHttpRequest({
          url: balloon.base+'/users/' + login.user.id,
          type: 'PATCH',
          dataType: 'json',
          contentType: 'application/json',
          data: JSON.stringify(data),
          success: function(body) {
            $btnActivate.show();
            $hintActive.hide();
            $hintInactive.show();

            login.user.multi_factor_auth = false;
          }
        });
      });
    });



  },

  /**
   * Get and display event log
   *
   * @param   object $dom
   * @param   object|string node
   * @param   object params request params
   * @return  void
   */
  displayEvents: function($dom, node, params) {
    if(balloon._event_limit === true) return;

    var data = params || {};

    if(data.limit === undefined) data.limit = balloon.EVENTS_PER_REQUEST;

    if(node !== undefined) data.id = balloon.id(node);

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

    return balloon.xmlHttpRequest({
      url: balloon.base+'/nodes/event-log',
      data: data,
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

        if(body.data.length === 0 && (data.offset === undefined || data.offset === 0)) {
          $dom.append('<li>'+i18next.t('events.no_events')+'</li>');
          return;
        }

        for(var log in body.data) {
          if(body.data[log].user === null) {
            username = '<user removed>';
          } else if(body.data[log].user.name == login.user.username) {
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
            icon = 'text-edit';
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

          $icon = $('<div class="fs-events-icon"><svg class="gr-icon"><use xlink:href="'+iconsSvg+'#undo"></use></svg></div>');
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

          var app = null;
          if(body.data[log].client) {
            app = body.data[log].client.type;

            if(body.data[log].client.app !== null) {
              app = body.data[log].client.app;
            }
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
            var that = this;
            $undo = $('<div class="fs-events-undo"><svg class="gr-icon gr-i-undo"><use xlink:href="'+iconsSvg+'#undo"></use></svg></div>').unbind('click').bind('click',
              body.data[log], function(e) {
                balloon.alertOpenFile(function() {
                  balloon._undoEvent.apply(that, [e, node]);
                });
              });
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
   * @param  object|string node
   * @param  object params
   * @return void
   */
  displayEventsInfiniteScroll: function($list, node, params) {
    balloon._event_limit = false;
    var offset = 0;

    params = params || {};

    $list.unbind('scroll').bind('scroll', function() {
      if(($list.scrollTop() + 700) >= $list[0].scrollHeight) {
        offset = offset + balloon.EVENTS_PER_REQUEST;
        params.offset = offset;
        params.limit = balloon.EVENTS_PER_REQUEST;
        balloon.displayEvents($list.find('ul'), node, params);
      }
    });
  },


  /**
   * Display events
   *
   * @return void
   */
  displayEventsWindow: function(node) {
    var $fs_event_win   = $('#fs-event-window'),
      $fs_event_list  = $fs_event_win.find('#fs-events-window-list'),
      $fs_event_list_ul  = $fs_event_list.find('ul'),
      $fs_event_search = $fs_event_win.find('input[name=event-log-search]');

    $fs_event_list_ul.empty();

    if($fs_event_win.is(':visible')) {
      balloon.displayEventsInfiniteScroll($fs_event_list, node);
      balloon.displayEvents($fs_event_list_ul, node);
    } else {
      balloon.displayEventsInfiniteScroll($fs_event_list, node);

      $fs_event_win.kendoBalloonWindow({
        title: $fs_event_win.attr('title'),
        resizable: false,
        modal: true,
        open: function() {
          balloon.displayEvents($fs_event_list_ul, node);
        }
      }).data("kendoBalloonWindow").center().open();
    }

    $fs_event_search.off('keyup').on('keyup', function(e) {
      var value = $(this).val();

      if(value.length >= 3) {
        var params = {query: {'$or': [
          {name: value},
          {'previous.name': value}
        ]}};

        $fs_event_list_ul.empty();
        balloon.displayEventsInfiniteScroll($fs_event_list, node, params);
        balloon.displayEvents($fs_event_list_ul, node, params);
      } else if(e.keyCode === 8 && value.length === 2) {
        $fs_event_list_ul.empty();
        balloon.displayEventsInfiniteScroll($fs_event_list, node);
        balloon.displayEvents($fs_event_list_ul, node);
      }
    });
  },


  /**
   * Undo event
   *
   * @param  object e
   * @param  object node
   * @return void
   */
  _undoEvent: function(e, node) {
    var successAction;
    if($('#fs-event-window.k-window-content').is(':visible')) {
      successAction = {
        action: 'displayEventsWindow',
        params: [node]
      };
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
          action: '_deleteShare',
          params: [e.data.node]
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
          params: [e.data.node.id, e.data.previous.name, true]
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
   * Get menu title
   *
   * @return string
   */
  getMenuTitle: function() {
    return $('.fs-menu-left-active').attr('title');
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

    case 'logout':
      //avoid unauthorized requests
      $(window).unbind('popstate');
      login.replaceState('');
      login.logout();
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
   * Add menu
   */
  addNew: function(name, label, icon, callback) {
    this.add_file_menu_items[name] = {
      name: name,
      label: label,
      icon: icon,
      callback: callback
    };
  },

  /**
   * Add file handler
   *
   * @param string app
   * @param string|function ext
   * @param function handler
   * @param object context
   */
  addFileHandler: function(handler) {
    var checksum = JSON.stringify(handler);

    for(let handle of balloon.file_handlers) {
      if(JSON.stringify(handle) === checksum) {
        return;
      }
    }

    balloon.file_handlers.push(handler);
  },

  /**
   * Open file
   *
   * @var object node
   */
  openFile: function(node) {
    var ext = this.getFileExtension(node);
    var result = [];

    for(let handler of this.file_handlers) {
      if(typeof handler.test === 'function' && handler.test(node) === true || handler.ext === ext) {
        result.push(handler);
      }
    }

    let defaultApps = {};
    if(localStorage.defaultApps) {
      defaultApps = JSON.parse(localStorage.defaultApps);
    }

    if(result.length === 0) {
      balloon.promptConfirm(i18next.t('tree.no_handler_found', node.name), function() {
        balloon.downloadNode(node);
      });
    } else if(result.length === 1) {
      result[0].handler(node, result[0].context);
    } else if(defaultApps[ext] && result[defaultApps[ext]]) {
      let handler = result[defaultApps[ext]];
      handler.handler(node, handler.context);
    } else {
      balloon.chooseFileHandler(node, result);
    }
  },

  /**
   * Choose file handler
   *
   * @param object node
   * @param array handlers
   */
  chooseFileHandler: function(node, handlers) {
    var $div = $('#fs-file-handler-window');
    $div.find('li').remove();
    var $ul = $div.find('ul');
    $div.find('div:first-child').html(i18next.t('tree.choose_handler_text', node.name));

    for(let i=0; i < handlers.length; i++) {
      let img = '';

      if(handlers[i].appIcon) {
        img = '<img src="'+handlers[i].appIcon+'" alt="" />';
      }

      $ul.append('<li data-handler="'+i+'">'+img+handlers[i].app+'</li>');
    }

    var $k_display = $div.kendoBalloonWindow({
      resizable: false,
      title: i18next.t('tree.choose_handler'),
      modal: true,
      draggable: false,
    }).data('kendoBalloonWindow').center().open();

    $ul.find('li:first-child').addClass('active');

    $ul.off('click').on('click', 'li', function() {
      $ul.find('li').removeClass('active');
      $(this).toggleClass('active');
    });

    $div.find('input[type=button]').off('click').on('click', function() {
      $k_display.close();
    });

    var $checkbox = $div.find('.checkbox').removeClass('active');

    $div.find('input[type=submit]').off('click').on('click', function() {
      let index = $ul.find('li.active').attr('data-handler');
      let handler = handlers[index];
      $k_display.close();
      handler.handler(node, handler.context);

      if($checkbox.hasClass('active')) {
        let defaultApps = {};
        if(localStorage.defaultApps) {
          defaultApps = JSON.parse(localStorage.defaultApps);
        }

        defaultApps[handler.ext || balloon.getFileExtension(node)] = index;

        localStorage.defaultApps = JSON.stringify(defaultApps);
      }
    });

    $checkbox.off('click').on('click', function() {
      $(this).toggleClass('active');
    });
  },

  /**
   * Add menu
   */
  addMenu: function(name, label, icon, callback) {
    this.menu_left_items[name] = {
      name: name,
      label: label,
      icon: icon,
      callback: callback
    };
  },

  /**
   * Add identity menu
   */
  addIdentityMenu: function(name, menu) {
    this.identity_menu_items[name] = $.extend({name: name}, menu);
  },

  /**
   * Add content view
   */
  addContentView: function(id, title, isEnabled, onActivate, $content) {
    this.fs_content_views[id] = {
      id: id,
      title: title,
      isEnabled: isEnabled,
      onActivate: onActivate,
      $content: $content
    };
  },


  /**
   * Main menu
   *
   * @return void
   */
  menuLeftAction: function(menu, exec, changeState) {
    var $d;
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

    balloon.updatePannel(false);
    balloon.resetDom(['search']);

    if(action === 'cloud') {
      balloon.resetDom('breadcrumb-home');
      $('#fs-crumb-search-list').hide();
      $('#fs-crumb-home-list').show();
      $('#fs-browser-header .fs-browser-column-icon').children().show();
    } else {
      balloon.resetDom('breadcrumb-search');
      $('#fs-crumb-home-list').hide();
      $('#fs-crumb-search-list').show();
      $('#fs-browser-header .fs-browser-column-icon').children().hide();

      balloon.setSearchCrumbTitle(action);
    }

    if(changeState !== false) {
      balloon.pushState(false, true);
    }

    if(exec === false) {
      return $.Deferred().resolve().promise();
    }

    balloon.slideout.close();

    if(action in balloon.menu_left_items) {
      $d = balloon.menu_left_items[action].callback();
    } else {
      $d = $.Deferred().reject().promise();
    }

    return $d;
  },

  /**
   * Sets the title in the search crumb
   *
   * @return void
   */
  setSearchCrumbTitle: function(menu) {
    var title = balloon.getMenuTitle();

    if(menu === 'search') {
      title = i18next.t('menu.' + menu);
    }

    $('#fs-crumb-search').html(title);
  },


  /**
   * Switch view
   *
   * @return void
   */
  switchView: function(view, visibleMobile) {
    $('#fs-content-view-wrap').removeClass('mobile-overlay-in-from-right').removeClass('mobile-overlay-out-to-right');
    $('#fs-content-view').find('dt,dd').removeClass('active');
    var $title = $('#fs-content-view-title-'+view).addClass(['active']);
    $title.next().addClass('active');

    if(visibleMobile) {
      $('#fs-content-view-wrap').addClass('mobile-overlay-in-from-right');
    }

    var viewConfig = balloon._getViewConfig(view);

    if(viewConfig.onActivate) viewConfig.onActivate.call(this);

    balloon.displayName(balloon.getCurrentNode());
    balloon.pushState();
  },


  /**
   * Gets the config for a given view
   *
   * @param   string id of the view
   * @return  object
   */
  _getViewConfig: function(view) {
    return balloon.fs_content_views[view] || null;
  },

  /**
   * Display help
   *
   * @return void
   */
  displayHelpWindow: function() {
    var i,
      $fs_help_win = $('#fs-help-window'),
      $ul = $fs_help_win.find('ul');

    $ul.empty();

    for(i=0; i<this.hints.length; i++) {
      $ul.append('<li>' + i18next.t(this.hints[i]) + '</li>');
    }

    $fs_help_win.kendoBalloonWindow({
      title: $fs_help_win.attr('title'),
      resizable: false,
      modal: true,
    }).data("kendoBalloonWindow").center().open();
  },


  /**
   * Display Properties
   *
   * @param   object node
   * @return  void
   */
  displayProperties: function(node) {
    balloon.resetDom('properties');

    if(!node) return;

    var $fs_properties = $('#fs-properties');
    var $fs_readonly = $fs_properties.find('input[name=readonly]');
    var $fs_destroy_date_preview = $fs_properties.find('#fs-properties-destroy-date-preview');
    var $fs_destroy_date_set = $fs_properties.find('#fs-properties-destroy-date-set');
    var $fs_destroy_date_edit = $fs_properties.find('#fs-properties-destroy-date-edit');

    $('#fs-properties').off('focusout').on('focusout', 'textarea,input[type="text"],select', balloon._saveMetaAttributes);

    if(node.destroy !== undefined) {
      var formatedDate = kendo.toString(new Date(node.destroy), kendo.culture().calendar.patterns.g);

      $fs_destroy_date_preview.html(formatedDate);
      $fs_destroy_date_set.hide();
      $fs_destroy_date_edit.show();
    } else {
      $fs_destroy_date_preview.html('');
      $fs_destroy_date_set.show();
      $fs_destroy_date_edit.hide();
    }

    $fs_readonly.prop('checked', node.readonly);

    $fs_readonly.off('change').on('change', function() {
      balloon.xmlHttpRequest({
        url: balloon.base+'/nodes',
        type: 'PATCH',
        data: {
          id: balloon.id(node),
          readonly: $fs_readonly.prop('checked')
        },
        success: function(data) {
          node.readonly = data.readonly;
          balloon.reloadTree();
        }
      });
    });

    $fs_properties.find('button').off('click').on('click', balloon.showDestroyDate);

    for(var meta_attr in node.meta) {
      $('#fs-properties-'+meta_attr).val(node.meta[meta_attr]);
    }
  },

  /**
   * Opens modal for setting the destoy date of the current node
   *
   * @return void
   */
  showDestroyDate: function() {
    var node = balloon.getCurrentNode();

    if(!node) return;

    var $fs_destroy_date_win = $('#fs-destroy-date-window');

    var $k_win = $fs_destroy_date_win.kendoBalloonWindow({
      title: i18next.t('view.properties.destroy_date_window.title'),
      resizable: false,
      modal: true,
      open: function() {
        var $k_fs_destroy_date = $fs_destroy_date_win.find('input[name=destroy_date]').val('').kendoBalloonDatePicker({
          format: kendo.culture().calendar.patterns.d,
          min: new Date(),
        }).data('kendoBalloonDatePicker');

        var $k_fs_destroy_time = $fs_destroy_date_win.find('input[name=destroy_time]').val('').kendoBalloonTimePicker({
          format: kendo.culture().calendar.patterns.t
        }).data('kendoBalloonTimePicker');

        if(node.destroy) {
          var curDate = new Date(node.destroy);
          var curTime = new Date(0);

          curTime.setHours(curDate.getHours());
          curTime.setMinutes(curDate.getMinutes());

          curDate.setHours(0);
          curDate.setMinutes(0);

          $k_fs_destroy_date.value(curDate);
          $k_fs_destroy_time.value(curTime);
        }

        $fs_destroy_date_win.find('input:submit').unbind().click(function() {
          var ts = null;
          var date = $k_fs_destroy_date.value();
          var time = $k_fs_destroy_time.value();

          if(date !== null) {
            date.setHours(0);
            date.setMinutes(0);
            date.setSeconds(0);
          }

          if(date !== null && time !== null) {
            date.setTime(date.getTime() + ((time.getHours() * 60 + time.getMinutes()) * 60 * 1000));
          }

          if(date != null) {
            ts = Math.round(date.getTime() / 1000);
          }

          balloon._setDestroy(node, ts, $k_win);
        });

        $fs_destroy_date_win.find('input:button').unbind().click(function() {
          $k_win.close();
        });
      }
    }).data('kendoBalloonWindow').center().open();
  },



  /**
   * Set self destroy node
   *
   * @param object node
   * @param null|integer ts
   */
  _setDestroy: function(node, ts, $k_win) {
    var curTs = (new Date(node.destroy)).getTime() / 1000;
    var $d = $.Deferred();

    if(ts !== curTs) {
      if(ts === null) {
        balloon.selfDestroyNode(node, ts, $k_win, $d);
      } else {
        var dateHr = kendo.toString(new Date(ts * 1000), kendo.culture().calendar.patterns.g)
        var msg  = i18next.t('view.properties.prompt_destroy', dateHr, node.name);
        balloon.promptConfirm(msg, 'selfDestroyNode', [node, ts, $k_win]).then(function() {
          $d.resolve();
        }, function() {
          $d.resolve();
        });
      }
    } else {
      if($k_win) {
        $k_win.close();
      }
      $d.resolve();
    }

    return $d;
  },


  /**
   * Set self destroy node
   *
   * @param object node
   * @param null|integer ts
   */
  selfDestroyNode: function(node, ts, $k_win) {
    var url;

    var $d = $.Deferred();

    if(ts !== null) {
      url = balloon.base+'/nodes?id='+balloon.id(node)+'&'+'at='+ts;
    } else {
      url = balloon.base+'/nodes?id='+balloon.id(node)+'&at=0';
    }

    balloon.xmlHttpRequest({
      url: url,
      type: 'DELETE',
      complete: function() {
        if($k_win) {
          $k_win.close();
        }

        $d.resolve();

        node.destroy = ts === null ? undefined : (new Date(ts * 1000)).toISOString();
        balloon.displayProperties(node);
      }
    });

    return $d;
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
   * touch end from a tree node
   *
   * @param   object e
   * @return  void
   */
  _treeTouchEnd: function(e) {
    if(balloon.touch_move) {
      e.preventDefault();
    }

    balloon.touch_move = false;
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
    var $target = $(e.target);

    balloon.previous_clicked_id = balloon.last_clicked_id;
    balloon.last_clicked_id = $target.attr('fs-id') || $target.parents('[fs-id]').attr('fs-id');

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
    } else if(balloon.last && balloon.last.id === '_FOLDERUP') {
      balloon._folderUp();
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
    var currentCollectionId = balloon.getCurrentCollectionId();

    if(currentCollectionId !== null) {
      nodeCount--;
    }

    $fs_browser_header_checkbox.removeClass('fs-browser-header-checkbox-checked');
    $fs_browser_header_checkbox.removeClass('fs-browser-header-checkbox-undetermined');

    if(balloon.isMultiSelect()) {
      if(balloon.multiselect.length === nodeCount) {
        $fs_browser_header_checkbox.addClass('fs-browser-header-checkbox-checked');
      } else {
        $fs_browser_header_checkbox.addClass('fs-browser-header-checkbox-undetermined');
      }
    } else if(balloon.last && balloon.last.id !== currentCollectionId && balloon.isSystemNode(balloon.last) === false) {
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
   * navigates to the parent folder
   *
   * @return  void
   */
  _folderUp: function() {
    var params = {},
      id   = balloon.getPreviousCollectionId();

    if(id !== null) {
      params.id = id;
      balloon.refreshTree('/collections/children', params, null, {action: '_FOLDERUP'});
    } else if(balloon.isSearchResult()) {
      balloon.resetDom('breadcrumb-search');
      return balloon.buildExtendedSearchQuery();
    } else {
      balloon.menuLeftAction(balloon.getCurrentMenu());
    }
  },

  /**
   * treeview dblclick
   *
   * @param   object e
   * @return  void
   */
  _treeDblclick: function(e, force) {
    if(!force && balloon.previous_clicked_id !== balloon.last_clicked_id) {
      //this was a "double click" on two different nodes
      return;
    }

    $('body').removeClass('fs-content-multiselect-active fs-content-select-active');

    if(balloon.last.directory === true) {
      balloon.resetDom('selected');
    }

    if(balloon.last !== null && balloon.last.directory) {
      balloon.updatePannel(false);

      var $k_tree = $("#fs-browser-tree").data("kendoTreeView");

      if(balloon.last.id == '_FOLDERUP') {
        balloon._folderUp();
      } else {
        balloon.refreshTree('/collections/children', {id: balloon.getCurrentNode().id}, null, {action: '_FOLDERDOWN'});
      }

      balloon.resetDom(
        ['selected','metadata','preview','multiselect','view-bar',
          'history','share','share-link']
      );

      return;
    }

    balloon.openFile(balloon.last);
    balloon.pushState();
  },


  /**
   * When the reset button in the searchbar is clicked
   *
   * @param   object e
   * @return  void
   */
  resetSearch: function(e) {
    $('#fs-search-filter').data('initialized', false);
    $('#fs-search-filter').hide();

    var $fs_crumb_search_list = $('#fs-crumb-search-list');
    $fs_crumb_search_list.find('li').remove();
    $fs_crumb_search_list.append('<li fs-id="" id="fs-crumb-search">'+i18next.t('search.results')+'</li>');

    balloon.resetDom(['selected', 'metadata', 'preview', 'multiselect',
      'view-bar', 'history', 'share', 'share-link', 'search']);
    balloon.menuLeftAction(balloon.getCurrentMenu());
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
          operation.data.offset = 0;

          balloon._readDataSource(operation).done(function(data) {
            var pool = {
              data: data,
              count: data.length
            };

            balloon._dataSourceSuccess(pool, operation);
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

  _readDataSource: function(operation) {
    var $d = $.Deferred();

    balloon.xmlHttpRequest({
      url: balloon.datasource._url,
      type: 'GET',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify(operation.data),
      processData: false,
      success: function(pool, msg, http) {
        if(pool._links.next) {
          operation.data.offset = operation.data.offset + operation.data.limit;

          balloon._readDataSource(operation)
            .done(function(data) {
              var combined = pool.data.concat(data);

              $d.resolve(combined);
            })
            .fail(function(e) {
              $d.resolve([]);
            });
        } else {
          $d.resolve(pool.data);
        }
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

        $d.resolve([]);
      },
    });

    return $d;
  },

  _dataSourceSuccess: function(pool, operation) {
    if(balloon.datasource._ds_params.action == '_FOLDERDOWN') {
      balloon.addCrumbRegister(balloon.getCurrentNode());
    } else if(balloon.datasource._ds_params.action == '_FOLDERUP') {
      var crumbs = balloon.getCrumb().find('li').filter(':hidden').get()/*.reverse()*/;
      crumbs = crumbs.slice(-1);
      $(crumbs).show();
      balloon.getCrumb().find('li:last-child').remove();

      if(balloon.getCrumb().find('li').get().length <= 5) {
        balloon.getCrumb().find('li.removed').remove();
      }
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
      $('#fs-crumb').addClass('is-child');
      pool.data.unshift({
        id: '_FOLDERUP',
        name: i18next.t('tree.folderup'),
        directory: true,
        spriteCssClass: 'gr-i-arrow-w',
      });
    } else {
      $('#fs-crumb').removeClass('is-child');
    }

    balloon.datasource._raw_data = pool.data;
    var sorted = balloon._sortDatasource(
      balloon._filterDatasource(pool.data, balloon.tree.filter),
      balloon.tree.sort.field,
      balloon.tree.sort.dir
    );
    balloon._rebuildTree(sorted, operation);
  },


  /**
   * Check if node has a hidden name
   *
   * Either unix style (. prefix), windows style (~) or windows system files like:
   *  - desktop.ini
   *  - Thumbs.db
   *
   * @param   string|object node
   * @return  bool
   */
  isHidden: function(node) {
    if(typeof(node) == 'object') {
      node = node.name;
    }

    return /^\./.test(node) || /^\~/.test(node) || node === 'Thumbs.db' || node === 'desktop.ini';
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
   * @param string field field to sort by
   * @param string dir (optional) sort direction
   * @return void
   */
  _sortTree: function(field, dir) {
    var $fs_browser_header = $('#fs-browser-header');

    if(dir === undefined) {
      if(balloon.tree.sort.field == field) {
        dir = balloon.tree.sort.dir == 'asc' ? 'desc' : 'asc';
      } else {
        dir = 'asc';
      }
    }

    $fs_browser_header.find('.fs-browser-column-sortable span').empty();

    var iconId = dir === 'asc' ? 'expand' : 'collapse';

    $fs_browser_header.find('.fs-browser-column-' + field + ' span').append('<svg class="gr-icon gr-i-' + iconId + '" viewBox="0 0 24 24"><use xlink:href="'+iconsSvg+'#' + iconId + '"></use></svg>');

    $('#fs-sorting-' + field + '-' + dir).prop('checked', true);
    $('#fs-action-sorting').html(i18next.t('tree.sorting.' + field + '_' + dir));

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
      } else if(!balloon.isSystemNode(a) && balloon.isSystemNode(b)) {
        return 1;
      } else if(balloon.isSystemNode(a) && balloon.isSystemNode(b)) {
        return 0;
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

    var $fs_rename_window = $('#fs-rename-window');
    $fs_rename_window.addClass('is-open');

    var node = balloon.getSelected();

    //wrapping $(find()[0]) is necessary that $input.focus() works
    var $input = $($fs_rename_window.find('input')[0]).val(node.name);

    balloon.rename_node = node;
    balloon.rename_input = $input;

    $input.focus();

    var ext = balloon.getFileExtension(node);
    if(ext === null) {
      $input.select();
    } else {
      var length = node.name.length - ext.length - 1;
      $input[0].setSelectionRange(0, length);
    }

    $input.keyup(function(e) {
      e.stopImmediatePropagation();
      if(e.which === 27) {
        balloon._resetRenameView();
      } else if(e.keyCode == 13) {
        balloon._rename();
      }
    });

    $fs_rename_window.find('input[name="cancel"], #fs-rename-window-close').off('click').on('click', function(event) {
      event.preventDefault();
      event.stopPropagation();

      balloon._resetRenameView();
    });

    $fs_rename_window.find('input[name="save"]').off('click').on('click', function() {
      event.preventDefault();
      event.stopPropagation();

      balloon._rename();
    });
  },

  /**
   * Reset normal fs-value-name view
   *
   * @return void
   */
  _resetRenameView: function() {
    $('#fs-rename-window').removeClass('is-open');

    balloon.rename_node = undefined;
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
   * @param   boolean suppressUndo
   * @return  void
   */
  rename: function(node, new_name, suppressUndo) {
    var options = {
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
          balloon._resetRenameView();
          balloon.displayName(newNode);
        }

        //rename can only be initialized from "cloud" therefore it is not necessary to use reloadTree here
        balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
        balloon.rename_node = null;
      },
      error: function(response) {
        balloon.rename_node = null;
        balloon._resetRenameView();
        balloon.displayError(response);
      }
    }

    if(suppressUndo !== true) {
      options.snackbar = {
        message: 'snackbar.node_renamed',
        values: {
          old_name: node.name,
          new_name: new_name
        },
        icon: 'undo',
        iconAction: function(response) {
          balloon.rename(response, node.name, true);
        }
      };
    }


    balloon.xmlHttpRequest(options);
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

    balloon.resetDom(['upload', 'preview', 'metadata', 'history', 'selected', 'view-bar']);
    balloon.updatePannel(true);

    var index = balloon.multiselect.indexOf(node);
    var $selected = $('#fs-browser-tree').find('li[fs-id='+balloon.id(node)+']');

    if(index >= 0 && stay === false) {
      balloon.multiselect.splice(index, 1);

      $selected.removeClass('fs-multiselected');
    } else if(index <= 0) {
      balloon.multiselect.push(node);
      $selected.addClass('fs-multiselected');
    }

    $('#fs-browser-summary div:first-child').html(i18next.t('tree.selected', {count: balloon.multiselect.length}));
    $('#fs-browser-summary').show();
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

    $('#fs-browser-header-checkbox').removeClass('fs-browser-header-checkbox-undetermined').removeClass('fs-browser-header-checkbox-checked');

    $k_tree.select($());

    balloon.multiselect = [];
    balloon.updatePannel(false);
    balloon.resetDom(['view-bar', 'multiselect']);
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

    var nodes = balloon.datasource._pristineData.filter(function(node) {
      //do not select _FOLDERUP
      return balloon.id(node) !== '_FOLDERUP';
    });


    if(nodes.length === 1) {
      var node = nodes[0];

      //balloon.multiSelect(node);

      var dom_node = $fs_browser_tree.find('.k-item[fs-id='+balloon.id(node)+']');
      $k_tree.select(dom_node);
      $k_tree.trigger('select', {node: dom_node});
    } else if(nodes.length > 1) {
      for(var i=0; i<nodes.length; i++) {
        var node = nodes[i];

        balloon.multiSelect(node);

        var dom_node = $fs_browser_tree.find('.k-item[fs-id='+balloon.id(node)+']');
        $k_tree.select(dom_node);
        $k_tree.trigger('select', {node: dom_node});
      }
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
        var $icon = '<svg class="gr-icon gr-i-warning-fill" viewBox="0 0 24 24"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="'+iconsSvg+'#warning-fill"></use></svg>';
        $fs_error_win.prev().find('.k-window-title').prepend($icon);

        $fs_error_win.find('input[name="ok"]').off('click').on('click', function() {
          $fs_error_win.data('kendoBalloonWindow').close();
        });
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

      if($that.hasClass('removed')) return;

      if(balloon.isSearchResult() && id === '') {
        balloon.resetDom('breadcrumb-search');
        return balloon.buildExtendedSearchQuery();
      } else if(id === '') {
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

      if(balloon.getCrumb().find('li').get().length <= 5) {
        balloon.getCrumb().find('li.removed').remove();
      }

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
          name: $that.html(),
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

    $('#fs-crumb li.removed').remove();
    var $crumbs = $('#fs-crumb').find('li:not(#fs-crumb-home,#fs-crumb-search)').filter(':visible');
    var $crumbsInvisble = $('#fs-crumb').find('li:not(#fs-crumb-home,#fs-crumb-search)').not(':visible');

    if($crumbs.length > 2) {
      $($crumbs[0]).hide();
      $('<li class="removed">...</li>').insertAfter('#fs-crumb li:first-child');
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
    return balloon.getCrumb().find('li').not('.removed').length;
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
      return $k_tree.dataSource.read();
    } else {
      return $.Deferred().resolve().promise();
    }
  },

  /**
   * Opens modal for adding a new node
   *
   * @return void
   */
  showNewNode: function(type, callback) {
    var $d = $.Deferred();

    var mayCreate = false;
    var $fs_new_node_win = $('#fs-new-node-window');

    var $k_win = $fs_new_node_win.kendoBalloonWindow({
      title: i18next.t('new_node.title.' + type),
      resizable: false,
      modal: true,
      activate: function(){
        $fs_new_node_win.find('#fs-new-node-window-name').focus();
      },
      open: function() {
        var $input = $fs_new_node_win.find('#fs-new-node-window-name');
        var $submit = $fs_new_node_win.find('input:submit');

        $input.val('');
        $submit.attr('disabled', true);
        var name;

        $input.off('keyup').on('keyup', function(e) {
          name = $(this).val();

          if(type !== 'folder') {
            name = name+'.'+type;
          }

          if(e.keyCode === 13) {
            if(mayCreate) $submit.click();
            return;
          }

          if(balloon.nodeExists(name) || name === '') {
            mayCreate = false;
            $(this).addClass('error-input');
            $submit.attr('disabled', true);
          } else {
            mayCreate = true;
            $(this).removeClass('error-input');
            $submit.attr('disabled', false);
          }
        });

        $submit.unbind().click(function() {
          var $d_add = callback(name, type);

          if($d_add && $d_add.then) {
            $d_add.done(function(node) {
              $d.resolve(node);
              $k_win.close();
            }).fail($d.reject);
          }
        });

        $fs_new_node_win.find('input:button').unbind().click(function() {
          $k_win.close();
        });
      }
    }).data('kendoBalloonWindow').center().open();

    return $d;
  },

  /**
   * Add node
   */
  addNode: function() {
    var $select = $('#fs-action-add-select');
    var $selectMobile = $('#fs-action-add-select-mobile');
    var $spike = $select.find('.fs-action-dropdown-spike');

    $('#fs-browser-action').removeClass('fs-browser-action-mobile-open');

    $('body').off('click').on('click', function(e){
      var $target = $(e.target);

      if($target.attr('id') != "fs-action-add") {
        $select.removeClass('is-open');
      }
    });

    $select.addClass('is-open');
    $selectMobile.addClass('is-open');

    var spikeLeft = ($(this).offset().left + $(this).width() / 2) - $select.offset().left - ($spike.outerWidth() / 2);
    $spike.css('left', spikeLeft+'px');

    function actionClicked() {
      var type = $(this).attr('data-type');
      balloon.handleAddNode(type);
      $selectMobile.removeClass('is-open');
    }

    $select.off('click', 'li').on('click', 'li', actionClicked);
    $selectMobile.off('click', 'li').on('click', 'li', actionClicked);

    $selectMobile.find('button').off('click').on('click', function() {
      $selectMobile.removeClass('is-open');
    });
  },

  /**
   * Execute add file handler
   */
  handleAddNode: function(type) {
    if(!balloon.add_file_menu_items[type] && ! balloon.add_file_menu_items[type].callback) {
      return $.Deferred().reject().prmosie();
    }

    var $d = balloon.add_file_menu_items[type].callback(type);

    if($d && $d.then) {
      $d.done(function(node) {
        balloon.added = node.id;

        //as handleAddNode can only be executed from within cloud:root and child collections no need for reloadTree here
        balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()}).then(function() {
          balloon.scrollToNode(node);
        });
      });
    }
  },

  /**
   * Add folder
   *
   * @param string name
   * @return  void
   */
  addFolder: function(name) {
    return balloon._createCollection(balloon.getCurrentCollectionId(), name);
  },


  /**
   * Add new file
   *
   * @param string name
   * @return void
   */
  addFile: function(name) {
    var $d = $.Deferred();

    name = encodeURIComponent(name);

    balloon.xmlHttpRequest({
      url: balloon.base+'/files?name='+name+'&'+balloon.param('collection', balloon.getCurrentCollectionId()),
      type: 'PUT',
      snackbar: {
        message: 'snackbar.file_created',
        values: {
          name: name
        },
        icon: 'undo',
        iconAction: function(response) {
          balloon.remove(response, true, true);
        }
      },
      complete: function(jqXHR, textStatus) {
        switch(textStatus) {
        case 'success':
          $d.resolve(jqXHR.responseJSON);
          break;
        default:
          $d.reject();
        }
      },
    });

    return $d;
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

    $fs_share_create.off('click').on('click', balloon._onShowShare);

    $fs_share_edit.off('click').on('click', balloon._onShowShare);

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

    var $li_owner = $('<li class="avatar-user"></li>');
    $fs_share_consumers_ul.append($li_owner);

    $fs_share_consumers_ul.off('click').on('click', balloon._onShowShare);

    balloon.displayAvatar($li_owner, login.user.id);

    if(!node.shared && !node.reference) {
      $fs_share_consumers.find('.fs-share-hint-owner-only').show();
    } else {
      var numConsumers = acl.length;
      var maxConsumersDisplayed = 5;

      for(var i=0; i < maxConsumersDisplayed-1 && i < numConsumers; i++) {
        var curAcl = acl[i];

        if(curAcl.type === 'user' && curAcl.id === node.owner.id) {
          //Do not display owner twice;
          maxConsumersDisplayed++;
          continue;
        }

        var $li_consumer = $('<li class="avatar-' + curAcl.type + '"><div><span></span><p>'+ i18next.t('view.share.privilege_text_'+curAcl.privilege, curAcl.role.name) +'</p></div></li>');
        $fs_share_consumers_ul.append($li_consumer);
        if(curAcl.type === 'user') balloon.displayAvatar($li_consumer, curAcl.id);
      }

      if(maxConsumersDisplayed < numConsumers) {
        var $li_additional = $('<li class="fs-share-consumers-additional"><span>' + (numConsumers - maxConsumersDisplayed) + '+</span></li>');
        $fs_share_consumers_ul.append($li_additional);
      }
    }
  },

  /**
   * Event handler wrapper for showShare
   *
   * @param object event
   * @return void
   */
  _onShowShare: function(event) {
    var node = balloon.getCurrentNode();
    balloon.showShare(node);
  },

  /**
   * Shows popup for share creating/edting
   *
   * @param object node
   * @return void
   */
  showShare: function(node) {
    var acl = [];

    if(!node || !node.directory) return;

    var $fs_share_win = $('#fs-share-window');
    var $fs_share_win_create = $fs_share_win.find('input[name=create]');
    var $fs_share_win_save = $fs_share_win.find('input[name=save]');
    var $fs_share_win_cancel = $fs_share_win.find('input[name=cancel]');
    var $fs_share_win_remove = $fs_share_win.find('#fs-share-window-remove');
    var $fs_share_win_remove_btn = $fs_share_win.find('input[name=unshare]');
    var $fs_share_win_consumers = $fs_share_win.find('#fs-share-window-consumers');
    var $share_name = $fs_share_win.find('input[name=share_name]');

    $fs_share_win_consumers.hide();
    $fs_share_win_consumers.find('ul').empty()
    $fs_share_win.find('#fs-share-window-content').removeClass('fs-share-window-consumers-expanded');

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
    var $privilegeSelectorTrigger = $fs_share_win.find('#fs-share-window-search-role .fs-share-window-selected-privilege');
    var $saveBtns = $fs_share_win.find('.fs-window-secondary-actions input[type="submit"]');
    balloon._setToggleConsumersVisibility(acl);

    $saveBtns.prop('disabled', ($share_name.val() === '' || acl.length === 0));

    var oldAcl = $.extend(true, [], acl);

    $saveBtns.off('click').on('click', function() {
      if(balloon._saveShare(acl, node, oldAcl)) {
        $fs_share_win.data('kendoBalloonWindow').close();
      }
    });

    $share_name.off('change').on('change', function() {
      if($(this).val() !== '') {
        if(acl.length > 0) {
          $fs_share_win.find('.fs-window-secondary-actions input[type="submit"]').prop('disabled', false);
        }
      } else {
        $fs_share_win.find('.fs-window-secondary-actions input[type="submit"]').prop('disabled', true);
      }
    });

    var selected = false;

    $share_consumer_search.unbind('keyup').bind('keyup', function(e) {
      if(e.keyCode == 13) {
        if(selected === true) {
          selected = false;
          return;
        }

        var value = $share_consumer_search.data("kendoAutoComplete").value()
        if(value === '' || value === undefined) {
          return;
        }

        var filter = JSON.stringify({'query': {'name': $share_consumer_search.data("kendoAutoComplete").value()}});

        balloon.xmlHttpRequest({
          url: balloon.base+'/groups?'+filter,
          contentType: "application/json",
          success: function(data) {
            if(data.count !== 1) {
              return;
            }

            $share_consumer_search.val('').focus();

            var role = {
              type: 'group',
              role: data.data[0]
            }

            acl = balloon._addShareConsumer(role, acl, true);
          }
        });

        filter = JSON.stringify({'query': {'username': $share_consumer_search.data("kendoAutoComplete").value()}});

        balloon.xmlHttpRequest({
          url: balloon.base+'/users?'+filter,
          contentType: "application/json",
          dataType: 'json',
          success: function(data) {
            if(data.count !== 1) {
              return;
            }

            $share_consumer_search.val('').focus();

            var role = {
              type: 'user',
              role: data.data[0]
            }

            acl = balloon._addShareConsumer(role, acl, true);
          }
        });
      }
    });

    balloon._userAndGroupAutocomplete($share_consumer_search, true, function(item) {
      selected = true;
      balloon._addShareConsumer(item, acl, true);
    });

    $fs_share_win.find('#fs-share-window-toggle-consumers a').off('click').on('click', function() {
      $fs_share_win.find('#fs-share-window-content').toggleClass('fs-share-window-consumers-expanded');
      $fs_share_win.data('kendoBalloonWindow').center();
    });

    $privilegeSelectorTrigger.off('click').on('click', balloon._showPrivilegeSelector);
  },

  /**
   * show a privilege selector
   *
   * @param  object event
   */
  _showPrivilegeSelector: function(event) {
    event.stopImmediatePropagation();

    var $fs_share_win = $('#fs-share-window');
    var $parent = $(event.target).parents('.fs-share-window-privilege-selector');
    var $trigger = $parent.find('.fs-share-window-selected-privilege');
    var $selector = $parent.find('.fs-share-window-privileges');

    $(document).trigger('privilege-selector-open');

    function positionSelector() {
      var selectorBounds = $selector[0].getBoundingClientRect();
      var triggerBounds = $trigger[0].getBoundingClientRect();
      var position = {};
      var alternativeTop;

      if($parent.attr('id') === 'fs-share-window-search-role') {
        position.top = triggerBounds.y - 11;
        position.right = $(window).width() - triggerBounds.x - triggerBounds.width - 10;
      } else {
        position.top = triggerBounds.y - 1;
        position.right = $(window).width() - triggerBounds.x - triggerBounds.width + 4;
      }

      if(position.top + selectorBounds.height > $(window).height()) {
        //would overlap viewport bottom, try to position towards top
        if($parent.attr('id') === 'fs-share-window-search-role') {
          alternativeTop = triggerBounds.y  + triggerBounds.height - selectorBounds.height + 10;
        } else {
          alternativeTop = triggerBounds.y  + triggerBounds.height - selectorBounds.height + 1;
        }

        if(alternativeTop > 0) {
          //do not position towards top, if it would overlap viewport top
          position.top = alternativeTop;
        }
      }

      $selector.css(position);
    }

    $selector.addClass('fs-share-window-privilege-visible');
    $selector.appendTo('body');
    positionSelector();

    $fs_share_win.off('scroll.privilege-selector').on('scroll.privilege-selector', function() {
      var triggerBounds = $trigger[0].getBoundingClientRect();

      positionSelector();
    });

    $fs_share_win.data('kendoBalloonWindow').one('close', function() {
      balloon._hidePrivilegeSelector($parent, $selector);
    });

    $(document).one('privilege-selector-open', function() {
      balloon._hidePrivilegeSelector($parent, $selector);
    });

    $(document).one('click.privilege-selector', function() {
      balloon._hidePrivilegeSelector($parent, $selector);
    });

    $selector.one('click', function() {
      balloon._hidePrivilegeSelector($parent, $selector);
    });
  },

  /**
   * sets visibillity of consumers toggle
   *
   * @param  object $parent
   * @param  object $selector
   */
  _hidePrivilegeSelector: function($parent, $selector) {
    $selector.removeClass('fs-share-window-privilege-visible');
    $selector.appendTo($parent);

    $('#fs-share-window').off('scroll.privilege-selector');
  },

  /**
   * sets visibillity of consumers toggle
   *
   * @param  array curAcl
   */
  _setToggleConsumersVisibility: function(curAcl) {
    if(curAcl.length >= 4) {
      $('#fs-share-window-toggle-consumers').addClass('visible');
    } else {
      $('#fs-share-window-toggle-consumers').removeClass('visible');
      $('#fs-share-window-content').removeClass('fs-share-window-consumers-expanded');
    }
  },

  /**
   * Autocomplete for users and groups on a given $input
   *
   * @param  object $input
   * @param  Function onSelect callback when an item from the autocomplete has been selected
   * @return object
   */
  _userAndGroupAutocomplete: function($input, includeGroups, onSelect) {
    var autocomplete = $input.data('kendoAutoComplete')
    if(autocomplete) autocomplete.destroy();

    $input.kendoAutoComplete({
      minLength: 3,
      dataTextField: "name",
      filter: "contains",
      highlightFirst: true,
      template: '<svg class="gr-icon gr-i-#: icon #"><use xlink:href="'+iconsSvg+'\\##: icon #"></use></svg><span>#: name #</span>',
      noDataTemplate: i18next.t('error.autocomplete.no_user_groups_found'),
      dataSource: new kendo.data.DataSource({
        serverFiltering: true,
        transport: {
          read: function(operation) {
            var value = $input.data("kendoAutoComplete").value()
            if(value === '' || value === undefined) {
              operation.success([]);
              $input.data('kendoAutoComplete').close();
              return;
            }

            var consumers = null;

            if(includeGroups) {
              var filter = {
                'query': {
                  'name': {
                    "$regex": $input.data("kendoAutoComplete").value(),
                    "$options": "i"
                  },
                }
              };

              if(login.user.namespace) {
                filter.query.namespace = login.user.namespace;
              }

              filter = JSON.stringify(filter);

              balloon.xmlHttpRequest({
                url: balloon.base+'/groups?'+filter,
                contentType: "application/json",
                success: function(data) {
                  for(var i in data.data) {
                    data.data[i].type = 'group';
                    data.data[i].icon = 'group';
                    data.data[i].role = $.extend({}, data.data[i]);
                  }

                  if(consumers !== null) {
                    operation.success(data.data.concat(consumers));
                  } else {
                    consumers = data.data;
                  }
                }
              });
            } else {
              consumers = [];
            }

            var filter = {
              'query': {
                'username': {
                  "$regex": $input.data("kendoAutoComplete").value(),
                  "$options": "i"
                },
              }
            };

            if(login.user.namespace) {
              filter.query.namespace = login.user.namespace;
            }

            filter = JSON.stringify(filter);

            balloon.xmlHttpRequest({
              url: balloon.base+'/users?'+filter,
              contentType: "application/json",
              dataType: 'json',
              success: function(data) {
                for(var i in data.data) {
                  data.data[i].type = 'user';
                  data.data[i].icon = 'person';
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
          $input.val('').focus();
        },50);

        $input.val('');
        var item = this.dataItem(e.item.index());
        onSelect(item);
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
  _addShareConsumer: function(item, acl, scrollToItem) {
    var $fs_share_win_consumers = $('#fs-share-window-consumers');
    var $fs_share_win_consumers_ul = $fs_share_win_consumers.find('> ul');

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

    var icon = item.type === 'group' ? 'group' : 'person';
    var $consumer = $(
      '<li id="fs-share-window-consumer-' + item.role.id + '">'+
        '<svg class="gr-icon gr-i-'+icon+'"><use xlink:href="'+iconsSvg+'#'+icon+'"></use></svg>'+
        '<span>'+name+'</span>'+
      '</li>'
    );

    var $consumer_privilege = $(
      '<div class="fs-share-window-privilege-selector">'+
        '<div class="fs-share-window-selected-privilege">'+
            '<span class="fs-share-window-selected-privilege-label">' + i18next.t('view.share.privilege_' + privilege) + '</span>'+
            '<svg class="gr-icon gr-i-expand"><use xlink:href="'+iconsSvg+'#expand"></use></svg>'+
        '</div>'+
      '</div>'
    );

    var $consumer_privilege_selector = $('<ul class="fs-share-window-privileges"></ul>');

    var privileges = ['m', 'r', 'rw', 'w+', 'd'];
    for(var i in privileges) {
      var itemPrivilege = privileges[i];
      var itemId = item.role.id;
      $consumer_privilege_selector.append(
        '<li>'+
            '<input id="priv_' + itemId + '_' + itemPrivilege + '" type="radio" name="priv_'+item.role.id+'" value="' + itemPrivilege + '" ' + (itemPrivilege === privilege ? ' checked' : '') + ' />'+
            '<label for="priv_'  + itemId + '_' + itemPrivilege + '">'+
                '<svg viewBox="0 0 24 24" class="gr-icon gr-i-checkmark"><use xlink:href="'+iconsSvg+'#checkmark"></use></svg>'+
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

    $consumer_privilege.on('mouseenter', function() {
      $consumer_privilege_selector.css('top', ($consumer_privilege.position().top-1)+'px');
    });

    $consumer.append($consumer_privilege);

    $fs_share_win_consumers_ul.append($consumer);
    $fs_share_win_consumers.show();

    balloon._setToggleConsumersVisibility(acl);

    if(scrollToItem) {
      $fs_share_win_consumers_ul.animate({scrollTop: $fs_share_win_consumers_ul.prop('scrollHeight')}, 250);
    }

    $('#fs-share-window').data('kendoBalloonWindow').center();

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

    $consumer_privilege.find('.fs-share-window-selected-privilege').off('click').on('click', balloon._showPrivilegeSelector);

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

    balloon._setToggleConsumersVisibility(acl);

    $('#fs-share-window').data('kendoBalloonWindow').center();

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
   * @param  Array oldAcl
   * @return object
   */
  _saveShare: function(acl, node, oldAcl) {
    var $share_name = $('#fs-share-window input[name=share_name]');

    if($share_name.val() === '') {
      $share_name.focus();
      return false;
    } else if(acl.length === 0) {
      $('#fs-share-window input[name=share_consumer_search]').focus();
      return false;
    } else {
      balloon._shareCollection(node, acl, $share_name.val(), oldAcl);
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
          balloon.reloadTree();
          balloon.last.shared = false;
          if(balloon.id(node) == balloon.id(balloon.last)) {
            balloon.switchView('share');
          }
        },
        200: function(data) {
          balloon.reloadTree();
          balloon.last = data;
          balloon.switchView('share');
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
   * @param   array oldAcl
   * @return  void
   */
  _shareCollection: function(node, acl, name, oldAcl) {
    var url = balloon.base+'/collections/share?id='+balloon.id(node);

    var options = {
      url: url,
      type: 'POST',
      dataType: 'json',
      data: {
        acl: acl,
        name: name
      },
      success: function() {
        node.shared = true;
        balloon.reloadTree();
        if(balloon.id(node) == balloon.id(balloon.last)) {
          balloon.switchView('share');
        }
      },
    };

    if(oldAcl.length === 0) {
      options.snackbar = {
        message: 'snackbar.share_added',
        values: {
          name: node.name
        },
        icon: 'undo',
        iconAction: function(response) {
          balloon._deleteShare(node)
        }
      };
    } else {
      options.snackbar = {
        message: 'snackbar.share_updated',
        values: {
          name: node.name
        },
        icon: 'undo',
        iconAction: function(response) {
          var oldName = node.sharename || node.name;
          balloon._shareCollection(response, oldAcl, oldName, acl);
        }
      };
    }

    balloon.xmlHttpRequest(options);
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

    balloon.resetDom('share-link-settings');
    var $fs_share_link_settings_win = $('#fs-share-link-settings-window');

    var $k_win = $fs_share_link_settings_win.kendoBalloonWindow({
      title: i18next.t('view.share_link.settings.title', node.name),
      resizable: false,
      modal: true,
      open: function() {
        var token;
        var destroy_checked = false;

        var $fs_share_expr_check = $fs_share_link_settings_win.find('#fs-share-link-expiration-check');
        var $fs_share_pw_check = $fs_share_link_settings_win.find('#fs-share-link-password-check');
        var $fs_share_destroy_check = $fs_share_link_settings_win.find('#fs-share-link-destroy');
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
            $fs_share_destroy_check.prop('disabled', false);
          }

          if(node.sharelink_has_password) {
            $fs_share_pw_check.prop('checked', true);
          }

          if(node.sharelink_expire && node.destroy && node.sharelink_expire === node.destroy) {
            $fs_share_destroy_check.prop('checked', true);
            destroy_checked = true;
          }
        }

        $fs_share_expr_check.off('change').on('change', function() {
          if($fs_share_expr_check.prop('checked') === false) {
            $k_fs_share_expr_date.value(null);
            $k_fs_share_expr_time.value(null);
            $fs_share_destroy_check.prop('checked', false).prop('disabled', true);
          } else {
            if($k_fs_share_expr_date.value() === null) {
              var defaultDate = new Date();
              defaultDate.setDate(defaultDate.getDate() + 1);
              $k_fs_share_expr_date.value(defaultDate);
              $fs_share_destroy_check.prop('disabled', false);
            }

            $k_fs_share_expr_date.open();
          }
        });

        $k_fs_share_expr_date.unbind().bind('change', function() {
          if($k_fs_share_expr_date.value() !== null) {
            $fs_share_expr_check.prop('checked', true);
            $fs_share_destroy_check.prop('disabled', false);
          } else {
            $fs_share_expr_check.prop('checked', false);
            $fs_share_destroy_check.prop('checked', false).prop('disabled', true);
          }
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

        var $submit = $fs_share_link_settings_win.find('input:submit');

        var label = token ? 'view.share_link.settings.save' : 'view.share_link.settings.save_continue';

        $submit.val(i18next.t(label));

        $submit.unbind().click(function() {
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

          var data = {
            id: balloon.id(node),
            expiration: '0',
            password: '0'
          }

          if(date !== null) {
            data.expiration = date;
          }

          if($fs_share_pw_check.prop('checked')) {
            var pw_val = $fs_share_pw.val();

            if(pw_val !== '') {
              data.password = pw_val;
            } else {
              data.password = null;
            }
          }

          var destroyRequest = balloon._setShareLinkDestroy(node, destroy_checked, $fs_share_destroy_check.prop('checked'), date);

          var shareLinkRequest = balloon.xmlHttpRequest({
            type: 'POST',
            url: balloon.base+'/nodes/share-link',
            data: data,
            statusCode: {
              200: function(data) {
                balloon.last = data;
              }
            }
          });

          $.when(shareLinkRequest, destroyRequest).done(function() {
            balloon.reloadTree().then(function() {
              balloon.switchView('share-link');
              $k_win.close();
              balloon.showShareLink();
            });
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
   * Sets the destroy date from within share-link-settings
   *
   * @param  object node to set destroy on
   * @param  boolean initial_destroy initial state of destroy checkbox
   * @param  boolean current_destroy current state of destroy checkbox
   * @param  date number the date to set for destroy date
   * @return Deferred|bool true
   */
  _setShareLinkDestroy: function(node, initial_destroy, current_destroy, date) {
    var curDestroyDate = node.destroy ? (new Date(node.destroy)).getTime() : null;

    if(current_destroy && (initial_destroy === false || curDestroyDate !== date)) {
      return balloon._setDestroy(node, date);
    } else if(current_destroy === false && initial_destroy === true){
      return balloon._setDestroy(node, null);
    } else {
      return true;
    }
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
        balloon.initShareLinkMessageForm(node);

        $fs_share_link.val(window.location.origin+'/share/'+node.sharelink_token);
        $fs_share_link.unbind('click').bind('click', function() {

          balloon.copyToClipboard($(this).val());

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

  /**
   * Removes a share link
   *
   * @return void
   */
  removeShareLink: function() {
    var node = balloon.getCurrentNode();

    if(!node) return;

    return balloon.xmlHttpRequest({
      url: balloon.base+'/nodes/share-link?id='+balloon.id(node),
      type: 'DELETE',
      success: function(body) {
        delete balloon.last.sharelink_token;
        balloon.reloadTree();

        $('#fs-share-link-edit').hide();
        $('#fs-share-link-delete').hide();
        $('#fs-share-link-create').show();
      }
    });
  },

  /**
   * Send a share link as mail or notification
   *
   * @param object node
   * @return void
   */
  sendShareLinkMessage: function(node) {
    var subject = i18next.t('view.share_link.message.subject')
    var $recipient_list = $('#fs-share-link-window-recipient-list');
    var comment = $('#fs-share-link-window-comment').val();
    var shareLink = window.location.origin+'/share/'+node.sharelink_token;

    if(comment.indexOf(shareLink) ===   -1) {
      comment = comment + "\n" + shareLink;
    }

    var emails = [], users = [], groups = [];

    $recipient_list.find('.tag').not('.is-invalid').each(function(i, item) {
      var data = $(item).data();

      switch(data.recipientType) {
      case 'email':
        emails.push(data.recipientAddress);
        break;
      case 'user':
        users.push(data.recipientAddress);
        break;
      case 'group':
        groups.push(data.recipientAddress);
        break;
      }
    });

    function doRequest(recipients, endpoint) {
      var promise = $.Deferred();
      if(recipients.length === 0) return promise.resolve();

      balloon.xmlHttpRequest({
        url: balloon.base + '/' + endpoint,
        type: 'POST',
        dataType: 'json',
        data: {
          subject: i18next.t('view.share_link.message.subject'),
          body: comment,
          receiver: recipients
        },
        converters: {
          //dealing with empty body in response
          'text json': function(response) {
            return (response === '') ? null : JSON.parse(response);
          },
        },
      }).fail(function() {
        promise.reject();
      }).done(function() {
        promise.resolve();
      });

      return promise;
    }

    return $.when(
      doRequest(emails, 'notifications/mail'),
      doRequest(users, 'notifications')
    );
  },

  /**
   * Initializes the share link message form
   *
   * @param object node
   * @return void
   */
  initShareLinkMessageForm: function(node) {
    if(app.isEnabled('Balloon.App.Notification') === false) {
      // require the Notification app to be installed in order to send messages
      $fs_share_link_message_form.hide();
      return;
    }
    var $fs_share_link_win = $('#fs-share-link-window');
    var $fs_share_link_message_form = $fs_share_link_win.find('#fs-share-link-window-message-form');
    var $recipient_list = $fs_share_link_win.find('#fs-share-link-window-recipient-list');
    var $input_recipient = $fs_share_link_message_form.find('#fs-share-link-window-recipient');
    var $input_comment = $fs_share_link_message_form.find('#fs-share-link-window-comment');
    var $btn_send = $fs_share_link_message_form.find('input[name="send"]');
    var $input_recipient_autocomplete;
    var shareLink = window.location.origin+'/share/'+node.sharelink_token;

    $recipient_list.find('.tag').remove();
    $input_comment.val(shareLink);
    $btn_send.prop('disabled', true);

    function addRecipient(recipient) {
      var label = '';
      var valid = true;
      var type, address;

      if(typeof recipient === 'string') {
        if(recipient === '') return;
        type = 'email';
        address = recipient.replace(/^\s+|[\s;,]+$/gm, '');
        label = address;

        var re = /^(([^<>()\[\]\.,;:\s@\"]+(\.[^<>()\[\]\.,;:\s@\"]+)*)|(\".+\"))@(([^<>()[\]\.,;:\s@\"]+\.)+[^<>()[\]\.,;:\s@\"]{2,})$/i;
        valid = re.test(String(address).toLowerCase());
      } else {
        type = recipient.type;
        address = recipient.role.id;
        label = recipient.role.name;
      }

      var recipients = $recipient_list.find('div.tag[data-recipient-type="' + type + '"][data-recipient-address="' + address + '"]');

      //recipient with of same type and address is already in the list
      if(recipients.length !== 0) {
        $input_recipient.val('');
        return;
      }

      var $recipient = $(
        '<div class="tag" data-recipient-address="' + address + '" data-recipient-type="' + type + '">'+
          '<div class="tag-name">'+ label + '</div>'+
          '<div class="fs-delete"><svg viewBox="0 0 24 24" class="gr-icon gr-i-close"><use xlink:href="'+iconsSvg+'#close"></use></svg></div>'+
        '</div>'
      );

      if(valid === false) {
        $recipient.addClass('is-invalid');
      }

      $recipient.insertBefore($input_recipient.parent());
      $input_recipient.val('');
      mightSendForm();
    }

    function mightSendForm() {
      if($recipient_list.find('.tag').not('.is-invalid').length > 0 && $input_comment.val() !== '') {
        $btn_send.prop('disabled', false);
      } else {
        $btn_send.prop('disabled', true);
      }
    }

    balloon._userAndGroupAutocomplete($input_recipient, false, function(item) {
      addRecipient(item);
    });

    $input_recipient_autocomplete = $input_recipient.data('kendoAutoComplete');

    $input_recipient.off('blur').on('blur', function() {
      if($input_recipient_autocomplete.items().length ===0) {
        addRecipient($input_recipient.val());
      }
    });

    $input_comment.off('keyup').on('keyup', function() {
      mightSendForm();
    });

    $input_recipient.off('keyup.shareLinkMessageForm').on('keyup.shareLinkMessageForm', function(event) {
      switch(event.keyCode) {
      case 13: // [Enter]
        //if autocomplete has at least one item, keep default behaviour of autocomplete
        if($input_recipient_autocomplete.items().length > 0) break;
      case 32: // [Space]
      case 186: // [;]
      case 188: // [,]
        event.stopImmediatePropagation();
        addRecipient($input_recipient.val());
        break;
      };
    });

    $input_recipient.off('keydown.shareLinkMessageForm').on('keydown.shareLinkMessageForm', function(event) {
      switch(event.keyCode) {
      case 8:
        if($input_recipient.val().trim() === '') {
          event.stopImmediatePropagation();
          $recipient_list.find('.tag').last().remove();
          mightSendForm();
        }
        break;
      };
    });

    $recipient_list.unbind('click').on('click', '.fs-delete', function(event) {
      $(this).parents().filter('.tag').remove();
      mightSendForm();
    });

    $btn_send.off('click').on('click', function(event) {
      event.preventDefault();

      $btn_send.prop('disabled', true);

      var requests = balloon.sendShareLinkMessage(node);

      requests.done(function() {
        $btn_send.prop('disabled', true);
        $recipient_list.find('.tag').remove();
        $input_comment.val(shareLink);
      });

      requests.fail(function() {
        $btn_send.prop('disabled', true);
        $recipient_list.find('.tag').remove();
      });
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

    if(typeof(login) === 'object' && login.getAccessToken()) {
      url += '&access_token='+login.getAccessToken();
    }

    if((node.directory == true || !balloon.isMobileViewPort()) && !balloon.isiOS()) {
      url += "&download=true";
      $iframe.attr('src', url).load(url);
    } else {
      window.open(url, '_blank');
    }
  },


  /**
   * Extended search popup
   *
   * @param object filters initialy selected filters (eg: {tags: ['tag1', 'tag2']})
   * @return  void
   */
  advancedSearch: function(filters) {
    balloon.initSearchResultBreadCrumb();

    var $fs_search = $('#fs-search');
    var $fs_search_input = $fs_search.find('#fs-search-input');
    var $fs_search_filter = $('#fs-search-filter');

    if(!$fs_search_input.is(':focus')) $fs_search_input;
    $fs_search_input.off('keyup').on('keyup', balloon.buildExtendedSearchQuery);

    balloon.xmlHttpRequest({
      url: balloon.base+'/users/' + login.user.id + '/node-attribute-summary',
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
            var color = colors[i]._id;
            var classes = ['fs-color-'+color];

            if(filters && filters.color && filters.color.includes(color)) {
              classes.push('fs-search-filter-selected');
            }

            children.push('<li data-item="'+color+'" class="'+classes.join(' ')+'"></li>');
          }
        }

        if(children.length >= 1) {
          $color_list.html('<ul>'+children.join('')+'</ul>');
        }

        var $tag_list = $('#fs-search-filter-tags').find('div:first'),
          tags = body['meta.tags'],
          children = [];

        for(var i in tags) {
          var classes = [];
          var tag = tags[i]._id;

          if(filters && filters.tags && filters.tags.includes(tag)) {
            classes.push('fs-search-filter-selected');
          }

          children.push('<li data-item="'+tag+'" class="'+classes.join(' ')+'">'+tag+' ('+tags[i].sum+')</li>');
        }

        if(children.length >= 1) {
          $tag_list.html('<ul>'+children.join('')+'</ul>');
        }

        var $mime_list = $('#fs-search-filter-mime').find('div:first'),
          mimes = body['mime'],
          children = [];

        for(var i in mimes) {
          var mime = mimes[i]._id;
          var ext = balloon.mapMimeToExtension(mime);

          var spriteClass = ext !== false ? balloon.getSpriteClass(ext) : 'gr-i-file';

          var classes = [];

          if(filters && filters.mime && filters.mime.includes(mime)) {
            classes.push('fs-search-filter-selected');
          }
          children.push(
            '<li data-item="'+mime+'" class="'+classes.join(' ')+'">'+
              '<svg class="gr-icon  ' + spriteClass + '"><use xlink:href="'+iconsSvg+'#' + spriteClass.replace('gr-i-', '') + '"></use></svg>'+
              '<div>['+mime+']</div></li>'
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

        $('#fs-search-filter').data('initialized', true);

        balloon.buildExtendedSearchQuery();
      },
    });
  },

  /**
   * Initializes the search breadcrumb
   *
   * @param object filters initialy selected filters (eg: {tags: ['tag1', 'tag2']})
   * @return  void
   */
  initSearchResultBreadCrumb: function() {
    balloon.resetDom(['breadcrumb-search']);
    $('#fs-crumb-home-list').hide();
    $('#fs-browser-header .fs-browser-column-icon').children().hide();
    $('#fs-crumb-search-list').show();

    $('#fs-crumb-search').find('li:first-child').html(i18next.t('search.results'));
    $('#fs-crumb-search').data('is-search-result', true);

    balloon.datasource.data([]);
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
    var filters = {tags: [], color:[], mime: []};

    $('#fs-search-filter-tags').find('li.fs-search-filter-selected').each(function(){
      filters.tags.push($(this).attr('data-item'));
    });

    $('#fs-search-filter-mime').find('li.fs-search-filter-selected').each(function(){
      filters.mime.push($(this).attr('data-item'));
    });

    $('#fs-search-filter-color').find('li.fs-search-filter-selected').each(function(){
      filters.color.push($(this).attr('data-item'));
    });

    var content = $('#fs-search-input').val();
    if(content.length < 3) content = undefined;

    $('.fs-search-reset-button').show();

    if(filters.tags.length > 0 || filters.color.length > 0 || filters.mime.length > 0) {
      $('#fs-search').addClass('fs-search-filtered');
    } else {
      $('#fs-search').removeClass('fs-search-filtered');
    }

    var query = balloon.buildQuery(content, filters);

    if(query === undefined) {
      balloon.datasource.data([]);
      return;
    }

    return balloon.executeQuery(query);
  },


  /**
   * build query
   *
   * @param   string value
   * @param   object filters
   * @return  object
   */
  buildQuery: function(value, filters) {
    var mode = $('input[name="fs-search-mode"]:checked').val();

    if(balloon.search_modes && balloon.search_modes[mode] && balloon.search_modes[mode].buildQuery) {
      return balloon.search_modes[mode].buildQuery(value, filters);
    }

    return undefined;
  },

  /**
   * execute query
   *
   * @param   object query
   * @return  object
   */
  executeQuery: function(query) {
    var mode = $('input[name="fs-search-mode"]:checked').val();

    if(balloon.search_modes && balloon.search_modes[mode] && balloon.search_modes[mode].executeQuery) {
      return balloon.search_modes[mode].executeQuery(query);
    } else {
      balloon.datasource.data([]);
      return $.Deferred().resolve().promise();
    }

  },

  /**
   * build query for nodename mode
   *
   * @param   string value
   * @param   object filters
   * @return  object
   */
  _buildQueryNodename: function(value, filters) {
    var queryParts = [];

    if(value) {
      queryParts.push({'name': {$regex:value, $options:'i'} });
    }

    if(filters && filters.tags && filters.tags.length > 0) {
      var $or = [];
      var i;

      for(i=0; i<filters.tags.length; i++) {
        $or.push({'meta.tags': filters.tags[i]});
      }

      queryParts.push({'$or': $or});
    }

    if(filters && filters.color && filters.color.length > 0) {
      var $or = [];
      var i;

      for(i=0; i<filters.color.length; i++) {
        $or.push({'meta.color': filters.color[i]});
      }

      queryParts.push({'$or': $or});
    }

    if(filters && filters.mime && filters.mime.length > 0) {
      var $or = [];
      var i;

      for(i=0; i<filters.mime.length; i++) {
        $or.push({'mime': filters.mime[i]});
      }

      queryParts.push({'$or': $or});
    }

    if(queryParts.length === 0) return undefined;

    if(queryParts.length === 1) return queryParts[0];

    return {'$and': queryParts};
  },

  /**
   * Check if search breadcrumb is visible
   *
   * @return bool
   */
  isSearch: function() {
    return $('#fs-crumb-search-list').is(':visible');
  },


  /**
   * Check if tree displays a search result
   *
   * @return bool
   */
  isSearchResult: function() {
    return $('#fs-crumb-search').data('is-search-result') === true;
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
        if(node[n].deleted || ignore_flag === true) {
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

    var $d = $.Deferred();

    if(params === undefined || params.constructor !== Array) params = [];

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
        $d.reject();
      }
    });

    $div.find('input[name=cancel]').unbind('click').bind('click', function(e) {
      e.stopImmediatePropagation();
      $k_prompt.close();
      $d.reject();
    });

    var $parent = this;
    $div.find('input[name=confirm]').unbind('click').click(function(e) {
      e.stopImmediatePropagation();

      if(action.constructor === Array) {
        var actionDs = [];

        for(var i in action) {
          if(action[i] !== null) {
            var childAction = typeof action[i].action === 'string' ? $parent[action[i].action] : action[i].action;
            var childActionD = childAction.apply($parent,action[i].params);

            if(typeof childActionD === 'object' && typeof childActionD.resolve === 'function') {
              actionDs.push(childActionD);
            }
          }
        }

        $.when.apply($parent, actionDs).then(function() {
          $d.resolve();
        }, function() {
          $d.reject();
        });
      } else {
        if(typeof action === 'string') {
          action = $parent[action];
        }

        var actionD = action.apply($parent,params);

        if(typeof actionD === 'object' && typeof actionD.resolve === 'function') {
          actionD.then($d.resolve, $d.reject);
        }
      }

      $k_prompt.close();
    });

    return $d;
  },

  /**
   * Alert window
   *
   * @param   string msg
   * @return  void
   */
  alert: function(msg) {
    var $div = $("#fs-alert-window");
    var $d = $.Deferred();

    $('#fs-alert-window-content').html(msg);

    var $k_alert = $div.kendoBalloonWindow({
      title: $div.attr('title'),
      resizable: false,
      modal: true,
      activate: function() {
        setTimeout(function() {
          $div.find('input[name=ok]').focus()
        },200);
      },
      close: function(e) {
        $d.resolve();
      }
    }).data("kendoBalloonWindow").center().open();

    $div.find('input[name=ok]').unbind('click').bind('click', function(e) {
      e.stopImmediatePropagation();
      e.preventDefault();
      $k_alert.close();
    });

    return $d;
  },


  /**
   * Alerts that the choosen action can't be executed, while a file is currently open
   *
   * @param   function action
   * @return  void
   */
  alertOpenFile: function(action) {
    if($('body').hasClass('fs-fullscreen-window-open')) {
      return balloon.alert(i18next.t('prompt.open_file_disables_action'));
    } else {
      return action();
    }
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

    var options = {
      url: balloon.base+'/nodes?ignore_flag='+ignore_flag+'&force='+force+'&'+balloon.param('id', node),
      type: 'DELETE',
      dataType: 'json',
      beforeSend: function() {
        balloon.resetDom(['selected', 'metadata', 'preview', 'multiselect',
          'view-bar', 'history', 'share', 'share-link', 'events']);

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
        $('body').removeClass('fs-content-select-active fs-content-multiselect-active');

        var count = 1;
        if(node instanceof Array) {
          count = node.length;
        }
        balloon.displayQuota();
        balloon.reloadTree();
      },
    };

    if(force === false) {
      //node has been deleted to trash, and therefore is undoable

      options.snackbar = {
        message: 'snackbar.node_deleted',
        values: {
          count: Array.isArray(node) ? node.length : 1
        },
        icon: 'undo',
        iconAction: function(response) {
          balloon.undelete(node);
        }
      };
    }

    balloon.xmlHttpRequest(options);
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
      snackbar: {
        message: 'snackbar.node_undeleted',
        values: {
          count: Array.isArray(node) ? node.length : 1
        },
        icon: 'undo',
        iconAction: function(response) {
          balloon.remove(node);
        }
      },
      complete: function() {
        balloon.resetDom('multiselect');
      },
      success: function(data) {
        balloon.displayQuota();

        balloon.reloadTree();
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
    var destName;
    var action;
    var successMessage;

    if(destination === null) {
      destName = i18next.t('menu.cloud');
    } else if(typeof destination !== 'string') {
      destName = destination.name;
    }

    if(clone === true) {
      action = 'clone'
      successMessage = 'snackbar.node_cloned';
    } else {
      action = 'move';
      successMessage = destName !== undefined ? 'snackbar.node_moved' : 'snackbar.node_moved_folderup';
    }

    balloon.xmlHttpRequest({
      url: balloon.base+'/nodes/'+action,
      type: 'POST',
      dataType: 'json',
      snackbar: {
        message: successMessage,
        values: {
          count: Array.isArray(source) ? source.length : 1,
          dest: destName
        },
        icon: 'undo',
        iconAction: function(response) {
          switch(action) {
          case 'clone':
            balloon._undoClone(source, response);
            break;
          case 'move':
            balloon._undoMove(source, destination, conflict);
            break;
          }
        }
      },
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
        //move can only be executed in cloud:root and child collections, therefore no need for reloatTree
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
   * undo a move issued by balloon.move
   *
   * params are the same as passed to balloon.move()
   *
   * @param   string|object|array source (moved elements)
   * @param   string|object|array destination (the destination where source(s) have been moved to)
   * @param   int conflict
   * @return  void
   */
  _undoMove: function(source, destination, conflict, clone) {
    var requests = [];

    if(!Array.isArray(source)) {
      source = [source];
    }

    for(var i=0; i<source.length; i++) {
      var src = source[i];

      var request = balloon.xmlHttpRequest({
        url: balloon.base+'/nodes/move',
        type: 'POST',
        dataType: 'json',
        data: {
          id: balloon.id(src),
          destid: balloon.id(src.parent),
          conflict: conflict
        },
        complete: function() {
          balloon.resetDom('multiselect');
          balloon.deselectAll();
        },
        error: function(data) {
          balloon.displayError(data);
        }
      });

      requests.push(request);
    }

    $.when.apply($, requests).always(function() {
      //undoMove can only be executed in cloud:root and child collections, therefore no need for reloatTree
      balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
    });
  },

  /**
   * undo a clone issued by balloon.move
   *
   *
   * @param   string|object|array source (source elements)
   * @param   object response (response from clone call)
   * @return  void
   */
  _undoClone: function(source, response) {
    var requests = [];

    if(!Array.isArray(source)) {
      source = [source];
    }

    for(var i=0; i<source.length; i++) {
      var src = source[i];
      var clone;

      if(source.length > 1) {
        var id = balloon.id(src);
        clone = response[id].data;
      } else {
        clone = response;
      }

      var request = balloon.xmlHttpRequest({
        url: balloon.base+'/nodes',
        type: 'DELETE',
        dataType: 'json',
        data: {
          id: balloon.id(clone),
          force: true,
        },
        complete: function() {
          balloon.resetDom('multiselect');
          balloon.deselectAll();
        },
        error: function(data) {
          balloon.displayError(data);
        }
      });

      requests.push(request);
    }

    $.when.apply($, requests).always(function() {
      //undoClone can only be executed in cloud:root and child collections, therefore no need for reloatTree
      balloon.refreshTree('/collections/children', {id: balloon.getCurrentCollectionId()});
    });
  },


  /**
   * Map mime to file extension
   *
   * @param   string mime
   * @return  string|bool
   */
  mapMimeToExtension: function(mime) {
    if(mime in balloon.mimeFileExtMap) {
      return balloon.mimeFileExtMap[mime];
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
        if(node.filter) {
          if(node.shared === true && node.reference === true) {
            return 'gr-i-folder-filter-received';
          } else if(node.shared === true) {
            return 'gr-i-folder-filter-shared';
          } else {
            return 'gr-i-folder-filter';
          }
        } else if(node.mount) {
          if(node.shared === true && node.reference === true) {
            return 'gr-i-folder-storage-received';
          } else if(node.shared === true) {
            return 'gr-i-folder-storage-shared';
          } else {
            return 'gr-i-folder-storage';
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

    if(extension in balloon.fileExtIconMap) {
      return balloon.fileExtIconMap[extension];
    } else {
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
          resizable: false,
          modal: false,
          fullscreen: true,
          draggable: false,
          deactivate: function(e) {
            e.sender.destroy();
          },
          keydown: function(e) {
            if(e.originalEvent.keyCode !== 27) {
              return;
            }

            if(data == $textarea.val()) {
              $k_display.close();
              return;
            }
          },
          close: function(e) {
            if(e.userTriggered && data != $textarea.val()) {
              //user tries to close window with unsaved changes
              e.preventDefault();
              var msg  = i18next.t('prompt.close_save_file', node.name);
              balloon.promptConfirm(msg, function(){
                balloon.saveFile(node, $textarea.val());
                $k_display.close();
              });

              $("#fs-prompt-window").find('input[name=cancel]').unbind('click').bind('click', function(){
                $("#fs-prompt-window").data('kendoBalloonWindow').close();
                $k_display.close();
              });
            }
          },
          open: function(e) {
            setTimeout(function(){
              e.sender.wrapper.find('textarea').focus();
            }, 600);

            e.sender.wrapper.find('textarea').unbind('change').bind('change',function(){
              data = $textarea.val();
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
      snackbar: {
        message: 'snackbar.file_saved',
        values: {
          name: node.name
        },
        icon: 'undo',
        iconAction: function(response) {
          balloon.restoreVersion(node.id, node.version, response.version);
        }
      },
      success: function(data) {
        balloon.resetDom('edit');

        if(balloon.last && balloon.last.id === data.id) {
          balloon.last = data;
        }

        switch(balloon.getURLParam('view')) {
        case 'history':
          balloon.displayHistoryView();

          if($('#fs-history-window').is(':visible')) {
            balloon.displayHistoryWindow(node);
          }
          break;
        case 'events':
          balloon.switchView('events');
          break;
        }
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

    var $k_display;
    var options = {
      draggable: false,
      resizable: false,
      modal: true,
      open: function(e) {
      },
      close: function() {
        $('#fs-display-content > *').remove();
      }
    };

    if($div.is(':visible')) {
      options.close();
      options.open();
      $k_display = $div.data("kendoBalloonWindow")
    } else {
      $k_display = $div.kendoBalloonWindow(options).data("kendoBalloonWindow").open().maximize();
    }

    var url = balloon.base+'/files/content?id='+node.id+'&hash='+node.hash;

    if(typeof(login) === 'object' && login.getAccessToken()) {
      url += '&access_token='+login.getAccessToken();
    }

    var $div_content = $('#fs-display-content').html('').hide(),
      $element,
      type = node.mime.substr(0, node.mime.indexOf('/'));
    var $div_content_inner = $('<div id="fs-display-content-inner"></div>');

    $div_content.css({width: 'inherit', height: 'inherit'});
    $div_content_inner.css({width: null, height: null});

    if(type == 'image') {
      $element = $('<img src="'+url+'"/>');

      $element.one('load', function() {
        $div_content_inner.css({width: $element.width(), height: ($element.height() + 40)});
      });
    } else if(type == 'video') {
      $element = $('<video autoplay controls><source src="'+url+'" type="'+node.mime+'"></video>');
    } else if(type == 'audio' || node.mime == 'application/ogg') {
      $element = $('<audio autoplay controls><source src="'+url+'" type="'+node.mime+'">Not supported</audio>');
    } else if(node.mime == 'application/pdf') {
      $div_content.css({width: '90%', height: '90%'})
      $element = $('<embed src="'+url+'" pluginspage="http://www.adobe.com/products/acrobat/readstep2.html">');
    }

    $div_content_inner.append($element);
    $div_content_inner.append('<div id="fs-display-title">' + node.name + '</div>');

    var $close = $('<div id="fs-display-close"><svg viewBox="0 0 24 24" class="gr-icon gr-i-close"><use xlink:href="'+iconsSvg+'#close"></use></svg><div>');
    $div_content_inner.append($close);
    $div_content.show().html($div_content_inner);

    $close.off('click').on('click', function() {
      $k_display.close();
    });

    var index = balloon.datasource._pristineData.indexOf(node);
    var data = balloon.datasource._pristineData;

    for(var i=++index; i<=data.length; i++) {
      if(i in data && data[i].mime && balloon.isViewable(data[i])) {
        $('#fs-display-right').show().unbind('click').bind('click', function(){
          balloon.displayFile(data[i]);
        });
        break;
      }
    }

    index = data.indexOf(node) ;

    for(var i2=--index; i2!=-1; i2--) {
      if(i2 in data && data[i2].mime && balloon.isViewable(data[i2])) {
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
        attributes: ['hard_quota','soft_quota','used','available']
      },
      type: 'GET',
      dataType: 'json',
      success: function(data) {
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
   * Get a nodes size as a human readable string
   *
   * @param   object node
   * @return  string
   */
  nodeSize: function(node) {
    var size = '';
    if(node.directory) {
      size = i18next.t('view.prop.data.childcount', {count: node.size})
    } else {
      size = balloon.getReadableFileSizeString(node.size || 0);
    }

    return size;
  },

  /**
   * Get time since
   *
   * @param   Date date
   * @return  string
   */
  timeSince: function(date, includeAgo) {
    var seconds = Math.floor((new Date() - date) / 1000);

    if(seconds < -1) {
      seconds *= -1;
    }

    var interval = Math.floor(seconds / 31536000);

    if (interval >= 1) {
      return i18next.t(includeAgo ? 'time.year_ago' : 'time.year', {count: interval});
    }
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
      return i18next.t(includeAgo ? 'time.month_ago' : 'time.month', {count: interval});
    }
    interval = Math.floor(seconds / 86400);
    if (interval >= 1) {
      return i18next.t(includeAgo ? 'time.day_ago' : 'time.day', {count: interval});
    }
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) {
      return i18next.t(includeAgo ? 'time.hour_ago' : 'time.hour', {count: interval});
    }
    interval = Math.floor(seconds / 60);
    if (interval >= 1) {
      return i18next.t(includeAgo ? 'time.minute_ago' : 'time.minute', {count: interval});
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
   * @param   object node
   * @return  bool
   */
  isEditable: function(node) {
    let mime = node.mime;

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
   * @param   object node
   * @return  bool
   */
  isViewable: function(node) {
    let mime = node.mime;
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
    if(typeof(node) == 'object' && (node.directory == true || node.name === undefined)) {
      return null;
    }
    var ext;
    if(typeof(node) == 'string') {
      ext = node.split('.');
    } else {
      ext = node.name.split('.');
    }

    if(ext.length == 1) {
      return null;
    }    else {
      return ext.pop();
    }
  },

  /**
   * Display file history in view bar
   *
   * @return  void
   */
  displayHistoryView: function() {
    var limit = 3;
    var node = balloon.getCurrentNode();
    var $fs_history = $('#fs-history');
    var $show_more = $fs_history.find('#fs-history-actions button');
    $show_more.hide();

    var req = balloon.displayHistory($fs_history, node, limit);
    req.done(function(body) {
      if(body && body.data && body.data.length > limit) {
        $show_more.off('click').on('click', function() {
          balloon.displayHistoryWindow(node);
        }).show();
      }
    });
  },

  /**
   * Display file history in given $dom
   *
   * @param   object $dom
   * @param   object node
   * @param   int limit
   * @return  void
   */
  displayHistory: function($dom, node, limit) {
    var $fs_history = $dom.find("ul");
    $fs_history.empty();

    return balloon.xmlHttpRequest({
      dataType: "json",
      url: balloon.base+'/files/history',
      type: "GET",
      data: {
        id: balloon.id(node)
      },
      success: function(data) {
        var action, dom_node, ts, since, radio;
        data.data.reverse();

        limit = limit || data.data.length;

        for(var i=0; i < limit && i < data.data.length; i++) {
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

        var $submit = $dom.find('input[type=submit]');
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
            balloon.alertOpenFile(function() {
              balloon.restoreVersion(node.id, version, node.version);
            });
          }
        });
      }
    });
  },


  /**
   * Display file history in modal
   *
   * @param   object node
   * @return  void
   */
  displayHistoryWindow: function(node) {
    var $fs_history_win   = $('#fs-history-window');

    if($fs_history_win.is(':visible')) {
      balloon.displayHistory($fs_history_win, node);
    } else {
      $fs_history_win.kendoBalloonWindow({
        title: i18next.t('view.history.history_for', node.name),
        resizable: false,
        modal: true,
        open: function() {
          balloon.displayHistory($fs_history_win, node);

          $fs_history_win.find('input[name="cancel"]').off('click').on('click', function(){
            $fs_history_win.data("kendoBalloonWindow").close();
          });
        }
      }).data('kendoBalloonWindow').center().open();
    }
  },

  /**
   * Restore file to a previous version
   *
   * @param   string|object node
   * @param   int version
   * @param   int prevVersion
   * @return  void
   */
  restoreVersion: function(node, version, prevVersion) {
    var options = {
      url: balloon.base+'/files/restore',
      type: 'POST',
      dataType: 'json',
      data: {
        version: version,
        id: balloon.id(node),
      },
      snackbar: {
        message: 'snackbar.restore_file',
        values: {
          version: version
        },
        icon: 'undo',
        iconAction: function(response) {
          balloon.restoreVersion(node, prevVersion, version);
        }
      },
      success: function(data) {
        if(balloon.last && balloon.last.id === data.id) {
          balloon.last = data;
        }

        balloon.displayHistoryView();
        balloon.reloadTree();

        if($('#fs-history-window').is(':visible')) {
          balloon.displayHistoryWindow(node);
        }
      }
    };

    if(prevVersion === undefined) {
      delete options.snackbar.icon;
      delete options.snackbar.iconAction;
    }

    balloon.xmlHttpRequest(options);
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

    var curValue = balloon.getCurrentNode().meta[name];

    var valueChanged =
      //value was not set before
      !(curValue === undefined && value === '')
      &&
      //changed value
      curValue !== value;

    if(valueChanged) {
      attrs[name] = value;
      balloon.saveMetaAttributes(balloon.getCurrentNode(), attrs);
    }
  },

  /**
   * Displays the name of the node
   *
   * @return  void
   */
  displayName: function(node) {
    var $fs_content_nodename = $('.fs-content-nodename');

    $fs_content_nodename.find('span').remove();
    $fs_content_nodename.find('input').remove();

    $fs_content_nodename.append('<span class="fs-value"></span>');
    var $field = $fs_content_nodename.find('.fs-value');

    var ext = balloon.getFileExtension(node);
    var name = node.name;

    var displayName = name;

    if(ext != null && node.directory == false) {
      $fs_content_nodename.append('<span class="fs-ext">('+ext+')</span>');
      var filename = name.substr(0, name.length-ext.length-1);
      $field.html(filename);
      displayName = filename + ' (' + ext.toUpperCase() + ')';
    } else {
      $field.html(name);
    }

    if($('body').hasClass('fs-fullscreen-window-open')) {
      $('.fs-fullscreen-window .k-window-title').html(displayName);
    }
  },

  /**
   * Display metadata of one node
   *
   * @param   object node
   * @return  void
   */
  displayMetadata: function(node) {
    var $fs_fileonly = $('.fs-metadata-fileonly').hide();

    if(node.directory === false) {
      $fs_fileonly.show();
    }

    var $field;

    //TODO pixtron - rename prop to attribute
    for(var prop in node) {
      var $parent = $('#fs-metadata-'+prop);
      var value;

      $field = $parent.find('.fs-value');
      $parent.parent().show();

      switch(prop) {
      case 'changed':
      case 'deleted':
      case 'created':
        if(node[prop] !== null) {
          var date   = new Date(node[prop]),
            format = kendo.toString(date, kendo.culture().calendar.patterns.g),
            since  = balloon.timeSince(date);

          value = i18next.t('view.history.changed_since', since, format);
        }
        break;

      case 'size':
        if(node.directory === true) {
          value = i18next.t('view.prop.data.childcount', {count: node[prop]});
        } else {
          value = i18next.t('view.prop.data.size', balloon.getReadableFileSizeString(node[prop]), node[prop]);
        }

        break;

      case 'share':
      case 'shared':
        if('shareowner' in node) {
          var access = i18next.t('view.share.privilege_'+node.access);

          if(node.shared === true) {
            value = i18next.t('view.prop.head.share_value', node.sharename, node.shareowner.name, access);
          } else if(node.share) {
            value = i18next.t('view.prop.head.share_value', node.share.name, node.shareowner.name, access);
          } else {
            continue;
          }

          var $icon = $('#fs-metadata-share').find('svg');
          $field = $('#fs-metadata-share').find('.fs-value');
          $('#fs-metadata-share').parent().show();

          var iconId = node.shareowner.name == login.username ? 'folder-shared' : 'folder-received';
          $icon.replaceWith('<svg class="gr-icon gr-i-' + iconId + '" viewBox="0 0 24 24"><use xlink:href="'+iconsSvg+'#' + iconId + '"></use></svg>');
        }
        break;
      case 'mount':
        var $fs_metadata_mount = $('#fs-metadata-mount');

        value = i18next.t('view.prop.head.mount_value', node.mount.share, node.mount.username, node.mount.adapter, node.mount.host, node.mount.workgroup);

        $field = $fs_metadata_mount.find('.fs-value');
        $fs_metadata_mount.parent().show();

        break;
      default:
        if($field.length != 0 && prop !== 'access' && prop != 'shareowner') {
          value = node[prop];
        }
        break;
      }

      $field.html(value);
      $field.prop('title', value);
      $field.off('click').on('click', function(event) {
        if(!balloon.isTouchDevice()) return;

        event.stopPropagation();

        var $this = $(this);

        var $title = $this.find('.tooltip');

        $('#fs-metadata .tooltip').remove();

        if(!$title.length) {
          $this.parent().append('<span class="tooltip">' + $this.attr('title') + '</span>');
          $(document).off('click.meta-tooltip').on('click.meta-tooltip', function() {
            $('#fs-metadata .tooltip').remove();
          });
        }
      });
    }

    var $parent = $('#fs-metadata-perma-link');
    $field = $parent.find('.fs-value');
    $parent.parent().show();
    value = balloon._buildPermaLink(node.id, true);

    $field.html(value);

    $field.unbind('click').bind('click', function() {
      balloon._copyPermaLink(node.id);
    });
  },


  /**
   * Copy permalink to clipboard
   *
   * @return void
   */
  _copyPermaLink: function(id) {
    balloon.copyToClipboard(balloon._buildPermaLink(id, false));

    balloon.showSnackbar({message: 'view.share_link.link_copied'});
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
  initMetaTagCompletion: function(onSelect) {
    var $meta_tags = $('#fs-properties-meta-tags-tags'),
      $meta_tags_parent = $meta_tags.parent(),
      $input = $meta_tags_parent.find('input');

    var autocomplete = $input.data('kendoAutoComplete');
    if(autocomplete) autocomplete.destroy();

    $input.kendoAutoComplete({
      select: onSelect,
      minLength: 0,
      dataTextField: "_id",
      highlightFirst: true,
      noDataTemplate: i18next.t('error.autocomplete.no_tags_found'),
      dataSource: new kendo.data.DataSource({
        transport: {
          read: function(operation) {
            balloon.xmlHttpRequest({
              url: balloon.base+'/users/' + login.user.id + '/node-attribute-summary',
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
   * Open preview
   */
  openPreview: function(node) {
    var $fs_preview_win = $('#fs-preview-window');
    var $preview = $('#fs-preview-thumb').find('img');

    var $k_preview_win = $fs_preview_win.kendoBalloonWindow({
      title: node.name,
      resizable: false,
      modal: true,
      open: function() {
        $fs_preview_win.html($preview);
      }
    }).data('kendoBalloonWindow').center().open();
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
        $fs_prop_tags_list.append('<li class="tag"><div class="tag-name">'+node.meta.tags[tag]+'</div><div class="fs-delete"><svg viewBox="0 0 24 24" class="gr-icon gr-i-close"><use xlink:href="'+iconsSvg+'#close"></use></svg></div></li>');
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
      url: balloon.base+'/files/preview?id='+balloon.id(node),
      type: 'GET',
      timeout: 5000,
      mimeType: "text/plain; charset=x-user-defined",
      beforeSend: function() {
        $fs_preview_outer.show();
        // TODO pixtron - what is this class used for?
        $fs_preview.addClass('fs-loader');
      },
      complete: function() {
        // TODO pixtron - what is this class used for?
        $fs_preview.removeClass('fs-loader');

        $fs_preview.find('*').unbind('click').bind('click', function() {
          balloon.openFile(node);
        });
      },
      success: function(data) {
        if(data == '') {
          this.error();
        } else {
          var img = document.createElement('img');
          img.src = 'data:image/png;base64,' +balloon.base64Encode(data);
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
    var $fs_prop_tags = $('#fs-properties-meta-tags-tags'),
      $fs_prop_tags_parent = $fs_prop_tags.parent();

    $fs_prop_tags_parent.find('.fs-add').unbind('click').bind('click', function(){

      balloon.initMetaTagCompletion(function(e) {
        balloon._metaTagHandler(node, e);
      });

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

      balloon.resetSearchFilter(['tags', 'color', 'mime']);
      $('#fs-search-input').val('');

      balloon.advancedSearch({tags: [$(this).find('.tag-name').text()]});
    });

    $fs_prop_tags_parent.find('input[name=add_tag]').unbind('keyup').on('keyup', function(e) {
      balloon.resetDom('upload');

      return balloon._metaTagHandler(node, e);
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
  _metaTagHandler: function(node, e) {
    var tagValue = '',
      $fs_prop_tags = $('#fs-properties-meta-tags-tags'),
      $fs_prop_tags_parent = $fs_prop_tags.parent(),
      $input = $fs_prop_tags_parent.find('input[name=add_tag]');

    if(e.type === undefined && e.item) {
      //kendoAutocomplete select event
      tagValue = e.item.text();
    } else if(e.type === 'keyup') {
      var code = (!e.charCode ? e.which : e.charCode);
      if(code == 13 || code == 32 || code == 186 || code == 188 || code == 0) {
        tagValue = $input.val().replace(/^\s+|[\s;,]+$/gm, '');
      }
    } else {
      return true;
    }

    if(tagValue === '') {
      //do not add empty tags
      return true;
    }

    var tags = $fs_prop_tags.find('li').map(function () {
      return $(this).find('.tag-name').text();
    }).get();

    if(tags.indexOf(tagValue) != -1) {
      //do not add tags twice
      return false;
    }

    e.preventDefault();

    $fs_prop_tags.find('ul').append('<li class="tag"><div class="tag-name">'+tagValue+'</div><div class="fs-delete"><svg viewBox="0 0 24 24" class="gr-icon gr-i-close"><use xlink:href="'+iconsSvg+'#close"></use></svg></div></li>');
    tags.push(tagValue);

    balloon.saveMetaAttributes(node, {tags: tags});

    $input.val('');

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
      $('#fs-content-nav-' + elements[element]).removeClass('disabled');
    }
  },


  /**
   * Disable action(s)
   *
   * @param   string|array elements action(s) to disabled
   * @return  void
   */
  disableAction: function(elements) {
    if(!elements) return;

    if(typeof(elements) === 'string') elements = [elements];

    var i;
    for(i=0; i<elements.length; i++) {
      $('#fs-action-'+elements[i]).addClass('fs-action-disabled');

      if(elements[i] == 'paste') {
        $('body').removeClass('fs-content-paste-active');
      }
    }
  },

  /**
   * Disable action(s)
   *
   * @param   string|array elements action(s) to enable
   * @param   bool reset
   * @return  void
   */
  enableAction: function(elements, reset) {
    if(!elements) return;

    if(typeof(elements) === 'string') elements = [elements];

    if(reset) balloon.resetDom('action-bar');

    var i;
    for(i=0; i<elements.length; i++) {
      $('#fs-action-'+elements[i]).removeClass('fs-action-disabled');

      if(elements[i] == 'paste') {
        $('body').addClass('fs-content-paste-active');
      }
    }
  },


  /**
   * Toggle side pannel
   *
   * @param boolean expand (optional)
   * @return void
   */
  updatePannel: function(enabled) {
    var $fs_browser_layout = $('#fs-browser-layout');
    var menu = balloon.getURLParam('menu');

    if(enabled === undefined) enabled = true;

    var actions = [];

    if(balloon.selected_action.command !== null) {
      actions.push('paste');
    }

    if(enabled === true) {
      actions.push('download');

      if(!balloon.isSearch() && !balloon.isMultiSelect()) {
        actions.push('rename');
      }

      if(!balloon.isSearch() || balloon.getCurrentCollectionId() !== null) {
        actions.push('cut', 'copy');
      }

      if(balloon.last) {
        actions.push('delete');
      }

      if(balloon.last && !balloon.isMultiSelect() && menu !== 'trash' && !balloon.last.deleted) {
        actions.push('perma-link');
      }

      if(balloon.last && balloon.last.deleted) {
        actions.push('restore');
      }

      balloon.enableAction(actions, true);
    } else {
      balloon.enableAction(actions, true);
    }
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
      balloon.alertOpenFile(function() {
        balloon.deletePrompt(balloon.getSelected(balloon.getCurrentNode()));
      });
      break;
    case 'restore':
      balloon.undeletePrompt(balloon.getSelected(balloon.getCurrentNode()));
      break;
    case 'download':
      balloon.downloadNode(balloon.getSelected(balloon.getCurrentNode()));
      break;
    case 'refresh':
      balloon.displayQuota();
      //refresh is not available on search results, therefore no need for reloadTree
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

      var count = Array.isArray(balloon.selected_action.nodes) ? balloon.selected_action.nodes.length : 1;
      $('#fs-action-paste-count').html(count);

      balloon.enableAction('paste');
      break;

    case 'paste':
      var parent;
      if(balloon.getCurrentNode() !== null) {
        parent = balloon.getCurrentCollectionId()
      } else if(!balloon.isMultiSelect()) {
        parent = balloon.getSelected(balloon.getCurrentNode());
      }

      if(balloon.selected_action.command === 'cut') {
        if(balloon.selected_action.collection !== parent) {
          balloon.move(balloon.selected_action.nodes, parent);
        }
      } else if(balloon.selected_action.command === 'copy') {
        if(balloon.selected_action.collection == parent) {
          balloon.clone(balloon.selected_action.nodes, parent, 1);
        } else {
          balloon.clone(balloon.selected_action.nodes, parent);
        }
      }

      balloon.disableAction('paste');

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

    case 'sorting':
      var $select = $('#fs-action-sorting-select');

      if($select.is(':visible')) {
        $select.hide();
        return;
      }

      $(document).off('click.action-sorting').on('click.action-sorting', function(e){
        var $target = $(e.target);

        if($target.attr('id') != "fs-action-sorting") {
          $select.hide();
        }
      })

      $select.show().off('change', 'input[type=radio]').on('change', 'input[type=radio]', function(event) {
        var values = $(this).val().split(':');
        balloon._sortTree(values[0], values[1]);
      });
      break;

    case 'rename':
      balloon.initRename();
      break;
    case 'perma-link':
      var selected = balloon.getSelected(balloon.getCurrentNode());

      balloon._copyPermaLink(selected.id);
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

    if(name === 'deleted') {
      balloon.tree.filter.deleted = checked ? 2 : 0;
    } else {
      balloon.tree.filter[name] = checked;
    }

    $('#fs-action-filter-select').hide();

    balloon.refreshTree(null, {id: balloon.getCurrentCollectionId()});
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
        'metadata',
        'preview',
        'action-bar',
        'multiselect',
        'view-bar',
        'history',
        'share',
        'share-link',
        'properties',
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
        $('#fs-profile-window dl > *').removeClass('active');
        balloon.resetWindow('fs-profile-window');
        break;

      case 'metadata':
        balloon._rename();
        balloon._resetRenameView();
        var $parent = $('#fs-metadata');
        $parent.find('tr').hide();

        $parent.find("span").html('');
        $('#fs-metadata-root').hide();
        $('#fs-view').hide();
        $("#fs-metadata-collection").hide();
        $(".fs-metadata-fileonly").hide();
        $("#fs-metadata-node").hide();
        $('#fs-metadata-share').parent().hide();
        $('#fs-metadata-mount').parent().hide();
        break;

      case 'properties':
        var $parent = $('#fs-properties');
        $parent.find('textarea').val('');
        $parent.find('input').val('');
        $parent.find('select').val('');
        break;

      case 'selected':
        $("#fs-browser-summary").hide();
        var $name = $("#fs-properties-name").hide();
        $name.find('.fs-sprite').removeAttr('class').addClass('fs-sprite');
        $name.find('.fs-value').html('');
        $name.find('.fs-ext').html('');
        break;

      case 'preview':
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
        $("#fs-prompt-window").addClass("fs-prompt-window-inner");
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
        $('#fs-content-view-wrap').removeClass('mobile-overlay-in-from-right').removeClass('mobile-overlay-out-to-right');
        $('#fs-content-view').find('dt,dd').addClass('disabled').removeClass('active');
        $('#fs-content-nav-small li').addClass('disabled');
        $('#fs-content-view dt').unbind('click');
        $('#fs-content-view-small dt').unbind('click');
        $('#fs-properties-name span').html('');
        break;

      case 'action-bar':
        $('#fs-browser-select-action li').addClass('fs-action-disabled');
        break;

      case 'search':
        var $fs_search = $('#fs-search');
        var $fs_search_input = $fs_search.find('#fs-search-input');

        $fs_search
          .removeClass('fs-search-focused')
          .removeClass('fs-search-mobile-visible')
          .removeClass('fs-search-filtered')
          .removeClass('fs-search-mode-dropdown-open');

        var modes = Object.keys(balloon.search_modes);

        $fs_search.find('#fs-search-mode-toggle span').contents().last().replaceWith(i18next.t(balloon.search_modes[modes[0]].label));
        $fs_search.find('#fs-search-mode-'+ modes[0]).prop('checked', true);

        $fs_search_input.val('');
        $('#fs-crumb-search').data('is-search-result', false);
        break;

      case 'history':
        var $view = $("#fs-history");
        $view.find("li").remove();
        $view.find('input[type=submit]').hide();
        break;

      case 'multiselect':
        balloon.multiselect = [];
        $('#fs-browser-summary div:first-child').html('');
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

      case 'share-link-settings':
        var $fs_share_link_settings_win = $('#fs-share-link-settings-window');
        $fs_share_link_settings_win.find('#fs-share-link-expiration-check').prop('checked', false);
        $fs_share_link_settings_win.find('#fs-share-link-password-check').prop('checked', false);
        $fs_share_link_settings_win.find('#fs-share-link-destroy').prop('checked', false).prop('disabled', true);
        $fs_share_link_settings_win.find('input[name=share_password]').val('');
        $fs_share_link_settings_win.find('input[name=share_expiration_time]').val('');
        $fs_share_link_settings_win.find('input[name=share_expiration_date]').val('');
        break;

      case 'tree':
        var $tree   = $("#fs-browser-tree"),
          $k_tree = $tree.data('kendoTreeView');

        if($k_tree !== undefined) {
          $k_tree.destroy();
          $tree.replaceWith('<div id="fs-browser-tree"></div>');
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
        $('#fs-crumb-search').data('is-search-result', false);
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
      $fs_browser_tree = $('#fs-browser-tree');

    if(dom_node != undefined) {
      dn = dom_node;
    } else {
      dn = $('#fs-browser-tree').find('.k-item[fs-id='+balloon.id(parent_node)+']');
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
   * Creates a collection
   *
   * @param   string parent parent collection id
   * @param   string name name of the new collection
   * @param   object options override request options
   * @return  $.Deferred
   */
  _createCollection: function(parent, name, options) {
    var $d = $.Deferred();

    var reqOptions = {
      url: balloon.base+'/collections',
      type: 'POST',
      data: {
        id: parent,
        name: name,
      },
      dataType: 'json',
      complete: function(jqXHR, textStatus) {
        switch(textStatus) {
        case 'success':
          $d.resolve(jqXHR.responseJSON);
          break;
        default:
          $d.reject();
        }
      }
    };

    $.extend(true, reqOptions, options || {});

    if(reqOptions.suppressSnackbar !== true) {
      reqOptions.snackbar = {
        message: 'snackbar.collection_created',
        values: {
          name: name
        },
        icon: 'undo',
        iconAction: function(response) {
          balloon.remove(response, true, true);
        }
      };
    }

    balloon.xmlHttpRequest(reqOptions);

    return $d;
  },

  /**
   * Creates a collection for uploaded folder
   *
   * @param   string parent parent collection id
   * @param   string name name of the new collection
   * @return  $.Deferred
   */
  _uploadCreateCollection: function(parent, name) {
    var $d = $.Deferred();

    balloon.uploadCollectionManager.uploadCreateCollectionQueue.push({
      parent: parent,
      name: name,
      done: function(response) {
        balloon._uploadCreateCollectionDone(parent, name);
        balloon._uploadCreateCollectionNext();
        $d.resolve(response.id);
      },
      fail: function() {
        $d.reject();
      },
    });

    balloon._uploadCreateCollectionNext();

    return $d;
  },

  /**
   * Checks if a new task can be shifted from the queue
   *
   * @return  void
   */
  _uploadCreateCollectionNext: function() {
    var maxConcurrentRequests = 3;

    if(Object.keys(balloon.uploadCollectionManager.uploadCreateCollectionPending).length < maxConcurrentRequests) {
      var task = this.uploadCollectionManager.uploadCreateCollectionQueue.shift();

      if(task) {
        balloon.uploadCollectionManager.uploadCreateCollectionPending[task.parent+'-'+task.name] = task;

        var options = {
          suppressSpinner: true,
          suppressSnackbar: true,
          /*
          //TODO pixtron - handle errror when folder already exists?
          error: function(response) {
          }*/
        };

        balloon._createCollection(task.parent, task.name, options)
          .done(task.done)
          .fail(task.fail);
      }
    }
  },

  /**
   * Removes done task from the create collection pending queue
   *
   * @param  string parent parent id
   * @param  string name name of the collection
   * @return  void
   */
  _uploadCreateCollectionDone: function(parent, name) {
    delete balloon.uploadCollectionManager.uploadCreateCollectionPending[parent+'-'+name];
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

    var blobs;

    if('originalEvent' in e && 'dataTransfer' in e.originalEvent) {
      try {
        balloon.showSpinner();
        var handler = new dataTransferItemsHandler(balloon._uploadCreateCollection, balloon._handleFileEntry);
        var $d = handler.handleItems(e.originalEvent.dataTransfer.items, balloon.id(parent_node));

        $d.done(function(files) {
          balloon.hideSpinner();
        });

        $d.fail(function(err) {
          balloon.hideSpinner();
          blobs = e.originalEvent.dataTransfer.files;
          balloon._handleFileSelectFilesOnly(blobs, parent_node);
        });
      } catch(err) {
        balloon.hideSpinner();
        blobs = e.originalEvent.dataTransfer.files;
      }
    } else {
      blobs = e.target.files;
    }

    if(blobs) {
      //if blobs are set - either browser does not support directory upload, or only files have been selected
      balloon._handleFileSelectFilesOnly(blobs, parent_node);
    }
  },

  /**
   * Prepare a FileEntry for upload
   *
   * @param   FileEntry file
   * @param   parent parent id where the file should be uploaded to
   * @return  $.Deferred
   */
  _handleFileEntry: function(file, parent) {
    var $d = $.Deferred();

    file.file(function(fileObj) {
      var files = [{
        blob: fileObj,
        parent: parent
      }];

      balloon.uploadFiles(files);
      $d.resolve();
    }, function(err) {
      $d.reject(err);
    });

    return $d;
  },

  /**
   * Prepare selected files for upload, if it is a files only upload
   *
   * @param   FileList blobs
   * @return  void
   */
  _handleFileSelectFilesOnly: function(blobs, parent_node) {
    var i;
    var files = [];

    for(i=0; i<blobs.length; i++) {
      files.push({
        blob: blobs[i],
        parent: parent_node
      });
    }

    balloon.uploadFiles(files);
  },

  /**
   * Prepare selected files for upload
   *
   * @param   array files
   * @return  void
   */
  uploadFiles: function(files) {
    balloon.resetDom(['upload-progress', 'uploadmgr-progress']);

    if(balloon.upload_manager === null ||
    balloon.upload_manager.count.transfer === balloon.upload_manager.count.upload) {
      balloon.resetDom('uploadmgr-progress-files');

      if(balloon.upload_manager && balloon.upload_manager.window) {
        balloon.upload_manager.window.close();
      }

      balloon.upload_manager = {
        window: undefined,
        progress: {
          mgr_percent: null,
          notifier_percent: null,
          mgr_chunk:   null,
        },
        files: {},
        queue: [],
        pending: {},
        upload_bytes: 0,
        transfered_bytes: 0,
        count: {
          upload:   0,
          transfer: 0,
          success:  0
        },
        start_time: new Date(),
      };
    }

    var $upload_list = $('#fs-upload-list');
    for(var i = 0, progressnode, file; file = files[i]; i++) {
      if(file.blob instanceof Blob) {
        file = {
          name: file.blob.name,
          blob: file.blob,
          parent: file.parent
        };
      }

      if(file.blob.size === 0) {
        balloon.displayError(new Error('Upload folders or empty files is not yet supported'));
      } else {
        var uuid = balloon.uuid();
        var progressId = 'fs-upload-'+uuid;
        progressnode = $('<div id="'+progressId+'" class="fs-uploadmgr-progress"><div id="'+progressId+'-progress" class="fs-uploadmgr-progressbar"></div></div>');
        $upload_list.append(progressnode);

        $('#'+progressId+'-progress').kendoProgressBar({
          type: 'percent',
          animation: {
            duration: 10
          },
        });

        balloon.upload_manager.files[uuid] = {
          progress:   progressnode,
          blob:     file.blob,
          name:     file.name,
          parent:   file.parent,
          index:    1,
          start:    0,
          end:    0,
          transfered_bytes: 0,
          success:  Math.ceil(file.blob.size / balloon.BYTES_PER_CHUNK),
          slices:   Math.ceil(file.blob.size / balloon.BYTES_PER_CHUNK),
          manager:  balloon.upload_manager,
          request:  null,
          status:   1,
          id: uuid,
        };

        balloon.upload_manager.queue.push(uuid);

        progressnode.prepend('<div class="fs-progress-filename">'+file.name+'</div>');
        progressnode.append('<div class="fs-progress-icon"><svg viewBox="0 0 24 24" class="gr-icon gr-i-close"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="'+iconsSvg+'#close"></use></svg></div>');

        balloon.upload_manager.upload_bytes += file.blob.size;
      }
    }

    if(Object.keys(balloon.upload_manager.files).length <= 0) {
      return;
    }

    $('#fs-upload-list').off('click', '.fs-progress-icon').on('click', '.fs-progress-icon', function() {
      var uuid  = $(this).parent().attr('id').substr(10),
        file = balloon.upload_manager.files[uuid];

      if(file.status !== 1) {
        return;
      }

      file.status = 0;
    });

    balloon.upload_manager.count.upload  = Object.keys(balloon.upload_manager.files).length;
    balloon._initProgress(balloon.upload_manager);

    $('#fs-upload-progress').unbind('click').click(function(){
      balloon._openUploadManagerWindow();
    });

    $('#fs-uploadmgr-files').html(
      i18next.t('uploadmgr.files_uploaded', "0", balloon.upload_manager.count.upload)
    );

    $('#fs-uploadmgr-bytes').html('<span>0</span> / '+balloon.getReadableFileSizeString(balloon.upload_manager.upload_bytes));

    $('#fs-upload-progree-info-status-uploaded').html('0');
    $('#fs-upload-progree-info-status-total').html(balloon.getReadableFileSizeString(balloon.upload_manager.upload_bytes));

    balloon._uploadManagerNext();

  },

  /**
   * Opens the upload manager window
   *
   * @return void
   */
  _openUploadManagerWindow: function() {
    var $div = $('#fs-uploadmgr');

    if(!balloon.upload_manager.window) {
      $div.kendoBalloonWindow({
        title: $div.attr('title'),
        resizable: false,
        modal: true,
      });

      balloon.upload_manager.window = $div.data('kendoBalloonWindow');
    }


    balloon.upload_manager.window.center().open()
  },

  /**
   * Try to start next uploads
   *
   * @return void
   */
  _uploadManagerNext: function() {
    var maxConcurrentRequests = 3;
    var pending = Object.keys(balloon.upload_manager.pending).length;

    for(pending; pending < maxConcurrentRequests; pending++) {
      var uuid = balloon.upload_manager.queue.shift();

      if(uuid && balloon.upload_manager.files[uuid]) {
        balloon.upload_manager.pending[uuid] = true;
        balloon._chunkUploadManager(balloon.upload_manager.files[uuid]);
      } else {
        //no more uploads
        break;
      }
    }
  },

  /**
   * Upload done, removes it from pending uploads, and schedules next
   *
   * @param  string uuid, id of the file
   * @return void
   */
  _uploadManagerDone: function(uuid) {
    delete balloon.upload_manager.pending[uuid];
    balloon._uploadManagerNext();
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

        file.progress.find('.fs-progress-icon').replaceWith('<div class="fs-progress-icon fs-progress-complete"><svg viewBox="0 0 24 24" class="gr-icon gr-i-checkmark"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="'+iconsSvg+'#checkmark"></use></svg></div>');
        file.progress.find('.fs-progress-icon').off('click');

        $('#fs-uploadmgr-files').html(i18next.t('uploadmgr.files_uploaded',
          file.manager.count.success.toString(), file.manager.count.upload)
        );

        balloon._uploadManagerDone(file.id);
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

      balloon._uploadManagerDone(file.id);
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
    var url = balloon.base + '/files/chunk?name=' + encodeURIComponent(file.name) + '&index=' +
      file.index + '&chunks=' + file.slices + '&size=' + file.blob.size;

    if(file.session) {
      url += '&session='+file.session;
    }

    if(file.parent !== null) {
      url += '&collection='+balloon.id(file.parent);
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
      contentType: 'application/octet-stream',
      type: 'PUT',
      data: chunk,
      processData: false,
      suppressSnackbar: true,
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
        file.progress.find('.fs-progress-icon').addClass('fs-progress-error').replaceWith('<div class="fs-progress-icon"><svg viewBox="0 0 24 24" class="gr-icon gr-i-error"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="'+iconsSvg+'#error"></use></svg></div>');
        file.progress.find('.fs-progress-icon').off('click');

        file.status = 2;
        file.manager.count.transfer++;
        balloon._checkUploadEnd();

        var data = balloon.parseError(e);
        if(data === false || data.status != 403) {
          balloon.displayError(e);
        } else {
          if(data.code === 40) {
            var new_name = balloon.getCloneName(file.blob.name);
            var new_file = {
              name: new_name,
              blob: file.blob,
              parent: file.parent
            };

            balloon.promptConfirm(i18next.t('prompt.auto_rename_node', file.blob.name, new_name), 'uploadFiles', [[new_file]]);
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
  },

  /**
   * Evaluate toggle_fs_browser_action_hooks
   *
   * @return boolean true if all hooks return true, false otherwise
   */
  _evalToggleFsBrowserActionHooks: function() {
    return Object.keys(balloon.toggle_fs_browser_action_hooks).every(function(key) {
      return balloon.toggle_fs_browser_action_hooks[key]();
    });
  },

  _initSwipeEvents: function() {
    balloon._initMenuLeftSwipeEvents();
    balloon._initMobileOverlaySwipeEvents();
  },

  _unifyTouchEvent: function(e) {
    return e.changedTouches ? e.changedTouches[0] : e;
  },

  _initMobileOverlaySwipeEvents: function() {
    var $overlays = $('#fs-content-nav-small-wrap, #fs-content-view-wrap');

    var $body = $('body');

    var threshhold = $body.width() / 4;
    var direction;
    var x0;

    function touchstart(e) {
      x0 = balloon._unifyTouchEvent(e).clientX;
    }

    function touchemove(e) {
      if(direction === undefined) {
        direction = (balloon._unifyTouchEvent(e).clientX - x0) > 0  ? 'right' : 'left';
      }
    }

    function touchend(e) {
      var xDiff = balloon._unifyTouchEvent(e).clientX - x0;

      switch(direction) {
      case 'right':
        if(xDiff > threshhold) {
          balloon.fsContentMobilePrev();
          e.preventDefault();
          e.stopPropagation();
        }
        break;
      }

      direction = undefined;
    };

    $overlays.off('touchstart').on('touchstart', touchstart);
    $overlays.off('touchmove').on('touchmove', touchemove);
    $overlays.off('touchend').on('touchend', touchend);
  },

  _initMenuLeftSwipeEvents: function() {
    var $fs_menu_left = $('#fs-menu-left');
    var $fs_layout = $('#fs-browser-layout');

    this.slideout = new Slideout({
      'panel': $fs_layout[0],
      'menu': $fs_menu_left[0],
      'padding': 240,
      'tolerance': 70
    });

    var $toggle = $('#fs-menu-left-toggl');

    this.slideout.on('beforeopen', function(){
      $toggle.addClass('fs-menu-left-open');
      $fs_menu_left.addClass('fs-menu-left-open');
      $fs_menu_left.css('z-index', '15');
    });

    this.slideout.on('beforeclose', function() {
      $toggle.removeClass('fs-menu-left-open');
      $fs_menu_left.removeClass('fs-menu-left-open');
      $fs_menu_left.css('z-index', '0');
    });

    this.slideout.on('translatestart', function() {
      $fs_menu_left.css('z-index', '0');
    });
  },

  /**
   * Copies a value to clipboard
   *
   * @param string value value to copy
   * @return void
   */
  copyToClipboard: function(value) {
    var tmpEl = document.createElement('textarea');

    document.body.appendChild(tmpEl);

    tmpEl.contentEditable = true;
    tmpEl.readOnly = false;
    tmpEl.value = value;

    var range = document.createRange();
    range.selectNodeContents(tmpEl);

    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(range);

    var userAgent = window.navigator.userAgent;
    if (userAgent.match(/iPad/i) || userAgent.match(/iPhone/i)) {
      tmpEl.setSelectionRange(0, 999999);
    } else {
      tmpEl.select();
    }

    document.execCommand('copy');

    document.body.removeChild(tmpEl);
  },

  fsContentMobileNext: function() {
    var $body = $('body');
    if(balloon.fs_content_mobile_current_state < balloon.fs_content_mobile_states.length-1) {
      $body.addClass('fs-content-mobile-animating');
      $body.removeClass(balloon.fs_content_mobile_states[balloon.fs_content_mobile_current_state]);
      balloon.fs_content_mobile_current_state ++;
      $body.addClass(balloon.fs_content_mobile_states[balloon.fs_content_mobile_current_state]);

      window.setTimeout(function() {
        $body.removeClass('fs-content-mobile-animating');
      }, 250);
    }
  },

  fsContentMobilePrev: function() {
    var $body = $('body');
    if(balloon.fs_content_mobile_current_state > 0) {
      $body.addClass('fs-content-mobile-animating');
      $body.removeClass(balloon.fs_content_mobile_states[balloon.fs_content_mobile_current_state]);
      balloon.fs_content_mobile_current_state --;
      $body.addClass(balloon.fs_content_mobile_states[balloon.fs_content_mobile_current_state]);

      window.setTimeout(function() {
        $body.removeClass('fs-content-mobile-animating');
      }, 250);
    }
  },
};

import './app.js';
export default balloon;
