// Copyright 2012 YDN Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview  A unique key for a datastore object supporting hierarchy of
 * parent-child relationships for an entity.
 *
 * The instances are immutable.
 *
 * @author kyawtun@yathit.com (Kyaw Tun)
 */

goog.provide('ydn.db.Key');


/**
 * Builds a new Key object of known id.
 *
 * @param {string|!ydn.db.Key.Json} store_or_json_or_value
 * @param {(string|number)=}id
 * @param {ydn.db.Key=} opt_parent
 * @constructor
 */
ydn.db.Key = function(store_or_json_or_value, id, opt_parent) {

  var store_name;
  if (goog.isObject(store_or_json_or_value)) {
    store_name = store_or_json_or_value['store'];
    id = store_or_json_or_value['id'];
    if (goog.isDefAndNotNull(store_or_json_or_value['parent'])) {
      opt_parent = new ydn.db.Key(store_or_json_or_value['parent']);
    }
  } else {
    goog.asserts.assertString(store_or_json_or_value);
    if (!goog.isDef(id)) {
      // must be valueOf string
      var idx = store_or_json_or_value.lastIndexOf(ydn.db.Key.SEP_PARENT);
      /**
       * @type {string}
       */
      var store_and_id = store_or_json_or_value;
      if (idx > 0) {
        store_and_id = store_or_json_or_value.substr(idx);
        opt_parent = new ydn.db.Key(store_or_json_or_value.substring(0, idx));
      }
      var parts = store_and_id.split(ydn.db.Key.SEP_STORE);
      store_name = parts[0];
      id = parts[1];
      if (!goog.isDef(id)) {
        throw Error('Invalid key value: ' + store_or_json_or_value);
      }
    } else {
      store_name = store_or_json_or_value;
    }
  }

  /**
   * @final
   * @private
   * @type {string}
   */
  this.store_name_ = store_name;
  /**
   * @final
   * @private
   * @type {(string|number)}
   */
  this.id_ = id;
  /**
   * @private
   * @final
   * @type {ydn.db.Key}
   */
  this.parent_ = opt_parent || null;

};


/**
 * @typedef {{
 *  store: string,
 *  id: (string|number),
 *  parent: (ydn.db.Key|undefined)
 * }}
 */
ydn.db.Key.Json;



/**
 * @return {!Object}
 */
ydn.db.Key.prototype.toJSON = function() {
  var obj = {
    'store': this.store_name_,
    'id': this.id_
  };
  if (this.parent_) {
    obj['parent'] = this.parent_.toJSON();
  }
  return obj;
};


/**
 *
 * @return {ydn.db.Key}
 */
ydn.db.Key.prototype.parent = function() {
  return this.parent_;
};


/**
 * Separator between child and parent.
 * @const {string}
 */
ydn.db.Key.SEP_PARENT = '^|';

/**
 * Separator between table and key.
 * @const {string}
 */
ydn.db.Key.SEP_STORE = '^:';


/**
 * @override
 * @return {string}
 */
ydn.db.Key.prototype.valueOf = function() {
  // necessary to make web-safe string ?
  var parent_value = this.parent_ ? this.parent_.valueOf() + ydn.db.Key.SEP_PARENT : '';
  return parent_value + this.store_name_ + ydn.db.Key.SEP_STORE + this.id_;
};


/**
 * @inheritDoc
 */
ydn.db.Key.prototype.toString = function() {
  return this.valueOf().replace('^|', '|').replace('^:', ':');
};


/**
 * 
 * @return {string}
 */
ydn.db.Key.prototype.getStoreName = function() {
  return this.store_name_;
};


/**
 *
 * @return {string|number}
 */
ydn.db.Key.prototype.getId = function() {
  return this.id_;
};



