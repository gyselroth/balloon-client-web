/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import balloonWindow from '../../../lib/widget-balloon-window.js';
import i18next from 'i18next';
import iconsSvg from '@gyselroth/icon-collection/src/icons.svg';
import css from '../styles/style.scss';

var app = {
  id: 'Balloon.App.ExternalStorage',

  render: function() {
  },

  preInit: function(core)  {
    this.balloon = core;
    app.balloon.addNew('external_storage', 'app.externalstorage.external_storage', 'folder-storage', app.storageWizard);

    app.balloon.addMenu('external_storage', 'app.externalstorage.external_storage', 'folder-storage', function() {
      return app.balloon.refreshTree('/nodes', {query: {"mount": {$exists: 1}}}, {});
    });

    this.balloon.addHint('app.externalstorage.hint');
  },

  resetView: function() {
  },

  storageWizard: function() {
    var $d = $.Deferred();
    var $div = $('<div id="fs-external-storage"></div>');
    $('body').append($div);

    $div.html(
      '<div class="error-message"></div>'+
      '<div>'+
        '<div class="fs-external-storage-select">'+
          '<select>'+
            '<option value="smb">'+i18next.t('app.externalstorage.smb_share')+'</option>'+
          '</select>'+
          '<svg class="gr-icon gr-i-expand"><use xlink:href="'+iconsSvg+'#expand"></use></svg>'+
        '</div>'+
        '<label>'+i18next.t('new_node.name')+'</label><input name="name" type="text"/>'+
        '<label>'+i18next.t('app.externalstorage.hostname')+'</label><input name="host" type="text"/>'+
        '<label>'+i18next.t('app.externalstorage.share_name')+'</label><input name="share" type="text"/>'+
        '<label>'+i18next.t('app.externalstorage.username')+'</label><input autocomplete="current-username" name="username" type="text"/>'+
        '<label>'+i18next.t('app.externalstorage.password')+'</label><input autocomplete="current-password" name="password" type="password"/>'+
        '<label>'+i18next.t('app.externalstorage.workgroup')+'</label><input name="workgroup" type="text"/>'+
      '</div>'+
      '<div class="fs-window-secondary-actions">'+
        '<input name="cancel" value='+i18next.t('button.cancel')+' type="submit" tabindex="2" />'+
        '<input class="fs-button-primary" name="add" value='+i18next.t('button.save')+' type="submit" tabindex="1"/>'+
      '</div>');
    var $k_display = $div.kendoBalloonWindow({
      resizable: false,
      title: i18next.t('app.externalstorage.external_storage'),
      modal: true,
      activate: function(){
        $div.find('input[name="name"]').focus();
      },
      open: function(e) {
        var mayCreate = false;
        var fieldsValid = {
          name: false,
          share: false,
          host: false,
        };

        var $input_host = $div.find('input[name=host]');
        var $input_share = $div.find('input[name=share]');
        var $input_name = $div.find('input[name=name]');
        var $submit = $div.find('input[name=add]');

        $div.find('input').removeClass('error-input');
        $submit.attr('disabled', true);

        function canCreate() {
          mayCreate = Object.keys(fieldsValid).every(function(key) {
            return fieldsValid[key] === true;
          });

          $submit.attr('disabled', !mayCreate);
        }

        $input_name.off('keyup').on('keyup', function(e) {
          let name = $input_name.val();

          if(e.keyCode === 13) {
            if(mayCreate) $submit.click();
            return;
          }

          if(app.balloon.nodeExists(name) || name === '') {
            $input_name.addClass('error-input');
            fieldsValid.name = false;
          } else {
            $input_name.removeClass('error-input');
            fieldsValid.name = true;
          }

          canCreate();
        });

        $input_share.off('keyup').on('keyup', function(e) {
          let share = $input_share.val();

          if(e.keyCode === 13) {
            if(mayCreate) $submit.click();
            return;
          }

          if(share === '') {
            $input_share.addClass('error-input');
            fieldsValid.share = false;
          } else {
            $input_share.removeClass('error-input');
            fieldsValid.share = true;
          }

          canCreate();
        });

        $input_host.off('keyup').on('keyup', function(e) {
          let host = $input_host.val();

          if(e.keyCode === 13) {
            if(mayCreate) $submit.click();
            return;
          }

          if(host === '') {
            $input_host.addClass('error-input');
            fieldsValid.host = false;
          } else {
            $input_host.removeClass('error-input');
            fieldsValid.host = true;
          }

          canCreate();
        });

        $($div).find('input[type=submit]').off('click').on('click', function() {
          if($(this).attr('name') === 'cancel') {
            return $k_display.close();
          }

          $div.find('input').removeClass('error-input');

          if($input_host.val() === '') {
            $input_host.addClass('error-input');
          }

          if($input_share.val() === '') {
            $input_share.addClass('error-input');
          }

          app.addExternalFolder(
            $d,
            $input_name.val(),
            $div.find('select').val(),
            $input_host.val(),
            $div.find('input[name=workgroup]').val(),
            $input_share.val(),
            $div.find('input[name=username]').val(),
            $div.find('input[name=password]').val()
          );
        })
      }
    }).data("kendoBalloonWindow").center().open();

    return $d;
  },

  addExternalFolder: function(promise, name, adapter, host, workgroup, share, username, password) {
    var $div = $('#fs-external-storage');
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/collections',
      type: 'POST',
      snackbar: {
        message: 'app.externalstorage.snackbar.created',
        values: {
          name: name
        },
        icon: 'undo',
        iconAction: function(response) {
          app.balloon.remove(response);
        }
      },
      data: {
        name: name,
        id: app.balloon.getCurrentCollectionId(),
        attributes: {
          mount: {
            adapter: adapter,
            host: host,
            workgroup: workgroup,
            share: share,
            username: username,
            password: password
          }
        }
      },
      error: function(error) {
        promise.reject();

        if(!error.responseJSON || !error.responseJSON.error) {
          return app.balloon.displayError(error);
        }

        switch(error.responseJSON.error) {
          case 'Icewind\\SMB\\Exception\\InvalidArgumentException':
          case 'Icewind\\SMB\\Exception\\NoRouteToHostException':
          case 'Icewind\\SMB\\Exception\\HostDownException':
            $div.find('.error-message').html(i18next.t('app.externalstorage.error.invalid_host')).show();
          break;

          case 'Icewind\\SMB\\Exception\\ForbiddenException':
          case 'Icewind\\SMB\\Exception\\AuthenticationException':
            $div.find('.error-message').html(i18next.t('app.externalstorage.error.invalid_credentials')).show();
          break;

          case 'Icewind\\SMB\\Exception\\NotFoundException':
            $div.find('.error-message').html(i18next.t('app.externalstorage.error.invalid_share')).show();
          break;

          case 'Balloon\\Filesystem\\Exception\\Conflict':
            if(error.responseJSON.code == 19) {
              $div.find('.error-message').html(i18next.t('tree.error.folder_exists', name)).show();
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
        $div.data('kendoBalloonWindow').close();
        $div.remove();
        promise.resolve(data);
      }
    });
  }
}

export default app;
