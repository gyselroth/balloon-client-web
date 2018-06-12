SHELL=/bin/bash

# DIRECTORIES
BASE_DIR = .
NODE_MODULES_DIR = $(BASE_DIR)/node_modules
DIST_DIR = $(BASE_DIR)/dist
BUILD_DIR = $(BASE_DIR)/build
PACK_DIR = $(BASE_DIR)/pack

# VERSION
ifeq ($(VERSION),)
VERSION := "0.0.1"
endif

# PACKAGES
DEB = $(DIST_DIR)/balloon-web-$(VERSION).deb
TAR = $(DIST_DIR)/balloon-web-$(VERSION).tar.gz

# NPM STUFF
NPM_BIN = npm
ESLINT_BIN = $(NODE_MODULES_DIR)/.bin/eslint

# TARGET ALIASES
NPM_TARGET = $(NODE_MODULES_DIR)
WEBPACK_TARGET = $(BUILD_DIR)
ESLINT_TARGET = $(BASE_DIR)
CHANGELOG_TARGET = $(PACK_DIR)/DEBIAN/changelog
BUILD_TARGET = $(ESLINT_TARGET) $(WEBPACK_TARGET)

# TARGETS
.PHONY: all
all: dist


.PHONY: clean
clean:	mostlyclean
	@-test ! -d $(BUILD_DIR) || rm -rfv $(BUILD_DIR)


.PHONY: mostlyclean
mostlyclean:
	@-test ! -f $(TAR) || rm -fv $(TAR)
	@-test ! -d $(NODE_MODULES_DIR) || rm -rfv $(NODE_MODULES_DIR)
	@-test ! -f $(DIST_DIR)/* || rm -fv $(DIST_DIR)/*


.PHONY: deps
deps: npm


.PHONY: build
build: $(BUILD_TARGET)


.PHONY: dist
dist: tar deb


.PHONY: deb
deb: $(DIST_DIR)/balloon-web-$(VERSION).deb

$(DIST_DIR)/balloon-web-%-$(VERSION).deb: $(CHANGELOG_TARGET) $(BUILD_TARGET)
	@-test ! -d $(PACK_DIR) || rm -rfv $(PACK_DIR)
	@mkdir -p $(PACK_DIR)/DEBIAN
	@cp $(BASE_DIR)/packaging/debian/control $(PACK_DIR)/DEBIAN/control
	@sed -i s/'{version}'/$(VERSION)/g $(PACK_DIR)/DEBIAN/control
	@if [ $* == "full" ]; then cp $(BASE_DIR)/packaging/debian/postinst $(PACK_DIR)/DEBIAN/postinst; fi
	@mkdir -p $(PACK_DIR)/usr/share/balloon-web
	@cp -Rp $(BUILD_DIR)/* $(PACK_DIR)/usr/share/balloon-web
	@mkdir $(PACK_DIR)/usr/share/balloon-web/nginx
	@cp -Rp $(BASE_DIR)/packaging/nginx.conf $(PACK_DIR)/usr/share/balloon-web/nginx
	@-test -d $(DIST_DIR) || mkdir $(DIST_DIR)
	@dpkg-deb --build $(PACK_DIR) $@
	@rm -rf $(PACK_DIR)


.PHONY: tar
tar: $(TAR)

$(TAR): $(BUILD_TARGET)
	@-test ! -f $(TAR) || rm -fv $(TAR)
	@-test ! -d $(PACK_DIR) || rm -rfv $(PACK_DIR)
	@-test -d $(DIST_DIR) || mkdir $(DIST_DIR)
	@mkdir $(PACK_DIR)
	@cp -Rp $(BUILD_DIR)/* $(PACK_DIR)

	@tar -czvf $(TAR) -C $(PACK_DIR) .
	@rm -rf $(PACK_DIR)

	@touch $@


.PHONY: changelog
changelog: $(CHANGELOG_TARGET)

$(CHANGELOG_TARGET): CHANGELOG.md
	@-test -d $(@D) || mkdir -p $(@D)
	@v=""
	@stable="stable"
	@author=""
	@date=""
	@changes=""
	@-test ! -f $@ || rm $@

	@while read l; \
	do \
		if [ "$${l:0:2}" == "##" ]; \
		then \
	 		if [ "$$v" != "" ]; \
	 		then \
	 			echo "balloon ($$v) $$stable; urgency=low" >> $@; \
	 			echo -e "$$changes" >> $@; \
	 			echo >>  $@; \
	 			echo " -- $$author  $$date" >> $@; \
	 			echo >>  $@; \
	 			v=""; \
	 			stable="stable"; \
	 			author=";" \
	 			date=";" \
	 			changes=""; \
	 		fi; \
	 		v=$${l:3}; \
			if [[ "$$v" == *"RC"* ]]; \
	 	 	then \
	 			stable="unstable"; \
	 		elif [[ "$$v" == *"BETA"* ]]; \
	 		then \
	 			stable="unstable"; \
	 		elif [[ "$$v" == *"ALPHA"* ]]; \
	 		then \
	 			stable="unstable"; \
	 		elif [[ "$$v" == *"dev"* ]]; \
			then \
	 			stable="unstable"; \
	 		fi \
	 	elif [ "$${l:0:5}" == "**Mai" ]; \
	 	then \
	 		p1=`echo $$l | cut -d '>' -f1`; \
	 		p2=`echo $$l | cut -d '>' -f2`; \
	 		author="$${p1:16}>"; \
	 		date=$${p2:13}; \
	 		date=`date -d"$$date" +'%a, %d %b %Y %H:%M:%S %z'`; \
			if [ $$? -ne 0 ]; \
			then \
				date=`date +'%a, %d %b %Y %H:%M:%S %z'`; \
			fi; \
			echo $$date; \
	 	elif [ "$${l:0:2}" == "* " ]; \
	 	then \
			changes="  $$changes\n  $$l"; \
	 	fi; \
	done < $<
	@echo generated $@ from $<


.PHONY: npm
npm: $(NPM_TARGET)

$(NPM_TARGET) : $(BASE_DIR)/package.json
	@test "`$(NPM_BIN) install --dry-run 2>&1 >/dev/null | grep Failed`" == ""
	$(NPM_BIN) run install
	$(NPM_BIN) update
	@touch $@


.PHONY: eslint
eslint: $(ESLINT_TARGET)

$(ESLINT_TARGET) : $(NPM_TARGET)
	$(ESLINT_BIN) src *.js
	@touch $@

.PHONY: webpack
webpack: $(WEBPACK_TARGET)

$(WEBPACK_TARGET) : $(NPM_TARGET) $(BASE_DIR)/webpack.common.js
	$(NPM_BIN) run build
	@touch $@
