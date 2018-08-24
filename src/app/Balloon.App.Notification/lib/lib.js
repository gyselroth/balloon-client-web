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
  id: 'Balloon.App.Notification',

  preInit: function(core) {
    this.balloon = core;

    var $content = $('<dd id="fs-notification">'+
      '<div id="fs-notification-description">'+i18next.t('app.balloon_app_notification.description')+'</div>'+
      '<div><input type="checkbox" id="fs-notification-subscribe" name="subscribe" value="1" /><label for="fs-notification-subscribe">'+i18next.t('app.balloon_app_notification.subscribe')+'</label></div>'+
      '<div class="fs-notification-suboption"><input type="checkbox" id="fs-notification-exclude_me" checked="checked" name="exclude_me" value="1" disabled /><label for="fs-notification-exclude_me">'+i18next.t('app.balloon_app_notification.exclude_me')+'</label></div>'+
      '<div class="fs-notification-suboption"><input type="checkbox" id="fs-notification-recursive" name="recursive" value="1" disabled /><label for="fs-notification-recursive">'+i18next.t('app.balloon_app_notification.recursive')+'</label></div>'+
      '<input type="submit" class="fs-button-primary" value="'+i18next.t('app.balloon_app_notification.save')+'">'+
    '</dd>');

    this.$content = $content;

    this.balloon.fs_content_views.push({
      id: 'notification',
      title: 'app.balloon_app_notification.menu_title',
      isEnabled: function() {
        return !app.balloon.last.deleted;
      },
      onActivate: app.onActivate,
      $content: $content
    });
  },

  postInit: function(core)  {
    this.balloon = core;

    this.$content.find('input[type=submit]').on('click', function(){
      var id = $(this).parent().attr('data-id');
      app.subscribe(app.balloon.last,
        app.$content.find('input[name=subscribe]').is(':checked'),
        app.$content.find('input[name=exclude_me]').is(':checked'),
        app.$content.find('input[name=recursive]').is(':checked')
      );
    });
  },

  onActivate: function() {
    var $subscribe = app.$content.find('input[name=subscribe]');
    var $exclude_me = app.$content.find('input[name=exclude_me]');
    var $recursive = app.$content.find('input[name=recursive]');

    if(app.balloon.last.subscription === false) {
      var exclude_me = true;
    } else {
      var exclude_me = app.balloon.last.subscription_exclude_me;
    }

    if(app.balloon.last.directory === false) {
      $recursive.parent().hide();
    }

    app._toggleCheckboxDisabled(app.balloon.last.subscription);

    $subscribe.prop('checked', app.balloon.last.subscription);
    $exclude_me.prop('checked', exclude_me);
    $recursive.prop('checked', app.balloon.last.subscription_recursive);

    $subscribe.off('change').on('change', function() {
      app._toggleCheckboxDisabled($subscribe.prop('checked'));
    });
  },

  _toggleCheckboxDisabled: function(subscribed) {
    var $exclude_me = app.$content.find('input[name=exclude_me]');
    var $recursive = app.$content.find('input[name=recursive]');

    if(subscribed) {
      $exclude_me.prop('disabled', false);
      $recursive.prop('disabled', false);
    } else {
      $exclude_me.prop('disabled', true);
      $recursive.prop('disabled', true);
    }
  },

  subscribe: function(node, subscription, exclude_me, recursive) {
    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/nodes/subscription',
      type: 'POST',
      dataType: 'json',
      data: {
        id: app.balloon.id(node),
        subscribe: subscription,
        exclude_me: exclude_me,
        recursive: recursive
      },
      success: function(node) {
        //TODO pixtron - this does not update the node in the datasource
        app.balloon.last = node;
      }
    });
  }
};

export default app;
