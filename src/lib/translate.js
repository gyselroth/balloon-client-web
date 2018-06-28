/**
 * balloon
 *
 * @copyright Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license   GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */
import $ from "jquery";
import i18next from 'i18next';
import i18nextXHRBackend from 'i18next-xhr-backend';
import i18nextBrowserLanguageDetector from 'i18next-browser-languagedetector';
import i18nextLocalStorageCache from 'i18next-localstorage-cache';
import i18nextSprintfPostProcessor from 'i18next-sprintf-postprocessor';
import jqueryI18next from 'jquery-i18next';
import login from './auth.js'
import app from './app.js'

var translate = {
  config: {},
  load: function(url, options, callback, data) {
    $.ajax({
      url: '/locale/'+url+'.json',
      success: function(body, responseText, response) {
        callback(response.responseText, {status: '200'});
      },
      error: function() {
        callback(null, {status: '404'});
      }
    });
  },

  loadCulture: function(locale) {
    try {
      require('bundle-loader!kendo-ui-core/js/cultures/kendo.culture.'+locale+'.js')((data) => {
        kendo.culture(locale);
      });
    } catch (e) {
      //fallback to en-US
    }
  },

  init: function(config) {
    this.config = config;
    var locale_version = process.env.VERSION+'-'+process.env.COMMITHASH;

    var locales = [
      ['en',  'English'],
      ['en-US', 'English (USA)'],
      ['en-AU', 'English (Australia'],
      ['en-GB', 'English (UK)'],
      ['de',  'Deutsch'],
      ['de-CH', 'Deutsch (Schweiz)'],
      ['de-DE', 'Deutsch (Deutschland)'],
      ['de-AT', 'Deutsch (Österreich)']
    ];

    if(localStorage.i18next_version !== locale_version) {
      var key;
      for(var i = 0; i < localStorage.length; i++){
        key = localStorage.key(i);
        if(key.substr(0, 12) === 'i18next_res_') {
          localStorage.removeItem(key);
        }
      }
      localStorage.i18next_version = locale_version;
    }

    i18next
      .use(i18nextXHRBackend)
      .use(i18nextBrowserLanguageDetector)
      .use(i18nextLocalStorageCache)
      .use(i18nextSprintfPostProcessor)
      .init({
        postProcess: "sprintf",
        overloadTranslationOptionHandler: i18nextSprintfPostProcessor.overloadTranslationOptionHandler,
        compatibilityJSON: 'v2',
        debug: false,
        cache: {
          enabled: true,
          prefix: 'i18next_res_',
          expirationTime: 60*60*120
        },
        fallbackLng: translate.config.default_lang,
        backend: {
          ajax: translate.load,
          loadPath: function(lng,ns){
            if(typeof lng === 'object') {
              lng = lng[0];
              var pos = lng.indexOf('-');
              if(pos !== -1) {
                lng = lng.substr(0, pos);
              }
            }

            return lng
          }
        },
      }, function() {
        jqueryI18next.init(i18next, $, {
          tName: 't',
          i18nName: 'i18n',
          handleName: 'localize',
          selectorAttr: 'data-i18n',
          targetAttr: 'i18n-target',
          optionsAttr: 'i18n-options',
          useOptionsAttr: false,
          parseDefaultValueFromContent: true
        });

        $('[data-i18n]').localize();

        app.render();
        login.init(translate.config);

        var current = localStorage.i18nextLng;
        translate.loadCulture(current);
        var $locales = $('#login-locale');

        for(let lang in locales) {
          $locales.append('<option value="'+locales[lang][0]+'">'+locales[lang][1]+'</option>')
        }

        $locales.find('option[value='+current+']').attr('selected','selected');
        $locales.change(function(){
          translate.loadCulture($(this).val());
          i18next.changeLanguage($(this).val(), function(){
            $('[data-i18n]').localize();
          });
        });
      });
  }
};

export default translate;
