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
