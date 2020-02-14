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
const {BaseTokenRequestHandler} = require('@openid/appauth/built/token_request_handler.js');
const {AuthorizationNotifier} = require('@openid/appauth/built/authorization_request_handler.js');
const {RedirectRequestHandler} = require('@openid/appauth/built/redirect_based_handler.js');
const {TokenRequest} = require('@openid/appauth/built/token_request.js');
const {BasicQueryStringUtils} = require('@openid/appauth/built/query_string_utils.js');

class NoHashQueryStringUtils extends BasicQueryStringUtils {
  parse(input, useHash) {
    return super.parse(input, false);
  }
}

var login = {
  accessToken: undefined,
  refreshToken: undefined,
  user: null,
  authorizationHandler: null,
  configuration: {},
  mayHideLoader: true,
  openIdConnectUrl: location.protocol + '//' + location.host,
  RedirectUrl: location.protocol + '//' + location.host,

  init: async function() {
    login.authorizationHandler = new RedirectRequestHandler(undefined, new NoHashQueryStringUtils(), undefined);
    login.configuration = await AuthorizationServiceConfiguration.fetchFromIssuer(login.openIdConnectUrl);
    return this.checkAuth();
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
    return new Promise(function(resolve, reject) {

    console.log("CHECK OIDC AUTH 1");
    var notifier = new AuthorizationNotifier();
    notifier.setAuthorizationListener(function (request, response, error) {
      this.tokenHandler = new BaseTokenRequestHandler();
      let tokenRequest;
      let extras = undefined;
      console.log("Re");

      if(error) {
        console.log("Re",error);
        return reject(error);
      }

      if (request && request.internal) {
        extras = {};
        extras['code_verifier'] = request.internal['code_verifier'];
      }
      console.log("CHECK OIDC AUTH 2");

      // use the code to make the token request.
      tokenRequest = new TokenRequest({
        client_id: "balloon-client-web",
        redirect_uri: login.RedirectUrl,
        grant_type: "authorization_code",
        code: response.code,
        extras: extras
      });

      this.tokenHandler.performTokenRequest(login.configuration, tokenRequest).then(response => {
        login.accessToken = response.accessToken;
        login.refreshToken = response.refreshToken;
        console.log("CHECK OIDC AUTH 3");

        login.verifyOidcAuthentication().then(() => {
          resolve();
        }).catch(() => {
          reject();
        })
      }).catch(err => {
        console.log("CHECK OIDC AUTH 4");
        reject(err);
      });
    });

    login.authorizationHandler.setAuthorizationNotifier(notifier);
    console.log("CHECK OIDC AUTH 5");
    login.authorizationHandler.completeAuthorizationRequestIfPossible().then(() => {
      console.log("test 1");
    }).catch(() => {
      console.log("test 2");
    })

    /*.then((e) => {
      console.log("then",e);
    }).catch((e) => {
      console.log("catch",e);

    });
    console.log("CHECK OIDC AUTH 6");*/
    });
  },

  getParameterByName: function(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
  },

  checkAuth: function() {
    var codeRequest = this.getParameterByName('code') !== null;
    var p = this.checkOidcAuth();
    var err = this.getParameterByName('error');

    if(err !== null) {
      return Promise.reject(err);
    }

    if(codeRequest === true) {
      return p;
    }

    // create a request
    let request = new AuthorizationRequest({
        client_id: "balloon-client-web",
        redirect_uri: login.RedirectUrl,
        scope: "openid offline",
        response_type: AuthorizationRequest.RESPONSE_TYPE_CODE,
        state: undefined,
        extras: {'prompt': 'consent', 'access_type': 'offline'}
    });

    // make the authorization request
    login.authorizationHandler.performAuthorizationRequest(login.configuration, request);
    return p;
  },

  logout: function() {
    login.refreshToken = null;
    login.accessToken = null;
    login.destroyBrowser();

    //revoke refresh_token

    /*$(window).unbind('popstate').bind('popstate', function(e) {
      login._initHash();
    });*/

    login.checkAuth();
  },

  verifyOidcAuthentication: function() {
    return new Promise(function(resolve, reject) {
      login.xmlHttpRequest({
        url: '/api/v3/users/whoami',
        cache: false,
        complete: function(response) {
          login.hideLoader(true);

          if(response.status == 200) {
            login.user = response.responseJSON;
            localStorage.username = login.user.username;
            localStorage.userId = login.user.id;

            if(login.user.namespace) {
              localStorage.namespace = login.user.namespace;
            } else {
              localStorage.removeItem('namespace');
            }

            return resolve();
          }

          return reject();
        }
      });
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

          //redirect oidc

        } else {
          login.logout();
        }
      } else if(error !== undefined) {
        error(response);
      }
    };

    return $.ajax(options);
  },

  initApp: function() {
    if(
      localStorage.getItem('webauthn') === null && "credentials" in navigator
      &&
      ('ontouchstart' in window || window.DocumentTouch && document instanceof DocumentTouch)
    ) {
      var $login_setup_webauthn = $('#login-setup-webauthn').show();
      var $webauthn_error = $('#login-webauthn-setup-error').hide();

      $login_setup_webauthn.find('input[type=submit]').off('click').on('click', function() {
        if($(this).attr('name') === 'ignore') {
          if($login_setup_webauthn.find('input[name="webauthn-reminder"]').is(':checked')) {
            localStorage.setItem('webauthn', 'false');
          }

          login.initBrowser();
          $login_setup_webauthn.hide();
          $webauthn_error.hide();
        } else {
          login.setupWebauthn().then(() => {
            $login_setup_webauthn.hide();
            login.initBrowser();
          }).catch(error => {
            $webauthn_error.show();
          });
        }
      });
    } else {
      login.initBrowser();
    }
  },

  renewToken: function() {
    var $spinner = $('#fs-spinner').show();

    tokenRequest = new TokenRequest({
      client_id: "balloon-client-web",
      grant_type: "refresh_token",
      refresh_token: login.refreshToken,
    });

    return this.tokenHandler.performTokenRequest(login.configuration, tokenRequest).then(response => {
      if(response.access_token) {
        login.accessToken = response.access_token
        ;
      } else {
        login.logout();
      }
    }).catch(err => {
      login.logout();
    }).finally(()=> {
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

  destroyBrowser: function() {
    $('#login').show();
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
