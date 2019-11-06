/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2018 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import i18next from 'i18next';
import css from '../styles/style.scss';

var app = {
  id: 'Balloon.App.Elasticsearch',

  balloon: null,

  render: function() {
  },

  preInit: function(core) {
    this.balloon = core;

    core.search_modes['fulltext'] = {
      label: 'app.elasticsearch.fulltext',
      buildQuery: app.buildQuery,
      executeQuery: app.executeQuery
    };
  },

  /**
   * execute a query
   *
   * @param   object query
   * @return  boolean
   */
  executeQuery: function(query) {
    return app.balloon.refreshTree('/files/search', {query: query});
  },

  /**
   * build query
   *
   * @param   string value
   * @param   object filters
   * @return  object
   */
  buildQuery: function(value, filters) {
    var should = [];
    var must = app._buildFilterQuery(filters);

    var query = {
      body: {
        from: 0,
        size: 500,
        query: {bool: {}}
      }
    };

    if(value) {
      should.push({
        match: {
          name: {
            query: value,
            minimum_should_match: "90%"
          }
        }
      });

      should.push({
        match: {
          'attachment.content': {
            query: value,
            minimum_should_match: "90%"
          }
        }
      });
    }

    if(must.length === 0 && should.length === 0) {
      return undefined;
    } else if(must.length === 0) {
      query.body.query.bool.should = should;
    } else if(should.length === 0) {
      query.body.query.bool.must = must;
    } else {
      query.body.query.bool.should = should;
      query.body.query.bool.minimum_should_match = 1;
      query.body.query.bool.must = must;
    }

    return query;
  },

  /**
   * build filters query
   *
   * @param   object filters
   * @return  array
   */
  _buildFilterQuery(filters) {
    var must = [], i;

    if(filters && filters.tags && filters.tags.length > 0) {
      var should = [];

      for(i=0; i<filters.tags.length; i++) {
        should.push({
          term: {
            'meta.tags': filters.tags[i]
          }
        });
      }

      must.push({bool: {should: should}});
    }

    if(filters && filters.color && filters.color.length > 0) {
      var should = [];

      for(i=0; i<filters.color.length; i++) {
        should.push({
          match: {
            'meta.tags': filters.color[i]
          }
        });
      }

      must.push({bool: {should: should}});
    }

    if(filters && filters.mime && filters.mime.length > 0) {
      var should = [];

      for(i=0; i<filters.mime.length; i++) {
        should.push({
          'query_string': {
            'query': '(mime:"'+filters.mime[i]+'")'
          }
        });
      }

      must.push({bool: {should: should}});
    }

    return must;
  },
}

export default app;
