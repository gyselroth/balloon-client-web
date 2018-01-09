/**
 * balloon
 *
 * @copyright Copryright (c) 2012-2017 gyselroth GmbH (https://gyselroth.com)
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
  username: null,
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
    }

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
      $login.find('input[type=submit]').off('click').on('click', login.initBasicAuth);

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
      cache: false,
      complete: function(response) {
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
          url: '/api/v'+balloon.BALLOON_API_VERSION,
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
      url: '/api/auth',
      cache: false,
      complete: function(response) {
        switch(response.status) {
        case 401:
        case 403:
          $('#login-oidc-error').show();
          break;

        case 400:
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

  fetchIdentity: function() {
    login.xmlHttpRequest({
      url: '/api/v'+balloon.BALLOON_API_VERSION+'/user/whoami',
      dataType: 'json',
      cache: false,
      success: function(body) {
        login.username = body.data;
        localStorage.username = login.username;
        $('#fs-identity').show().find('#fs-identity-username').html(body.data);
      }
    });
  },

  getUsername: function() {
    return this.username;
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

    AuthorizationServiceConfiguration.fetchFromIssuer(idp.providerUrl).then(configuration => {
      var request = new AuthorizationRequest(
        idp.clientId, idp.redirectUri, idp.scope, 'id_token token', undefined, {'nonce': Math.random().toString(36).slice(2)});

      login.handler.performAuthorizationRequest(configuration, request);
    });
  },

  initBasicAuth: function() {
    var $login = $('#login');
    $login.find('.error-message').hide();
    var $username_input = $login.find('input[type=text]');
    var $password_input = $login.find('input[type=password]');

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

  doBasicAuth: function(username, password) {
    var $login = $('#login');
    var $username_input = $login.find('input[type=text]');
    var $password_input = $login.find('input[type=password]');

    $.ajax({
      type: 'GET',
      username: username,
      password: password,
      dataType: 'json',
      url: '/api/v1/user/whoami',
      beforeSend: function() {
        $username_input.removeClass('error');
        $password_input.removeClass('error');
      },
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
          login.adapter = 'basic';
          login.username = response.responseJSON.data;
          localStorage.username = login.username;
          $('#fs-identity').show().find('#fs-identity-username').html(login.username);
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
