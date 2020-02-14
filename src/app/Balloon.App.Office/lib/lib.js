/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import i18next from 'i18next';
import css from '../styles/style.scss';
const parser = require('fast-xml-parser');
const he = require('he');

var options = {
    attributeNamePrefix : "@_",
    attrNodeName: "attr", //default is 'false'
    textNodeName : "#text",
    ignoreAttributes : true,
    ignoreNameSpace : false,
    allowBooleanAttributes : false,
    parseNodeValue : true,
    parseAttributeValue : false,
    trimValues: true,
    cdataTagName: "__cdata", //default is 'false'
    cdataPositionChar: "\\c",
    parseTrueNumberOnly: false,
    arrayMode: false, //"strict"
    attrValueProcessor: (val, attrName) => he.decode(val, {isAttributeValue: true}),//default is a=>a
    tagValueProcessor : (val, tagName) => he.decode(val), //default is a=>a
    stopNodes: ["parse-me-as-string"]
};


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
                        wopi_url: host.wopi_url,
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
      deactivate: function(e) {
        e.sender.destroy();
      },
      open: function(e) {
        $('#fs-edit-office_wnd_title').html(
          $('#fs-browser-tree').find('li[gr-id="'+node.id+'"]').find('.k-in').find('> span').clone()
        );

        //TODO balloon v2.7.0 supports wopi_url, remove backup in web client v3.3
        var src;
        if(context.wopi_url) {
          src = context.wopi_url+'/files/'+session.node;
        } else {
          src = window.location.protocol + '//' + window.location.hostname + app.balloon.base+'/office/wopi/files/'+session.node;
        }

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
    var variables = url.substr(url.indexOf('?')+1).replace(/<([^=]+)=([^&]+)&>/g, function(match, name, value) {
      switch(name) {
        default:
          return '';
      }
    });

    let result = url.substring(0, url.indexOf('?'));
    result += '?WOPISrc='+src+'&'+variables;

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
