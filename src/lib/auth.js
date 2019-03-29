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
  credentials: 'token',
  oidc: [],
  notifier: null,
  handler: null,
  mayHideLoader: true,
  internalIdp: true,
  recaptchaKey: null,

  init: function(config) {
    this.recaptchaKey = config.recaptchaKey;

    if(config && config.auth) {
      if(config.auth.credentials) {
        this.credentials = config.auth.credentials;
      }

      if(config.auth.oidc) {
        this.oidc = config.auth.oidc;
      }
    }

    this._initHash();

    $('#login-footer').find('span').html(process.env.VERSION);
    if(this.credentials === null) {
      $('#login-basic').hide();
    }

    var $oidc = $('#login-oidc');
    for(let i in this.oidc) {
      $oidc.append('<img alt="'+this.oidc[i].providerUrl+'" src="data:image/png;base64,'+this.oidc[i].imgBase64+'" />');
    }

    this.checkAuth();
  },

  _initHash: function() {
    var hash = window.location.hash.substr(1);

    if(hash) {
      if(login.initOidcAuth(hash)) {
        login.mayHideLoader = false;
      } else {
        var pairs = this.parseAuthorizationResponse();
        if(pairs.access_token) {
          login.mayHideLoader = false;
        } else {
          //assume it is an internal balloon url
          localStorage.setItem('redirectAfterLogin', hash);
          login.replaceState('');
        }
      }
    }
  },

  replaceState: function(hash) {
    if(!window.history || !window.history.replaceState) {
      window.location.hash = hash;
    } else {
      window.history.replaceState(null, '', '#'+hash);
    }
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
        login.internalIdp = false;
        login.verifyOidcAuthentication();
      } else {
        login.hideLoader(true);
        $('#login-oidc-error').show();
      }

      login.replaceState('');
    });

    this.handler.setAuthorizationNotifier(this.notifier);
    this.handler.completeAuthorizationRequestIfPossible();
  },

  checkAuth: function() {
    this.checkOidcAuth();

    var login_helper = function(e) {
      login.destroyBrowser();

      var $login = $('#login').show();
      var $input_username = $login.find('input[name=username]').focus();

      $('#fs-namespace').hide();
      $login.find('input[type=submit]').off('click').on('click', login.initUsernamePasswordAuth);

      if(localStorage.username !== undefined) {
        $input_username.val(localStorage.username);
      }

      $(document).off('keydown.password').on('keydown.password', function(e) {
        if(e.keyCode === 13 && login.credentials !== null) {
          login.initUsernamePasswordAuth();
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
        login.hideLoader();

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
          login.verifyBasicIdentity();
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

    $(window).unbind('popstate').bind('popstate', function(e) {
      login._initHash();
    });

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
        login.hideLoader(true);

        switch(response.status) {
        case 401:
        case 403:
          $('#login-oidc-error').show();
          break;

        case 200:
          login.user = response.responseJSON;
          localStorage.username = login.user.username;

          if(login.user.namespace) {
            localStorage.namespace = login.user.namespace;
          } else {
            localStorage.removeItem('namespace');
          }

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
        login.user = body;
        localStorage.username = login.user.username;

        if(login.user.namespace) {
          localStorage.namespace = login.user.namespace;
        } else {
          localStorage.removeItem('namespace');
        }

        login.updateFsIdentity();
      }
    });
  },

  updateFsIdentity: function() {
    $('#fs-identity').show().find('#fs-identity-username').html(login.user.username);

    return balloon.displayAvatar($('#fs-identity-avatar'));
  },

  getAccessToken: function() {
    return login.token;
  },

  xmlHttpRequest: function(options) {
    if(login.token && !options.disableToken) {
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
      return false;
    }

    AuthorizationServiceConfiguration.fetchFromIssuer(idp.providerUrl).then(configuration => {
      var request = new AuthorizationRequest(
        idp.clientId, idp.redirectUri, idp.scope, 'id_token token', undefined, {'nonce': Math.random().toString(36).slice(2)});

      login.handler.performAuthorizationRequest(configuration, request);
    });

    return true;
  },

  initUsernamePasswordAuth: function() {
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

    if(login.credentials === 'basic') {
      return login.doBasicAuth(username, password);
    }

    return login.doTokenAuth(username, password);
  },

  verifyBasicIdentity: function() {
    var $login = $('#login');
    var $username_input = $login.find('input[name=username]');
    var $password_input = $login.find('input[name=password]');
    window.location.hash = '';

    $.ajax({
      type: 'GET',
      dataType: 'json',
      url: '/api/auth',
      complete: function(response) {
        if(response.responseJSON.error === 'Balloon\\App\\Recaptcha\\Exception\\InvalidRecaptchaToken') {
          login.displayRecaptcha();
          return;
        }

        switch(response.status) {
        case 401:
        case 403:
          $('#fs-namespace').hide();
          $('#login-credentials-error').show();
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

  verifyTokenIdentity: function(response, username, password, mfa) {
    var $login = $('#login');
    var $login_mfa = $('#login-mfa');
    var $username_input = $login.find('input[name=username]');
    var $password_input = $login.find('input[name=password]');
    var $code_input = $login.find('input[name=code]');
    window.location.hash = '';

    switch(response.status) {
      case 400:
      case 401:
      case 403:
        if(response.responseJSON.error === 'Balloon\\App\\Recaptcha\\Exception\\InvalidRecaptchaToken') {
          login.displayRecaptcha();
        } else if(response.responseJSON.error === 'Balloon\\App\\Idp\\Exception\\MultiFactorAuthenticationRequired') {
          $username_input.hide();
          $password_input.hide();
          $login_mfa.show();

          $login.find('input[type=submit]').focus().unbind('click').on('click', function() {
            let code = $code_input.val();
            $code_input.val('');
            login.doMultiFactorTokenAuth(username, password, code);
          });

          $(document).off('keydown.token').on('keydown.token', function(e) {
            if(e.keyCode === 13) {
              let code = $code_input.val();
              $code_input.val('');
              login.doMultiFactorTokenAuth(username, password, code);
            }
          });
        } else if(mfa === true) {
          $('#fs-namespace').hide();
          $('#login-mfa-error').show();
          $code_input.addClass('error');
        } else {
          $('#fs-namespace').hide();
          $('#login-credentials-error').show();
          $username_input.addClass('error');
          $password_input.addClass('error');
        }
        break;

      case 200:
        login.internalIdp = true;
        login.adapter = 'oidc';
        login.token = response.responseJSON.access_token;
        login.fetchIdentity();
        login.initBrowser();
        break;

      default:
        $('#login').show();
        $('#login-server-error').show();
        $('#login-body').hide();
      break;
    }
  },

  doMultiFactorTokenAuth: function(username, password, code) {
    var $spinner = $('#fs-spinner').show();

    $.ajax({
      type: 'POST',
      data: {
        username: username,
        password: password,
        code: code,
        grant_type: 'password_mfa',
      },
      url: '/api/v2/tokens'+login.getRecaptchaString(),
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "Basic " + btoa('balloon-client-web:'));
      },
      complete: function(response) {
        login.verifyTokenIdentity(response, username, password, true)
      }
    }).always(function() {
      $spinner.hide();
    });
  },

  getRecaptchaString: function() {
    var captcha = $('.g-recaptcha-response').val()
    if(captcha) {
      return '?g-recaptcha-response='+captcha;
    }

    return '';
  },

  doTokenAuth: function(username, password) {
    var $spinner = $('#fs-spinner').show();

    $.ajax({
      type: 'POST',
      data: {
        username: username,
        password: password,
        grant_type: 'password',
      },
      url: '/api/v2/tokens'+login.getRecaptchaString(),
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "Basic " + btoa('balloon-client-web:'));
      },
      complete: function(response) {
        login.verifyTokenIdentity(response, username, password, false)
      }
    }).always(function() {
      $spinner.hide();
    });
  },

  displayCaptcha: function() {
    $.getScript('https://www.google.com/recaptcha/api.js', function() {
      $('.g-recaptcha').attr('data-sitekey', login.recaptchaKey);
    });
  },

  doBasicAuth: function(username, password) {
    var $spinner = $('#fs-spinner').show();

    $.ajax({
      type: 'GET',
      username: username,
      password: password,
      dataType: 'json',
      url: '/api/basic-auth'+login.getRecaptchaString(),
      complete: login.verifyBasicIdentity
    }).always(function() {
      $spinner.hide();
    });
  },

  initBrowser: function() {
    var redirectAfterLogin = localStorage.getItem('redirectAfterLogin');

    if(redirectAfterLogin) {
      localStorage.removeItem('redirectAfterLogin');
      login.replaceState(redirectAfterLogin);
    }

    $(window).unbind('popstate');

    $('#login').hide();
    $('#fs-namespace').show();

    balloon.init();
  },

  getAdapter: function() {
    return this.adapter;
  },

  destroyBrowser: function() {
    var $login = $('#login');
    $login.find('input[name=username]').show().removeClass('error');
    $login.find('input[name=password]').show().removeClass('error');
    $login.find('input[name=code]').show().removeClass('error');
    $('#login-mfa').hide();

    $login.show();
    balloon.resetDom();
    $('#fs-namespace').hide();
  },

  hideLoader: function(force) {
    if(force || this.mayHideLoader) {
      $('#login-loader').addClass('ready-for-take-off');

      setTimeout(function(){
        $('#login-loader').remove();
      }, 350);
    }
  }
}

export default login;
