/**
 * balloon
 *
 * @copyright Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license   GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import balloon from './core.js';
const {AuthorizationServiceConfiguration} = require('@openid/appauth/built/authorization_service_configuration.js');
const {AuthorizationRequest} = require('@openid/appauth/built/authorization_request.js');
const {AuthorizationNotifier} = require('@openid/appauth/built/authorization_request_handler.js');
const {RedirectRequestHandler} = require('@openid/appauth/built/redirect_based_handler.js');

var login = {
  token: undefined,
  adapter: null,
  user: null,
  basic: true,
  oidc: [],
  notifier: null,
  handler: null,

  init: function(config) {
    if(config && config.auth) {
      if(config.auth.basic === false) {
        this.basic = false;
      }

      if(config.auth.oidc) {
        this.oidc = config.auth.oidc;
      }

      var type = window.location.hash.substr(1);
      if(type) {
        login.initOidcAuth(type);
      }
    }

    $('#login-footer').find('span').html(process.env.VERSION);
    if(this.basic === false) {
      $('#login-basic').hide();
    }

    var $oidc = $('#login-oidc');
    for(let i in this.oidc) {
      $oidc.append('<img alt="'+this.oidc[i].providerUrl+'" src="data:image/png;base64,'+this.oidc[i].imgBase64+'" />');
    }

    this.checkAuth();
  },

  parseAuthorizationResponse: function() {
    var hash = window.location.hash.substr(1);
    var obj = {};
    var pairs = hash.split('&');

    for(let i in pairs){
      let split = pairs[i].split('=');
      obj[decodeURIComponent(split[0])] = decodeURIComponent(split[1]);
    }

    return obj;
  },

  checkOidcAuth: function() {
    this.notifier = new AuthorizationNotifier();
    this.handler = new RedirectRequestHandler();

    this.notifier.setAuthorizationListener(function (request, response, error) {
      var hash = login.parseAuthorizationResponse();
      if (response && hash.access_token) {
        login.token = hash.access_token;
        login.adapter = 'oidc';
        login.verifyOidcAuthentication();
      } else {
        $('#login-oidc-error').show();
      }

      window.location.hash = '';
    });

    this.handler.setAuthorizationNotifier(this.notifier);
    this.handler.completeAuthorizationRequestIfPossible();
  },

  checkAuth: function() {
    this.checkOidcAuth();

    var login_helper = function(e) {
      login.destroyBrowser();

      var $login = $('#login').show();

      $('#fs-namespace').hide();
      $login.find('input[type=submit]').on('click', login.initBasicAuth);

      if(localStorage.username !== undefined) {
        $login.find('input[name=username]').val(localStorage.username);
      }

      $(document).on('keydown', function(e) {
        if(e.keyCode === 13 && login.basic === true) {
          login.initBasicAuth();
        }
      });

      $('#login-oidc').find('img').off('click').on('click', function() {
        $login.find('.error-message').hide();
        login.initOidcAuth($(this).attr('alt'));
      });
    };

    var options = {
      type:'GET',
      url: '/api/auth',
      complete: function(response) {
        $('#login-loader').hide();
        switch(response.status) {
        case 401:
        case 403:
          login_helper(response);
          break;

        case 400:
          if(login.token) {
            login.adapter = 'oidc';
          } else {
            login.adapter = 'basic';
          }
          login.fetchIdentity();
          break;

        case 200:
        case 404:
          login.verifyIdentity();
          break;

        default:
          $('#login').show();
          $('#login-server-error').show();
          $('#login-body').hide();
          break;
        }
      }
    }

    if(login.token) {
      options.headers = {
        "Authorization": 'Bearer '+login.token,
      }
    }

    $.ajax(options);
  },

  logout: function() {
    login.token = null;
    login.destroyBrowser();

    if(login.adapter === 'basic') {
      if(navigator.userAgent.indexOf('MSIE') > -1 || navigator.userAgent.indexOf('Edge') > -1) {
        document.execCommand('ClearAuthenticationCache', 'false');
        login.destroyBrowser();
        login.checkAuth();
      } else {
        $.ajax({
          url: '/api/logout',
          username: '_logout',
          password: 'logout',
          cache: false,
          statusCode: {
            401: function() {
              login.destroyBrowser();
              login.checkAuth();
            }
          }
        });
      }
    }
  },

  verifyOidcAuthentication: function() {
    login.xmlHttpRequest({
      url: '/api/v2/users/whoami',
      cache: false,
      complete: function(response) {
        switch(response.status) {
        case 401:
        case 403:
          $('#login-oidc-error').show();
          break;

        case 200:
          login.user = response.responseJSON;
          localStorage.username = login.user.username;

          login.updateFsIdentity();

          login.initBrowser();
          break;

        default:
          $('#login').show();
          $('#login-server-error').show();
          $('#login-body').hide();
          break;
        }
      }
    });
  },

  fetchIdentity: function() {
    login.xmlHttpRequest({
      url: '/api/v'+balloon.BALLOON_API_VERSION+'/users/whoami',
      dataType: 'json',
      cache: false,
      success: function(body) {
        window.location.hash = '';
        login.user = body;
        localStorage.username = login.user.username;
        login.updateFsIdentity();
      }
    });
  },

  updateFsIdentity: function() {
    $('#fs-identity').show().find('#fs-identity-username').html(login.user.username);

    return login.xmlHttpRequest({
      url: '/api/v'+balloon.BALLOON_API_VERSION+'/users/avatar',
      dataType: 'json',
      cache: false,
      success: function(body) {
        var $avatar = $('#fs-identity-avatar');
        $avatar.css('background-image', 'url(data:image/jpeg;base64,'+body+')');
      },
      error: function() {
        var $avatar = $('#fs-identity-avatar');
        $avatar.css('background-image', '');
      }
    });;
  },

  getAccessToken: function() {
    return this.token;
  },

  xmlHttpRequest: function(options) {
    if(login.token) {
      if(options.headers) {
        options.headers["Authorization"] = 'Bearer '+login.token;
      } else {
        options.headers = {
          "Authorization": 'Bearer '+login.token
        };
      }
    }

    return $.ajax(options);
  },

  getIdpConfigByProviderUrl: function(provider_url) {
    for(let i in this.oidc) {
      if(this.oidc[i].providerUrl === provider_url) {
        return this.oidc[i];
      }
    }
  },

  initOidcAuth: function(provider_url) {
    var idp = this.getIdpConfigByProviderUrl(provider_url);

    if(!idp) {
      return;
    }

    AuthorizationServiceConfiguration.fetchFromIssuer(idp.providerUrl).then(configuration => {
      var request = new AuthorizationRequest(
        idp.clientId, idp.redirectUri, idp.scope, 'id_token token', undefined, {'nonce': Math.random().toString(36).slice(2)});

      login.handler.performAuthorizationRequest(configuration, request);
    });
  },

  initBasicAuth: function() {
    var $login = $('#login');
    $login.find('.error-message').hide();
    var $username_input = $login.find('input[name=username]');
    var $password_input = $login.find('input[name=password]');

    var username = $username_input.val();
    var password = $password_input.val();

    if(username == '') {
      $username_input.addClass('error');
    }
    if(password == '') {
      $password_input.addClass('error');
    }

    if(username == '' || password == '') {
      return;
    }

    $password_input.val('');

    login.doBasicAuth(username, password);
  },

  verifyIdentity: function() {
    var $login = $('#login');
    var $username_input = $login.find('input[name=username]');
    var $password_input = $login.find('input[name=password]');
    window.location.hash = '';

    $.ajax({
      type: 'GET',
      dataType: 'json',
      url: '/api/auth',
      complete: function(response) {
        switch(response.status) {
        case 401:
        case 403:
          $('#fs-namespace').hide();
          $('#login-basic-error').show();
          $username_input.addClass('error');
          $password_input.addClass('error');
          break;

        case 200:
        case 404:
          login.adapter = 'basic';
          login.fetchIdentity();
          login.initBrowser();
          break;

        default:
          $('#login').show();
          $('#login-server-error').show();
          $('#login-body').hide();
          break;
        }
      }
    });
  },

  doBasicAuth: function(username, password) {
    $.ajax({
      type: 'GET',
      username: username,
      password: password,
      dataType: 'json',
      url: '/api/basic-auth',
      complete: login.verifyIdentity
    });
  },

  initBrowser: function() {
    $('#login').hide();
    $('#fs-namespace').show();

    $('#fs-menu-user-logout').unbind('click').bind('click', function() {
      login.logout();
    });

    balloon.init();
  },

  destroyBrowser: function() {
    $('#login').show();
    balloon.resetDom();
    $('#fs-namespace').hide();
  },
}

export default login;
