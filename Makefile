SHELL=/bin/bash

# DIRECTORIES
BASE_DIR = .
NODE_MODULES_DIR = $(BASE_DIR)/node_modules
DIST_DIR = $(BASE_DIR)/dist
BUILD_DIR = $(BASE_DIR)/build
PACK_DIR = $(BASE_DIR)/pack
INSTALL_PREFIX = "/"

# VERSION
ifeq ($(VERSION),)
VERSION := "0.0.1"
endif

# PACKAGES
TAR = $(DIST_DIR)/balloon-web-$(VERSION).tar.gz

# NPM STUFF
NPM_BIN = npm
ESLINT_BIN = $(NODE_MODULES_DIR)/.bin/eslint

# TARGET ALIASES
INSTALL_TARGET = "$(INSTALL_PREFIX)usr/share/balloon-web"
NPM_TARGET = $(NODE_MODULES_DIR)
WEBPACK_TARGET = $(BUILD_DIR)
ESLINT_TARGET = $(BASE_DIR)
BUILD_TARGET = $(ESLINT_TARGET) $(WEBPACK_TARGET)

#DOCKER
DOCKER_NAME=gyselroth/balloon-web


help: ## This help.
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.DEFAULT_GOAL := help

# TARGETS
.PHONY: all
all: build


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
dist: tar docker

.PHONY: docker #Build test and create docker image
docker: $(BUILD_TARGET) composer-no-dev
	docker build -t $(DOCKER_NAME):$(VERSION) .

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

.PHONY: install
install: $(INSTALL_TARGET)

$(INSTALL_TARGET): $(BUILD_TARGET)
	@cp -Rp $(BUILD_DIR)/* $(INSTALL_PREFIX)/usr/share/balloon-web
	@mkdir -p /etc/nginx/conf.d/balloon
