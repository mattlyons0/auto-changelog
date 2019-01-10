import semver from 'semver'
import { cmd, isLink, replaceText, getGitVersion } from './utils'

const COMMIT_SEPARATOR = '__AUTO_CHANGELOG_COMMIT_SEPARATOR__'
const MESSAGE_SEPARATOR = '__AUTO_CHANGELOG_MESSAGE_SEPARATOR__'
const MATCH_COMMIT = /(.*)\n(?:\s\((.*)\))?\n(.*)\n(.*)\n(.*)\n([\S\s]+)/
const MATCH_STATS = /(\d+) files? changed(?:, (\d+) insertions?...)?(?:, (\d+) deletions?...)?/
const BODY_FORMAT = '%B'
const FALLBACK_BODY_FORMAT = '%s%n%n%b'

// https://help.github.com/articles/closing-issues-via-commit-messages
const DEFAULT_FIX_PATTERN = /(?:close[sd]?|fixe?[sd]?|resolve[sd]?)\s(?:#(\d+)|(https?:\/\/.+?\/(?:issues|pull|pull-requests|merge_requests)\/(\d+)))/gi

const MERGE_PATTERNS = [
  /Merge pull request #(\d+) from .+\n\n(.+)/, // Regular GitHub merge
  /^(.+) \(#(\d+)\)(?:$|\n\n)/, // Github squash merge
  /Merged in .+ \(pull request #(\d+)\)\n\n(.+)/, // BitBucket merge
  /Merge branch .+ into .+\n\n(.+)[\S\s]+See merge request [^!]*!(\d+)/ // GitLab merge
]

export async function fetchCommits (remote, options, branch = null, onProgress) {
  let command = branch ? `git log --merges --first-parent ${branch}` : 'git log --merges --first-parent'

  if (options.startingCommit) {
    command = `git log HEAD...${options.startingCommit} --merges --first-parent`
  }

  const format = await getLogFormat()
  const log = await cmd(`${command} --shortstat --pretty=format:${format}`, onProgress)
  return await parseCommits(log, remote, options)
}

async function getLogFormat () {
  const gitVersion = await getGitVersion()
  const bodyFormat = gitVersion && semver.gte(gitVersion, '1.7.2') ? BODY_FORMAT : FALLBACK_BODY_FORMAT
  return `${COMMIT_SEPARATOR}%H%n%d%n%ai%n%an%n%ae%n${bodyFormat}${MESSAGE_SEPARATOR}`
}

async function parseCommits (string, remote, options = {}) {
  let commits = string
    .split(COMMIT_SEPARATOR)
    .slice(1)
    .map(commit => parseMergeCommit(commit, remote, options))

  commits = await Promise.all(commits)

  commits = commits.flat() // parseCommit may return an array, flatten that
    .filter(commit => {
      if (options.ignoreCommitPattern) {
        return new RegExp(options.ignoreCommitPattern).test(commit.subject) === false
      }
      return true
    })

  return commits
}

async function parseMergeCommit (commit, remote, options = {}) {
  const [, hash, refs, date, author, email, tail] = commit.match(MATCH_COMMIT)

  const command = `git log ${hash}^..${hash} --no-merges`
  const format = await getLogFormat()
  const log = commit + await cmd(`${command} --shortstat --pretty=format:${format}`)
  const commits = log
    .split(COMMIT_SEPARATOR)
    .map(commit => parseCommit(commit, remote, options))
  return commits
}

function parseCommit (commit, remote, options = {}) {
  const [, hash, refs, date, author, email, tail] = commit.match(MATCH_COMMIT)
  const [message, stats] = tail.split(MESSAGE_SEPARATOR)

  return {
    hash,
    shorthash: hash.slice(0, 7),
    author,
    email,
    date: new Date(date).toISOString(),
    tag: getTag(refs, options),
    subject: replaceText(getSubject(message), options),
    message: message.trim(),
    fixes: getFixes(message, author, remote, options),
    merge: getMerge(message, author, remote, options),
    href: getCommitLink(hash, remote),
    breaking: !!options.breakingPattern && new RegExp(options.breakingPattern).test(message),
    ...getStats(stats.trim())
  }
}

function getTag (refs, options) {
  if (!refs) return null
  for (let ref of refs.split(', ')) {
    const prefix = `tag: ${options.tagPrefix}`
    if (ref.indexOf(prefix) === 0) {
      const tag = ref.replace(prefix, '')
      if (options.tagPattern) {
        if (new RegExp(options.tagPattern).test(tag)) {
          return tag
        }
        return null
      }
      if (semver.valid(tag)) {
        return tag
      }
    }
  }
  return null
}

function getSubject (message) {
  if (!message) {
    return '_No commit message_'
  }
  return message.match(/[^\n]+/)[0]
}

function getStats (stats) {
  if (!stats) return {}
  const [, files, insertions, deletions] = stats.match(MATCH_STATS)
  return {
    files: parseInt(files || 0),
    insertions: parseInt(insertions || 0),
    deletions: parseInt(deletions || 0)
  }
}

function getFixes (message, author, remote, options = {}) {
  const pattern = getFixPattern(options)
  let fixes = []
  let match = pattern.exec(message)
  if (!match) return null
  while (match) {
    const id = getFixID(match)
    const href = getIssueLink(match, id, remote, options.issueUrl)
    fixes.push({ id, href, author })
    match = pattern.exec(message)
  }
  return fixes
}

function getFixID (match) {
  // Get the last non-falsey value in the match array
  for (let i = match.length; i >= 0; i--) {
    if (match[i]) {
      return match[i]
    }
  }
}

function getFixPattern (options) {
  if (options.issuePattern) {
    return new RegExp(options.issuePattern, 'g')
  }
  return DEFAULT_FIX_PATTERN
}

function getMergePatterns (options) {
  if (options.mergePattern) {
    return [new RegExp(options.mergePattern, 'g')]
  }
  return MERGE_PATTERNS
}

function getMerge (message, author, remote, options = {}) {
  const patterns = getMergePatterns(options)
  for (let pattern of patterns) {
    const match = pattern.exec(message)
    if (match) {
      const id = /^\d+$/.test(match[1]) ? match[1] : match[2]
      const message = /^\d+$/.test(match[1]) ? match[2] : match[1]
      return {
        id,
        message: replaceText(message, options),
        href: getMergeLink(id, remote, options),
        author
      }
    }
  }
  return null
}

function getCommitLink (hash, remote) {
  if (!remote) {
    return null
  }
  if (/bitbucket/.test(remote.hostname)) {
    return `${remote.url}/commits/${hash}`
  }
  return `${remote.url}/commit/${hash}`
}

function getIssueLink (match, id, remote, issueUrl) {
  if (!remote) {
    return null
  }
  if (isLink(match[2])) {
    return match[2]
  }
  if (issueUrl) {
    return issueUrl.replace('{id}', id)
  }
  if (/dev\.azure/.test(remote.hostname) || /visualstudio/.test(remote.hostname)) {
    return `${remote.projectUrl}/_workitems/edit/${id}`
  }
  return `${remote.url}/issues/${id}`
}

function getMergeLink (id, remote, options = {}) {
  if (!remote) {
    return null
  }
  if ((/bitbucket/.test(remote.hostname) && options.platform === undefined) || options.platform === 'bitbucket') {
    return `${remote.url}/pull-requests/${id}`
  }
  if ((/gitlab/.test(remote.hostname) && options.platform === undefined) || options.platform === 'gitlab') {
    return `${remote.url}/merge_requests/${id}`
  }
  if (((/dev\.azure/.test(remote.hostname) || /visualstudio/.test(remote.hostname)) && options.platform === undefined) || options.platform === 'azure') {
    return `${remote.url}/pullrequest/${id}`
  }
  return `${remote.url}/pull/${id}`
}
