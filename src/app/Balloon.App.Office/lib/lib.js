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

  render: function() {
    var $add_node = $('#fs-action-add-select').find('ul');

    $add_node.append(
      '<li data-type="docx">'+
        '<svg class="gr-icon gr-i-file-word"><use xlink:href="/assets/icons.svg#file-word"></use></svg>'+
        '<span>'+i18next.t('app.office.word_document')+'</span>'+
        '<input type="text" placeholder="" />'+
      '</li>'
    );

    $add_node.append(
      '<li data-type="xlsx">'+
        '<svg class="gr-icon gr-i-file-excel"><use xlink:href="/assets/icons.svg#file-excel"></use></svg>'+
        '<span>'+i18next.t('app.office.excel_document')+'</span>'+
        '<input type="text" placeholder="" />'+
      '</li>'
    );

    $add_node.append(
      '<li data-type="pptx">'+
        '<svg class="gr-icon gr-i-file-powerpoint"><use xlink:href="/assets/icons.svg#file-powerpoint"></use></svg>'+
        '<span>'+i18next.t('app.office.powerpoint_document')+'</span>'+
        '<input type="text" placeholder="" />'+
      '</li>'
    );
  },

  preInit: function(core)  {
    this.balloon = core;
    app.origDblClick = app.balloon._treeDblclick;
    //TODO pixtron - find a clean way for apps to hook into core. Just overriding core methods is quite a hack.
    app.balloon._treeDblclick = app.treeDblclick;
    this.balloon.add_file_handlers.docx = this.addOfficeFile;
    this.balloon.add_file_handlers.xlsx = this.addOfficeFile;
    this.balloon.add_file_handlers.pptx = this.addOfficeFile;
  },

  edit: function(node) {
    $('#fs-edit-office').remove();

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/office/documents?id='+app.balloon.id(node),
      success: function(doc) {
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

    var $div = $('<div id="fs-office-join-prompt" class="fs-prompt-window-inner" title="'+i18next.t('app.office.session.prompt.title')+'">'
            +'<div id="fs-office-join-prompt-content" class="fs-prompt-window-content">'+msg+'</div>'
            +'<div class="fs-window-secondary-actions">'
            +'    <input type="button" tabindex="2" name="new" value="'+i18next.t('app.office.session.prompt.new')+'"/>'
            +'    <input type="button" tabindex="1" name="join" value="'+i18next.t('app.office.session.prompt.join')+'" class="fs-button-primary" />'
            +'</div>'
        +'</div>');

    $("#fs-namespace").append($div);
    $div.find('input[name=session]:first').attr('checked', true);

    $div.find('input[name=join]').unbind('click').click(function(e) {
      e.stopImmediatePropagation();
      $div.data('kendoBalloonWindow').close();
      app.joinSession(node, doc, $div.find('input[name=session]:checked').val());
    });

    app.sessionPrompt($div, node, doc);
  },

  sessionPrompt: function($div, node, doc)    {
    var $k_prompt = $div.kendoBalloonWindow({
      title: $div.attr('title'),
      resizable: false,
      modal: true,
      activate: function() {
        setTimeout(function() {
          $div.find('input[name=join]').focus()
        },200);
      }
    }).data("kendoBalloonWindow").center().open();

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
    var $div = $('<div id="fs-office-join-prompt" class="fs-prompt-window-inner" title="'+i18next.t('app.office.session.prompt.title')+'">'
            +'<div id="fs-office-join-prompt" fs-prompt-window-content>'+i18next.t('app.office.session.prompt.message_one', node.name, session.user.name, app.balloon.timeSince(new Date((session.created*1000))))+'</div>'
            +'<div class="fs-window-secondary-actions">'
            +'    <input type="button" tabindex="2" name="new" value="'+i18next.t('app.office.session.prompt.new')+'"/>'
            +'    <input type="button" tabindex="1" name="join" value="'+i18next.t('app.office.session.prompt.join')+'" class="fs-button-primary"/>'
            +'</div>'
        +'</div>');
    $("#fs-namespace").append($div);

    $div.find('input[name=join]').unbind('click').click(function(e) {
      e.stopImmediatePropagation();
      $div.data('kendoBalloonWindow').close();
      app.joinSession(node, doc, session.id);
    });

    app.sessionPrompt($div, node, doc);
  },

  newSession: function(node, doc) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/office/sessions?id='+app.balloon.id(node),
      type: 'POST',
      success: function(session) {
        app.initLibreOffice(node, doc, session);
      }
    });
  },

  joinSession: function(node, doc, session_id) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/office/sessions/join?id='+session_id,
      type: 'POST',
      success: function(session) {
        session.id = session_id;
        app.initLibreOffice(node, doc, session);
      }
    });
  },

  initLibreOffice: function(node, doc, session) {
    var $div = $('<div id="fs-edit-office"></div>');
    $('body').append($div);

    var $k_display = $div.kendoBalloonWindow({
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
            url: app.balloon.base+'/office/sessions?id='+session.id+'&access_token='+session.access_token,
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

        var src = session.wopi_url+app.balloon.base+'/office/wopi/document/'+session.id,
          src = encodeURIComponent(src),
          url = doc.loleaflet+'?WOPISrc='+src+'&title='+node.name+'&lang='+i18next.language+'&closebutton=0&revisionhistory=0';

        $div.append(
          '<form method="post" action="'+url+'" target="loleafletframe">'+
                    '<input type="hidden" name="access_token" value="'+session.access_token+'"/>'+
                    '<input type="hidden" name="access_token_ttl" value="'+session.access_token_ttl+'"/>'+
                  '</form>'+
                  '<iframe style="width: 100%; height: calc(100% - 40px);" name="loleafletframe"/>'
        );

        $div.find('form').submit();

        $(this.wrapper).find('.k-i-close').unbind('click.fix').bind('click.fix', function(e){
          e.stopImmediatePropagation();
          var msg  = i18next.t('app.office.close_edit_file', node.name);
          app.balloon.promptConfirm(msg, function(){
            app.balloon.xmlHttpRequest({
              url: app.balloon.base+'/office/sessions?id='+session.id+'&access_token='+session.access_token,
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
    }).data("kendoBalloonWindow").center().maximize();
  },

  showStartupPrompt: function(e) {
    if(localStorage.app_office_hide_prompt == "true") {
      return;
    }

    $("#fs-libreoffice-prompt").remove();

    var $div = $('<div id="fs-libreoffice-prompt" class="fs-prompt-window-inner" title="'+i18next.t('app.office.startup_prompt.title')+'">'
            +'<div id="fs-libreoffice-prompt-content" class="fs-prompt-window-content">'+i18next.t('app.office.startup_prompt.message')+'</div>'
            +'<div class="fs-window-secondary-actions">'
            +'    <input type="button" tabindex="2" name="hide" value="'+i18next.t('app.office.startup_prompt.dont_show_again')+'" />'
            +'    <input type="button" tabindex="1" name="close" value="'+i18next.t('app.office.startup_prompt.close')+'" class="fs-button-primary" />'
            +'</div>'
        +'</div>');

    $("#fs-namespace").append($div);

    var $k_prompt = $div.kendoBalloonWindow({
      title: $div.attr('title'),
      resizable: false,
      modal: true,
      activate: function() {
        setTimeout(function() {
          $div.find('input[name=close]').focus()
        },200);
      }
    }).data("kendoBalloonWindow");

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
    var supported_office = [
      'csv', 'odt','ott','ott','docx','doc','dot','rtf','xls','xlsx','xlt','ods','ots','ppt','pptx','odp','otp','potm'
    ];

    if(
      app.balloon.last !== null
      && app.balloon.last.directory === false
      && supported_office.indexOf(app.balloon.getFileExtension(app.balloon.last.name)) > -1
      && !app.balloon.isMobileViewPort()
    ) {
      app.edit(app.balloon.getCurrentNode());
      app.balloon.pushState();
    } else {
      app.origDblClick();
    }
  },

  addOfficeFile: function(name, type) {
    name = encodeURI(name);

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/office/documents?type='+type+'&name='+name+'&'+app.balloon.param('collection', app.balloon.getCurrentCollectionId()),
      type: 'POST',
      complete: function() {
        $('#fs-new-file').remove();
      },
      success: function(data) {
        app.balloon.added = data.id;
        app.balloon.refreshTree('/collections/children', {id: app.balloon.getCurrentCollectionId()});
      }
    });
  }
}

export default app;
