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
  id: 'Balloon.App.ClamAv',

  render: function() {
  },

  postInit: function(core)  {
    this.balloon = core;
    $('#fs-browser-tree').data('kendoTreeView').bind("select", this.selectNode);
  },

  resetView: function() {
    $('#fs-clamav').remove();
  },

  selectNode: function() {
    app.resetView();
    if(app.balloon.last.directory) {
      return;
    }

    if(app.balloon.last.malware_quarantine === true) {
      var $node = $('<div id="fs-clamav" class="fs-clamav-positive">'
          +'<span>'+i18next.t('app.balloon_app_clamav.malware_found', app.balloon.last.malware_reason)+'</span>'
        +'</li>');

      $('#fs-properties').prepend($node);
    } else if(app.balloon.last.malware_quarantine === false) {
      var $node = $('<div id="fs-clamav" class="fs-clamav-negative">'
          +'<span>'+i18next.t('app.balloon_app_clamav.clean')+'</span>'
        +'</li>');

      $('#fs-properties').prepend($node);
    }
  },
}

export default app;
