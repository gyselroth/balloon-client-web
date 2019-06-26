/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import "@babel/polyfill";
import iconsSvg from '@gyselroth/icon-collection/src/icons.svg';
import $ from "jquery";
import translate from './lib/translate.js';
import svgxuse from 'svgxuse';
import balloonCss from './themes/default/scss/balloon.scss';
import { polyfill } from 'es6-promise'; polyfill();
import { Workbox } from 'workbox-window';

window.jquery = $;

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


if ('serviceWorker' in navigator) {
  const wb = new Workbox('/service-worker.js');

  wb.addEventListener('activated', (event) => {
    if (event.isUpdate) {
      // reload when there is a newer version available
      window.location.reload();
    }
  });

  wb.register();
}
