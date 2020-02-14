/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import "@babel/polyfill";
import iconsSvg from '@gyselroth/icon-collection/src/icons.svg';
import $ from "jquery";
import auth from './lib/auth.js';
import translation from './lib/translate.js';
import app from './lib/app.js';
import svgxuse from 'svgxuse';
import balloonCss from './themes/default/scss/balloon.scss';
import { polyfill } from 'es6-promise'; polyfill();
import { Workbox } from 'workbox-window';

window.jquery = $;

$.ajax({
  url: '/config.json',
  complete: async function(body, responseText, response) {
    if(body.localScript) {
      $.getScript(body.localScript);
    }
    console.log("auth init");

    try {
      await translation.init(responseText || {});
      await auth.init();
      app.init(responseText || {});
      app.render();
      auth.initApp();
    } catch (e) {
      auth.hideLoader(true);
      $('#login').show();
    }
  }
});

if ('serviceWorker' in navigator) {
  const wb = new Workbox('/service-worker.js');

  wb.addEventListener('waiting', (event) => {
    $('body').addClass('app-notification-visible');
    $('#update-notification').show().off('click').on('click', () => {

      wb.addEventListener('controlling', (event) => {
        window.location.reload();
      });

      wb.messageSW({type: 'SKIP_WAITING'});
    });
  });

  wb.register();
}
