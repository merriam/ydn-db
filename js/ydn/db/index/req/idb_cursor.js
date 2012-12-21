/**
 * @fileoverview Cursor.
 */


goog.provide('ydn.db.index.req.IDBCursor');
goog.require('ydn.db.index.req.AbstractCursor');


/**
 * Open an index. This will resume depending on the cursor state.
 * @param {!IDBObjectStore} obj_store object store.
 * @param {string} store_name the store name to open.
 * @param {string|undefined} index_name index
 * @param {IDBKeyRange} keyRange
 * @param {ydn.db.base.Direction} direction we are using old spec
 * @param {boolean} key_only mode.
 * @param {*=} ini_key primary key to resume position.
 * @param {*=} ini_index_key index key to resume position.
 * @extends {ydn.db.index.req.AbstractCursor}
 * @constructor
 */
ydn.db.index.req.IDBCursor = function(obj_store, store_name, index_name, keyRange,
                                   direction, key_only, ini_key, ini_index_key) {
  goog.base(this, store_name, index_name, keyRange, direction, key_only);

  goog.asserts.assert(obj_store);
  this.obj_store = obj_store;

  /**
   *
   * @type {?IDBIndex}
   */
  this.index = null;
  if (goog.isDefAndNotNull(index_name)) {
    if (obj_store.indexNames.contains(index_name)) {
      this.index = obj_store.index(index_name);
    } else if (obj_store.keyPath != index_name ) {
      throw new ydn.db.InternalError('index "' + index_name + '" not found in ' +
          obj_store.name);
    }
  }

  this.cur = null;
  this.target_key_ = null;
  this.target_index_key_ = null;
  this.target_exclusive_ = false;
  this.has_pending_request_ = false;

  this.open_request(ini_key, ini_index_key);

};
goog.inherits(ydn.db.index.req.IDBCursor, ydn.db.index.req.AbstractCursor);


/**
 * @define {boolean}
 */
ydn.db.index.req.IDBCursor.DEBUG = false;


/**
 * @protected
 * @type {goog.debug.Logger} logger.
 */
ydn.db.index.req.IDBCursor.prototype.logger =
  goog.debug.Logger.getLogger('ydn.db.index.req.IDBCursor');


/**
 * @private
 * @type {IDBObjectStore}
 */
ydn.db.index.req.IDBCursor.prototype.obj_store = null;


/**
 * @private
 * @type {IDBIndex}
 */
ydn.db.index.req.IDBCursor.prototype.index = null;


/**
 * @private
 * @type {IDBCursor|IDBCursorWithValue}
 */
ydn.db.index.req.IDBCursor.prototype.cur = null;


/**
 *
 * @param {Event} event
 */
ydn.db.index.req.IDBCursor.prototype.requestOnSuccess = function (event) {
  var label = 'IDBCursor: ' + this.store_name + ':' + this.index_name;
  this.has_pending_request_ = false;
  var target = /** {IDBRequest} */ (event.target);
  var cur = (event.target.result);
  this.cur = cur;
  //console.log(['onsuccess', cur ? cur.key : undefined, cur ? cur.primaryKey : undefined, ini_key, ini_index_key]);
  if (cur) {
    //var value = me.key_only ? cur.key : cur['value'];

    if (goog.isDefAndNotNull(this.target_index_key_)) {
      var index_cmp = ydn.db.con.IndexedDb.indexedDb.cmp(cur.key, this.target_index_key_);
      if (index_cmp === 1) {
        // not in the range.
        this.target_key_ = null;
        this.target_index_key_ = null;
        //me.onNext(cur.primaryKey, cur.key, cur.value);
        this.onSuccess(cur.primaryKey, cur.key, cur.value);
        return;
      } else if (index_cmp === 0) {
        this.target_index_key_ = null;
      } else {
        cur['continue']();
        return;
      }
    }
    if (goog.isDefAndNotNull(this.target_key_)) {
      var primary_cmp = ydn.db.con.IndexedDb.indexedDb.cmp(this.target_key_, cur.primaryKey);
      if (primary_cmp === 0) {
        this.target_key_ = null; // we got there.
        // me.onNext(cur.primaryKey, cur.key, cur.value);
        if (this.target_exclusive_) {
          this.target_exclusive_ = false; // mark done.
          cur['continue'](); // resume point is exclusive
        } else {
          this.onSuccess(cur.primaryKey, cur.key, cur.value);
        }
      } else if (primary_cmp === 1) {
        // the key we are looking is not yet arrive.
        cur['continue']();
      } else {
        // the seeking primary key is not in the range.
        this.target_key_ = null;
        //me.onNext(this.cur.key, cur.primaryKey, cur.value);
        this.onSuccess(cur.primaryKey, cur.key, cur.value);
      }
    } else {
      //me.onNext(cur.primaryKey, cur.key, cur.value);
      this.onSuccess(cur.primaryKey, cur.key, cur.value);
    }

  } else {
    //me.onSuccess(undefined, undefined, undefined);
    this.target_index_key_ = null;
    this.target_key_ = null;
    this.target_exclusive_ = false;
    this.logger.finest(label + ' completed.');
    // notify that cursor iteration is finished.
    //me.onNext(undefined, undefined, undefined);
    this.onSuccess(undefined, undefined, undefined);
  }

};


/**
 *
 * @type {*}
 * @private
 */
ydn.db.index.req.IDBCursor.prototype.target_key_ = null;

/**
 *
 * @type {*}
 * @private
 */
ydn.db.index.req.IDBCursor.prototype.target_index_key_ = null;

/**
 *
 * @type {boolean}
 * @private
 */
ydn.db.index.req.IDBCursor.prototype.target_exclusive_ = false;

/**
 *
 * @type {boolean}
 * @private
 */
ydn.db.index.req.IDBCursor.prototype.has_pending_request_ = false;



/**
 * Make cursor opening request.
 *
 * This will seek to given initial position if given. If only ini_key (primary
 * key) is given, this will rewind, if not found.
 *
 * @param {*=} ini_key primary key to resume position.
 * @param {*=} ini_index_key index key to resume position.
 * @param {boolean=} exclusive
 * @private
 */
ydn.db.index.req.IDBCursor.prototype.open_request = function (ini_key, ini_index_key, exclusive) {

  var label = 'IDBCursor: ' + this.store_name + ':' + this.index_name;
  this.target_key_ = ini_key;
  this.target_index_key_ = ini_index_key;
  this.target_exclusive_ = !!exclusive;

  var key_range = this.key_range;
  if (goog.isDefAndNotNull(ini_index_key)) {
    if (goog.isDefAndNotNull(this.key_range)) {
      var cmp = ydn.db.con.IndexedDb.indexedDb.cmp(ini_index_key, this.key_range.upper);
      if (cmp == 1 || (cmp == 0 && !this.key_range.upperOpen)) {
        this.onNext(undefined, undefined, undefined); // out of range;
        return;
      }
      key_range = ydn.db.IDBKeyRange.bound(ini_index_key,
        this.key_range.upper, false, this.key_range.upperOpen);
    } else {
      key_range = ydn.db.IDBKeyRange.lowerBound(ini_index_key);
    }
  }

  /**
   * @type {ydn.db.index.req.IDBCursor}
   */
  var me = this;
  var request;
  if (this.key_only) {
    if (this.index) {
      if (goog.isDefAndNotNull(this.dir)) {
        request = this.index.openKeyCursor(key_range, this.dir);
      } else if (goog.isDefAndNotNull(key_range)) {
        request = this.index.openKeyCursor(key_range);
      } else {
        request = this.index.openKeyCursor();
      }
    } else {
      //throw new ydn.error.InvalidOperationException(
      //    'object store cannot open for key cursor');
      // IDB v1 spec do not have openKeyCursor, hopefully next version does
      // http://lists.w3.org/Archives/Public/public-webapps/2012OctDec/0466.html
      // however, lazy serailization used at least in FF.
      if (goog.isDefAndNotNull(this.dir)) {
        request = this.obj_store.openCursor(key_range, this.dir);
      } else if (goog.isDefAndNotNull(key_range)) {
        request = this.obj_store.openCursor(key_range);
        // some browser have problem with null, even though spec said OK.
      } else {
        request = this.obj_store.openCursor();
      }

    }
  } else {
    if (this.index) {
      if (goog.isDefAndNotNull(this.dir)) {
        request = this.index.openCursor(key_range, this.dir);
      } else if (goog.isDefAndNotNull(key_range)) {
        request = this.index.openCursor(key_range);
      } else {
        request = this.index.openCursor();
      }
    } else {
      if (goog.isDefAndNotNull(this.dir)) {
        request = this.obj_store.openCursor(key_range, this.dir);
      } else if (goog.isDefAndNotNull(key_range)) {
        request = this.obj_store.openCursor(key_range);
        // some browser have problem with null, even though spec said OK.
      } else {
        request = this.obj_store.openCursor();
      }
    }
  }
  this.has_pending_request_ = true;

  me.logger.finest(label + ' opened.');

  request.onsuccess = goog.bind(this.requestOnSuccess, this);

  request.onerror = goog.bind(this.onError, this);

};


/**
 * Move cursor to certain steps.
 * @param {number} count
 */
ydn.db.index.req.IDBCursor.prototype.advance = function(count) {
  if (this.cur) {
    this.cur.advance(count);
  } else {
    var label = 'IDBCursor:' + this.store_name + ':' + this.index_name;
    throw new ydn.error.InvalidOperationError(label + ' cursor gone.');
  }
};


/**
 * Continue to next position.
 * @param {*} next_position next index key.
 * @override
 */
ydn.db.index.req.IDBCursor.prototype.forward = function (next_position) {
  //console.log(['next_position', cur, next_position]);
  var label = 'IDBCursor:' + this.store_name + ':' + this.index_name;
  if (next_position === false) {
    // restart the iterator
    this.logger.finest(label + ' restarting.');
    this.open_request();
  } else if (this.cur) {
    if (next_position === true) {
      this.cur['continue']();
    } else if (goog.isDefAndNotNull(next_position)) {
      //console.log('continuing to ' + next_position)
      this.cur['continue'](next_position);
    } else {
      // notify that cursor iteration is finished.
      this.onSuccess(undefined, undefined, undefined);
      this.logger.finest(label + ' resting.');
    }
  } else {
    throw new ydn.error.InvalidOperationError(label + ' cursor gone.');
  }
};


/**
 * @inheritDoc
 */
ydn.db.index.req.IDBCursor.prototype.hasCursor = function() {
  return !!this.cur;
};


/**
 * This must call only when cursor is active.
 * @return {*} return current index key.
 * @override
 */
ydn.db.index.req.IDBCursor.prototype.getIndexKey = function() {
  return this.cur.key;
};


/**
 * This must call only when cursor is active.
 * @return {*} return current primary key.
 * @override
 */
ydn.db.index.req.IDBCursor.prototype.getPrimaryKey = function() {
  return this.cur.primaryKey;
};


/**
 * This must call only when cursor is active.
 * @return {*} return current primary key.
 * @override
 */
ydn.db.index.req.IDBCursor.prototype.getValue = function() {
  return this.cur.value;
};


/**
 * Continue to next primary key position.
 *
 *
 * This will continue to scan
 * until the key is over the given primary key. If next_primary_key is
 * lower than current position, this will rewind.
 * @param {*} next_primary_key
 * @param {*=} next_index_key
 * @param {boolean=} exclusive
 * @override
 */
ydn.db.index.req.IDBCursor.prototype.seek = function(next_primary_key,
                                         next_index_key, exclusive) {

  var label = 'IDBCursor:' + this.store_name + ':' + this.index_name;
  if (goog.DEBUG && this.has_pending_request_) {
    throw new ydn.db.InternalError(label + ' has pending request.');
  }
  this.target_index_key_ =  next_index_key;
  this.target_key_ = next_primary_key;
  this.target_exclusive_ = !!exclusive;

  if (this.cur) {
    var value = this.key_only ? this.cur.key : this.cur['value'];
    var primary_cmp = ydn.db.con.IndexedDb.indexedDb.cmp(next_primary_key, this.cur.primaryKey);
    var primary_on_track = primary_cmp == 0 || (primary_cmp == 1 && !this.reverse) || (primary_cmp == -1 && this.reverse);

    if (ydn.db.index.req.IDBCursor.DEBUG) {
      var s = primary_cmp === 0 ? 'next' : primary_cmp === 1 ? 'on track' : 'wrong track';
      window.console.log(this + ' seek ' + next_primary_key + ':' + next_index_key + ' ' + s);
    }

    if (goog.isDefAndNotNull(next_index_key)) {
      var index_cmp = ydn.db.con.IndexedDb.indexedDb.cmp(this.cur.key, next_index_key);
      var index_on_track = (index_cmp == 1 && !this.reverse) || (index_cmp == -1 && this.reverse);
      if (index_cmp === 0) {
        if (goog.DEBUG && primary_cmp === 0) {
          throw new ydn.error.InternalError(label + ' cursor cannot seek to current position');
        } else if (primary_on_track) {
          this.has_pending_request_ = true;
          this.cur['continue']();
        } else {
          // primary key not in the range
          // this will restart the thread.
          this.open_request(next_primary_key, next_index_key);
        }
      } else if (index_on_track) {
        // just to index key position and continue
        this.cur['continue'](next_index_key);
      } else {
        // this will restart the thread.
        this.logger.finest(label + ' restarting for ' + next_primary_key);
        this.open_request(next_primary_key, next_index_key);
      }
    } else {
      if (primary_cmp === 0) {
        if (goog.DEBUG && !exclusive) {
          throw new ydn.db.InternalError(label + 'cursor cannot seek to current position');
        }
        this.has_pending_request_ = true;
        this.cur['continue']();
      } else if (primary_on_track) {
        this.has_pending_request_ = true;
        // IDB v1 do not expose walking on primary key, so we walk
        // filed feature request
        // https://www.w3.org/Bugs/Public/show_bug.cgi?id=20257
        this.cur['continue']();
      } else {
        // primary key not in the range
        // this will restart the thread.
        this.open_request(next_primary_key, next_index_key, exclusive);
      }
    }
  } else {
    throw new ydn.db.InternalError(label + ' cursor gone.');
  }
};


/**
 * @inheritDoc
 */
ydn.db.index.req.IDBCursor.prototype.update = function(record, index) {
  var idx = goog.isDef(index) ? index : 0;
  if (this.cur) {
    var df = new goog.async.Deferred();
    var req = this.cur.update(record);
    req.onsuccess = function(x) {
      df.callback(x);
    };
    req.onerror = function(e) {
      df.errback(e);
    };
    return df;
  } else {
    throw new ydn.db.InvalidAccessError('cursor gone');
  }
};
