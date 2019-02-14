"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseReleases = parseReleases;
exports.sortReleases = sortReleases;

var _semver = _interopRequireDefault(require("semver"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var MERGE_COMMIT_PATTERN = /^Merge (remote-tracking )?branch '.+'/;
var COMMIT_MESSAGE_PATTERN = /\n+([\S\s]+)/;
var NUMERIC_PATTERN = /^\d+(\.\d+)?$/;

function parseReleases(commits, remote, latestVersion, options) {
  var release = newRelease(latestVersion);
  var releases = [];
  var _iteratorNormalCompletion = true;
  var _didIteratorError = false;
  var _iteratorError = undefined;

  try {
    for (var _iterator = commits[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
      var commit = _step.value;

      if (commit.tag) {
        if (release.tag || options.unreleased) {
          releases.push(_objectSpread({}, release, {
            href: getCompareLink("".concat(options.tagPrefix).concat(commit.tag), release.tag ? "".concat(options.tagPrefix).concat(release.tag) : 'HEAD', remote),
            commits: sliceCommits(release.commits.sort(sortCommits), options, release),
            major: !options.tagPattern && commit.tag && release.tag && _semver.default.diff(commit.tag, release.tag) === 'major'
          }));
        }

        var summary = getSummary(commit.message, options.releaseSummary);
        release = newRelease(commit.tag, commit.date, summary);
      }

      if (commit.merge) {
        release.merges.push(commit.merge);
      } else if (commit.fixes) {
        release.fixes.push({
          fixes: commit.fixes,
          commit: commit
        });
      } else if (filterCommit(commit, release, options.commitLimit)) {
        release.commits.push(commit);
      }
    }
  } catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
  } finally {
    try {
      if (!_iteratorNormalCompletion && _iterator.return != null) {
        _iterator.return();
      }
    } finally {
      if (_didIteratorError) {
        throw _iteratorError;
      }
    }
  }

  releases.push(_objectSpread({}, release, {
    commits: sliceCommits(release.commits.sort(sortCommits), options, release)
  }));
  return releases;
}

function sortReleases(a, b) {
  if (a.tag && b.tag) {
    if (_semver.default.valid(a.tag) && _semver.default.valid(b.tag)) {
      return _semver.default.rcompare(a.tag, b.tag);
    }

    if (NUMERIC_PATTERN.test(a.tag) && NUMERIC_PATTERN.test(b.tag)) {
      return parseFloat(a.tag) < parseFloat(b.tag) ? 1 : -1;
    }

    if (a.tag === b.tag) {
      return 0;
    }

    return a.tag < b.tag ? 1 : -1;
  }

  if (a.tag) return 1;
  if (b.tag) return -1;
  return 0;
}

function newRelease() {
  var tag = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
  var date = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : new Date().toISOString();
  var summary = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;
  return {
    commits: [],
    fixes: [],
    merges: [],
    tag: tag,
    date: date,
    summary: summary,
    title: tag || 'Unreleased',
    niceDate: (0, _utils.niceDate)(date),
    isoDate: date.slice(0, 10)
  };
}

function filterCommit(commit, release, limit) {
  if (commit.breaking) {
    return true;
  }

  if (_semver.default.valid(commit.subject)) {
    // Filter out version commits
    return false;
  }

  if (MERGE_COMMIT_PATTERN.test(commit.subject)) {
    // Filter out merge commits
    return false;
  }

  if (release.merges.findIndex(function (m) {
    return m.message === commit.subject;
  }) !== -1) {
    // Filter out commits with the same message as an existing merge
    return false;
  }

  return true;
}

function getCompareLink(from, to, remote) {
  if (!remote) {
    return null;
  }

  if (/bitbucket/.test(remote.hostname)) {
    return "".concat(remote.url, "/compare/").concat(to, "..").concat(from);
  }

  if (/dev\.azure/.test(remote.hostname) || /visualstudio/.test(remote.hostname)) {
    return "".concat(remote.url, "/branches?baseVersion=GT").concat(to, "&targetVersion=GT").concat(from, "&_a=commits");
  }

  return "".concat(remote.url, "/compare/").concat(from, "...").concat(to);
}

function getSummary(message, releaseSummary) {
  if (!message || !releaseSummary) {
    return null;
  }

  if (COMMIT_MESSAGE_PATTERN.test(message)) {
    return message.match(COMMIT_MESSAGE_PATTERN)[1];
  }

  return null;
}

function sortCommits(a, b) {
  if (!a.breaking && b.breaking) return 1;
  if (a.breaking && !b.breaking) return -1;
  return b.insertions + b.deletions - (a.insertions + a.deletions);
}

function sliceCommits(commits, options, release) {
  if (options.commitLimit === false) {
    return commits;
  }

  var emptyRelease = release.fixes.length === 0 && release.merges.length === 0;
  var limit = emptyRelease ? options.backfillLimit : options.commitLimit;
  var minLimit = commits.filter(function (c) {
    return c.breaking;
  }).length;
  return commits.slice(0, Math.max(minLimit, limit));
}