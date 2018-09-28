/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import i18next from 'i18next';
import css from '../styles/style.scss';

var app = {
  id: 'Balloon.App.Convert',

  preInit: function(core) {
    this.balloon = core;

    var $content = $('<dd id="fs-shadow">'+
      '<p id="fs-shadow-description">'+i18next.t('app.convert.description')+'</p>'+
      '<p id="fs-shadow-not-supported">'+i18next.t('app.convert.not_supported')+'</p>'+
      '<div id="fs-shadow-formats">'+
        '<select name="formats">'+
          '<option>'+i18next.t('app.convert.choose_format')+'</option>'+
          '</select>'+
          '<svg class="gr-icon gr-i-expand"><use xlink:href="/assets/icons.svg#expand"></use></svg>'+
          '<div id="fs-shadow-formats-add">'+
            '<svg class="gr-icon gr-i-plus"><use xlink:href="/assets/icons.svg#plus"></use></svg>'+
          '</div>'+
      '</div>'+
      '<ul id="fs-shadow-slaves"></ul>'+
    '</dd>');

    this.$content = $content;

    this.balloon.addContentView(
      'shadow',
      'app.convert.menu_title',
      function() {
        return !(app.balloon.last.directory || app.balloon.last.deleted);
      },
      app.onActivate,
      $content
    );
  },

  postInit: function(core)  {
    this.balloon = core;

    this.$content.find('#fs-shadow-slaves').on('click', '.fs-shadow-slave-remove', function(){
      var id = $(this).parents().filter('li').attr('data-id');
      app.deleteSlave(app.balloon.last, id);
    });

    this.balloon.addHint('app.convert.hint')
  },

  resetView: function() {
    app.$content.find('li, option[value]').remove();
    app.$content.find('.fs-shadow-not-supported').hide();
    $('#fs-slave-node').remove();
  },

  selectNode: function() {
    app.resetView();

    if(app.balloon.last.master) {
      var $node = $('<div id="fs-slave-node">'
          +'<span>'+i18next.t('app.convert.slave_node', {node: app.balloon.last})+'</span>'
        +'</li>');

      $('#fs-properties').prepend($node);
    }

    if(app.balloon.last.directory || app.balloon.last.deleted) {
      return;
    }
  },

  onActivate: function() {
    app.resetView();
    $('.fs-view-content').hide();
    $('#fs-view-bar').find('li').removeClass('fs-view-bar-active');
    $('#fs-view-shadow').addClass('fs-view-bar-active');

    app.loadSlaves(app.balloon.last);
    app.loadSupportedFormats(app.balloon.last);
  },

  loadSlaves: function(node) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/files/convert/slaves',
      type: 'GET',
      dataType: 'json',
      data: {
        id: app.balloon.id(node)
      },
      success: function(data) {
        var $slaves = app.$content.find('#fs-shadow-slaves');

        var $slaveDs = data.data.map(function(slaveEntry) {
          if(!slaveEntry.slave) {
            var $slave = app._renderSlave(node, slaveEntry.format, slaveEntry.id);
            return $.Deferred().resolve($slave).promise();
          } else {
            var $d = $.Deferred();
            app.balloon.xmlHttpRequest({
              url: app.balloon.base+'/nodes',
              type: 'GET',
              data: {
                id: slaveEntry.slave.id
              },
              success: function(slaveData) {
                var $slave = app._renderSlave(node, slaveEntry.format, slaveEntry.id, slaveData.path);
                $d.resolve($slave)
              },
              error: function() {
                $d.reject();
              }
            });

            return $d;
          }
        });

        $.when.apply(this, $slaveDs).then(function() {
          $slaves.append(Array.prototype.slice.call(arguments).join(''));
        });
      }
    })
  },

  loadSupportedFormats: function(node) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/files/convert/supported-formats',
      type: 'GET',
      dataType: 'json',
      data: {
        id: app.balloon.id(node)
      },
      success: function(data) {
        var $content = app.$content,
          $submit = $content.find('input'),
          $add = $content.find('#fs-shadow-formats-add'),
          $select = $content.find('select');

        if(data.length === 0) {
          $content.find('.fs-shadow-not-supported').show();
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
      url: app.balloon.base+'/files/convert/slaves',
      type: 'POST',
      data: {
        id: app.balloon.id(node),
        format: format
      },
      success: function(data) {
        var $slave = app._renderSlave(node, data.format, data.id);

        app.$content.find('#fs-shadow-slaves').append($slave);
      }
    });
  },

  _renderSlave: function(origNode, format, id, path) {
    var sprite = app.balloon.getSpriteClass(format);
    var icon = sprite.replace('gr-i-', '');
    var origExt = app.balloon.getFileExtension(origNode.name) || '';
    var name = origNode.name.substr(0, origNode.name.length-origExt.length-1);

    if(!path) {
      path = i18next.t('app.convert.being_created');
    }

    return '<li ' + (id ? 'data-id="'+id+'"' : '') + '>'+
        '<div class="fs-shadow-slave-icon">'+
          '<svg class="gr-icon '+sprite+'"><use xlink:href="/assets/icons.svg#'+icon+'"></use></svg>'+
        '</div>'+
        '<div class="fs-shadow-slave-name">'+
          '<div><span class="fs-name">'+name+'</span><span class="fs-ext">('+format+')</span></div>'+
          '<div><span class="fs-path">'+path+'</span></div>'+
        '</div>'+
        '<div class="fs-shadow-slave-remove">'+
          '<svg class="gr-icon gr-i-minus"><use xlink:href="/assets/icons.svg#minus"></use></svg>'+
        '</div>'+
      '</li>';
  },

  deleteSlave: function(node, slave) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/files/convert/slaves?id='+app.balloon.id(node)+'&slave='+slave,
      type: 'DELETE',
      success: function() {
        app.$content.find('li[data-id='+slave+']').remove();
      }
    });
  }
};

export default app;
