/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import i18next from 'i18next';
import css from '../styles/style.scss';
import login from '../../../lib/auth.js';
import balloonWindow from '../../../lib/widget-balloon-window.js';

var app = {
  id: 'Balloon.App.DesktopClient',

  render: function() {
    this.$menu = $('<li id="fs-menu-user-desktop" data-i18n="[title]app.balloon_app_desktopclient.menu">'
      +'<div class="fs-menu-left-icon">'
        +'<svg class="gr-icon gr-i-app-download"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="/assets/icons.svg#app-download"></use></svg>'
      +'</div>'
      +'<div><span>'+i18next.t('app.balloon_app_desktopclient.menu')+'</span></div>'
    +'</li>');

    this.$menu.appendTo('#fs-menu-left-bottom');
  },

  preInit: function(core)  {
    this.balloon = core;
    this.$menu.unbind('click').bind('click', function(){
      app.openPopup();
    });
  },

  openPopup: function() {
    var _self = this;
    var $div = $('<div id="fs-desktop">'
      + '<p>'+i18next.t('app.balloon_app_desktopclient.description')+'</p>'
      + '<ul>'
        + '<li id="fs-desktop-exe"><div class="icon"></div><span class="title">'+i18next.t('app.balloon_app_desktopclient.windows')+'</span><span class="download">'+i18next.t('app.balloon_app_desktopclient.download')+'</span></li>'
        + '<li id="fs-desktop-pkg"><div class="icon"></div><span class="title">'+i18next.t('app.balloon_app_desktopclient.osx')+'</span><span class="download">'+i18next.t('app.balloon_app_desktopclient.download')+'</span></li>'
        + '<li id="fs-desktop-zip"><div class="icon"></div><span class="title">'+i18next.t('app.balloon_app_desktopclient.linux')+'</span><span class="download">'+i18next.t('app.balloon_app_desktopclient.download')+'</span></li>'
        + '<li id="fs-desktop-deb"><div class="icon"></div><span class="title">'+i18next.t('app.balloon_app_desktopclient.debian')+'</span><span class="download">'+i18next.t('app.balloon_app_desktopclient.download')+'</span></li>'
        + '<li id="fs-desktop-rpm"><div class="icon"></div><span class="title">'+i18next.t('app.balloon_app_desktopclient.redhat')+'</span><span class="download">'+i18next.t('app.balloon_app_desktopclient.download')+'</span></li>'
      + '</ul>'
    +'</div>');

    $div.off('click').on('click', 'li', this.download);

    $('body .fs-desktop').remove();
    $('body').append($div);


    app.$k_popup = $div.kendoBalloonWindow({
      resizable: false,
      title: i18next.t('app.balloon_app_desktopclient.menu'),
      modal: true,
      draggable: true,
      open: function(e) {
      },
      close: function(e) {
        _self.$menu.removeClass('fs-menu-left-active');
      }
    }).data('kendoBalloonWindow');

    this.$k_popup.center().open();

    this.$menu.addClass('fs-menu-left-active');
  },

  download: function(e) {
    var format = $(this).attr('id').substr(11);
    var $iframe = $("#fs-fetch-file");
    var url = app.balloon.base+'/desktop-clients/'+format+'/content';

    if(typeof(login) === 'object' && login.getAccessToken()) {
      url += '?access_token='+login.getAccessToken();
    }

    $iframe.attr('src', url).load(url);
    app.$k_popup.close();
  }
}

export default app;
