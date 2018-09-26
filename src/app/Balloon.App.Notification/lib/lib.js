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
  _loadingMessages: false,
  _messagesLimit: 10,

  preInit: function(core) {
    this.balloon = core;

    this.injectSettings();
    this.injectMessages();
  },

  postInit: function(core)  {
    this.balloon = core;

    this.initializeMessages();
    this.balloon.addHint(i18next.t('app.notification.hints.hint_1'));
    this.balloon.addHint(i18next.t('app.notification.hints.hint_2'));
    app._displayMessages();
  },

  /** Message Center **/

  /**
   * Inject the container displaying messages
   *
   * @return void
   */
  injectMessages: function() {
    var content =
      '<div id="fs-notifications-header">'+
        '<h3>'+ i18next.t('app.notification.messages.title') +'</h3>'+
        '<button id="fs-notifications-delete-all" class="fs-button-primary">' + i18next.t('app.notification.messages.delete_all') + '</button>'+
      '</div>'+
      '<div id="fs-notifications-messages-wrap">'+
        '<div id="fs-notifications-no-messages">'+ i18next.t('app.notification.messages.no_messages') +'</div>'+
        '<ul id="fs-notifications-messages"></ul>'+
      '</div>';

    app.balloon.addIdentityMenu('notifications', 'app.notification.messages.title', 'alert', content, true);

  },

  /**
   * Initialize messages
   *
   * @return void
   */
  initializeMessages: function() {

    this.$contentMessages = $('#fs-notifications');
    this.$contentMessagesDropdown = this.$contentMessages.find('#fs-notifications-dropdown');
    this.$contentMessagesContainer = this.$contentMessages.find('#fs-notifications-messages');
    this.$contentMessagesCount = this.$contentMessages.find('#fs-notifications-count');
    this.$contentMessagesDeleteAll = this.$contentMessages.find('#fs-notifications-delete-all');

    this.$contentMessages.off('click.balloon.app.notifications').on('click.balloon.app.notifications', function() {
      var $list = app.$contentMessagesContainer;
      $list.empty();
      $list.scrollTop(0);
      $list.data('fsNotificationsTotalMessages', 0);
      $list.data('fsNotificationsOffset', 0);

      app.$contentMessagesDropdown.removeClass('has-messages');
      app.$contentMessagesDeleteAll.off('click').on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();

        app._deleteAllDisplayedMessages();
      });

      app.$contentMessagesContainer.off('click').on('click', function(event) {
        //allow clicks on messages.
        event.stopPropagation();
      });

      app._displayMessages().done(function(body) {
        app._displayMessagesInfiniteScroll();
      });
    });
  },

  /**
   * Loads messages from server and adds it to the container
   *
   * @param int offset (optional offset)
   * @param int limit (optional limit)
   * @return void
   */
  _displayMessages: function(offset, limit) {
    app._loadingMessages = true;
    var $list = app.$contentMessagesContainer;
    var limit = limit || app._messagesLimit;
    var offset = offset || $list.data('fsNotificationsOffset');

    var request = app._fetchMessages(offset, limit);

    $list.data('fsNotificationsOffset', (offset + limit))

    request.done(function(body) {
      $list.data('fsNotificationsTotalMessages', body.total);

      if(body.total > 0) {
        app.$contentMessagesCount.html(body.total).show();
        app.$contentMessagesDropdown.addClass('has-messages');

        var messages = body.data;

        for(var i=0; i<messages.length; i++) {
          var meta;
          var message = messages[i];
          var date = kendo.toString(new Date(message.created), kendo.culture().calendar.patterns.g)

          if(message.sender && message.sender.username) {
            meta = i18next.t('app.notification.messages.message_meta', date, message.sender.username);
          } else {
            meta = i18next.t('app.notification.messages.message_meta_no_sender', date);
          }

          var $messageContent = $('<div class="fs-notifications-message-inner"></div>');

          if(message.node && message.node.id) {
            $messageContent.data('fs-node-id', message.node.id);
            $messageContent.off('click').on('click', function(event) {
              var nodeId = $(this).data('fs-node-id');

              app.balloon.xmlHttpRequest({
                url: app.balloon.base+'/nodes',
                data: {
                  id: nodeId
                },
                success: function(data) {
                  $(document).trigger('click');
                  var collection = (data.parent && data.parent.id) ? data.parent.id : null;
                  app.balloon.navigateTo('cloud', collection, data, 'preview');
                }
              });
            });
          }

          $messageContent.append($('<p class="fs-notifications-meta"></p>').text(meta));
          $messageContent.append($('<h4></h4>').text(message.subject));
          $messageContent.append($('<p></p>').text(message.message));
          $messageContent.append(
            '<div class="fs-notifications-delete-message">'+
              '<svg class="gr-icon gr-i-close" viewBox="0 0 24 24">'+
                '<use xlink:href="/assets/icons.svg#close"></use>'+
              '</svg>'+
            '</div>'
          );

          $messageContent.find('.fs-notifications-delete-message').click(app._onDeleteMessage);

          var $message = $('<li data-fs-message-id="' + message.id + '"></li>');

          $message.append($messageContent);
          $list.append($message);
        }
      } else {
        app.$contentMessagesDropdown.removeClass('has-messages');
        app.$contentMessagesCount.html(0).hide();
      }

      app._loadingMessages = false;
    });

    return request;
  },

  /**
   * Delete all messages
   *
   * @param int offset
   * @param int limit
   * @return void
   */
  _fetchMessages: function(offset, limit) {
    return app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/notifications',
      type: 'GET',
      dataType: 'json',
      data: {
        limit: limit,
        offset: offset
      },
    });
  },

  /**
   * Initialize infiinite scroll for messages
   *
   * @return void
   */
  _displayMessagesInfiniteScroll: function() {
    var $list = app.$contentMessagesContainer;

    $list.unbind('scroll').bind('scroll', function() {
      if(app._loadingMessages === false && ($list.scrollTop() + $list.height() * 1.75) >= $list[0].scrollHeight) {
        var offset = $list.data('fsNotificationsOffset');
        var total = $list.data('fsNotificationsTotalMessages');

        if(offset + app._messagesLimit >= (Math.ceil(total / app._messagesLimit) * app._messagesLimit) + 1) {
          $list.unbind('scroll');
        } else {
          app._displayMessages();
        }
      }
    });
  },

  /**
   * Delete all messages
   *
   * @return void
   */
  _deleteAllDisplayedMessages: function() {
    var $messages = app.$contentMessagesContainer.find('li');
    var messageIds = [];

    $messages.each(function(index, message) {
      messageIds.push($(message).data('fsMessageId'));
    });

    app._deleteMessagesIds(messageIds);
  },

  /**
   * Delete given messages
   *
   * @param array messageIds
   * @return void
   */
  _deleteMessagesIds: function(messageIds) {
    var requests = messageIds.map(function(messageId) {
      return app._deleteMessage(messageId, false);
    });

    var $d = $.when.apply($, requests);

    $d.always(function() {
      app._displayMessages();
    });

    return $d;
  },

  /**
   * Delete a given message
   *
   * @param string messageId
   * @param boolean loadNext
   * @return void
   */
  _deleteMessage: function(messageId, loadNext) {
    var $d = $.Deferred();

    app.balloon.xmlHttpRequest({
      url: app.balloon.base+'/notifications',
      type: 'DELETE',
      dataType: 'json',
      data: {
        id: messageId
      },
      success: function(body) {
        var $message = app.$contentMessagesContainer.find('li[data-fs-message-id="' + messageId + '"]');
        var $list = app.$contentMessagesContainer;
        var offset = $list.data('fsNotificationsOffset');
        var total = $list.data('fsNotificationsTotalMessages');
        total --;
        offset --;

        $message.addClass('fs-notifications-message-hidden');
        setTimeout(function() {
          $message.remove();

          if(total <= 0) {
            app.$contentMessagesDropdown.removeClass('has-messages');
            app.$contentMessagesCount.html(0).hide();
          }
        }, 700);

        $list.data('fsNotificationsTotalMessages', total);
        $list.data('fsNotificationsOffset', offset);

        if(total > 0) {
          app.$contentMessagesCount.html(total).show();

          if(loadNext && offset < total) {
            //load next message
            app._displayMessages(offset, 1);
          }
        }

        $d.resolve();
      },
      error: function() {
        $d.reject();
      }
    });

    return $d;
  },

  /**
   * Click callback, deleting a given message
   *
   * @return void
   */
  _onDeleteMessage: function(event) {
    event.stopPropagation();

    var messageId = $(event.target).closest('li').data('fsMessageId');
    app._deleteMessage(messageId, true);
  },

  /** Settings **/


  /**
   * Inject notification settings to side bar
   *
   * @return void
   */
  injectSettings: function() {
    var $contentSettings = $('<dd id="fs-notification">'+
      '<div id="fs-notification-description">'+i18next.t('app.notification.settings.description')+'</div>'+
      '<div><input type="checkbox" id="fs-notification-subscribe" name="subscribe" value="1" /><label for="fs-notification-subscribe">'+i18next.t('app.notification.settings.subscribe')+'</label></div>'+
      '<div class="fs-notification-suboption"><input type="checkbox" id="fs-notification-exclude_me" checked="checked" name="exclude_me" value="1" disabled /><label for="fs-notification-exclude_me">'+i18next.t('app.notification.settings.exclude_me')+'</label></div>'+
      '<div class="fs-notification-suboption"><input type="checkbox" id="fs-notification-recursive" name="recursive" value="1" disabled /><label for="fs-notification-recursive">'+i18next.t('app.notification.settings.recursive')+'</label></div>'+
      '<input type="submit" class="fs-button-primary" value="'+i18next.t('app.notification.settings.save')+'">'+
    '</dd>');

    this.$contentSettings = $contentSettings;

    this.balloon.addContentView(
      'notification',
      'app.notification.settings.menu_title',
      function() {
        return !app.balloon.last.deleted;
      },
      app.onActivateSettings,
      $contentSettings
    );
  },

  /**
   * Callback called, when notification settings are opened
   *
   * @return void
   */
  onActivateSettings: function() {
    var $subscribe = app.$contentSettings.find('input[name=subscribe]');
    var $exclude_me = app.$contentSettings.find('input[name=exclude_me]');
    var $recursive = app.$contentSettings.find('input[name=recursive]');
    var $submit = app.$contentSettings.find('input[type=submit]');

    if(app.balloon.last.subscription === false) {
      var exclude_me = true;
    } else {
      var exclude_me = app.balloon.last.subscription_exclude_me;
    }

    if(app.balloon.last.directory === false) {
      $recursive.parent().hide();
    } else {
      $recursive.parent().show();
    }

    app._toggleCheckboxDisabled(app.balloon.last.subscription);

    $subscribe.prop('checked', app.balloon.last.subscription);
    $exclude_me.prop('checked', exclude_me);
    $recursive.prop('checked', app.balloon.last.subscription_recursive);

    $subscribe.off('change').on('change', function() {
      app._toggleCheckboxDisabled($subscribe.prop('checked'));
    });

    $submit.off('click').on('click', function(){
      var id = $(this).parent().attr('data-id');
      app.subscribe(app.balloon.last,
        $subscribe.is(':checked'),
        $exclude_me.is(':checked'),
        $recursive.is(':checked')
      );
    });
  },

  /**
   * Toggles disabled state for notification checkboxes
   *
   * @return void
   */
  _toggleCheckboxDisabled: function(subscribed) {
    var $exclude_me = app.$contentSettings.find('input[name=exclude_me]');
    var $recursive = app.$contentSettings.find('input[name=recursive]');

    if(subscribed) {
      $exclude_me.prop('disabled', false);
      $recursive.prop('disabled', false);
    } else {
      $exclude_me.prop('disabled', true);
      $recursive.prop('disabled', true);
    }
  },

  /**
   * Subscribe to notifications for current node
   *
   * @return void
   */
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
        app.balloon.last = node;
        app.balloon.reloadTree();
      }
    });
  }
};

export default app;
