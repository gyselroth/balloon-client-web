/**
 * Balloon
 *
 * @author      Raffael Sahli <sahli@gyselroth.net>
 * @copyright   Copryright (c) 2012-2017 gyselroth GmbH (https://gyselroth.com)
 * @license     GPLv3 https://opensource.org/licenses/GPL-3.0
 */
import * as $ from "jquery";
import kendoWindow from 'kendo-ui-core/js/kendo.window.js';
import i18next from 'i18next';
import css from '../styles/style.css';

var app = {
  render: function(core) {
    this.balloon = core;
    app.balloon._treeDblclick = app.treeDblclick;
  },

  init: function(core)  {
    app.addTextFile = app.balloon.addFile;
    app.balloon.addFile = app.addFile;
  },

  resetView: function() {
  },

  edit: function(node) {
    $('#fs-edit-office').remove();

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/app/office/document?id='+app.balloon.id(node),
      success: function(data) {
        var doc = data.data;
        if(doc.session.length === 0) {
          app.newSession(node, doc);
        } else {
          if(doc.session.length === 1) {
            app.promptSingleSessionJoin(node, doc, doc.session[0]);
          } else {
            app.promptSelectSessionJoin(node, doc);
          }
        }
      }
    });
  },

  promptSelectSessionJoin: function(node, doc) {
    $("#fs-office-join-prompt").remove();

    var msg = i18next.t('app.office.session.prompt.message_select', node.name);
    msg += '<ul>';
    for(var i in doc.session) {
      msg += '<li><input type="radio" name="session" value="'+doc.session[i].id+'"/>'
              +i18next.t('app.office.session.prompt.message_select_by_user', doc.session[i].user.name, app.balloon.timeSince(new Date((doc.session[i].created*1000))))+'</li>';
    }
    msg += '</ul>';

    var $div = $('<div id="fs-office-join-prompt" class="fs-prompt-window" title="'+i18next.t('app.office.session.prompt.title')+'">'
            +'<div id="fs-prompt-window-content">'+msg+'</div>'
            +'<div id="fs-prompt-window-button-wrapper">'
            +'    <input type="button" tabindex="2" name="new" value="'+i18next.t('app.office.session.prompt.new')+'"/>'
            +'    <input type="button" tabindex="1" name="join" value="'+i18next.t('app.office.session.prompt.join')+'"/>'
            +'</div>'
        +'</div>');
    $("#fs-namespace").append($div);
    $div.find('input[name=session]:first').attr('checked', true);

    $div.find('input[name=join]').unbind('click').click(function(e) {
      e.stopImmediatePropagation();
      $div.data('kendoWindow').close();
      app.joinSession(node, doc, $div.find('input[name=session]:checked').val());
    });

    app.sessionPrompt($div, node, doc);
  },

  sessionPrompt: function($div, node, doc)    {
    var $k_prompt = $div.kendoWindow({
      title: $div.attr('title'),
      resizable: false,
      modal: true,
      activate: function() {
        setTimeout(function() {
          $div.find('input[name=join]').focus()
        },200);
      }
    }).data("kendoWindow").center().open();

    $div.unbind('keydown').keydown(function(e) {
      if(e.keyCode === 27) {
        e.stopImmediatePropagation();
        $k_prompt.close();
      }
    });

    $div.find('input[name=new]').unbind('click').click(function(e) {
      e.stopImmediatePropagation();
      $k_prompt.close();
      app.newSession(node, doc);
    });
  },

  promptSingleSessionJoin: function(node, doc, session) {
    $("#fs-office-join-prompt").remove();
    var $div = $('<div id="fs-office-join-prompt" class="fs-prompt-window" title="'+i18next.t('app.office.session.prompt.title')+'">'
            +'<div id="fs-prompt-window-content">'+i18next.t('app.office.session.prompt.message_one', node.name, session.user.name, app.balloon.timeSince(new Date((session.created*1000))))+'</div>'
            +'<div id="fs-prompt-window-button-wrapper">'
            +'    <input type="button" tabindex="2" name="new" value="'+i18next.t('app.office.session.prompt.new')+'"/>'
            +'    <input type="button" tabindex="1" name="join" value="'+i18next.t('app.office.session.prompt.join')+'"/>'
            +'</div>'
        +'</div>');
    $("#fs-namespace").append($div);

    $div.find('input[name=join]').unbind('click').click(function(e) {
      e.stopImmediatePropagation();
      $div.data('kendoWindow').close();
      app.joinSession(node, doc, session.id);
    });

    app.sessionPrompt($div, node, doc);
  },

  newSession: function(node, doc) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/app/office/session?id='+app.balloon.id(node),
      type: 'POST',
      success: function(session) {
        app.initLibreOffice(node, doc, session);
      }
    });
  },

  joinSession: function(node, doc, session_id) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/app/office/session/join?id='+session_id,
      type: 'POST',
      success: function(session) {
        session.data.id = session_id;
        app.initLibreOffice(node, doc, session);
      }
    });
  },

  initLibreOffice: function(node, doc, session) {
    var $div = $('<div id="fs-edit-office"></div>');
    $('body').append($div);

    var $k_display = $div.kendoWindow({
      resizable: false,
      title: node.name,
      modal: true,
      draggable: false,
      keydown: function(e) {
        if(e.originalEvent.keyCode !== 27) {
          return;
        }

        e.stopImmediatePropagation();
        var msg  = i18next.t('app.office.close_edit_file', node.name);
        app.balloon.promptConfirm(msg, function(){
          app.balloon.xmlHttpRequest({
            url: app.balloon.base+'/app/office/session?id='+session.data.id+'&access_token='+session.data.access_token,
            type: 'DELETE',
            error: function(){},
            complete: function() {
              $k_display.close();
              $div.remove();
            }
          });
        });
      },
      open: function(e) {
        app.showStartupPrompt();

        $('#fs-edit-office_wnd_title').html(
          $('#fs-browser-tree').find('li[gr-id="'+node.id+'"]').find('.k-in').find('> span').clone()
        );

        var src = 'https://'+window.location.hostname+app.balloon.base+'/app/office/wopi/document/'+session.data.id,
          src = encodeURIComponent(src),
          url = doc.loleaflet+'?WOPISrc='+src+'&title='+node.name+'&lang='+i18next.language+'&closebutton=0&revisionhistory=0';

        $div.append(
          '<form method="post" action="'+url+'" target="loleafletframe">'+
                    '<input type="hidden" name="access_token" value="'+session.data.access_token+'"/>'+
                    '<input type="hidden" name="access_token_ttl" value="'+session.data.access_token_ttl+'"/>'+
                  '</form>'+
                  '<iframe style="width: 100%; height: calc(100% - 40px);" name="loleafletframe"/>'
        );

        $div.find('form').submit();

        $(this.wrapper).find('.k-i-close').unbind('click.fix').bind('click.fix', function(e){
          e.stopImmediatePropagation();
          var msg  = i18next.t('app.office.close_edit_file', node.name);
          app.balloon.promptConfirm(msg, function(){
            app.balloon.xmlHttpRequest({
              url: app.balloon.base+'/app/office/session?id='+session.data.id+'&access_token='+session.data.access_token,
              type: 'DELETE',
              error: function(){},
              complete: function() {
                $k_display.close();
                $div.remove();
              }
            });
          });
        });
      }
    }).data("kendoWindow").center().maximize();
  },

  showStartupPrompt: function(e) {
    if(localStorage.app_office_hide_prompt == "true") {
      return;
    }

    $("#fs-libreoffice-prompt").remove();

    var $div = $('<div id="fs-libreoffice-prompt" class="fs-prompt-window" title="'+i18next.t('app.office.startup_prompt.title')+'">'
            +'<div id="fs-prompt-window-content">'+i18next.t('app.office.startup_prompt.message')+'</div>'
            +'<div id="fs-prompt-window-button-wrapper">'
            +'    <input type="button" tabindex="2" name="hide" value="'+i18next.t('app.office.startup_prompt.dont_show_again')+'"/>'
            +'    <input type="button" tabindex="1" name="close" value="'+i18next.t('app.office.startup_prompt.close')+'"/>'
            +'</div>'
        +'</div>');
    $("#fs-namespace").append($div);

    var $k_prompt = $div.kendoWindow({
      title: $div.attr('title'),
      resizable: false,
      modal: true,
      activate: function() {
        setTimeout(function() {
          $div.find('input[name=close]').focus()
        },200);
      }
    }).data("kendoWindow");

    setTimeout(function(){
      $k_prompt.center().open();
    }, 700);

    $div.unbind('keydown').keydown(function(e) {
      if(e.keyCode === 27) {
        e.stopImmediatePropagation();
        $k_prompt.close();
      }
    });

    $div.find('input[name=close]').unbind('click').click(function(e) {
      e.stopImmediatePropagation();
      $k_prompt.close();
    });

    $div.find('input[name=hide]').unbind('click').click(function(e) {
      localStorage.app_office_hide_prompt = true;
      e.stopImmediatePropagation();
      $k_prompt.close();
    });
  },

  treeDblclick: function(e) {
    if(app.balloon.last.directory === true) {
      app.balloon.resetDom('selected');
    }

    var supported_office = [
      'csv', 'odt','ott','ott','docx','doc','dot','rtf','xls','xlsx','xlt','ods','ots','ppt','pptx','odp','otp','potm'
    ];

    if(app.balloon.last !== null && app.balloon.last.directory) {
      app.balloon.togglePannel('content', true);

      var $k_tree = $("#fs-browser-tree").data("kendoTreeView");

      if(app.balloon.last.id == '_FOLDERUP') {
        var params = {},
          id     = app.balloon.getPreviousCollectionId();

        if(id !== null) {
          params.id = id;
          app.balloon.refreshTree('/collection/children', params, null, {action: '_FOLDERUP'});
        } else {
          app.balloon.menuLeftAction(app.balloon.getCurrentMenu());
        }
      } else {
        app.balloon.refreshTree('/collection/children', {id: app.balloon.getCurrentNode().id}, null, {action: '_FOLDERDOWN'});
      }

      app.balloon.resetDom(
        ['selected','properties','preview','action-bar','multiselect','view-bar',
          'history','share-collection','share-link']
      );
    } else if(supported_office.indexOf(app.balloon.getFileExtension(app.balloon.last.name)) > -1 && !app.balloon.isMobileViewPort()) {
      app.edit(app.balloon.getCurrentNode());
    } else if(app.balloon.isEditable(app.balloon.last.mime)) {
      app.balloon.editFile(app.balloon.getCurrentNode());
    } else if(app.balloon.isViewable(app.balloon.last.mime)) {
      app.balloon.displayFile(app.balloon.getCurrentNode());
    } else {
      app.balloon.downloadNode(app.balloon.getCurrentNode());
    }

    app.balloon.pushState();
  },

  addFile: function() {
    var $box = $('#fs-new-file');
    if($box.is(':visible')) {
      $box.remove();
      return;
    }

    var $select = $('<div id="fs-new-file">'+
        '<div class="gr-icon gr-i-file-add"></div>' +
        '<ul>'+
            '<li><span class="gr-i-file-text gr-icon"></span><span>'+i18next.t('app.office.text_document')+'</span></li>'+
            '<li><span class="gr-i-file-word gr-icon"></span><span>'+i18next.t('app.office.word_document')+'</span></li>'+
            '<li><span class="gr-i-file-excel gr-icon"></span><span>'+i18next.t('app.office.excel_document')+'</span></li>'+
            '<li><span class="gr-i-file-powerpoint gr-icon"></span><span>'+i18next.t('app.office.powerpoint_document')+'</span></li>'+
        '</ul>'+
    '</div>');

    var $bar = $('#fs-browser-action');
    $bar.append($select);
    $box = $('#fs-new-file');

    $box.on('click', 'li', function(){
      var $type = $(this).find('.gr-icon');

      if($type.hasClass('gr-i-file-text')) {
        app.addTextFile();
      } else if($type.hasClass('gr-i-file-word')) {
        app.addOfficeFile('docx');
      } else if($type.hasClass('gr-i-file-excel')) {
        app.addOfficeFile('xlsx');
      } else if($type.hasClass('gr-i-file-powerpoint')) {
        app.addOfficeFile('pptx');
      }

      $box.remove();
    });

    $(document).off('click.office').on('click.office', function(e) {
      if($(e.target).hasClass('gr-i-file-add')) {
        return;
      }

      var $box = $('#fs-new-file');
      if($box.is(':visible')) {
        $box.remove();
      }
    });
  },

  addOfficeFile: function(type) {
    var new_name = i18next.t('tree.new_file'),
      name = new_name+'.'+type;

    if(app.balloon.nodeExists(name)) {
      name = new_name+' ('+app.balloon.randomString(4)+').'+type;
    }

    name = encodeURI(name);

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/app/office/document?type='+type+'&name='+name+'&'+app.balloon.param('collection', app.balloon.getCurrentCollectionId()),
      type: 'PUT',
      complete: function() {
        $('#fs-new-file').remove();
      },
      success: function(data) {
        app.balloon.refreshTree('/collection/children', {id: app.balloon.getCurrentCollectionId()});
        app.balloon.added_rename = data.data;
      }
    });
  }
}

export default app;
