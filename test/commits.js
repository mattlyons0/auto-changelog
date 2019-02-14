import { describe, it } from 'mocha'
import { expect } from 'chai'
import { join } from 'path'
import { readFile } from '../src/utils'
import remotes from './data/remotes'
import commits from './data/commits'
import commitsNoRemote from './data/commits-no-remote'
import {
  fetchCommits,
  __get__,
  __Rewire__ as mock,
  __ResetDependency__ as unmock
} from '../src/commits'

const parseCommits = __get__('parseCommits')
const getFixes = __get__('getFixes')
const getMerge = __get__('getMerge')
const getSubject = __get__('getSubject')
const getLogFormat = __get__('getLogFormat')

const options = {
  tagPrefix: ''
}

describe('fetchCommits', () => {
  it('fetches commits', async () => {
    const gitLog = await readFile(join(__dirname, 'data', 'git-log.txt'))
    mock('cmd', () => gitLog)
    expect(await fetchCommits(remotes.github, options)).to.deep.equal(commits)
    unmock('cmd')
  })
})

describe('parseCommits', () => {
  it('parses commits', async () => {
    const gitLog = await readFile(join(__dirname, 'data', 'git-log.txt'))
    expect(parseCommits(gitLog, remotes.github, options)).to.deep.equal(commits)
  })

  it('parses commits without remote', async () => {
    const gitLog = await readFile(join(__dirname, 'data', 'git-log.txt'))
    expect(parseCommits(gitLog, null, options)).to.deep.equal(commitsNoRemote)
  })

  it('parses bitbucket commits', async () => {
    const gitLog = await readFile(join(__dirname, 'data', 'git-log.txt'))
    const commits = parseCommits(gitLog, remotes.bitbucket)
    expect(commits[0].href).to.equal('https://bitbucket.org/user/repo/commits/2401ee4706e94629f48830bab9ed5812c032734a')
  })

  it('supports startingCommit option', async () => {
    const gitLog = await readFile(join(__dirname, 'data', 'git-log.txt'))
    const options = { startingCommit: '17fbef87e82889f01d8257900f7edc55b05918a2' }
    expect(parseCommits(gitLog, remotes.github, options)).to.have.length(10)
  })

  it('supports ignoreCommitPattern option', async () => {
    const gitLog = await readFile(join(__dirname, 'data', 'git-log.txt'))
    const options = { ignoreCommitPattern: 'Second commit' }
    const result = parseCommits(gitLog, remotes.github, options)
    expect(result).to.have.length(commits.length - 1)
    expect(JSON.stringify(result)).to.not.contain('Second commit')
  })

  it('supports breakingPattern option', async () => {
    const gitLog = await readFile(join(__dirname, 'data', 'git-log.txt'))
    const options = { breakingPattern: 'Some breaking change' }
    const result = parseCommits(gitLog, remotes.github, options)
    expect(result.filter(c => c.breaking)).to.have.length(1)
  })

  it('supports tagPattern option', async () => {
    const gitLog = await readFile(join(__dirname, 'data', 'git-log.txt'))
    const options = { tagPattern: 'non-semver', tagPrefix: '' }
    const result = parseCommits(gitLog, remotes.github, options)
    expect(result.filter(c => c.tag)).to.have.length(1)
    expect(result.filter(c => c.tag === 'non-semver-tag')).to.have.length(1)
  })

  it('supports wildcard tagPattern', async () => {
    const gitLog = await readFile(join(__dirname, 'data', 'git-log.txt'))
    const options = { tagPattern: '.+', tagPrefix: '' }
    const result = parseCommits(gitLog, remotes.github, options)
    expect(result.filter(c => c.tag)).to.have.length(5)
    expect(result.filter(c => c.tag === 'non-semver-tag')).to.have.length(1)
  })

  it('supports replaceText option', async () => {
    const gitLog = await readFile(join(__dirname, 'data', 'git-log.txt'))
    const options = {
      replaceText: {
        'breaking': '**BREAKING**'
      }
    }
    const result = parseCommits(gitLog, remotes.github, options)
    expect(result.filter(c => c.subject === 'Some **BREAKING** change')).to.have.length(1)
  })

  it('invalid startingCommit throws an error', done => {
    const options = { startingCommit: 'not-a-hash' }
    readFile(join(__dirname, 'data', 'git-log.txt'))
      .then(gitLog => parseCommits(gitLog, remotes.github, options))
      .then(() => done('Should throw an error'))
      .catch(() => done())
  })
})

describe('getFixes', () => {
  it('returns null with no fixes', () => {
    const message = 'Commit message with no fixes'
    expect(getFixes(message, 'Commit Author', remotes.github)).to.equal(null)
  })

  it('parses a single fix', () => {
    const message = 'Commit that fixes #12'
    expect(getFixes(message, 'Commit Author', remotes.github)).to.deep.equal([
      { id: '12', href: 'https://github.com/user/repo/issues/12', author: 'Commit Author' }
    ])
  })

  it('parses fix in commit notes', () => {
    const message = 'Commit message\n\nCloses #8'
    expect(getFixes(message, 'Commit Author', remotes.github)).to.deep.equal([
      { id: '8', href: 'https://github.com/user/repo/issues/8', author: 'Commit Author' }
    ])
  })

  it('parses a commit that closes a pull request', () => {
    const message = 'Commit message\n\nCloses https://github.com/user/repo/pull/14'
    expect(getFixes(message, 'Commit Author', remotes.github)).to.deep.equal([
      { id: '14', href: 'https://github.com/user/repo/pull/14', author: 'Commit Author' }
    ])
  })

  it('parses multiple fixes', () => {
    const message = 'Commit message\n\nFixes #1, fix #2, resolved #3, closes #4'
    expect(getFixes(message, 'Commit Author', remotes.github)).to.deep.equal([
      { id: '1', href: 'https://github.com/user/repo/issues/1', author: 'Commit Author' },
      { id: '2', href: 'https://github.com/user/repo/issues/2', author: 'Commit Author' },
      { id: '3', href: 'https://github.com/user/repo/issues/3', author: 'Commit Author' },
      { id: '4', href: 'https://github.com/user/repo/issues/4', author: 'Commit Author' }
    ])
  })

  it('parses fixes by issue URL', () => {
    const message = 'Commit message\n\nFixes https://github.com/user/repo/issues/1'
    expect(getFixes(message, 'Commit Author', remotes.github)).to.deep.equal([
      { id: '1', href: 'https://github.com/user/repo/issues/1', author: 'Commit Author' }
    ])
  })

  it('parses multiple fixes by issue URL', () => {
    const message = 'Commit message\n\nFixes https://github.com/user/repo/issues/1 and fixes https://github.com/user/repo/issues/2'
    expect(getFixes(message, 'Commit Author', remotes.github)).to.deep.equal([
      { id: '1', href: 'https://github.com/user/repo/issues/1', author: 'Commit Author' },
      { id: '2', href: 'https://github.com/user/repo/issues/2', author: 'Commit Author' }
    ])
  })

  it('parses external repo issues', () => {
    const message = 'Commit message\n\nFixes https://github.com/other-user/external-repo/issues/1'
    expect(getFixes(message, 'Commit Author', remotes.github)).to.deep.equal([
      { id: '1', href: 'https://github.com/other-user/external-repo/issues/1', author: 'Commit Author' }
    ])
  })

  it('parses azure devops fix', () => {
    const message = 'Commit message\n\nCloses #123'
    expect(getFixes(message, 'Commit Author', remotes.azure)).to.deep.equal([
      { id: '123', href: 'https://dev.azure.com/user/project/_workitems/edit/123', author: 'Commit Author' }
    ])
  })

  it('parses visual studio fix', () => {
    const message = 'Commit message\n\nCloses #123'
    expect(getFixes(message, 'Commit Author', remotes.visualstudio)).to.deep.equal([
      { id: '123', href: 'https://user.visualstudio.com/project/_workitems/edit/123', author: 'Commit Author' }
    ])
  })

  it('supports issueUrl parameter', () => {
    const options = {
      issueUrl: 'http://example.com/issues/{id}'
    }
    const message = 'Commit message\n\nCloses #8'
    expect(getFixes(message, 'Commit Author', remotes.github, options)).to.deep.equal([
      { id: '8', href: 'http://example.com/issues/8', author: 'Commit Author' }
    ])
  })

  it('supports issuePattern parameter', () => {
    const options = {
      issuePattern: '[A-Z]+-\\d+',
      issueUrl: 'http://example.com/issues/{id}'
    }
    const message = 'Commit message\n\nCloses ABC-1234'
    expect(getFixes(message, 'Commit Author', remotes.github, options)).to.deep.equal([
      { id: 'ABC-1234', href: 'http://example.com/issues/ABC-1234', author: 'Commit Author' }
    ])
  })

  it('supports issuePattern parameter with capture group', () => {
    const options = {
      issuePattern: '[Ff]ixes ([A-Z]+-\\d+)',
      issueUrl: 'http://example.com/issues/{id}'
    }
    const message = 'Commit message\n\nFixes ABC-1234 and fixes ABC-2345 but not BCD-2345'
    expect(getFixes(message, 'Commit Author', remotes.github, options)).to.deep.equal([
      { id: 'ABC-1234', href: 'http://example.com/issues/ABC-1234', author: 'Commit Author' },
      { id: 'ABC-2345', href: 'http://example.com/issues/ABC-2345', author: 'Commit Author' }
    ])
  })
})

describe('getMerge', () => {
  it('returns null on fail', () => {
    const message = 'Not a merge commit'
    expect(getMerge(message, 'Commit Author', remotes.github)).to.equal(null)
  })

  describe('github', () => {
    it('parses a merge', () => {
      const message = 'Merge pull request #3 from repo/branch\n\nPull request title'
      expect(getMerge(message, 'Commit Author', remotes.github)).to.deep.equal({
        id: '3',
        message: 'Pull request title',
        href: 'https://github.com/user/repo/pull/3',
        author: 'Commit Author'
      })
    })

    it('parses a squash merge', () => {
      const message = 'Update dependencies to enable Greenkeeper 🌴 (#10)\n\n* chore(package): update dependencies'
      expect(getMerge(message, 'Commit Author', remotes.github)).to.deep.equal({
        id: '10',
        message: 'Update dependencies to enable Greenkeeper 🌴',
        href: 'https://github.com/user/repo/pull/10',
        author: 'Commit Author'
      })
    })

    it('parses a squash merge with no message', () => {
      const message = 'Generate changelogs that show the commits between tags (#411)'
      expect(getMerge(message, 'Commit Author', remotes.github)).to.deep.equal({
        id: '411',
        message: 'Generate changelogs that show the commits between tags',
        href: 'https://github.com/user/repo/pull/411',
        author: 'Commit Author'
      })
    })
  })

  describe('gitlab', () => {
    it('parses a merge', () => {
      const message = 'Merge branch \'branch\' into \'master\'\n\nMemoize GitLab logger to reduce open file descriptors\n\nCloses gitlab-ee#3664\n\nSee merge request !15007'
      expect(getMerge(message, 'Commit Author', remotes.gitlab)).to.deep.equal({
        id: '15007',
        message: 'Memoize GitLab logger to reduce open file descriptors',
        href: 'https://gitlab.com/user/repo/merge_requests/15007',
        author: 'Commit Author'
      })
    })

    it('parses a merge for subgroups', () => {
      const message = 'Merge branch \'branch\' into \'master\'\n\nMemoize GitLab logger to reduce open file descriptors\n\nCloses gitlab-ee#3664\n\nSee merge request user/repo/subgroup!15007'
      const remote = {
        hostname: 'gitlab.com',
        url: 'https://gitlab.com/user/repo/subgroup'
      }
      expect(getMerge(message, 'Commit Author', remote)).to.deep.equal({
        id: '15007',
        message: 'Memoize GitLab logger to reduce open file descriptors',
        href: 'https://gitlab.com/user/repo/subgroup/merge_requests/15007',
        author: 'Commit Author'
      })
    })
  })

  describe('bitbucket', () => {
    it('parses a merge', () => {
      const message = 'Merged in eshvedai/fix-schema-issue (pull request #4518)\n\nfix(component): re-export createSchema from editor-core\n\nApproved-by: Scott Sidwell <ssidwell@atlassian.com>'
      expect(getMerge(message, 'Commit Author', remotes.bitbucket)).to.deep.equal({
        id: '4518',
        message: 'fix(component): re-export createSchema from editor-core',
        href: 'https://bitbucket.org/user/repo/pull-requests/4518',
        author: 'Commit Author'
      })
    })
  })

  describe('azure devops', () => {
    it('parses a merge', () => {
      // Use github merge message until we can find out what an azure devops one looks like
      const message = 'Merge pull request #3 from repo/branch\n\nPull request title'
      expect(getMerge(message, 'Commit Author', remotes.azure)).to.deep.equal({
        id: '3',
        message: 'Pull request title',
        href: 'https://dev.azure.com/user/project/_git/repo/pullrequest/3',
        author: 'Commit Author'
      })
    })
  })

  describe('visual studio', () => {
    it('parses a merge', () => {
      // Use github merge message until we can find out what a visual studio one looks like
      const message = 'Merge pull request #3 from repo/branch\n\nPull request title'
      expect(getMerge(message, 'Commit Author', remotes.visualstudio)).to.deep.equal({
        id: '3',
        message: 'Pull request title',
        href: 'https://user.visualstudio.com/project/_git/repo/pullrequest/3',
        author: 'Commit Author'
      })
    })
  })

  it('supports mergePattern parameter', () => {
    const options = {
      mergePattern: 'PR #(\\d+) from .+\\n\\n.+\\n(.+)'
    }

    const message = 'PR #37 from repo/branch\n\ncommit sha512\nPull request title'
    expect(getMerge(message, 'Commit Author', remotes.github, options)).to.deep.equal({
      id: '37',
      message: 'Pull request title',
      href: 'https://github.com/user/repo/pull/37',
      author: 'Commit Author'
    })
  })

  it('supports replaceText option', () => {
    const message = 'Merge pull request #3 from repo/branch\n\nPull request title'
    const options = {
      replaceText: {
        '(..l)': '_$1_'
      }
    }
    expect(getMerge(message, 'Commit Author', remotes.github, options)).to.deep.equal({
      id: '3',
      message: '_Pul_l request t_itl_e',
      href: 'https://github.com/user/repo/pull/3',
      author: 'Commit Author'
    })
  })

  describe('self managed', () => {
    it('parses a bitbucket merge', () => {
      const message = 'Merge branch \'branch\' into \'master\'\n\nMemoize GitLab logger to reduce open file descriptors\n\nCloses gitlab-ee#3664\n\nSee merge request !15007'
      expect(getMerge(message, 'Commit Author', remotes.self_managed, { platform: 'bitbucket' })).to.deep.equal({
        id: '15007',
        message: 'Memoize GitLab logger to reduce open file descriptors',
        href: 'https://git.example.com/user/repo/pull-requests/15007',
        author: 'Commit Author'
      })
    })
    it('parses a gitlab merge', () => {
      const message = 'Merge branch \'branch\' into \'master\'\n\nMemoize GitLab logger to reduce open file descriptors\n\nCloses gitlab-ee#3664\n\nSee merge request !15007'
      expect(getMerge(message, 'Commit Author', remotes.self_managed, { platform: 'gitlab' })).to.deep.equal({
        id: '15007',
        message: 'Memoize GitLab logger to reduce open file descriptors',
        href: 'https://git.example.com/user/repo/merge_requests/15007',
        author: 'Commit Author'
      })
    })
    it('parses a azure merge', () => {
      const message = 'Merge branch \'branch\' into \'master\'\n\nMemoize GitLab logger to reduce open file descriptors\n\nCloses gitlab-ee#3664\n\nSee merge request !15007'
      expect(getMerge(message, 'Commit Author', remotes.self_managed, { platform: 'azure' })).to.deep.equal({
        id: '15007',
        message: 'Memoize GitLab logger to reduce open file descriptors',
        href: 'https://git.example.com/user/repo/pullrequest/15007',
        author: 'Commit Author'
      })
    })
  })
})

describe('getSubject', () => {
  it('returns commit subject', () => {
    const message = 'Commit message\n\nCloses ABC-1234'
    expect(getSubject(message)).to.equal('Commit message')
  })

  it('returns no commit message', () => {
    expect(getSubject('')).to.equal('_No commit message_')
  })
})

describe('getLogFormat', () => {
  it('returns modern format', async () => {
    mock('getGitVersion', () => Promise.resolve('1.7.2'))
    expect(await getLogFormat()).to.equal('__AUTO_CHANGELOG_COMMIT_SEPARATOR__%H%n%d%n%ai%n%an%n%ae%n%B__AUTO_CHANGELOG_MESSAGE_SEPARATOR__')
    unmock('cmd')
  })

  it('returns fallback format', async () => {
    mock('getGitVersion', () => Promise.resolve('1.7.1'))
    expect(await getLogFormat()).to.equal('__AUTO_CHANGELOG_COMMIT_SEPARATOR__%H%n%d%n%ai%n%an%n%ae%n%s%n%n%b__AUTO_CHANGELOG_MESSAGE_SEPARATOR__')
    unmock('cmd')
  })

  it('returns fallback format when null', async () => {
    mock('getGitVersion', () => Promise.resolve(null))
    expect(await getLogFormat()).to.equal('__AUTO_CHANGELOG_COMMIT_SEPARATOR__%H%n%d%n%ai%n%an%n%ae%n%s%n%n%b__AUTO_CHANGELOG_MESSAGE_SEPARATOR__')
    unmock('cmd')
  })
})
