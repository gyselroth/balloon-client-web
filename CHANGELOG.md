## 3.0.5
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue Oct 23 13:25:51 CEST 2018

* [FIX] Popup destroy shared links shows date 1970-01-01 instead the choosen one #98
* [FIX] Metadata inputs are not cleared if a new node gets openened #99
* [FIX] Fixed de_CH and en_US hint locale typos


## 3.0.3
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue Oct 23 10:32:55 CEST 2018

* [FIX] login background image not stretched on ie11 #94
* [FIX] Object method assign does not exists on ie11 #95
* [FIX] syntax error in translate.js on ie11 #93
* [FIX] Promise is undefined on IE11 #92


## 3.0.2
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Mon Oct 22 10:32:34 CEST 2018

* [FIX] Fixed get access token for node download/preview if authenticated via oidc #87


## 3.0.1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue Oct 02 10:32:20 CEST 2018

* [FIX] Metadata contains a share property with a date on non shared collections #66


## 3.0.0
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue Oct 02 09:03:20 CEST 2018

Web UI v3. Complete redesign.


## 3.0.0-rc1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri Sept 28 16:36:20 CEST 2018

Web UI v3. Complete redesign.


## 3.0.0-beta2
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Wed Sept 26 14:21:34 CEST 2018

Web UI v3. Complete redesign.

## 3.0.0-beta1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri Sept 14 14:53:33 CEST 2018

Web UI v3. Complete redesign.


## 2.0.2
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Mon Jul 16 09:59:58 CEST 2018

* [FIX] fixed last node not visible #54
* [FIX] fixed wrong credentials will show a browser authentication prompt #53


## 2.0.1
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Mon Jul 09 14:54:33 CEST 2018

* [FIX] fixes nginx.conf for webdav
* [FIX] fixes quota handling for change in api v2, do not check for quota in chunked upload since this is now done through the api at each chunk


## 2.0.0
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Thu Jun 28 10:37:34 CEST 2018

* [FIX] fixes user/group namespaces in share ui


## 2.0.0-rc1
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Fri Jun 15 17:36:32 CEST 2018

* [CHANGE] avatar and preview images are now used as binary image from api
* [FIX] fixes invalid view for file/collection nodes, load always preview first
* [FIX] fixes re-added new nodes entries after relogin


## 2.0.0-beta3
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Tue May 15 14:52:11 CEST 2018

* [FIX] share reset button is only visible after enter input
* [FIX] fixed right pannel toggle in mobile view
* [CHANGE] adding new nodes opens a dropdown to choose from and set the new name


## 2.0.0-beta2
**Maintainer**: Raffael Sahli <sahli@gyselroth.com>\
**Date**: Mon Mar 26 13:01:18 CEST 2018

* [FIX] fixed error node is not a share after unshare a collection
* [FIX] popup close icon is now brighter and better visible
* [FIX] fixed scroll on mobile devices (mobile responsive view)
* [FIX] fixed Balloon.App.Notification subscription exception after subscribe a node
* [FIX] going up link gets added after a new node has been added within the root
* [FIX] keyboard navigation through tree
* [FIX] Exception node is not a share after unshare a collection
* [FIX] deleted nodes can not be restored if a node with the same name exists in root
* [CHANGE] the search mode now displays the path of a node instead the name in the tree
* [FIX] fixed right pannel which does not always toggle
* [FIX] auth credentials are now stored in browser cache, no login window anymore after reload


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
