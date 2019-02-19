"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.compileTemplate = compileTemplate;

var _path = require("path");

var _handlebars = _interopRequireDefault(require("handlebars"));

var _nodeFetch = _interopRequireDefault(require("node-fetch"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const TEMPLATES_DIR = (0, _path.join)(__dirname, '..', 'templates');
const MATCH_URL = /^https?:\/\/.+/;

_handlebars.default.registerHelper('cut', function (context, options) {
  if (!context) return '';
  return context.replace(RegExp(options.hash.re, 'g'), '');
});

_handlebars.default.registerHelper('indent', function (context, options) {
  return '\t';
});

_handlebars.default.registerHelper('json', function (object) {
  return new _handlebars.default.SafeString(JSON.stringify(object, null, 2));
});

_handlebars.default.registerHelper('commit-list', function (context, options) {
  if (!context || context.length === 0) {
    return '';
  }

  const list = context.filter(commit => {
    if (options.hash.exclude) {
      const pattern = new RegExp(options.hash.exclude, 'm');

      if (pattern.test(commit.message)) {
        return false;
      }
    }

    if (options.hash.message) {
      const pattern = new RegExp(options.hash.message, 'm');
      return pattern.test(commit.message);
    }

    if (options.hash.subject) {
      const pattern = new RegExp(options.hash.subject);
      return pattern.test(commit.subject);
    }

    return true;
  }).map(item => options.fn(item)).join('');

  if (!list) {
    return '';
  }

  return `${options.hash.heading}\n\n${list}`;
});

_handlebars.default.registerHelper('matches', function (val, pattern, options) {
  const r = new RegExp(pattern, options.hash.flags || '');
  return r.test(val) ? options.fn(this) : options.inverse(this);
});

async function getTemplate(template) {
  if (MATCH_URL.test(template)) {
    const response = await (0, _nodeFetch.default)(template);
    return response.text();
  }

  if (await (0, _utils.fileExists)(template)) {
    return (0, _utils.readFile)(template);
  }

  const path = (0, _path.join)(TEMPLATES_DIR, template + '.hbs');

  if ((await (0, _utils.fileExists)(path)) === false) {
    throw new Error(`Template '${template}' was not found`);
  }

  return (0, _utils.readFile)(path);
}

function cleanTemplate(template) {
  return template // Remove indentation
  .replace(/\n +/g, '\n').replace(/^ +/, '') // Fix multiple blank lines
  .replace(/\n\n\n+/g, '\n\n').replace(/\n\n$/, '\n');
}

async function compileTemplate(template, data) {
  const compile = _handlebars.default.compile((await getTemplate(template)), {
    preventIndent: false
  });

  if (template === 'json') {
    return compile(data);
  }

  return cleanTemplate(compile(data));
}