import kendoWindow from 'kendo-ui-core/js/kendo.window.js';

(function($) {
  var kendo = window.kendo;
  var ui = kendo.ui;
  var Window = ui.Window;

  var BalloonWindow = Window.extend({

    init: function(target, options) {
      Window.fn.init.call(this, target, options);

      var $target = $(target);
      var $parent = $target.parent();

      var id = $target.attr('id');
      if(id) $parent.addClass(id);

      var $origIcon = $parent.find('.k-window-actions .k-i-close');
      if($origIcon.length > 0) {
        var $newIcon = $origIcon.parent().find('.gr-i-close');

        if($newIcon.length === 0) {
          $origIcon.parent().append('<svg class="gr-icon gr-i-close" viewBox="0 0 24 24"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="/assets/icons.svg#close"></use></svg>');
        }
      }

      this.title(options.title);
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

    options: {
      name: 'BalloonWindow',
    }
  });

  ui.plugin(BalloonWindow);
})(jQuery);
