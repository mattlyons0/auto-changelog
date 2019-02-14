"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.updateLog = updateLog;
exports.formatBytes = formatBytes;
exports.cmd = cmd;
exports.getGitVersion = getGitVersion;
exports.niceDate = niceDate;
exports.isLink = isLink;
exports.parseLimit = parseLimit;
exports.replaceText = replaceText;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.fileExists = fileExists;
exports.readJson = readJson;

var _readline = _interopRequireDefault(require("readline"));

var _fs = _interopRequireDefault(require("fs"));

var _child_process = require("child_process");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function updateLog(string, clearLine = true) {
  if (clearLine) {
    _readline.default.clearLine(process.stdout);

    _readline.default.cursorTo(process.stdout, 0);
  }

  process.stdout.write(`auto-changelog: ${string}`);
}

function formatBytes(bytes) {
  return `${Math.max(1, Math.round(bytes / 1024))} kB`;
} // Simple util for calling a child process


function cmd(string, onProgress) {
  const [cmd, ...args] = string.split(' ');
  return new Promise((resolve, reject) => {
    const child = (0, _child_process.spawn)(cmd, args);
    let data = '';
    child.stdout.on('data', buffer => {
      data += buffer.toString();

      if (onProgress) {
        onProgress(data.length);
      }
    });
    child.stdout.on('end', () => resolve(data));
    child.on('error', reject);
  });
}

async function getGitVersion() {
  const output = await cmd('git --version');
  const match = output.match(/\d+\.\d+\.\d+/);
  return match ? match[0] : null;
}

function niceDate(string) {
  const date = new Date(string);
  const day = date.getUTCDate();
  const month = MONTH_NAMES[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function isLink(string) {
  return /^http/.test(string);
}

function parseLimit(limit) {
  return limit === 'false' ? false : parseInt(limit, 10);
}

function replaceText(string, options) {
  if (!options.replaceText || !string) {
    return string;
  }

  return Object.keys(options.replaceText).reduce((string, pattern) => {
    return string.replace(new RegExp(pattern, 'g'), options.replaceText[pattern]);
  }, string);
}

const createCallback = (resolve, reject) => (err, data) => {
  if (err) reject(err);else resolve(data);
};

function readFile(path) {
  return new Promise((resolve, reject) => {
    _fs.default.readFile(path, 'utf-8', createCallback(resolve, reject));
  });
}

function writeFile(path, data) {
  return new Promise((resolve, reject) => {
    _fs.default.writeFile(path, data, createCallback(resolve, reject));
  });
}

function fileExists(path) {
  return new Promise(resolve => {
    _fs.default.access(path, err => resolve(!err));
  });
}

async function readJson(path) {
  const json = await readFile(path);
  return JSON.parse(json);
}