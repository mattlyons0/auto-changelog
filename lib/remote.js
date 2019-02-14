"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fetchRemote = fetchRemote;

var _parseGithubUrl = _interopRequireDefault(require("parse-github-url"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

async function fetchRemote(name) {
  const remoteURL = await (0, _utils.cmd)(`git config --get remote.${name}.url`);

  if (!remoteURL) {
    console.warn(`Warning: Git remote ${name} was not found`);
    console.warn(`Warning: Changelog will not contain links to commits, issues, or PRs`);
    return null;
  }

  const remote = (0, _parseGithubUrl.default)(remoteURL);
  const protocol = remote.protocol === 'http:' ? 'http:' : 'https:';
  const hostname = remote.hostname || remote.host;

  if (/gitlab/.test(hostname) && /\.git$/.test(remote.branch)) {
    // Support gitlab subgroups
    return {
      hostname,
      url: `${protocol}//${hostname}/${remote.repo}/${remote.branch.replace(/\.git$/, '')}`
    };
  }

  if (/dev\.azure/.test(hostname)) {
    return {
      hostname,
      url: `${protocol}//${hostname}/${remote.path}`,
      projectUrl: `${protocol}//${hostname}/${remote.repo}`
    };
  }

  if (/visualstudio/.test(hostname)) {
    return {
      hostname,
      url: `${protocol}//${hostname}/${remote.repo}/${remote.branch}`,
      projectUrl: `${protocol}//${hostname}/${remote.owner}`
    };
  }

  return {
    hostname,
    url: `${protocol}//${hostname}/${remote.repo}`
  };
}