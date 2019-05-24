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
import {WebAuthnApp} from 'webauthn-simple-app';
import {
    solveRegistrationChallenge
} from '@webauthn/client';

var login = {
  accessToken: undefined,
  refreshToken: undefined,
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

  webauthnAuth: function() {
    var userId = localStorage.getItem('userId');
    var $webauth_error = $('#login-error-webauthn').hide();

    if(userId === null) {
      return;
    }

    login.xmlHttpRequest({
      url: '/api/v2/users/'+userId+'/request-challenges?domain='+window.location.hostname,
      type: 'POST',
      error: function(e) {
        $webauth_error.show();
      },
      success: function(resource) {
        let publicKey = resource.key;
        publicKey.challenge = Uint8Array.from(window.atob(publicKey.challenge), c=>c.charCodeAt(0));
        publicKey.allowCredentials = publicKey.allowCredentials.map(function(data) {
            return {
                ...data,
                'id': Uint8Array.from(atob(data.id), c=>c.charCodeAt(0))
            };
        });

        navigator.credentials.get({publicKey}).then(data => {
          let publicKeyCredential = {
            id: data.id,
            type: data.type,
            rawId: login.arrayToBase64String(new Uint8Array(data.rawId)),
            response: {
              authenticatorData: login.arrayToBase64String(new Uint8Array(data.response.authenticatorData)),
              clientDataJSON: login.arrayToBase64String(new Uint8Array(data.response.clientDataJSON)),
              signature: login.arrayToBase64String(new Uint8Array(data.response.signature)),
              userHandle: data.response.userHandle ? login.arrayToBase64String(new Uint8Array(data.response.userHandle)) : null
            }
          };

          login.doTokenAuth({
            grant_type: 'webauthn',
            public_key: publicKeyCredential,
            challenge: resource.id,
            user: userId,
          });
        }).catch(e => {
          $webauth_error.show();
        });
      }
    });
  },

  arrayToBase64String: function(a) {
    return btoa(String.fromCharCode(...a));
  },

  setupWebauthn: function() {
     var $d = $.Deferred();

    login.xmlHttpRequest({
      url: '/api/v2/creation-challenges?domain='+window.location.hostname,
      type: 'POST',
      success: function(resource) {
        let publicKey = resource.key;
        publicKey.challenge = Uint8Array.from(window.atob(publicKey.challenge), c=>c.charCodeAt(0));
        publicKey.user.id = Uint8Array.from(window.atob(publicKey.user.id), c=>c.charCodeAt(0));

        if (publicKey.excludeCredentials) {
          publicKey.excludeCredentials = publicKey.excludeCredentials.map(function(data) {
            return {
              ...data,
              'id': Uint8Array.from(window.atob(data.id), c=>c.charCodeAt(0))
            };
          });
        }

        navigator.credentials.create({publicKey}).then(function(data) {
          let publicKeyCredential = {
              id: data.id,
              type: data.type,
              rawId: login.arrayToBase64String(new Uint8Array(data.rawId)),
              response: {
                  clientDataJSON: login.arrayToBase64String(new Uint8Array(data.response.clientDataJSON)),
                  attestationObject: login.arrayToBase64String(new Uint8Array(data.response.attestationObject))
              }
          };

          login.xmlHttpRequest({
            url: '/api/v2/devices?challenge='+resource.id,
            data: publicKeyCredential,
            type: 'POST',
            success: function(publicKey) {
              localStorage.setItem('webauthn', 'true');
              $d.resolve();
            },
            error: function(e) {
              $d.reject(e);
            }
          });
        }).catch((e) => {
          $d.reject(e);
        });
      },
      error: function(e) {
        $d.reject(e);
      }
    });

    return $d;
  },

  checkOidcAuth: function() {
    this.notifier = new AuthorizationNotifier();
    this.handler = new RedirectRequestHandler();
    this.notifier.setAuthorizationListener(function (request, response, error) {
      var hash = login.parseAuthorizationResponse();
      if (response && hash.access_token) {
        login.accessToken = hash.access_token;
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
      $login.find('input[type=submit]').off('click.login').on('click.login', login.initUsernamePasswordAuth);

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

      if(localStorage.getItem('webauthn') === 'true') {
        $('#login-webauthn').show().off('click').on('click', login.webauthnAuth);
        login.webauthnAuth();
      }
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
          if(login.accessToken) {
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

    if(login.accessToken) {
      options.headers = {
        "Authorization": 'Bearer '+login.accessToken,
      }
    }

    $.ajax(options);
  },

  logout: function() {
    login.internalIdp = true;
    login.refreshToken = null;
    login.accessToken = null;
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
    } else {
      login.checkAuth();
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
          localStorage.userId = login.user.id;

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
        localStorage.userId = login.user.id;

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

    return balloon.displayAvatar($('#fs-identity-avatar'), login.user.id);
  },

  getAccessToken: function() {
    return login.accessToken;
  },

  getRequestHeaders: function(options) {
    if(login.accessToken && !options.disableToken) {
      if(options.headers) {
        options.headers["Authorization"] = 'Bearer '+login.accessToken;
      } else {
        options.headers = {
          "Authorization": 'Bearer '+login.accessToken
        };
      }
    }

    return options;
  },

  xmlHttpRequest: function(options) {
    options = login.getRequestHeaders(options);

    var error = options.error;
    options.error = function(response) {
      if(response.status === 401) {
        if(login.refreshToken) {
          login.renewToken().then(() => {
            options.error = error;
            options = login.getRequestHeaders(options);
            return $.ajax(options);
          }).catch(() => {
            login.logout();
          });
        } else if(login.internalIdp === false && localStorage.lastIdpUrl) {
          login.initOidcAuth(localStorage.lastIdpUrl);
        } else {
          login.logout();
        }
      } else if(error !== undefined) {
        error(response);
      }
    };

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

    localStorage.lastIdpUrl = provider_url;

    AuthorizationServiceConfiguration.fetchFromIssuer(idp.providerUrl).then(configuration => {
      var config = {
        client_id: idp.clientId,
        redirect_uri: idp.redirectUri,
        scope: idp.scope,
        response_type: 'id_token token',
        state: undefined,
        extras: {nonce: Math.random().toString(36).slice(2)}
      }

      var request = new AuthorizationRequest(config);

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

    return login.doTokenAuth({
      username: username,
      password: password,
      grant_type: 'password'
    });
  },

  verifyBasicIdentity: function() {
    var $login = $('#login');
    var $username_input = $login.find('input[name=username]');
    var $password_input = $login.find('input[name=password]');
    window.location.hash = '';
    $('#login-recaptcha').html('');

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

  verifyTokenIdentity: function(response, context, mfa) {
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
          context.grant_type = context.grant_type +'_mfa';

          $login.find('input[type=submit]').focus().unbind('click').on('click', function() {
            context.code = $code_input.val();
            $code_input.val('');
            login.doTokenAuth(context, true);
          });

          $(document).off('keydown.token').on('keydown.token', function(e) {
            if(e.keyCode === 13) {
              context.code = $code_input.val();
              $code_input.val('');
              login.doTokenAuth(context, true);
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
        login.accessToken = response.responseJSON.access_token;
        login.refreshToken = response.responseJSON.refresh_token;
        login.initApp();
        break;

      default:
        $('#login').show();
        $('#login-server-error').show();
        $('#login-body').hide();
      break;
    }
  },

  initApp: function() {
    if(localStorage.getItem('webauthn') === null && "credentials" in navigator) {
      var $login_setup_mfa = $('#login-setup-webauthn').show();
      var $webauthn_error = $('#login-webauthn-setup-error').hide();
      var $login_basic =  $('#login-basic').hide();
      var $login_oidc = $('#login-oidc').hide();
      var $reminder = $login_setup_mfa.find('span[class=checkbox]').off('click').on('click', function() {
        $(this).toggleClass('active');
      });

      $login_setup_mfa.find('input[type=submit]').off('click').on('click', function() {
        if($(this).attr('name') === 'ignore') {
          let reminder = $reminder.hasClass('active');
          if(reminder === true) {
            localStorage.setItem('webauthn', 'false');
          }

          login.fetchIdentity();
          login.initBrowser();
          $login_setup_mfa.hide();
          $login_basic.show();
          $login_oidc.show();
          $webauthn_error.hide();
        } else {
          login.setupWebauthn().then(() => {
            $login_setup_mfa.hide();
            $login_basic.show();
            $login_oidc.show();
            login.fetchIdentity();
            login.initBrowser();
          }).catch(error => {
            $webauthn_error.show();
          });
        }
      });
    } else {
      login.fetchIdentity();
      login.initBrowser();
    }
  },

  renewToken: function() {
    var $d = $.Deferred();
    var $spinner = $('#fs-spinner').show();

    $.ajax({
      type: 'POST',
      data: {
        refresh_token: login.refreshToken,
        grant_type: 'refresh_token',
      },
      url: '/api/v2/tokens',
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "Basic " + btoa('balloon-client-web:'));
      },
      complete: function(response) {
        if(response.responseJSON.access_token) {
          login.accessToken = response.responseJSON.access_token;
          $d.resolve();
        } else {
          login.logout();
          $d.reject();
        }
      }
    }).always(function() {
      $spinner.hide();
    });

    return $d;
  },

  getRecaptchaString: function() {
    var captcha = $('.g-recaptcha-response').val()
    if(captcha) {
      return '?g-recaptcha-response='+captcha;
    }

    return '';
  },

  doTokenAuth: function(data, mfa) {
    var $spinner = $('#fs-spinner').show();

    $.ajax({
      type: 'POST',
      data: data,
      url: '/api/v2/tokens'+login.getRecaptchaString(),
      beforeSend: function (xhr) {
        xhr.setRequestHeader("Authorization", "Basic " + btoa('balloon-client-web:'));
      },
      complete: function(response) {
        login.verifyTokenIdentity(response, data, mfa);
        $('#login-recaptcha').html('');
      }
    }).always(function() {
      $spinner.hide();
    });
  },

  displayRecaptcha: function() {
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

    $(document).off('keydown.password');

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
