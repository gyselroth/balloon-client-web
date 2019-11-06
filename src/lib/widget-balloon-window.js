import kendoWindow from 'kendo-ui-core/js/kendo.window.js';
import iconsSvg from '@gyselroth/icon-collection/src/icons.svg';

(function($) {
  var kendo = window.kendo;
  var ui = kendo.ui;
  var Window = ui.Window;

  var BalloonWindow = Window.extend({

    init: function(target, options) {
      var that = this;

      var existingWin = $(target).data('kendoBalloonWindow');
      if(existingWin) existingWin.destroy();

      Window.fn.init.call(this, target, options);

      if(this.options.closeViaOverlay === undefined) {
        this.options.closeViaOverlay = true;
      }

      var $target = $(target);
      var $parent = $target.parent();

      var id = $target.attr('id');
      if(id) $parent.addClass(id);

      var $origIcon = $parent.find('.k-window-actions .k-i-close');
      if($origIcon.length > 0) {
        var $newIcon = $origIcon.parent().find('.gr-i-close');

        if($newIcon.length === 0) {
          $origIcon.parent().append('<svg class="gr-icon gr-i-close" viewBox="0 0 24 24"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="'+iconsSvg+'#close"></use></svg>');
        }
      }

      if(options.fullscreen === true) {
        $parent.addClass('fs-fullscreen-window');
        $('body').addClass('fs-fullscreen-window-open');
      }

      this.title(options.title);
    },

    open: function() {
      var that = this;
      Window.fn.open.call(this);

      var overlay = this.options.modal ? this._overlay(true) : $(undefined);
      if(this.options.modal && this.options.closeViaOverlay) {
        overlay.addClass('bln-overlay-clickable');
        overlay.off('click').on('click', function() {
          that.close();
        });
      } else {
        overlay.removeClass('bln-overlay-clickable');
      }

      return that;
    },

    center: function () {
      var that = this,
        position = that.options.position,
        wrapper = that.wrapper,
        documentWindow = $(window),
        scrollTop = 0,
        scrollLeft = 0,
        newTop, newLeft;

      if (that.options.isMaximized) {
        return that;
      }

      if(that.options.pinned && !that._isPinned) {
        that.pin();
      }

      if (!that.options.pinned) {
        scrollTop = documentWindow.scrollTop();
        scrollLeft = documentWindow.scrollLeft();
      }

      newLeft = scrollLeft + Math.max(0, (documentWindow.width() - wrapper.outerWidth()) / 2);
      newTop = scrollTop + Math.max(0, (documentWindow.height() - wrapper.outerHeight() - parseInt(wrapper.css("paddingTop"), 10)) / 2);

      wrapper.css({
        left: newLeft,
        top: newTop
      });

      position.top = newTop;
      position.left = newLeft;

      return that;
    },

    _actionForIcon: function(icon) {
      if(icon.hasClass('k-i-close')) {
        // remove the class, when window is close via action icon close.
        // a bit of a hack though, but unfourtanetly the action handler only
        // calls `_close`, which we can't extend without running into circular loops
        $('body').removeClass('fs-fullscreen-window-open');
      }

      return Window.fn._actionForIcon.call(this, icon);
    },

    close: function() {
      var that = this;

      if(this.options.fullscreen === true) {
        $('body').removeClass('fs-fullscreen-window-open');
      }

      Window.fn.close.call(this);

      return that;
    },

    options: {
      name: 'BalloonWindow',
    },

    _removeOverlay: function(suppressAnimation) {
      var modals = this._modals();
      var options = this.options;
      var overlay = options.modal ? this._overlay(true) : $(undefined);
      var hideOverlay = options.modal && !modals.length;

      if (hideOverlay) {
        this._overlay(false).remove();
      } else if (modals.length) {
        this._object(modals.last())._overlay(true);
      }
    },

    _keydown: function(e) {
      if(this.options.draggable && !e.ctrlKey && !e.altKey && [37,38,39,40].indexOf(e.keyCode) > -1) {
        //do not move window with arrow keys (needed for scrolling)
        return true;
      }

      Window.fn._keydown.call(this, e);
    },
  });

  ui.plugin(BalloonWindow);
})(jQuery);
