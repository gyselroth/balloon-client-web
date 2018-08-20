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

    var $add_node = $('#fs-action-add-select').find('ul');
    $add_node.append('<li data-type="external_storage"><span class="gr-i-folder gr-icon"></span><span>'+i18next.t('app.externalstorage.external_storage')+'</span></li>');
    this.balloon.add_file_handlers.external_storage = this.storageWizard;

    app.balloon.addMenu('external_storage', i18next.t('app.externalstorage.external_storage'), 'gr-i-folder-received', function() {
      app.balloon.refreshTree('/nodes', {query: {"mount": {$exists: 1}}}, {});
    });
  },

  resetView: function() {
  },

  storageWizard: function() {
    var $div = $('<div id="fs-external-storage"></div>');
    $('body').append($div);

    $div.html(
      '<div class="error-message"></div>'+
      '<select>'+
        '<option value="smb">'+i18next.t('app.externalstorage.smb_share')+'</option>'+
      '</select>'+
      '<label>'+i18next.t('tree.folder')+'</label><input name="name" type="text"/>'+
      '<label>'+i18next.t('app.externalstorage.hostname')+'</label><input name="host" type="text"/>'+
      '<label>'+i18next.t('app.externalstorage.share_name')+'</label><input name="share" type="text"/>'+
      '<label>'+i18next.t('app.externalstorage.path')+'</label><input name="path" type="text"/>'+
      '<label>'+i18next.t('app.externalstorage.username')+'</label><input autocomplete="off" name="username" type="text"/>'+
      '<label>'+i18next.t('app.externalstorage.password')+'</label><input autocomplete="off" name="password" type="password"/>'+
      '<label>'+i18next.t('app.externalstorage.workgroup')+'</label><input name="workgroup" type="text"/>'+
      '<input name="add" value='+i18next.t('button.save')+' type="submit"/>'+
      '<input name="cancel" value='+i18next.t('button.cancel')+' type="submit"/>');

    var $k_display = $div.kendoWindow({
      resizable: false,
      title: i18next.t('app.externalstorage.external_storage'),
      modal: true,
      draggable: true,
      width: 440,
      height: 520,
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

          var $input_host = $div.find('input[name=host]');
          var $input_share = $div.find('input[name=share]');
          var $input_name = $div.find('input[name=name]');

          if($input_host.val() === '') {
            $input_host.addClass('fs-node-exists');
          } else {
            $input_host.removeClass('fs-node-exists');

          }

          if($input_share.val() === '') {
            $input_share.addClass('fs-node-exists');
          } else {
            $input_share.removeClass('fs-node-exists');

          }

          if($input_name.val() === '') {
            $input_name.addClass('fs-node-exists');
          } else {
            $input_name.removeClass('fs-node-exists');

          }

          if($div.find('.fs-node-exists').length > 0) {
            return;
          }

          app.addExternalFolder(
            $input_name.val(),
            $div.find('select').val(),
            $input_host.val(),
            $div.find('input[name=workgroup]').val(),
            $input_share.val(),
            $div.find('input[name=username]').val(),
            $div.find('input[name=password]').val(),
            $div.find('input[name=path]').val()
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

  addExternalFolder: function(name, adapter, host, workgroup, share, username, password, path) {
    var $div = $('#fs-external-storage');

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/collections',
      type: 'POST',
      data: {
        name: name,
        collection: app.balloon.getCurrentCollectionId(),
        attributes: {
          mount: {
            adapter: adapter,
            host: host,
            workgroup: workgroup,
            share: share,
            username: username,
            password: password,
            path: path
          }
        }
      },
      error: function(error) {
        if(!error.responseJSON || !error.responseJSON.error) {
          return app.balloon.displayError(error);
        }

        switch(error.responseJSON.error) {
          case 'Icewind\\SMB\\Exception\\InvalidArgumentException':
            $div.find('.error-message').html(i18next.t('app.externalstorage.error.invalid_host')).show();
          break;

          case 'Icewind\\SMB\\Exception\\ForbiddenException':
            $div.find('.error-message').html(i18next.t('app.externalstorage.error.invalid_credentials')).show();
          break;

          case 'Balloon\\Filesystem\\Exception\\Conflict':
            if(error.responseJSON.code == 19) {
              $div.find('.error-message').html(i18next.t('tree.error.folder_exists')).show();
            } else {
              app.balloon.displayError(error);
            }
          break;

          default:
            app.balloon.displayError(error);
        }
      },
      success: function(data) {
        app.balloon.refreshTree('/collections/children', {id: app.balloon.getCurrentCollectionId()});
        app.balloon.added_rename = data.id;
        $div.data('kendoWindow').close();
        $div.remove();
      }
    });
  }
}

export default app;
