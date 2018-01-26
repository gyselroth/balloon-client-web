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
  render: function(core) {
    this.balloon = core;

    var $node = $('<li id="fs-view-notification" style="display: inline-block;" class="fs-view-bar-active">'
                +'<span>'+i18next.t('app.balloon_app_notification.menu_title')+'</span>'
            +'</li>');

    $('#fs-view-bar').find('ul').append($node);
    app.$menu = $node;

    var $view = $('<div id="fs-notification" class="fs-view-content">'
                +'<div id="fs-notification-description">'+i18next.t('app.balloon_app_notification.description')+'</div>'
                +'<div>'+i18next.t('app.balloon_app_notification.subscribe')+' <input type="checkbox" name="subscribe" value="1"/></div>'
                +'<div>'+i18next.t('app.balloon_app_notification.exclude_me')+' <input type="checkbox" name="exclude_me" value="1"/></div>'
                +'<div>'+i18next.t('app.balloon_app_notification.recursive')+' <input type="checkbox" name="recursive" value="1"/></div>'
                +'<input type="submit" value="'+i18next.t('app.balloon_app_notification.save')+'">'
            +'</div>');

    $('#fs-content-data').prepend($view);

    $view.find('input[type=submit]').on('click', function(){
      var id = $(this).parent().attr('data-id');
      app.subscribe(app.balloon.last,
        $view.find('input[name=subscribe]').is(':checked'),
        $view.find('input[name=exclude_me]').is(':checked'),
        $view.find('input[name=recursive]').is(':checked')
      );
    });

    app.$view = $view;
    app.resetView();
  },

  init: function()  {
    $('#fs-browser-tree').data('kendoTreeView').bind("select", this.selectNode);
  },

  resetView: function() {
    app.$view.find('input[name=subscribe]').prop('checked', false);
    app.$view.find('input[name=exclude_me]').prop('checked', true);
    app.$view.find('input[name=recursive]').prop('checked', false);
  },

  selectNode: function() {
    if(app.balloon.last.deleted) {
      return;
    }

    app.$menu.show().unbind('click').bind('click', function(){
      app.resetView();
      $('.fs-view-content').hide();
      $('#fs-view-bar').find('li').removeClass('fs-view-bar-active');
      app.$view.show();
      app.$view.find('input[name=subscribe]').prop('checked', app.balloon.last.subscription);
      app.$view.find('input[name=exclude_me]').prop('checked', app.balloon.last.subscription_exclude_me);
      app.$view.find('input[name=recursive]').prop('checked', app.balloon.last.subscription_recursive);
    });
  },

  subscribe: function(node, subscription, exclude_me, recursive) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/notification/subscribe',
      type: 'POST',
      dataType: 'json',
      data: {
        id: app.balloon.id(node),
        subscribe: subscription,
        exclude_me: exclude_me,
        recursive: recursive
      },
    });
  }
};

export default app;
