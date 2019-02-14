/**
 * balloon
 *
 * @copyright   Copryright (c) 2012-2019 gyselroth GmbH (https://gyselroth.com)
 * @license     GPL-3.0 https://opensource.org/licenses/GPL-3.0
 */

import $ from "jquery";
import i18next from 'i18next';
import css from '../styles/style.scss';
import iconsSvg from '@gyselroth/icon-collection/src/icons.svg';

import filterConfig from './filter-config.js';

var app = {
  id: 'Balloon.App.IntelligentCollection',

  $win: null,

  filterId: 0,

  filters: [],

  mayCreate: false,

  fieldsValid: {
    name: false,
    filters: false
  },

  preInit: function(core) {
    this.balloon = core;

    this.balloon.addNew('intelligentCollection', 'app.intelligentCollection.intelligentCollection', 'folder-filter', this.addIntelligentCollection.bind(this));

    this.balloon.toggle_fs_browser_action_hooks['app.intelligentCollection'] = this._fsBroserActionHook;

    app.balloon.addMenu('intelligentCollection', 'app.intelligentCollection.intelligentCollection', 'folder-filter', function() {
      return app.balloon.refreshTree('/nodes', {query: {filter: {$type: 2}}}, {});
    });
  },

  postInit: function(core)  {
    this.balloon = core;
  },

  /**
   * Displays modal for adding a new intelligent collection
   *
   * @return void
   */
  addIntelligentCollection: function() {
    var $d = $.Deferred();

    //initializte first filter
    this.filterId = 0;
    this.filters = [{
      id: 'filter-'+0,
      property: 'name',
      operator: 'contains',
      values: {}
    }];

    if(this.$win === null) {
      this.$win = $('<div id="fs-intelligent-collection-window"></div>');
      $('body').append(this.$win);
    }

    var $win = this.$win;

    $win.html(
      '<p class="hint">'+i18next.t('app.intelligentCollection.addNewWin.hint')+'</p>'+
      '<div class="error-message"></div>'+
      '<div class="fs-window-form">'+
        '<label>'+i18next.t('new_node.name')+'</label><input name="name" type="text"/>'+
      '</div>'+
      '<hr class="full-width" />'+
      '<div id="fs-intelligent-collection-window-comparsion">'+
        '<select name="comparsion">'+
          '<option value="and" selected="selected">' + i18next.t('app.intelligentCollection.addNewWin.comparsion.and') + '</option>'+
          '<option value="or">' + i18next.t('app.intelligentCollection.addNewWin.comparsion.or') + '</option>'+
        '</select>'+
        '<svg class="gr-icon gr-i-expand"><use xlink:href="'+iconsSvg+'#expand"></use></svg>'+
      '</div>'+
      '<div id="fs-intelligent-collection-window-filters"></div>'+
      '<hr class="full-width" />'+
      '<div class="fs-window-secondary-actions">'+
        '<input name="cancel" value='+i18next.t('button.cancel')+' type="submit" tabindex="2"/>'+
        '<input class="fs-button-primary" name="add" value='+i18next.t('button.save')+' type="submit" tabindex="1" disabled="disabled"/>'+
      '</div>');

    this.$filters = $win.find('#fs-intelligent-collection-window-filters');

    var i;
    for(i in this.filters) {
      this.$filters.append(this._renderFilter(this.filters[i]));
    }

    var $k_window = $win.kendoBalloonWindow({
      resizable: false,
      title: i18next.t('app.intelligentCollection.addNewWin.title'),
      modal: true,
      activate: function(){
        $win.find('input[name=name]').focus();
      },
      open: function(e) {
        app.mayCreate = false;
        app.fieldsValid = {
          name: false,
          filters: false
        };

        var $input_name = $win.find('input[name=name]');
        var $submit = $win.find('input[name=add]');

        $win.find('input').removeClass('error-input');

        $input_name.off('keyup').on('keyup', function(e) {
          let name = $input_name.val();

          if(e.keyCode === 13) {
            if(app.mayCreate) $submit.click();
            return;
          }

          if(app.balloon.nodeExists(name) || name === '') {
            $input_name.addClass('error-input');
            app.fieldsValid.name = false;
          } else {
            $input_name.removeClass('error-input');
            app.fieldsValid.name = true;
          }

          app._validate();
        });

        $($win).find('input[type=submit]').off('click').on('click', function() {
          if($(this).attr('name') === 'cancel') {
            $d.reject();
            return $k_window.close();
          }

          app._addIntelligentCollection($input_name.val())
            .then(function(data) {
              $k_window.close();
              $d.resolve(data);
            });
        })
      }
    }).data('kendoBalloonWindow').center().open();

    return $d;
  },

  /**
   * Validates the whole form
   *
   * @return void
   */
  _validate: function() {
    var $submit = this.$win.find('input[name=add]');

    this.mayCreate = Object.keys(this.fieldsValid).every(function(key) {
      return app.fieldsValid[key] === true;
    });

    $submit.prop('disabled', !this.mayCreate);
  },

  /**
   * Validates all filters
   *
   * @return void
   */
  _validateFilters: function() {
    this.fieldsValid.filters = this.filters.every(function(filter) {
      var property = filterConfig.properties[filter.property];
      var operator = filterConfig.dataTypes[property.dataType].operators[filter.operator];

      if(operator.validate) return operator.validate(filter.values, filter.$filter);

      return true;
    });

    this._validate();
  },

  /**
   * Add new intelligent collection with given name and filters to the server
   *
   * @param string name
   * @return void
   */
  _addIntelligentCollection: function(name) {
    var $d = $.Deferred();

    var filter = this._createFiltersQuery();
    var data = {
      name: name,
      id: this.balloon.getCurrentCollectionId(),
      attributes: {
        filter: filter
      }
    };

    this.balloon.xmlHttpRequest({
      url: this.balloon.base+'/collections',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify(data),
      success: function(data) {
        $d.resolve(data);
      }.bind(this),
      error: function(error) {
        app.balloon.displayError(error);
        $d.reject();
      }
    });

    return $d;
  },

  /**
   * Add a single filter to the dom
   *
   * @param object filter
   * @return void
   */
  _addFilter: function(filter) {
    this.filterId++;

    filter.filterId = 'filter-'+this.filterId;

    this.filters.push(filter);

    this.$filters.append(this._renderFilter(filter));
  },

  /**
   * Creates search query for all filters in this.filters
   *
   * @return object mongo query
   */
  _createFiltersQuery: function() {
    var filter;

    if(this.filters.length > 1) {
      var $constraints = [];
      var comparsion = $('#fs-intelligent-collection-window-comparsion select').val();

      var i;
      for(i in this.filters) {
        var constraint = this._createFilterQuery(this.filters[i]);
        $constraints.push(constraint)
      }

      filter = {};
      filter['$'+comparsion] = $constraints;
    } else {
      filter = this._createFilterQuery(this.filters[0]);
    }

    return filter;
  },

  /**
   * Creates search query for a given filter
   *
   * @param object filter
   * @return object mongo constraint
   */
  _createFilterQuery: function(filter) {
    var property = filterConfig.properties[filter.property];
    var operator = filterConfig.dataTypes[property.dataType].operators[filter.operator];

    return operator.query(property.dbField, filter.values);
  },

  /**
   * Creates dom for a given filter
   *
   * @param object filter
   * @return object jquery dom representation
   */
  _renderFilter: function(filter) {
    var $filter = $(
      '<div class="fs-intelligent-collection-filter-outer">'+
        '<hr class="full-width" />'+
        '<div class="fs-intelligent-collection-filter">'+
          '<div class="fs-intelligent-collection-filter-property"></div>'+
          '<div class="fs-intelligent-collection-filter-operator"></div>'+
          '<div class="fs-intelligent-collection-filter-values"></div>'+
          '<div class="fs-intelligent-collection-filter-controll fs-intelligent-collection-filter-add">'+
            '<svg class="gr-icon gr-i-plus"><use xlink:href="'+iconsSvg+'#plus"></use></svg>'+
          '</div>'+
          '<div class="fs-intelligent-collection-filter-controll fs-intelligent-collection-filter-remove fs-action-disabled">'+
            '<svg class="gr-icon gr-i-minus"><use xlink:href="'+iconsSvg+'#minus"></use></svg>'+
          '</div>'+
        '</div>'+
      '</div>'
    );

    filter.$filter = $filter;

    this._renderProperty(filter);
    this._renderOperator(filter);
    this._renderValues(filter);
    this._renderAddButton(filter);
    this._renderRemoveButton(filter);

    return $filter;
  },

  /**
   * renders property dom for a given filter
   *
   * @param object filter
   * @return void
   */
  _renderProperty: function(filter) {
    var $dropdown = $('<select></select>');
    var propertyId;

    for(propertyId in filterConfig.properties) {
      var property = filterConfig.properties[propertyId];
      var $option = $(
        '<option value="'+propertyId+'">'+
          i18next.t(property.label)+
        '</option>'
      );

      if(filter.property === propertyId) {
        $option.prop('selected', true);
      }

      $dropdown.append($option);
    }

    var $property = $(
      '<div class="fs-intelligent-collection-filter-property">'+
        '<svg class="gr-icon gr-i-expand"><use xlink:href="'+iconsSvg+'#expand"></use></svg>'+
      '</div>'
    );

    $property.prepend($dropdown);

    filter.$filter.find('.fs-intelligent-collection-filter-property').replaceWith($property);

    $dropdown.off('change').on('change', function(event) {
      event.preventDefault();

      app._onPropertyChanged(filter, $(this).val());
    });
  },

  /**
   * renders operator dom for a given filter
   *
   * @param object filter
   * @return void
   */
  _renderOperator: function(filter) {
    var $dropdown = $('<select></select>');

    var property = filterConfig.properties[filter.property];
    var operators = filterConfig.dataTypes[property.dataType].operators;

    var operatorId;
    for(operatorId in operators) {
      var operator = operators[operatorId];

      var $option = $(
        '<option value="'+operatorId+'">'+
          i18next.t(operator.label)+
        '</option>'
      );

      if(filter.operator === operatorId) {
        $option.prop('selected', true);
      }

      $dropdown.append($option);
    }

    var $operator = $(
      '<div class="fs-intelligent-collection-filter-operator">'+
        '<svg class="gr-icon gr-i-expand"><use xlink:href="'+iconsSvg+'#expand"></use></svg>'+
      '</div>'
    );

    $operator.prepend($dropdown);

    filter.$filter.find('.fs-intelligent-collection-filter-operator').replaceWith($operator);

    $dropdown.off('change').on('change', function(event) {
      event.preventDefault();

      app._onOperatorChanged(filter, $(this).val());
    });
  },

  /**
   * renders value(s?) dom for a given filter
   *
   * @param object filter
   * @return void
   */
  _renderValues: function(filter) {
    var property = filterConfig.properties[filter.property];
    var dataType = property.dataType;
    var values = filterConfig.dataTypes[dataType].operators[filter.operator].values;
    var datePickers = [];

    var $values = $('<div class="fs-intelligent-collection-filter-values"></div>');

    var i;
    for(i in values) {
      var value = values[i];
      var name = value.type+'_'+i;

      switch(value.type) {
      case 'string':
        var curVal = filter.values[name] || '';
        var $field = $('<input type="text" name="' + name + '" value="' + curVal + '" />');

        $field.off('keyup').on('keyup', function(event) {
          event.preventDefault();
          var $this = $(this);
          app._onValueChanged(filter, $this.attr('name'), $this.val());
        });

        break;
      case 'integer':
        var curVal = filter.values[name] || '1';
        filter.values[name] = curVal;
        var $field = $('<input type="text" class="number" name="' + name + '" value="' + curVal + '" />');

        $field.off('keyup').on('keyup', function(event) {
          event.preventDefault();
          var $this = $(this);
          app._onValueChanged(filter, $this.attr('name'), $this.val());
        });

        break;
      case 'color':
        var curVal = filter.values[name] || [];
        var fieldName = filter.filterId + '-' + name;
        var colors = ['magenta', 'purple', 'blue', 'green', 'yellow'];

        var $field = $('<div class="fs-intelligent-collection-filter-value-colors"></div>');

        var i;
        for(i in colors) {
          var color = colors[i];
          var id = filter.filterId + '-' + name + '-' + color;

          var $label = $('<label for="' + id + '" class="fs-intelligent-collection-filter-value-color-' + color + '" title="' + color + '">&nbsp;</label>');
          var $input = $('<input type="checkbox" name="' + fieldName + '" id="' + id + '" value="' + color + '" />');

          if(curVal.indexOf(color) !== -1) {
            $input.prop('checked', true);
          }

          $field.append($input);
          $field.append($label);
        }

        $field.find('input[type="checkbox"]').off('change').on('change', function(event) {
          event.preventDefault();

          var checked = [];
          $field.find('input[type="checkbox"]:checked').each(function(index, elem) {
            checked.push($(elem).val());
          });

          app._onValueChanged(filter, name, checked);
        });

        break;
      case 'dropdown':
        var curVal = filter.values[name] || value.options[0].value;
        filter.values[name] = curVal;
        var $select = $('<select name="' + name + '"></select>');

        var i;
        for(i in value.options) {
          var option = value.options[i];

          var $option = $(
            '<option value="'+option.value+'">'+
              i18next.t(option.label)+
            '</option>'
          );

          if(curVal === option.value) {
            $option.prop('selected', true);
          }

          $select.append($option);
        }

        $select.off('change').on('change', function(event) {
          event.preventDefault();

          var $this = $(this);
          app._onValueChanged(filter, $this.attr('name'), $this.val());
        });

        $field = $('<div class="fs-intelligent-collection-filter-value-dropdown"></div>');
        $field.append($select);
        $field.append('<svg class="gr-icon gr-i-expand"><use xlink:href="'+iconsSvg+'#expand"></use></svg>');
        break;
      case 'date':
        var curVal = filter.values[name] ? filter.values[name] : new Date();
        filter.values[name] = curVal;
        var $field = $('<input type="date" name="' + name + '" value="" />');

        $field.off('keyup').on('keyup', function(event) {
          event.preventDefault();
          var $this = $(this);
          app._onValueChanged(filter, $this.attr('name'), $this.val());
        });

        datePickers.push({
          name: name,
          value: curVal,
          change: function() {
            var $this = $(this.element);
            app._onValueChanged(filter, $this.attr('name'), this.value());
          }
        });

        break;
      }

      $values.append($('<div class="fs-intelligent-collection-filter-value ' + 'fs-intelligent-collection-filter-value-' + value.type  + '"></div>').append($field));
    }

    filter.$filter.find('.fs-intelligent-collection-filter-values').replaceWith($values);

    //adding kendo ui widgets here as they can only successfully be added after elements have been added to the dom
    if(property.autocomplete) {
      var autocomplete = property.autocomplete;
      this._addAutocompleteToValue(filter, filter.$filter.find('input[name="' + autocomplete.field + '"]'), autocomplete.options(app));
    }

    if(datePickers.length > 0) {
      var i;
      for(i in datePickers) {
        filter.$filter.find('input[name="' + datePickers[i].name + '"]').kendoBalloonDatePicker({
          format: kendo.culture().calendar.patterns.d,
          value: datePickers[i].value,
          change: datePickers[i].change,
        });
      }
    }
  },

  /**
   * adds autocomplete to a given input field
   *
   * @param object filter
   * @param $input object input field to add autocomplete to
   * @param object options autocomplete options
   * @return void
   */
  _addAutocompleteToValue: function(filter, $input, options) {
    var autocompleteOptions = {
      select: function(e) {
        app._onValueChanged(filter, $input.attr('name'), e.item.text());
      },
      minLength: 0,
      highlightFirst: true,
      noDataTemplate: i18next.t('app.intelligentCollection.error.autocomplete.no_data'),
      change: function(e) {
        this.dataSource.read();
      }
    };

    if(options) {
      autocompleteOptions = $.extend(true, autocompleteOptions, options);
    }

    $input.kendoAutoComplete(autocompleteOptions);
  },

  /**
   * renders add button dom for a given filter
   *
   * @param object filter
   * @return void
   */
  _renderAddButton: function(filter) {
    var $button = filter.$filter.find('.fs-intelligent-collection-filter-add');

    $button.off('click').on('click', function(event) {
      event.preventDefault();

      var newFilter = {
        property: 'name',
        operator: 'contains',
        values: {}
      };

      app._addFilter(newFilter);

      if(app.filters.length > 1) {
        app.$filters.find('.fs-intelligent-collection-filter-remove')
          .removeClass('fs-action-disabled');
      }

      app._validateFilters();
    });
  },

  /**
   * renders remove button dom for a given filter
   *
   * @param object filter
   * @return void
   */
  _renderRemoveButton: function(filter) {
    var $button = filter.$filter.find('.fs-intelligent-collection-filter-remove');

    $button.off('click').on('click', function(event) {
      event.preventDefault();

      if($(this).hasClass('fs-action-disabled')) return;


      var index = app.filters.findIndex(function(item) {
        return item.filterId === filter.filterId;
      });

      app.filters.splice(index, 1);
      filter.$filter.remove();

      if(app.filters.length <= 1) {
        app.$filters.find('.fs-intelligent-collection-filter-remove')
          .addClass('fs-action-disabled');
      }

      app._validateFilters();
    });
  },

  /**
   * Event handler when the property of a filter changes
   *
   * @param object filter
   * @param string newProperty
   * @return void
   */
  _onPropertyChanged: function(filter, newProperty) {
    var property = filterConfig.properties[newProperty];
    var operator = filterConfig.dataTypes[property.dataType].defaultOperator;

    filter.property = newProperty;
    filter.operator = operator;

    this._renderOperator(filter);
    this._renderValues(filter);
    this._validateFilters();
  },

  /**
   * Event handler when the operator of a filter changes
   *
   * @param object filter
   * @param string newOperator
   * @return void
   */
  _onOperatorChanged: function(filter, newOperator) {
    var property = filterConfig.properties[filter.property];
    var operator = filterConfig.dataTypes[property.dataType][newOperator];

    filter.operator = newOperator;

    this._renderValues(filter);
    this._validateFilters();
  },

  /**
   * Event handler when the value(s?) of a filter changes
   *
   * @param object filter
   * @param string name
   * @param string newValue
   * @return void
   */
  _onValueChanged: function(filter, name, newValue) {
    filter.values[name] = newValue;
    this._validateFilters();
  },

  /**
   * Validate if currentNode is a intelligent collection
   *
   * @return boolean true if it is a filtered collection
   */
  _fsBroserActionHook: function() {
    var currentNode = app.balloon.getCurrentNode();

    if(currentNode !== null && currentNode.directory && currentNode.filter) return false;

    return true;
  }
};

export default app;
