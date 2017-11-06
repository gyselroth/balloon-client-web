/**
 * Balloon
 *
 * @author    Raffael Sahli <sahli@gyselroth.net>
 * @copyright Copryright (c) 2012-2017 gyselroth GmbH (https://gyselroth.com)
 * @license   GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import office from '../app/Balloon.App.Office/lib/lib.js';
//import convert '../app/Balloon.App.Convert/lib/lib.js';

var apps = [
  office
]

var app = {
  render: function(core) {
    for(let app in apps) {
      apps[app].render(core);
    }
  },

  init: function(core) {
    for(let app in apps) {
      apps[app].init(core);
    }
  }
};

export default app;
