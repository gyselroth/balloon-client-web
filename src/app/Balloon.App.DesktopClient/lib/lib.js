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
import login from '../../../lib/auth.js';

var app = {
  render: function(core) {
    this.balloon = core;
    this.$menu = $('<li>'
      +'<span class="gr-icon gr-i-favourite"></span>'
      +'<span>'+i18next.t('app.balloon_app_desktopclient.menu')+'</span>'
    +'</li>');

    $("#fs-identity-menu").css("height","+=20px");

    this.$menu.insertAfter('#fs-menu-user-events');
  },

  init: function()  {
    this.$menu.unbind('click').bind('click', function(){
      app.openPopup();
    });
  },

  openPopup: function() {
    var $div = $('<div id="fs-desktop">'
      + '<div>'+i18next.t('app.balloon_app_desktopclient.description')+'</div>'
      + '<ul>'
        + '<li id="fs-desktop-exe"><div></div><span>'+i18next.t('app.balloon_app_desktopclient.windows')+'</span></li>'
        + '<li id="fs-desktop-pkg"><div></div><span>'+i18next.t('app.balloon_app_desktopclient.osx')+'</span></li>'
        + '<li id="fs-desktop-zip"><div></div><span>'+i18next.t('app.balloon_app_desktopclient.linux')+'</span></li>'
        + '<li id="fs-desktop-deb"><div></div><span>'+i18next.t('app.balloon_app_desktopclient.debian')+'</span></li>'
        + '<li id="fs-desktop-rpm"><div></div><span>'+i18next.t('app.balloon_app_desktopclient.redhat')+'</span></li>'
      + '</ul>'
    +'</div>');

    $div.off('click').on('click', 'li', this.download);

    $('body').append($div);

    this.$k_popup = $div.kendoWindow({
      resizable: false,
      title: i18next.t('app.balloon_app_desktopclient.menu'),
      modal: true,
      draggable: true,
      open: function(e) {
      }
    }).data('kendoWindow').open().center();
  },

  download: function(e) {
    var format = $(this).attr('id').substr(11);
    var $iframe = $("#fs-fetch-file");
    var url = app.balloon.base+'/desktop-client/'+format+'/stream';

    if(typeof(login) === 'object' && login.getAccessToken()) {
      url += '?access_token='+login.getAccessToken();
    }

    $iframe.attr("src", url).load();
    app.$k_popup.close();
  }
}

export default app;
