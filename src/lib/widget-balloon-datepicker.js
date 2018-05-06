import kendoDateTimePicker from 'kendo-ui-core/js/kendo.datetimepicker.js';

(function($) {
  var kendo = window.kendo;
  var ui = kendo.ui;
  var DatePicker = ui.DatePicker;

  var BalloonDatePicker = DatePicker.extend({

    init: function(target, options) {
      DatePicker.fn.init.call(this, target, options);

      var $kSelect = $(target).siblings('.k-select');

      $kSelect.empty();
      $kSelect.append('<svg class="gr-icon gr-i-calendar" viewBox="0 0 24 24"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="../node_modules/@gyselroth/icon-collection/src/icons.svg#calendar"></use></svg>');
    },

    options: {
      name: 'BalloonDatePicker',
    }
  });

  ui.plugin(BalloonDatePicker);
})(jQuery);
