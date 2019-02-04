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
  return  curVal !== '' && curVal !== undefined;
}

function validateDropdown(name, values, $filter) {
  var curVal = values[name];
  return  curVal !== '' && curVal !== undefined;
}

var config = {
  properties: {
    name: {
      dbField: 'name',
      label: 'app.intelligentCollection.properties.name',
      dataType: 'string',
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
    /*
    //TODO pixtron - find a way to query date fields
    changed: {
      dbField: 'changed',
      label: 'app.intelligentCollection.properties.changed',
      dataType: 'date',
    }*/
  },
  dataTypes: {
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
            query[property] = {$regex: values['string_0']};

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
            query[property] = {$regex: '^' + values['string_0']};

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
            query[property] = {$regex: values['string_0'] + '$'};

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
      defaultOperator: 'since',
      operators: {
        since: {
          label: 'app.intelligentCollection.operators.date.since',
          values: [
            {
              type: 'integer',
            },
            {
              type: 'dropdown',
              options: [
                {
                  value: 'days',
                  label: 'app.intelligentCollection.operators.date.sinceVal2.days',
                },
                {
                  value: 'weeks',
                  label: 'app.intelligentCollection.operators.date.sinceVal2.weeks',
                },
                {
                  value: 'months',
                  label: 'app.intelligentCollection.operators.date.sinceVal2.months',
                },
                {
                  value: 'years',
                  label: 'app.intelligentCollection.operators.date.sinceVal2.years',
                }
              ]
            }
          ]
        },
        exactly: {
          label: 'app.intelligentCollection.operators.date.exactly',
          values: [
            {
              type: 'date',
            }
          ]
        },
        before: {
          label: 'app.intelligentCollection.operators.date.before',
          values: [
            {
              type: 'date',
            }
          ]
        },
        after: {
          label: 'app.intelligentCollection.operators.date.after',
          values: [
            {
              type: 'date',
            }
          ]
        },
        today: {
          label: 'app.intelligentCollection.operators.date.today',
          values: []
        },
        yesterday: {
          label: 'app.intelligentCollection.operators.date.yesterday',
          values: []
        },
        thisweek: {
          label: 'app.intelligentCollection.operators.date.thisweek',
          values: []
        },
        thismonth: {
          label: 'app.intelligentCollection.operators.date.thismonth',
          values: []
        },
        thisyear: {
          label: 'app.intelligentCollection.operators.date.thisyear',
          values: []
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
            query[property] = values['color_0'];

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
            query[property] = {$ne: values['color_0']};

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
