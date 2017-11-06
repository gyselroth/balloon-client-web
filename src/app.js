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

/*
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.de.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.de-CH.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.de-AT.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.de-DE.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.en.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.en-GB.min.js"></script>
    <script type="text/javascript" src="/ui/vendor/kendo-ui-web/scripts/cultures/kendo.culture.en-AU.min.js"></script>
*/
