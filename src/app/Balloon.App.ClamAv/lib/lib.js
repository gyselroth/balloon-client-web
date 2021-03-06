/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import i18next from 'i18next';
import css from '../styles/style.scss';
import iconsSvg from '@gyselroth/icon-collection/src/icons.svg';

var app = {
  id: 'Balloon.App.ClamAv',

  render: function() {
  },

  preInit: function(core) {
    this.balloon = core;

    app.balloon.addMenu('quarantine', 'app.clamav.quarantine', 'warning', function() {
      app.balloon.tree.filter.deleted = 1;
      return app.balloon.refreshTree('/nodes', {query: {"app.Balloon\\App\\ClamAv.quarantine": true}}, {});
    });
  },

  postInit: function(core)  {
    this.balloon = core;
    $('#fs-browser-tree').data('kendoTreeView').bind("select", this.selectNode);

    this.balloon.addHint('app.clamav.hint');
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
          +'<svg class="gr-icon gr-i-checked-false"><use xlink:href="'+iconsSvg+'#checked-false"></use></svg>'
          +'<span>'+i18next.t('app.clamav.malware_found', app.balloon.last.malware_reason)+'</span>'
        +'</div>');

      $('#fs-metadata').prepend($node);
    } else if(app.balloon.last.malware_quarantine === false) {
      var $node = $('<div id="fs-clamav" class="fs-clamav-negative">'
          +'<svg class="gr-icon gr-i-checked-true"><use xlink:href="'+iconsSvg+'#checked-true"></use></svg>'
          +'<span>'+i18next.t('app.clamav.clean')+'</span>'
        +'</div>');

      $('#fs-metadata').prepend($node);
    }
  },
}

export default app;
