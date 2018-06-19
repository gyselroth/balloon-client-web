/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import iconsSvg from '@gyselroth/icon-collection/src/icons.svg';

import $ from "jquery";
import translate from './lib/translate.js';
import svgxuse from 'svgxuse';

import balloonCss from './themes/default/scss/balloon.scss';


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
