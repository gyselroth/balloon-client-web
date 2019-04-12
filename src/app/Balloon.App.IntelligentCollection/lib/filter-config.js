import {fileExtMimeMap} from '../../../lib/mime-file-ext-map.js';

const mimeDropDownOptions = Object.keys(fileExtMimeMap).map(function(ext) {
  return {
    value: ext,
    label: ext
  };
}).sort(function(a, b) {
  if (a.label > b.label) return 1;
  if (a.label < b.label) return -1;
  return 0;
});

function validateInputString(name, values, $filter) {
  var curVal = values[name];
  var valid = curVal !== '' && curVal !== undefined;
  if(valid === false && curVal !== undefined) {
    $filter.find('input[name="'+name+'"]').addClass('error-input');
  } else {
    $filter.find('input[name="'+name+'"]').removeClass('error-input');
  }

  return valid;
}

function validateColor(name, values, $filter) {
  var curVal = values[name];

  return Array.isArray(curVal) && curVal.length > 0;
}

function validateDropdown(name, values, $filter) {
  var curVal = values[name];
  return  curVal !== '' && curVal !== undefined;
}

function validateInputInteger(name, values, $filter) {
  var curVal = values[name];
  var valid = curVal !== '' && curVal !== undefined && parseInt(curVal)+'' === curVal;

  if(valid === false && curVal !== undefined) {
    $filter.find('input[name="'+name+'"]').addClass('error-input');
  } else {
    $filter.find('input[name="'+name+'"]').removeClass('error-input');
  }

  return valid;
}

var config = {
  properties: {
    name: {
      dbField: 'name',
      label: 'app.intelligentCollection.properties.name',
      dataType: 'string',
    },
    tag: {
      dbField: 'meta.tags',
      label: 'app.intelligentCollection.properties.tag',
      dataType: 'string',
      autocomplete: {
        field: 'string_0',
        options: function(app) {
          return {
            dataTextField: '_id',
            dataSource: new kendo.data.DataSource({
              transport: {
                read: function(operation) {
                  app.balloon.xmlHttpRequest({
                    url: app.balloon.base+'/users/node-attribute-summary',
                    data: {
                      attributes: ['meta.tags']
                    },
                    success: function(data) {
                      data['meta.tags'].sort();
                      operation.success(data['meta.tags']);
                    }
                  });
                }
              },
            }),
            sort: {
              dir: 'asc',
              field: '_id'
            }
          }
        }
      }
    },
    color: {
      dbField: 'meta.color',
      label: 'app.intelligentCollection.properties.color',
      dataType: 'color',
    },
    mime: {
      dbField: 'mime',
      label: 'app.intelligentCollection.properties.mime',
      dataType: 'mime',
    },
    changed: {
      dbField: 'changed',
      label: 'app.intelligentCollection.properties.changed',
      dataType: 'date',
    },
    created: {
      dbField: 'created',
      label: 'app.intelligentCollection.properties.created',
      dataType: 'date',
    },
    directory: {
      dbField: 'directory',
      label: 'app.intelligentCollection.properties.directory',
      dataType: 'boolean',
    },
    author: {
      dbField: 'meta.author',
      label: 'app.intelligentCollection.properties.author',
      dataType: 'string',
    },
    copyright: {
      dbField: 'meta.copyright',
      label: 'app.intelligentCollection.properties.copyright',
      dataType: 'string',
    },
    description: {
      dbField: 'meta.description',
      label: 'app.intelligentCollection.properties.description',
      dataType: 'string',
    },
  },
  dataTypes: {
    boolean: {
      defaultOperator: 'true',
      operators: {
        true: {
          label: 'app.intelligentCollection.operators.boolean.true',
          values: [],
          query: function(property, values) {
            var query = {};
            query[property] = true;

            return query;
          }
        },
        false: {
          label: 'app.intelligentCollection.operators.boolean.false',
          values: [],
          query: function(property, values) {
            var query = {};
            query[property] = false;

            return query;
          }
        }
      }
    },
    string: {
      defaultOperator: 'contains',
      operators: {
        contains: {
          label: 'app.intelligentCollection.operators.string.contains',
          values: [
            {
              type: 'string',
            }
          ],
          query: function(property, values) {
            var query = {};
            query[property] = {$regex: values['string_0'], $options: 'i'};

            return query;
          },
          validate: function(values, $filter) {
            return validateInputString('string_0', values, $filter);
          }
        },
        startsWith: {
          label: 'app.intelligentCollection.operators.string.startsWith',
          values: [
            {
              type: 'string',
            }
          ],
          query: function(property, values) {
            var query = {};
            query[property] = {$regex: '^' + values['string_0'], $options: 'i'};

            return query;
          },
          validate: function(values, $filter) {
            return validateInputString('string_0', values, $filter);
          }
        },
        endsWith: {
          label: 'app.intelligentCollection.operators.string.endsWith',
          values: [
            {
              type: 'string',
            }
          ],
          query: function(property, values) {
            var query = {};
            query[property] = {$regex: values['string_0'] + '$', $options: 'i'};

            return query;
          },
          validate: function(values, $filter) {
            return validateInputString('string_0', values, $filter);
          }
        },
        equals: {
          label: 'app.intelligentCollection.operators.string.equals',
          values: [
            {
              type: 'string',
            }
          ],
          query: function(property, values) {
            var query = {};
            query[property] = values['string_0'];

            return query;
          },
          validate: function(values, $filter) {
            return validateInputString('string_0', values, $filter);
          }
        },
        notEquals: {
          label: 'app.intelligentCollection.operators.string.notEquals',
          values: [
            {
              type: 'string',
            }
          ],
          query: function(property, values) {
            var query = {};
            query[property] = {$ne: values['string_0']};

            return query;
          },
          validate: function(values, $filter) {
            return validateInputString('string_0', values, $filter);
          }
        }
      }
    },
    date: {
      defaultOperator: 'exactly',
      operators: {
        /*since: {
          label: 'app.intelligentCollection.operators.date.since',
          values: [
            {
              type: 'integer',
            },
            {
              type: 'dropdown',
              options: [
                {
                  //1 day
                  value: 86400,
                  label: 'app.intelligentCollection.operators.date.sinceVal2.days',
                },
                {
                  //7 days
                  value: 604800,
                  label: 'app.intelligentCollection.operators.date.sinceVal2.weeks',
                },
                {
                  //30 days
                  value: 2592000,
                  label: 'app.intelligentCollection.operators.date.sinceVal2.months',
                },
                {
                  //365 days
                  value: 31536000,
                  label: 'app.intelligentCollection.operators.date.sinceVal2.years',
                }
              ]
            }
          ],
          query: function(property, values) {
            var subtract = parseInt(values['integer_0']) * parseInt(values['dropdown_1']) * 1000;
            var $where = 'function() {'+
              'return this.' + property + ' <= ISODate()'+
              ' && '+
              'this.' + property + ' >= ISODate().getTime() - ' + subtract + ';'+
            '}';

            return {$where: $where};
          },
          validate: function(values, $filter) {
            return validateInputInteger('integer_0', values, $filter) && validateDropdown('dropdown_1', values, $filter);
          }
        },*/
        exactly: {
          label: 'app.intelligentCollection.operators.date.exactly',
          values: [
            {
              type: 'date',
            }
          ],
          query: function(property, values) {
            var query = {};

            var date = values['date_0'];

            var startDate = new Date(date.getTime());
            startDate.setHours(0);
            startDate.setMinutes(0);
            startDate.setSeconds(0);
            startDate.setMilliseconds(0);

            var endDate = new Date(date.getTime());
            endDate.setHours(23);
            endDate.setMinutes(59);
            endDate.setSeconds(59);
            endDate.setMilliseconds(999);

            query[property] = {$gte: {$date: startDate.getTime()}, $lte: {$date: endDate.getTime()}};

            return query;
          }
        },
        before: {
          label: 'app.intelligentCollection.operators.date.before',
          values: [
            {
              type: 'date',
            }
          ],
          query: function(property, values) {
            var query = {};

            var date = values['date_0'];

            date.setHours(0);
            date.setMinutes(0);
            date.setSeconds(0);
            date.setMilliseconds(0);


            query[property] = {$lte: {$date: date.getTime()}};

            return query;
          }
        },
        after: {
          label: 'app.intelligentCollection.operators.date.after',
          values: [
            {
              type: 'date',
            }
          ],
          query: function(property, values) {
            var query = {};

            var date = values['date_0'];

            date.setHours(23);
            date.setMinutes(59);
            date.setSeconds(59);
            date.setMilliseconds(999);

            query[property] = {$gte: {$date: date.getTime()}};

            return query;
          }
        }
      }
    },
    color: {
      defaultOperator: 'has',
      operators: {
        has: {
          label: 'app.intelligentCollection.operators.color.has',
          values: [
            {
              type: 'color',
            }
          ],
          query: function(property, values) {
            var query = {};
            var colors = values['color_0'];

            if(colors.length > 1) {
              var constraints = [];
              query[property] = {$in: colors};
            } else {
              query[property] = colors[0];
            }

            return query;
          },
          validate: function(values, $filter) {
            return validateColor('color_0', values, $filter);
          }
        },
        hasNot: {
          label: 'app.intelligentCollection.operators.color.hasNot',
          values: [
            {
              type: 'color',
            }
          ],
          query: function(property, values) {
            var query = {};
            var colors = values['color_0'];

            if(colors.length > 1) {
              var constraints = [];
              query[property] = {$nin: colors};
            } else {
              query[property] = {$ne: colors[0]};
            }

            return query;
          },
          validate: function(values, $filter) {
            return validateColor('color_0', values, $filter);
          }
        }
      }
    },
    mime: {
      defaultOperator: 'has',
      operators: {
        has: {
          label: 'app.intelligentCollection.operators.mime.has',
          values: [
            {
              type: 'dropdown',
              options: mimeDropDownOptions
            }
          ],
          query: function(property, values) {
            var query = {};
            var mimes = fileExtMimeMap[values['dropdown_0']];

            if(mimes.length > 1) {
              query[property] = {$in: mimes};
            } else {
              query[property] = mimes[0];
            }

            return query;
          },
          validate: function(values, $filter) {
            return validateDropdown('dropdown_0', values, $filter);
          }
        },
        hasNot: {
          label: 'app.intelligentCollection.operators.mime.hasNot',
          values: [
            {
              type: 'dropdown',
              options: mimeDropDownOptions
            }
          ],
          query: function(property, values) {
            var query = {};
            var mimes = fileExtMimeMap[values['dropdown_0']];

            if(mimes.length > 1) {
              query[property] = {$nin: mimes};
            } else {
              query[property] = {$ne: mimes[0]};
            }

            return query;
          },
          validate: function(values, $filter) {
            return validateDropdown('dropdown_0', values, $filter);
          }
        }
      }
    }
  }
}

export default config;
