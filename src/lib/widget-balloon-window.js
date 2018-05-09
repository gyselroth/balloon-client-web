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
          $origIcon.parent().append('<svg class="gr-icon gr-i-close" viewBox="0 0 24 24"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#close"></use></svg>');
        }
      }
    },

    options: {
      name: 'BalloonWindow',
    }
  });

  ui.plugin(BalloonWindow);
})(jQuery);
