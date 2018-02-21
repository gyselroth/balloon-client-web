/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import reset from './themes/default/css/reset.css';
import kendo from './themes/default/css/kendo.css';
import ubuntu_fonts from 'ubuntu-fontface/ubuntu.css';
import kendo_theme from './themes/default/css/kendo_theme.css';
import layout from './themes/default/css/layout.css';
import responsive from './themes/default/css/responsive.css';
import icons from '@gyselroth/icon-collection/src/icons.css';
import $ from "jquery";
import translate from './lib/translate.js';

$.ajax({
   url: '/config.json',
   success: function(body, responseText, response) {
      if(body.localScript) {
        $.getScript(body.localScript);
      }

      translate.init(body);
   },
   error: function() {
      translate.init({});
  }
});
