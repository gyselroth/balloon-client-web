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

  OFFICE_EXTENSIONS: ['csv', 'odt','ott','ott','docx','doc','dot','rtf','xls','xlsx','xlt','ods','ots','ppt','pptx','odp','otp','potm'],

  render: function() {
  },

  refreshWopiHosts: function() {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/office/hosts',
      success: function(data) {
        app.wopiHosts = data.data;
        console.log(app.wopiHosts);

        for(let host of app.wopiHosts) {
          for(let zone of app.toArray(host.discovery['net-zone'])) {
            if(zone['@attributes'].name === 'external-https' || zone['@attributes'].name === 'external-http') {
              for(let wopiApp of app.toArray(zone.app)) {
                for(let action of app.toArray(wopiApp.action)) {
                  if(action['@attributes'].name === 'edit') {
                    app.balloon.addFileHandler(action['@attributes'].ext, app.fileHandler, {
                      url: action['@attributes'].urlsrc,
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

    app.balloon.addPreviewHandler('office', this._handlePreview);

    console.log(app.wopiHosts)

  },

  fileHandler: function(node, context) {
    $('#fs-edit-office').remove();

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/office/sessions?id='+app.balloon.id(node),
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

        //var src = window.location.protocol + '//' + window.location.hostname + ':' + window.location.port+app.balloon.base+'/office/wopi/files/'+session.file;
        var src = window.location.protocol + '//' + '10.242.2.8' + ':' + '8084'+app.balloon.base+'/office/wopi/files/'+session.file;
        src = encodeURIComponent(src);
        var url = context.url+'&WOPISrc='+src;
        console.log(src,url);

        //url = 'https://oos.mbazh.ch/wv/wordviewerframe.aspx?WOPISrc=http%3A%2F%2F10.242.2.8:8084%2Fapi%2Fv2%2Foffice%2Fwopi%2Ffiles%2F'+session.file+'&ui=en-us&new=1';

        $div.append(
          '<form method="post" action="'+url+'" target="loleafletframe">'+
                    '<input type="hidden" name="access_token" value="'+session.access_token+'"/>'+
                    //'<input type="hidden" name="access_token_ttl" value="'+session.ttl+'"/>'+
                  '</form>'+
                  '<iframe style="width: 100%; height: 100%;" name="loleafletframe"/>'
        );

        $div.find('form').submit();

        $(this.wrapper).find('.k-i-close').unbind('click.fix').bind('click.fix', function(e){
          e.stopImmediatePropagation();
          var msg  = i18next.t('app.office.close_edit_file', node.name);
          app.balloon.promptConfirm(msg, function(){
             $k_display.close();
             $div.remove();
          });
        });
      }
    }).data("kendoBalloonWindow").center().maximize();
  },

  /**
   * Check if file is a supported office file
   *
   * @param   object node
   * @return  bool
   */
  isOfficeFile: function(node) {
    return this.OFFICE_EXTENSIONS.indexOf(this.balloon.getFileExtension(node)) > -1;
  },

  _handlePreview: function(node) {
    if(app.isOfficeFile(node) && !app.balloon.isMobileViewPort()) {
      return function(node) {
        app.edit(node);
        app.balloon.pushState();
      }
    }
  },

  addOfficeFile: function(name, type) {
    var $d = $.Deferred();

    name = encodeURI(name);

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/office/documents?type='+type+'&name='+name+'&'+app.balloon.param('collection', app.balloon.getCurrentCollectionId()),
      type: 'POST',
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
