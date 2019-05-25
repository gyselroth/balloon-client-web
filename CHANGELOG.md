## 3.2.x
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**:

* [FEATURE] Display mount information #73
* [CHANGE] Implement paged node listing #133
* [FEATURE] Undo move/clone via snackbar #42
* [FIX] Undo event "addCollectionShare" #157
* [FEATURE] Support for multiple office clients #149
* [FEATURE] Various snackbar undo actions #62
* [FIX] prompt user to save unsaved changes in text file #159
* [FIX] Not visible if a resource is a user or group in share dropdown #168
* [FIX] Share link from search context, no ui response #144
* [FIX] App aborts if received a server error #108
* [FEATURE] Implement webauthn authentification #182
* [FEATURE] Support for progressive web app (pwa) #82
* [FIX] Various actions reload the tree, without respecting search results #78
* [FIX] FOLDERUP in a search result ends in parent menu #177
* [FIX] Search does not get correctly initialized #176
* [FIX] reloadTree should work in search mode as well #173
* [FEATURE] Refresh tree with scrolling down #162
* [FEATURE] swipe left menu from right to left to open #82
* [FIX] Adding new node reloads root instead of current collection #158
* [FEATURE] Full WOPI support and support for multiple file handler apps #149
* [FEATURE] Implement recaptcha v2 ui #148
* [CHANGE] NTH: Own app for elastic search #129
* [FIX] Searching by tag resets search filter #126
* [FEATURE] Implement all features from the desktop version into the mobile version #81
* [FIX] Rename node: mouse usage on input field #63
* [FEATURE] New KendoBalloonFullscreenWindow #179
* [FIX] File view close should be top right #170


## 3.1.2
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Mon May 13 15:31:14 CEST 2019

* [FIX] Reload new node if unshare a collection as a share manager


## 3.1.1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Mon Apr 29 10:20:11 CEST 2019

* [FIX] uncaught error in IE11 #155


## 3.1.0
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri Apr 12 15:33:34 CEST 2019

* [FIX] Avoid wrongly positioned upload manager #153


## 3.1.0-beta3
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue Apr 02 15:25:43 CEST 2019

* [FIX] search summary attributes are now displayed correctly
* [CHANGE] Renew access_token for token login #151
* [FIX] Handle expired auth tokens #145


## 3.1.0-beta2
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri Mar 29 16:32:43 CET 2019

* [FIX] Display "InvalidEncryptionKey" message when adding external storage #142
* [FIX] Display multi factor if authenticated via internal Idp #141
* [FIX] fixed multi auth trigger if relogin is executed #141
* [CHANGE] Make it possible to enable/disable apps #147
* [FIX] loggedin user avatar gets loaded correctly


## 3.1.0-beta1
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu Mar 21 12:25:01 CET 2019

* [CHANGE] Add hint to share link settings #134
* [FIX] File does not get uploaded #139
* [FEATURE] Upload directories by drag and drop #11
* [FEATURE] Support for two factor auth and token authentication #141
* [CHANGE] Newer notifications should be on top #113
* [FEATURE] Nice URL's and easy way to share balloon url's #83
* [FEATURE] gui for special filtered folders #10
* [FIX] Uncaught TypeError when navigation away from deep links #122
* [CHANGE] If a sso oidc provider is called directly the login window must not be shown #72
* [CHANGE] Modals should be closable by clicking the greyed out area #50
* [CHANGE] BalloonWindow keydown #67
* [FEATURE] Choose between fulltextsearch and name only search #69
* [FEATURE] Change password #116


## 3.0.9
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue Jan 22 14:34:01 CET 2019

* [FIX] Avoid double requests in autocomplete #104
* [FIX] Do not show owner in list of share consumers #85
* [CHANGE] Use hash for all assets #84
* [FIX] Reload tree after changeing to readonly flag #79
* [FIX] Design issue share search user/groups #114
* [FIX] Undefined collection name in push state #78


## 3.0.8
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Wed Dez 05 08:55:22 CET 2018

* [FIX] Various german locale fixes
* [FIX] Delete button must be active for readonly files #110
* [FIX] Infinite scroll for events does not work #74
* [FIX] If a scrollbar is at the bottom in the balloon events window the scrollbar can not be moved anymore #75


## 3.0.7
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Tue Nov 13 09:39:22 CET 2018

* [FIX] File uploads are sent with wrong Content-Type header #106


## 3.0.6
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Fri Nov 09 09:28:22 CET 2018

* [FIX] doublecklick on folder too much recursion, folder does not open #91
* [FIX] Missing share "privilege" "deny" (d) #86


## 3.0.5
**Maintainer**: balloon-team <opensource@gyselroth.net>\
**Date**: Thu Oct 25 11:07:51 CEST 2018

* [CHANGE] Add user namespace to localStorage #101
* [FIX] n.data[b].client is undefined after open events #102


## 3.0.4
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
