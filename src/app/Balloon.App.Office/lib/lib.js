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
  id: 'Balloon.App.Office',
  wopiHosts: [],
  handlers: [],
  supported: [],

  render: function() {
  },

  refreshWopiHosts: function() {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/office/hosts',
      success: function(data) {
        app.wopiHosts = data.data;

        for(let host of app.wopiHosts) {
          for(let zone of app.toArray(host.discovery['net-zone'])) {
            if(zone['@attributes'].name === 'external-https' || zone['@attributes'].name === 'external-http') {
              for(let wopiApp of app.toArray(zone.app)) {
                for(let action of app.toArray(wopiApp.action)) {
                  if(app.supported.indexOf(host.name+'-'+action['@attributes'].ext) ===  -1) {
                    app.supported.push(host.name+'-'+action['@attributes'].ext);

                    app.balloon.addFileHandler({
                      app: host.name+' - '+wopiApp['@attributes'].name,
                      appIcon: wopiApp['@attributes'].favIconUrl,
                      ext: action['@attributes'].ext,
                      handler: app.fileHandler,
                      context: {
                        url: action['@attributes'].urlsrc,
                      }
                    });
                  }
                }
              }
            }
          }
        }
      }
    });
  },

  toArray: function(haystack) {
      if(Array.isArray(haystack)) {
        return haystack;
      }

      return [haystack];
  },

  preInit: function(core)  {
    this.balloon = core;
    this.refreshWopiHosts();

    var callback = function(type) {
      return core.showNewNode(type, app.addOfficeFile);
    };

    app.balloon.addNew('docx', 'app.office.word_document', 'file-word', callback);
    app.balloon.addNew('xlsx', 'app.office.excel_document', 'file-excel', callback);
    app.balloon.addNew('pptx', 'app.office.powerpoint_document', 'file-powerpoint', callback);
  },

  fileHandler: function(node, context) {
    $('#fs-edit-office').remove();

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/files/'+app.balloon.id(node)+'/tokens',
      type: 'POST',
      success: function(session) {
        app.wopiClient(node, session, context);
      }
    });
  },

  wopiClient: function(node, session, context) {
    var $div = $('<div id="fs-edit-office"></div>');
    $('body').append($div);

    var $k_display = $div.kendoBalloonWindow({
      resizable: false,
      title: node.name,
      modal: false,
      draggable: false,
      fullscreen: true,
      keydown: function(e) {
        if(e.originalEvent.keyCode !== 27) {
          return;
        }

        e.stopImmediatePropagation();
        var msg  = i18next.t('app.office.close_edit_file', node.name);
        app.balloon.promptConfirm(msg, function(){
           $k_display.close();
           $div.remove();
        });
      },
      open: function(e) {
        $('#fs-edit-office_wnd_title').html(
          $('#fs-browser-tree').find('li[gr-id="'+node.id+'"]').find('.k-in').find('> span').clone()
        );

        var src = window.location.protocol + '//' + window.location.hostname + app.balloon.base+'/office/wopi/files/'+session.node;
        //var src = window.location.protocol + '//' + '10.242.2.8' + ':' + '8084'+app.balloon.base+'/office/wopi/files/'+session.node;
        src = encodeURIComponent(src);
        var url = app.parseUrl(context.url, src, node);

        $div.append(
          '<form method="post" action="'+url+'" target="office">'+
             '<input type="hidden" name="access_token" value="'+session.access_token+'"/>'+
             '<input type="hidden" name="access_token_ttl" value="'+session.ttl+'"/>'+
          '</form>'+
          '<iframe style="width: 100%; height: 100%;" name="office"/>'
        );

        $div.find('form').submit();
        app.eventHandler(node);

        $(this.wrapper).find('.k-i-close').unbind('click.fix').bind('click.fix', function(e){
          e.stopImmediatePropagation();
          var msg  = i18next.t('app.office.close_edit_file', node.name);
          app.balloon.promptConfirm(msg, function(){
             $k_display.close();
             $div.remove();
          });
        });
      }
    }).data("kendoBalloonWindow").center();
  },

  eventHandler: function(node) {
    $(window).off('message').on('message', function(e) {
      var msg = JSON.parse(e.originalEvent.data);
      var msgId = msg.MessageId;
      var msgData = msg.Values;

      switch(msgId) {
        case 'File_Rename':
          $('#fs-edit-office_wnd_title').html(msgData.NewName+'.'+app.balloon.getFileExtension(node));
        break;

        case 'UI_FileVersions':
          app.balloon.displayHistoryWindow(node)
        break;

        case 'UI_Sharing':
          app.balloon.xmlHttpRequest({
            url: app.balloon.base+'/nodes/'+app.balloon.getCurrentCollectionId(),
            type: 'GET',
            success: function(node) {
              app.balloon.showShare(node);
            },
          });
        break;
      }
    });
  },

  parseUrl: function(url, src, node) {
    let result = url.substring(0, url.indexOf('?'));
    result += '?WOPISrc='+src;

    if(node.size === 0) {
      result += '&new=1';
    }

    return result;
  },

  addOfficeFile: function(name, type) {
    var $d = $.Deferred();

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/office/documents?type='+type+'&name='+encodeURI(name)+'&'+app.balloon.param('collection', app.balloon.getCurrentCollectionId()),
      type: 'POST',
      snackbar: {
        message: 'app.office.snackbar.' + type + '_created',
        values: {
          name: name
        },
        icon: 'undo',
        iconAction: function(response) {
          app.balloon.remove(response, true, true);
        }
      },
      complete: function(jqXHR, textStatus) {
        $('#fs-new-file').remove();

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
  }
}

export default app;
