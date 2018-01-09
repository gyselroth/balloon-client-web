## 2.0.0-dev
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**:

First relese of the extracted web ui from the core server.

* [FEATURE] Added new tree flag if node is readonly
* [FEATURE] Added new tree flag if node is set on auto destroy
* [FEATURE] Implemented ui for node master/slaves https://github.com/gyselroth/balloon/issues/9
* [FIX] added missing german locale for view.prop.head.share_value
* [FEATURE] Possibility to configure file shadows
* [CHANGE] node list now gets populated without size for collections which increases performance (Collection number of children is still visible in the properties tab)
* [CHANGE] migrated to AppAuth-JS https://github.com/gyselroth/balloon/issues/30
* [FEATURE] Support for multiple OpenID-connect provider
* [CHANGE] Migrated from bower to npm and webpack https://github.com/gyselroth/balloon/issues/54
* [CHANGE] Started to refactore into modules https://github.com/gyselroth/balloon/issues/35, also implemented some build changes according webpack
* [CHANGE] migrated fonts to ubuntu-fontface
* [FEATURE] Possibility to configure share node name https://github.com/gyselroth/balloon/issues/94
* [FIX] Changeable node properties in readonly shares are not visible anymore (Only as readable decleration)
* [FIX] share collection tab is not visible for sub share nodes
* [FEATURE] Possibility to handle unlimited quota
