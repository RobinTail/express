/*!
 * express
 * Copyright(c) 2009-2013 TJ Holowaychuk
 * Copyright(c) 2014-2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @api private
 */

import { METHODS } from 'node:http';
import contentType from 'content-type';
import etagOriginal from 'etag';
import mime from 'mime-types';
import proxyaddr from 'proxy-addr';
import qs from 'qs';
import querystring from 'querystring';

/**
 * A list of lowercased HTTP methods that are supported by Node.js.
 * @api private
 */
export const methods = METHODS.map((method) => method.toLowerCase());

/**
 * Return strong ETag for `body`.
 *
 * @param {String|Buffer} body
 * @param {String} [encoding]
 * @return {String}
 * @api private
 */

export const etag = createETagGenerator({ weak: false })

/**
 * Return weak ETag for `body`.
 *
 * @param {String|Buffer} body
 * @param {String} [encoding]
 * @return {String}
 * @api private
 */

export const wetag = createETagGenerator({ weak: true })

/**
 * Normalize the given `type`, for example "html" becomes "text/html".
 *
 * @param {String} type
 * @return {Object}
 * @api private
 */

export const normalizeType = function(type: string){
  return ~type.indexOf('/')
    ? acceptParams(type)
    : { value: (mime.lookup(type) || 'application/octet-stream'), params: {} }
};

/**
 * Normalize `types`, for example "html" becomes "text/html".
 *
 * @param {Array} types
 * @return {Array}
 * @api private
 */

export const normalizeTypes = function(types: string[]) {
  return types.map(normalizeType);
};


/**
 * Parse accept params `str` returning an
 * object with `.value`, `.quality` and `.params`.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function acceptParams (str: string) {
  const length = str.length;
  const colonIndex = str.indexOf(';');
  let index = colonIndex === -1 ? length : colonIndex;
  const ret = { value: str.slice(0, index).trim(), quality: 1, params: {} as Record<string, string> };

  while (index < length) {
    const splitIndex = str.indexOf('=', index);
    if (splitIndex === -1) break;

    const colonIndex = str.indexOf(';', index);
    const endIndex = colonIndex === -1 ? length : colonIndex;

    if (splitIndex > endIndex) {
      index = str.lastIndexOf(';', splitIndex - 1) + 1;
      continue;
    }

    const key = str.slice(index, splitIndex).trim();
    const value = str.slice(splitIndex + 1, endIndex).trim();

    if (key === 'q') {
      ret.quality = parseFloat(value);
    } else {
      ret.params[key] = value;
    }

    index = endIndex + 1;
  }

  return ret;
}

/**
 * Compile "etag" value to function.
 *
 * @param  {Boolean|String|Function} val
 * @return {Function}
 * @api private
 */

export const compileETag = function(val: boolean | string | Function) {
  let fn;

  if (typeof val === 'function') {
    return val;
  }

  switch (val) {
    case true:
    case 'weak':
      fn = wetag;
      break;
    case false:
      break;
    case 'strong':
      fn = etag;
      break;
    default:
      throw new TypeError('unknown value for etag function: ' + val);
  }

  return fn;
}

/**
 * Compile "query parser" value to function.
 *
 * @param  {String|Function} val
 * @return {Function}
 * @api private
 */

export const compileQueryParser = function compileQueryParser(val: string | boolean | Function) {
  let fn;

  if (typeof val === 'function') {
    return val;
  }

  switch (val) {
    case true:
    case 'simple':
      fn = querystring.parse;
      break;
    case false:
      break;
    case 'extended':
      fn = parseExtendedQueryString;
      break;
    default:
      throw new TypeError('unknown value for query parser function: ' + val);
  }

  return fn;
}

/**
 * Compile "proxy trust" value to function.
 *
 * @param  {Boolean|String|Number|Array|Function} val
 * @return {Function}
 * @api private
 */

export const compileTrust = function(val: boolean | string | number | string[] | Function) {
  if (typeof val === 'function') return val;

  if (val === true) {
    // Support plain true/false
    return function(){ return true };
  }

  if (typeof val === 'number') {
    // Support trusting hop count
    return function(a: string, i: number){ return i < (val as number) };
  }

  if (typeof val === 'string') {
    // Support comma-separated values
    val = val.split(',')
      .map(function (v) { return v.trim() })
  }

  return proxyaddr.compile(val || []);
}

/**
 * Set the charset in a given Content-Type string.
 *
 * @param {String} type
 * @param {String} charset
 * @return {String}
 * @api private
 */

export const setCharset = function setCharset(type: string, charset: string) {
  if (!type || !charset) {
    return type;
  }

  // parse type
  const parsed = contentType.parse(type);

  // set charset
  parsed.parameters.charset = charset;

  // format type
  return contentType.format(parsed);
};

/**
 * Create an ETag generator function, generating ETags with
 * the given options.
 *
 * @param {object} options
 * @return {function}
 * @private
 */

function createETagGenerator (options: etagOriginal.Options) {
  return function generateETag (body: string | Buffer, encoding: BufferEncoding) {
    const buf = !Buffer.isBuffer(body)
      ? Buffer.from(body, encoding)
      : body

    return etagOriginal(buf, options)
  }
}

/**
 * Parse an extended query string with qs.
 *
 * @param {String} str
 * @return {Object}
 * @private
 */

function parseExtendedQueryString(str: string) {
  return qs.parse(str, {
    allowPrototypes: true
  });
}
