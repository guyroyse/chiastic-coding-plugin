#!/usr/bin/env node

const { execSync } = require('child_process')
const { parseArgs } = require('util')

main()

function main() {
  const { behavior, maxCycles } = parseArguments()

  console.log()
  console.log(`=== task pairing ===`)
  console.log('behavior:', behavior)
  console.log('max cycles:', maxCycles)
  console.log()

  const roles = createInitialRoles()

  let commitCount = 0
  let cycle = 1

  while (true) {
    // if we've exceeded the max cycles, report and exit before starting the next cycle
    if (cycle > maxCycles) reportMaxCycles(behavior, commitCount, maxCycles)

    // rotate roles each cycle to give everyone a chance at each role
    if (cycle > 1) swapRoles(roles)

    try {
      const cycleResult = processCycle(cycle, roles, behavior)
      commitCount += cycleResult.commits
      if (cycleResult.status === 'complete') break
    } catch (err) {
      reportError(behavior, commitCount, err.message)
    }

    cycle++
  }

  try {
    squashCommits(commitCount, `feat: ${behavior}`)
  } catch (err) {
    reportError(behavior, commitCount, err.message)
  }

  reportComplete(behavior, commitCount)
}

function parseArguments() {
  const { values } = parseArgs({
    options: {
      behavior: { type: 'string' },
      maxCycles: { type: 'number' }
    }
  })

  const behavior = values.behavior
  const maxCycles = values.maxCycles ?? 5

  if (!behavior) {
    console.error('Usage: pair.js --behavior <description>')
    process.exit(1)
  }

  return { behavior, maxCycles }
}

function createInitialRoles() {
  const alice = { name: 'Alice', sessionId: null }
  const bob = { name: 'Bob', sessionId: null }
  return { testWriter: alice, implementer: bob, refactorer: alice }
}

function swapRoles(roles) {
  const { testWriter, implementer, refactorer } = roles
  roles.testWriter = implementer
  roles.implementer = refactorer
  roles.refactorer = testWriter
}

function processCycle(cycle, roles, behavior) {
  const { testWriter, implementer, refactorer } = roles

  console.log(`--- cycle ${cycle} ---`)
  console.log('test writer:', testWriter.name)
  console.log('implementer:', implementer.name)
  console.log('refactorer:', refactorer.name)
  console.log()

  let commits = 0

  const red = processRed(testWriter, behavior)
  if (red.status === 'complete') return { commits, status: 'complete' }
  if (red.committed) commits++

  const green = processGreen(implementer)
  if (green.committed) commits++

  const refactor = processRefactor(refactorer)
  if (refactor.committed) commits++

  return { commits, status: 'continue' }
}

function reportMaxCycles(behavior, commits, maxCycles) {
  console.log()
  console.log(`max cycles (${maxCycles}) reached.`)
  console.log(JSON.stringify({ behavior, status: 'max-cycles', commits, error: null }))
  process.exit(1)
}

function reportError(behavior, commits, error) {
  console.log()
  console.error(`pair session failed: ${error}`)
  console.log(JSON.stringify({ behavior, status: 'error', commits, error }))
  process.exit(1)
}

function reportComplete(behavior, commits) {
  console.log()
  console.log('pair session complete.')
  console.log(JSON.stringify({ behavior, status: 'complete', commits, error: null }))
}

function processRed(agent, behavior) {
  console.log('[red]', agent.name, 'writing tests...')

  const prompt = agent.sessionId ? continueWritingTests(behavior) : startWritingTests(agent, behavior)
  const response = invokeAgent(agent, prompt)

  console.log('[red]', `${agent.name}:`, response.summary)

  const committed = response.status !== 'complete' && gitCommit('red', agent.name, response.summary)

  return { ...response, committed }
}

function processGreen(agent) {
  console.log('[green]', agent.name, 'implementing...')

  const prompt = agent.sessionId ? makeTestsPass() : startMakingTestsPass(agent)
  const response = invokeAgent(agent, prompt)

  console.log('[green]', `${agent.name}:`, response.summary)

  const committed = gitCommit('green', agent.name, response.summary)

  return { ...response, committed }
}

function processRefactor(agent) {
  console.log('[refactor]', agent.name, 'refactoring...')

  const prompt = reviewAndRefactor()
  const response = invokeAgent(agent, prompt)

  console.log('[refactor]', `${agent.name}:`, response.summary)

  const committed = gitCommit('refactor', agent.name, response.summary)

  return { ...response, committed }
}

function invokeAgent(agent, prompt) {
  // construct the command with appropriate arguments
  const resumeArg = agent.sessionId ? `--resume ${shellQuote(agent.sessionId)}` : ''
  const promptArg = `-p ${shellQuote(prompt)}`
  const outputFormatArg = '--output-format json'
  const permissionModeArg = '--permission-mode bypassPermissions'
  const maxTurnsArg = '--max-turns 25'
  const command = `claude ${resumeArg} ${promptArg} ${outputFormatArg} ${permissionModeArg} ${maxTurnsArg}`

  // set a larger buffer and timeout to accommodate longer conversations
  const maxBuffer = 10 * 1024 * 1024 // 10 MB
  const timeout = 10 * 60 * 1000 // 10 minutes
  const execOptions = { encoding: 'utf-8', maxBuffer, timeout }

  // execute the command and parse the JSON result
  const rawResults = execSync(command, execOptions)
  const jsonResult = JSON.parse(rawResults)
  const { session_id, result } = jsonResult

  // update the agent's session ID for future turns
  agent.sessionId = session_id

  // look for JSON objects in the text that contains a "status" field
  const matchJsonWithStatus = /\{[^{}]*"status"\s*:\s*"(complete|continue)"[^{}]*\}/g
  const text = result ?? ''
  const matches = [...text.matchAll(matchJsonWithStatus)]

  // if no matches are found, throw an error
  if (matches.length === 0) throw new Error('agent did not return a status response')

  // parse the last match as JSON and return it
  const last = matches[matches.length - 1]
  const json = JSON.parse(last[0])
  return json
}

function gitCommit(phase, agentName, message) {
  // stage all the changes
  execSync('git add -A', { encoding: 'utf-8' })

  // check if there are any staged changes to commit
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim()
  if (!status) {
    console.log(`no changes to commit for ${phase}`)
    return false
  }

  // commit the changes with a message that includes the phase and agent name
  const commitMsg = `[${phase}] ${agentName}: ${message}`
  execSync(`git commit -m ${shellQuote(commitMsg)}`, { encoding: 'utf-8' })

  console.log(`  committed: ${commitMsg}`)

  return true
}

function squashCommits(commitCount, message) {
  if (commitCount <= 1) return
  execSync(`git reset --soft HEAD~${commitCount}`, { encoding: 'utf-8' })
  execSync(`git commit -m ${shellQuote(message)}`, { encoding: 'utf-8' })
  console.log(`squashed ${commitCount} commits: ${message}`)
}

function shellQuote(str) {
  return `'${str.replace(/'/g, "'\\''")}'`
}

function pairIntro(agent) {
  return `Use the chiastic-task-pair skill to understand how you work. Your name is ${agent.name}.`
}

function startWritingTests(agent, behavior) {
  return `${pairIntro(agent)} Use the chiastic-task-pair-test-writer skill. The behavior to specify: ${behavior}. Write failing tests for this behavior.`
}

function continueWritingTests(behavior) {
  return `Use the chiastic-task-pair-test-writer skill. Continue specifying the behavior: ${behavior}. Review what's already tested and implemented, then write the next failing test(s) if any remain. If the behavior is fully covered, signal complete.`
}

function startMakingTestsPass(agent) {
  return `${pairIntro(agent)} Use the chiastic-task-pair-implementer skill. Make the failing tests pass. Look at the recent changes to understand what tests were added.`
}

function makeTestsPass() {
  return `Use the chiastic-task-pair-implementer skill. Make the failing tests pass. Look at the recent changes to understand what tests were added.`
}

function reviewAndRefactor() {
  return `Use the chiastic-task-pair-refactorer skill. Review the current implementation and tests. Refactor if improvements are warranted, otherwise move on.`
}
