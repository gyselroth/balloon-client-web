/**
 * balloon
 *
 * @copyright Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license   GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import office from '../app/Balloon.App.Office/lib/lib.js';
import convert from '../app/Balloon.App.Convert/lib/lib.js';
import notification from '../app/Balloon.App.Notification/lib/lib.js';
import clamav from '../app/Balloon.App.ClamAv/lib/lib.js';
import desktop from '../app/Balloon.App.DesktopClient/lib/lib.js';

var apps = [
  office,
  convert,
  notification,
  clamav,
  desktop
]

var app = {
  render: function(core) {
    for(let app in apps) {
      apps[app].render();
    }
  },

  init: function(core) {
    for(let app in apps) {
      apps[app].init(core);
    }
  }
};

export default app;
