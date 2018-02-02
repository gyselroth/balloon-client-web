/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import i18next from 'i18next';
import css from '../styles/style.css';

var app = {
  render: function() {
    var $node = $('<li id="fs-view-shadow" style="display: inline-block;" class="fs-view-bar-active">'
                +'<span>'+i18next.t('app.balloon_app_convert.menu_title')+'</span>'
            +'</li>');

    $('#fs-view-bar').find('ul').append($node);
    app.$menu = $node;

    var $view = $('<div id="fs-shadow" class="fs-view-content">'
                +'<div id="fs-shadow-description">'+i18next.t('app.balloon_app_convert.description')+'</div>'
                +'<div id="fs-shadow-not-supported">'+i18next.t('app.balloon_app_convert.not_supported')+'</div>'
                +'<select name="formats">'
                    +'<option>'+i18next.t('app.balloon_app_convert.choose_format')+'</option>'
                +'</select>'
                +'<span class="k-sprite gr-i-add gr-icon"></span>'
                +'<ul></ul>'
            +'</div>');

    $('#fs-content-data').append($view);

    this.$view = $view;
  },

  init: function(core)  {
    this.balloon = core;
    $('#fs-browser-tree').data('kendoTreeView').bind("select", this.selectNode);

    this.$view.find('ul').on('click', '.gr-i-remove', function(){
      var id = $(this).parent().attr('data-id');
      app.deleteSlave(app.balloon.last, id);
    });
  },

  resetView: function() {
    app.$view.find('li, option[value]').remove();
    app.$view.find('.fs-shadow-not-supported').hide();
  },

  selectNode: function() {
    if(app.balloon.last.directory || app.balloon.last.deleted) {
      return;
    }

    app.$menu.show().unbind('click').bind('click', function(){
      app.resetView();
      $('.fs-view-content').hide();
      $('#fs-view-bar').find('li').removeClass('fs-view-bar-active');
      $('#fs-view-shadow').addClass('fs-view-bar-active');
      app.$view.show();
      app.loadSlaves(app.balloon.last);
      app.loadSupportedFormats(app.balloon.last);
    });
  },

  loadSlaves: function(node) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/file/convert/slaves',
      type: 'GET',
      dataType: 'json',
      data: {
        id: app.balloon.id(node)
      },
      success: function(data) {
        var $view = app.$view,
          $ul = $view.find('ul');

        for(var slave in data) {
          let sprite = app.balloon.getSpriteClass(data[slave].format);
          $ul.append('<li data-id="'+slave+'"><span class="k-sprite gr-i-remove gr-icon"></span>'
                    +'<span class="k-sprite '+sprite+' gr-icon"></span>'
                    +'<span>'+data[slave].format+'</span></li>');
        }
      }
    })
  },

  loadSupportedFormats: function(node) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/file/convert/supported-formats',
      type: 'GET',
      dataType: 'json',
      data: {
        id: app.balloon.id(node)
      },
      success: function(data) {
        var $view = app.$view,
          $submit = $view.find('input'),
          $ul = $view.find('ul'),
          $add = $view.find('.gr-i-add'),
          $select = $view.find('select');

        if(data.length === 0) {
          $view.find('.fs-shadow-not-supported').show();
          return;
        }

        $select.find('option[value]').remove();

        for(var format in data) {
          let sprite = app.balloon.getSpriteClass(data[format]);
          $select.append('<option value="'+data[format]+'" class="'+sprite+' gr-icon">'
                    +data[format]+'</option>');
        }

        $add.unbind('click').bind('click', function() {
          if($select.val() ===  $select.find('option:first-child').val()) {
            return;
          }

          var format = $select.val();
          $select.find('option:first-child').select();
          app.addSlave(node, format);
        });
      }
    });
  },

  addSlave: function(node, format) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/file/convert/slave',
      type: 'POST',
      data: {
        id: app.balloon.id(node),
        format: format
      },
      success: function() {
        var sprite = app.balloon.getSpriteClass(format);
        app.$view.find('ul').append('<li>'
                    +'<span class="k-sprite gr-i-remove gr-icon"></span>'
                    +'<span class="k-sprite '+sprite+' gr-icon"></span><span>'+format+'</span></li>')
      }
    });
  },

  deleteSlave: function(node, slave) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/file/convert/slave?id='+app.balloon.id(node)+'&slave='+slave,
      type: 'DELETE',
      success: function() {
        app.$view.find('li[data-id='+slave+']').remove();
      }
    });
  }
};

export default app;
