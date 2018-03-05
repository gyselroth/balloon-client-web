## 2.0.0-beta1
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Mon Mar 05 10:01:18 CET 2018

Web UI v2. Fully compatible with balloon server v2 and also includes some new features which balloon server 2.0.0 offers.
Using REST API v2.

* [FEATURE] Added new tree flag if node is readonly
* [FEATURE] Added new tree flag if node is set on auto destroy
* [FEATURE] Implemented ui for node master/slaves https://github.com/gyselroth/balloon/issues/9
* [FEATURE] Possibility to configure file shadows
* [CHANGE] Started to refactore into modules https://github.com/gyselroth/balloon/issues/35, also implemented some build changes according webpack
* [FEATURE] Possibility to configure share node name https://github.com/gyselroth/balloon/issues/94
* [FEATURE] Possibility to handle unlimited quota
* [FEATURE] Implemented interface for server app Balloon.App.Notification (Subscribe for changes & receive notifications)
* [FEATURE] Implemented interface for server app Balloon.App.Convert (Automatically clone nodes and convert to other formats)
* [FEATURE] Implemented interface for server app Balloon.App.DesktopClient (Download the balloon desktop client)
* [FEATURE] Possibility to define localScript in config.js
* [FEATURE] Added loader unter the whole DOM is rendered
* [CHANGE] New search design


## 1.0.0
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Mon Mar 05 10:01:18 CET 2018

First relese of the extracted web ui from the core server. Using REST API v1.

* [FIX] added missing german locale for view.prop.head.share_value
* [CHANGE] migrated to AppAuth-JS https://github.com/gyselroth/balloon/issues/30
* [FEATURE] Support for multiple OpenID-connect provider
* [CHANGE] Migrated from bower to npm and webpack https://github.com/gyselroth/balloon/issues/54
* [CHANGE] migrated fonts to ubuntu-fontface
* [FIX] Changeable node properties in readonly shares are not visible anymore (Only as readable decleration)
* [FIX] share collection tab is not visible for sub share nodes
