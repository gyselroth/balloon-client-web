/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import kendoWindow from 'kendo-ui-core/js/kendo.window.js';
import i18next from 'i18next';
import css from '../styles/style.css';

var app = {
  render: function() {
  },

  preInit: function(core)  {
    this.balloon = core;
    app.addNormalFolder = app.balloon.addFolder;
    app.balloon.addFolder = app.addFolder;
  },

  resetView: function() {
  },

  storageWizard: function() {
    var $div = $('<div id="fs-external-storage"></div>');
    $('body').append($div);

    $div.html(
      '<select>'+
        '<option value="smb">'+i18next.t('app.externalstorage.smb_cifs_share')+'</option>'+
      '</select>'+
      '<label>'+i18next.t('app.externalstorage.name')+'</label><input name="name" type="text"/>'+
      '<label>'+i18next.t('app.externalstorage.host')+'</label><input name="host" type="text"/>'+
      '<label>'+i18next.t('app.externalstorage.share')+'</label><input name="share" type="text"/>'+
      '<label>'+i18next.t('app.externalstorage.username')+'</label><input name="username" type="text"/>'+
      '<label>'+i18next.t('app.externalstorage.password')+'</label><input name="password" type="password"/>'+
      '<input name="add" value='+i18next.t('button.save')+' type="submit"/>'+
      '<input name="cancel" value='+i18next.t('button.cancel')+' type="submit"/>');

    var $k_display = $div.kendoWindow({
      resizable: false,
      title: +i18next.t('app.externalstorage.folder'),
      modal: true,
      draggable: true,
      width: 400,
      height: 400,
      keydown: function(e) {
        if(e.originalEvent.keyCode !== 27) {
          return;
        }
      },
      open: function(e) {
        $($div).find('input[type=submit]').off('click').on('click', function() {
          if($(this).attr('name') === 'cancel') {
            return $k_display.close();
          }

          app.addExternalFolder(
            $div.find('input[name=name]').val(),
            $div.find('select').val(),
            $div.find('input[name=host]').val(),
            $div.find('input[name=share]').val(),
            $div.find('input[name=username]').val(),
            $div.find('input[name=password]').val(),
          );
        })
      }
    }).data("kendoWindow").center();
  },

  addFolder: function() {
    var $box = $('#fs-new-folder');
    if($box.is(':visible')) {
      $box.remove();
      return;
    }

    var $select = $('<div id="fs-new-folder">'+
        '<div class="gr-icon gr-i-file-add"></div>' +
        '<ul>'+
            '<li><span class="gr-i-folder gr-icon"></span><span>'+i18next.t('app.externalstorage.normal_folder')+'</span></li>'+
            '<li><span class="gr-i-cloud gr-icon"></span><span>'+i18next.t('app.externalstorage.external_folder')+'</span></li>'+
        '</ul>'+
    '</div>');

    var $bar = $('#fs-browser-action');
    $bar.append($select);
    $box = $('#fs-new-folder');

    $box.on('click', 'li', function(){
      var $type = $(this).find('.gr-icon');

      if($type.hasClass('gr-i-folder')) {
        console.log(1);
        app.addNormalFolder();
      } else if($type.hasClass('gr-i-cloud')) {
        app.storageWizard();
      }

      $box.remove();
    });

    $(document).off('click.externalstorage').on('click.externalstorage', function(e) {
      if($(e.target).hasClass('gr-i-folder-add')) {
        return;
      }

      var $box = $('#fs-new-folder');
      if($box.is(':visible')) {
        $box.remove();
      }
    });
  },

  addExternalFolder: function(name, adapter, host, share, username, password) {
    if(app.balloon.nodeExists(name)) {
      name = name+' ('+app.balloon.randomString(4)+').'+type;
    }

    name = encodeURI(name);

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/collections',
      type: 'POST',
      data: {
        name: name,
        collection: app.balloon.getCurrentCollectionId(),
        attributes: {
          external_storage: {
            adapter: adapter,
            host: host,
            share: share,
            username: username,
            password: password,
          }
        }
      },
      complete: function() {
      },
      success: function(data) {
        app.balloon.refreshTree('/collections/children', {id: app.balloon.getCurrentCollectionId()});
        app.balloon.added_rename = data.id;
      }
    });
  }
}

export default app;
