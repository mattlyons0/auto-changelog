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

var _commits = require("./commits");

var _releases = require("./releases");

var _template = require("./template");

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const DEFAULT_OPTIONS = {
  output: 'CHANGELOG.md',
  template: 'compact',
  remote: 'origin',
  commitLimit: 3,
  backfillLimit: 3,
  tagPrefix: ''
};
const PACKAGE_FILE = 'package.json';
const PACKAGE_OPTIONS_KEY = 'auto-changelog';
const OPTIONS_DOTFILE = '.auto-changelog';

function getOptions(argv, pkg, dotOptions) {
  const options = new _commander.Command().option('-o, --output [file]', `output file, default: ${DEFAULT_OPTIONS.output}`).option('-t, --template [template]', `specify template to use [compact, keepachangelog, json], default: ${DEFAULT_OPTIONS.template}`).option('-r, --remote [remote]', `specify git remote to use for links, default: ${DEFAULT_OPTIONS.remote}`).option('-p, --package', 'use version from package.json as latest release').option('-v, --latest-version [version]', 'use specified version as latest release').option('-u, --unreleased', 'include section for unreleased changes').option('-l, --commit-limit [count]', `number of commits to display per release, default: ${DEFAULT_OPTIONS.commitLimit}`, _utils.parseLimit).option('-b, --backfill-limit [count]', `number of commits to backfill empty releases with, default: ${DEFAULT_OPTIONS.backfillLimit}`, _utils.parseLimit).option('-i, --issue-url [url]', 'override url for issues, use {id} for issue id').option('--issue-pattern [regex]', 'override regex pattern for issues in commit messages').option('--breaking-pattern [regex]', 'regex pattern for breaking change commits').option('--merge-pattern [regex]', 'override regex pattern for merge commits').option('--ignore-commit-pattern [regex]', 'pattern to ignore when parsing commits').option('--tag-pattern [regex]', 'override regex pattern for release tags').option('--tag-prefix [prefix]', 'prefix used in version tags').option('--starting-commit [hash]', 'starting commit to use for changelog generation').option('--include-branch [branch]', 'one or more branches to include commits from, comma separated', str => str.split(',')).option('--release-summary', 'use tagged commit message body as release summary').option('--platform [platform]', 'set platform manually [bitbucket, gitlab, azure]').option('--stdout', 'output changelog to stdout').version(_package.version).parse(argv);

  if (!pkg) {
    if (options.package) {
      throw new Error('package.json could not be found');
    }

    return { ...DEFAULT_OPTIONS,
      ...dotOptions,
      ...options
    };
  }

  return { ...DEFAULT_OPTIONS,
    ...dotOptions,
    ...pkg[PACKAGE_OPTIONS_KEY],
    ...options
  };
}

function getLatestVersion(options, pkg, commits) {
  if (options.latestVersion) {
    if (!_semver.default.valid(options.latestVersion)) {
      throw new Error('--latest-version must be a valid semver version');
    }

    return options.latestVersion;
  }

  if (options.package) {
    const prefix = commits.some(c => /^v/.test(c.tag)) ? 'v' : '';
    return `${prefix}${pkg.version}`;
  }

  return null;
}

async function getReleases(commits, remote, latestVersion, options) {
  let releases = (0, _releases.parseReleases)(commits, remote, latestVersion, options);

  if (options.includeBranch) {
    for (const branch of options.includeBranch) {
      const commits = await (0, _commits.fetchCommits)(remote, options, branch);
      releases = [...releases, ...(0, _releases.parseReleases)(commits, remote, latestVersion, options)];
    }
  }

  return (0, _lodash.default)(releases, 'tag').sort(_releases.sortReleases);
}

async function run(argv) {
  const pkg = (await (0, _utils.fileExists)(PACKAGE_FILE)) && (await (0, _utils.readJson)(PACKAGE_FILE));
  const dotOptions = (await (0, _utils.fileExists)(OPTIONS_DOTFILE)) && (await (0, _utils.readJson)(OPTIONS_DOTFILE));
  const options = getOptions(argv, pkg, dotOptions);

  const log = string => options.stdout ? null : (0, _utils.updateLog)(string);

  log('Fetching remote…');
  const remote = await (0, _remote.fetchRemote)(options.remote);

  const commitProgress = bytes => log(`Fetching commits… ${(0, _utils.formatBytes)(bytes)} loaded`);

  const commits = await (0, _commits.fetchCommits)(remote, options, null, commitProgress);
  log('Generating changelog…');
  const latestVersion = getLatestVersion(options, pkg, commits);
  const releases = await getReleases(commits, remote, latestVersion, options);
  const changelog = await (0, _template.compileTemplate)(options.template, {
    releases
  });

  if (options.stdout) {
    process.stdout.write(changelog);
  } else {
    await (0, _utils.writeFile)(options.output, changelog);
  }

  const bytes = Buffer.byteLength(changelog, 'utf8');
  log(`${(0, _utils.formatBytes)(bytes)} written to ${options.output}\n`);
}