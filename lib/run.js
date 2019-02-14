"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = run;

var _commander = require("commander");

var _semver = _interopRequireDefault(require("semver"));

var _lodash = _interopRequireDefault(require("lodash.uniqby"));

var _package = require("../package.json");

var _remote = require("./remote");

var _commits2 = require("./commits");

var _releases = require("./releases");

var _template = require("./template");

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var DEFAULT_OPTIONS = {
  output: 'CHANGELOG.md',
  template: 'compact',
  remote: 'origin',
  commitLimit: 3,
  backfillLimit: 3,
  tagPrefix: ''
};
var PACKAGE_FILE = 'package.json';
var PACKAGE_OPTIONS_KEY = 'auto-changelog';
var OPTIONS_DOTFILE = '.auto-changelog';

function getOptions(argv, pkg, dotOptions) {
  var options = new _commander.Command().option('-o, --output [file]', "output file, default: ".concat(DEFAULT_OPTIONS.output)).option('-t, --template [template]', "specify template to use [compact, keepachangelog, json], default: ".concat(DEFAULT_OPTIONS.template)).option('-r, --remote [remote]', "specify git remote to use for links, default: ".concat(DEFAULT_OPTIONS.remote)).option('-p, --package', 'use version from package.json as latest release').option('-v, --latest-version [version]', 'use specified version as latest release').option('-u, --unreleased', 'include section for unreleased changes').option('-l, --commit-limit [count]', "number of commits to display per release, default: ".concat(DEFAULT_OPTIONS.commitLimit), _utils.parseLimit).option('-b, --backfill-limit [count]', "number of commits to backfill empty releases with, default: ".concat(DEFAULT_OPTIONS.backfillLimit), _utils.parseLimit).option('-i, --issue-url [url]', 'override url for issues, use {id} for issue id').option('--issue-pattern [regex]', 'override regex pattern for issues in commit messages').option('--breaking-pattern [regex]', 'regex pattern for breaking change commits').option('--merge-pattern [regex]', 'override regex pattern for merge commits').option('--ignore-commit-pattern [regex]', 'pattern to ignore when parsing commits').option('--tag-pattern [regex]', 'override regex pattern for release tags').option('--tag-prefix [prefix]', 'prefix used in version tags').option('--starting-commit [hash]', 'starting commit to use for changelog generation').option('--include-branch [branch]', 'one or more branches to include commits from, comma separated', function (str) {
    return str.split(',');
  }).option('--release-summary', 'use tagged commit message body as release summary').option('--stdout', 'output changelog to stdout').version(_package.version).parse(argv);

  if (!pkg) {
    if (options.package) {
      throw new Error('package.json could not be found');
    }

    return _objectSpread({}, DEFAULT_OPTIONS, dotOptions, options);
  }

  return _objectSpread({}, DEFAULT_OPTIONS, dotOptions, pkg[PACKAGE_OPTIONS_KEY], options);
}

function getLatestVersion(options, pkg, commits) {
  if (options.latestVersion) {
    if (!_semver.default.valid(options.latestVersion)) {
      throw new Error('--latest-version must be a valid semver version');
    }

    return options.latestVersion;
  }

  if (options.package) {
    var prefix = commits.some(function (c) {
      return /^v/.test(c.tag);
    }) ? 'v' : '';
    return "".concat(prefix).concat(pkg.version);
  }

  return null;
}

function getReleases(_x, _x2, _x3, _x4) {
  return _getReleases.apply(this, arguments);
}

function _getReleases() {
  _getReleases = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee(commits, remote, latestVersion, options) {
    var releases, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, branch, _commits;

    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            releases = (0, _releases.parseReleases)(commits, remote, latestVersion, options);

            if (!options.includeBranch) {
              _context.next = 30;
              break;
            }

            _iteratorNormalCompletion = true;
            _didIteratorError = false;
            _iteratorError = undefined;
            _context.prev = 5;
            _iterator = options.includeBranch[Symbol.iterator]();

          case 7:
            if (_iteratorNormalCompletion = (_step = _iterator.next()).done) {
              _context.next = 16;
              break;
            }

            branch = _step.value;
            _context.next = 11;
            return (0, _commits2.fetchCommits)(remote, options, branch);

          case 11:
            _commits = _context.sent;
            releases = [].concat(_toConsumableArray(releases), _toConsumableArray((0, _releases.parseReleases)(_commits, remote, latestVersion, options)));

          case 13:
            _iteratorNormalCompletion = true;
            _context.next = 7;
            break;

          case 16:
            _context.next = 22;
            break;

          case 18:
            _context.prev = 18;
            _context.t0 = _context["catch"](5);
            _didIteratorError = true;
            _iteratorError = _context.t0;

          case 22:
            _context.prev = 22;
            _context.prev = 23;

            if (!_iteratorNormalCompletion && _iterator.return != null) {
              _iterator.return();
            }

          case 25:
            _context.prev = 25;

            if (!_didIteratorError) {
              _context.next = 28;
              break;
            }

            throw _iteratorError;

          case 28:
            return _context.finish(25);

          case 29:
            return _context.finish(22);

          case 30:
            return _context.abrupt("return", (0, _lodash.default)(releases, 'tag').sort(_releases.sortReleases));

          case 31:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this, [[5, 18, 22, 30], [23,, 25, 29]]);
  }));
  return _getReleases.apply(this, arguments);
}

function run(_x5) {
  return _run.apply(this, arguments);
}

function _run() {
  _run = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee2(argv) {
    var pkg, dotOptions, options, log, remote, commitProgress, commits, latestVersion, releases, changelog, bytes;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return (0, _utils.fileExists)(PACKAGE_FILE);

          case 2:
            _context2.t0 = _context2.sent;

            if (!_context2.t0) {
              _context2.next = 7;
              break;
            }

            _context2.next = 6;
            return (0, _utils.readJson)(PACKAGE_FILE);

          case 6:
            _context2.t0 = _context2.sent;

          case 7:
            pkg = _context2.t0;
            _context2.next = 10;
            return (0, _utils.fileExists)(OPTIONS_DOTFILE);

          case 10:
            _context2.t1 = _context2.sent;

            if (!_context2.t1) {
              _context2.next = 15;
              break;
            }

            _context2.next = 14;
            return (0, _utils.readJson)(OPTIONS_DOTFILE);

          case 14:
            _context2.t1 = _context2.sent;

          case 15:
            dotOptions = _context2.t1;
            options = getOptions(argv, pkg, dotOptions);

            log = function log(string) {
              return options.stdout ? null : (0, _utils.updateLog)(string);
            };

            log('Fetching remote…');
            _context2.next = 21;
            return (0, _remote.fetchRemote)(options.remote);

          case 21:
            remote = _context2.sent;

            commitProgress = function commitProgress(bytes) {
              return log("Fetching commits\u2026 ".concat((0, _utils.formatBytes)(bytes), " loaded"));
            };

            _context2.next = 25;
            return (0, _commits2.fetchCommits)(remote, options, null, commitProgress);

          case 25:
            commits = _context2.sent;
            log('Generating changelog…');
            latestVersion = getLatestVersion(options, pkg, commits);
            _context2.next = 30;
            return getReleases(commits, remote, latestVersion, options);

          case 30:
            releases = _context2.sent;
            _context2.next = 33;
            return (0, _template.compileTemplate)(options.template, {
              releases: releases
            });

          case 33:
            changelog = _context2.sent;

            if (!options.stdout) {
              _context2.next = 38;
              break;
            }

            process.stdout.write(changelog);
            _context2.next = 40;
            break;

          case 38:
            _context2.next = 40;
            return (0, _utils.writeFile)(options.output, changelog);

          case 40:
            bytes = Buffer.byteLength(changelog, 'utf8');
            log("".concat((0, _utils.formatBytes)(bytes), " written to ").concat(options.output, "\n"));

          case 42:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));
  return _run.apply(this, arguments);
}