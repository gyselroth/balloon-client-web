import kendoDateTimePicker from 'kendo-ui-core/js/kendo.datetimepicker.js';
import iconsSvg from '@gyselroth/icon-collection/src/icons.svg';

(function($) {
  var kendo = window.kendo;
  var ui = kendo.ui;
  var TimePicker = ui.TimePicker;

  var BalloonTimePicker = TimePicker.extend({

    init: function(target, options) {
      TimePicker.fn.init.call(this, target, options);

      var $kSelect = $(target).siblings('.k-select');

      $kSelect.empty();
      $kSelect.append('<svg class="gr-icon gr-i-clock" viewBox="0 0 24 24"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="'+iconsSvg+'#clock"></use></svg>');
    },

    options: {
      name: 'BalloonTimePicker',
    }
  });

  ui.plugin(BalloonTimePicker);
})(jQuery);
