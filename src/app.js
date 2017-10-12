import reset from './themes/default/css/reset.css';
import kendo from './themes/default/css/kendo.css';
import ubuntu_fonts from 'ubuntu-fontface/ubuntu.css';
import kendo_theme from './themes/default/css/kendo_theme.css';
import layout from './themes/default/css/layout.css';
import responsive from './themes/default/css/responsive.css';
import icons from '@gyselroth/icon-collection/src/icons.css';
import translate from './lib/translate.js';

try {
  let wait = require('bundle-loader!../config.json');
  wait((config) => {
    translate.init(config);
  })
} catch (e) {
  translate.init({});
}



/*import auth from './lib/auth.js';
import core from './lib/core.js';
*/

/*
    <script type="text/javascript" src="/ui/vendor/jquery/dist/jquery.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/jquery-ui/jquery-ui.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-core/js/kendo.ui.core.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/kendo.treeview.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/jso/build/jso.js"></script>
    <script type="text/javascript" src="/ui/vendor/i18next/i18next.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/jquery-i18next/jquery-i18next.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/i18next-xhr-backend/i18nextXHRBackend.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/i18next-browser-languagedetector/i18nextBrowserLanguageDetector.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/i18next-localstorage-cache/i18nextLocalStorageCache.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/i18next-sprintf-postprocessor/i18nextSprintfPostProcessor.min.js"></script>
    <script type="text/javascript" src="/ui/lib/translate.js"></script>
    <script type="text/javascript" src="/ui/lib/login.js"></script>
    <script type="text/javascript" src="/ui/lib/file.js"></script>
    <script type="text/javascript" src="/ui/app/Balloon.App.Office/lib/lib.js"></script>
    <script type="text/javascript" src="/ui/app/Balloon.App.Convert/lib/lib.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.de.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.de-CH.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.de-AT.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.de-DE.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.en.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.en-GB.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.en-AU.min.js"></script>

*/
