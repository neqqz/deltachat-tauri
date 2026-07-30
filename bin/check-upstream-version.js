// Keeps this repo aligned with the pinned `upstream/` checkout:
//
// 1. our version == upstream's version (package.json and src-tauri/Cargo.toml)
// 2. the `catalog:` entries we use are the ones upstream resolves them to
//
// Pass --fix to write our version and catalog entries from upstream instead of
// failing. Run after moving the `upstream/` submodule pointer.

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { parse } from 'yaml'

const fix = process.argv.includes('--fix')
const problems = []

if (!existsSync('upstream/package.json')) {
  console.error(
    '❌ upstream/ is empty — run `git submodule update --init` first'
  )
  process.exit(1)
}

const upstreamVersion = JSON.parse(
  readFileSync('upstream/package.json', 'utf8')
).version

// 1. version

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
if (packageJson.version !== upstreamVersion) {
  if (fix) {
    packageJson.version = upstreamVersion
    writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n')
    console.log(`✅ Updated package.json to ${upstreamVersion}`)
  } else {
    problems.push(
      `package.json version: (expected ${upstreamVersion}) (actual ${packageJson.version})`
    )
  }
}

const cargoPath = 'src-tauri/Cargo.toml'
const cargo = readFileSync(cargoPath, 'utf8')
const cargoVersion = /^version = "(.*?)"/m.exec(cargo)[1]
if (cargoVersion !== upstreamVersion) {
  if (fix) {
    writeFileSync(
      cargoPath,
      cargo.replace(/^version = "(.*?)"/m, `version = "${upstreamVersion}"`)
    )
    console.log(`✅ Updated ${cargoPath} to ${upstreamVersion}`)
  } else {
    problems.push(
      `${cargoPath} version: (expected ${upstreamVersion}) (actual ${cargoVersion})`
    )
  }
}

// 2. catalog

const ourWorkspacePath = 'pnpm-workspace.yaml'
const ourWorkspaceRaw = readFileSync(ourWorkspacePath, 'utf8')
const ourCatalog = parse(ourWorkspaceRaw).catalog ?? {}
const upstreamCatalog =
  parse(readFileSync('upstream/pnpm-workspace.yaml', 'utf8')).catalog ?? {}

let patchedWorkspace = ourWorkspaceRaw
for (const [name, ourSpec] of Object.entries(ourCatalog)) {
  const upstreamSpec = upstreamCatalog[name]
  if (upstreamSpec === undefined) {
    problems.push(`catalog entry '${name}' no longer exists upstream`)
  } else if (upstreamSpec !== ourSpec) {
    if (fix) {
      patchedWorkspace = patchedWorkspace.replace(
        new RegExp(`^(\\s*'?${name.replace('/', '\\/')}'?:\\s*).*$`, 'm'),
        `$1${upstreamSpec}`
      )
      console.log(`✅ Updated catalog '${name}' to ${upstreamSpec}`)
    } else {
      problems.push(
        `catalog '${name}': (expected ${upstreamSpec}) (actual ${ourSpec})`
      )
    }
  }
}
if (fix && patchedWorkspace !== ourWorkspaceRaw) {
  writeFileSync(ourWorkspacePath, patchedWorkspace)
}

// 3. deltachat-core
//
// The rust side pulls core straight from git, so it can drift away from the
// version the frontend's `@deltachat/jsonrpc-client` speaks to. That mismatch
// builds fine and only shows up as JSON-RPC errors at runtime.

const coreVersion = upstreamCatalog['@deltachat/jsonrpc-client']
const cargoRaw = readFileSync(cargoPath, 'utf8')
let patchedCargo = cargoRaw

for (const crate of ['deltachat', 'deltachat-jsonrpc']) {
  const line = new RegExp(
    `^(${crate} = \\{.*?tag = ")([^"]*)(".*?version = ")([^"]*)(".*\\})$`,
    'm'
  )
  const match = line.exec(patchedCargo)
  if (match === null) {
    problems.push(`could not find the '${crate}' dependency in ${cargoPath}`)
    continue
  }
  if (match[2] === `v${coreVersion}` && match[4] === coreVersion) {
    continue
  }
  if (fix) {
    patchedCargo = patchedCargo.replace(
      line,
      `$1v${coreVersion}$3${coreVersion}$5`
    )
    console.log(`✅ Updated ${crate} to v${coreVersion}`)
  } else {
    problems.push(
      `${cargoPath} '${crate}': (expected tag v${coreVersion}) (actual tag ${match[2]}, version ${match[4]})`
    )
  }
}

if (fix && patchedCargo !== cargoRaw) {
  writeFileSync(cargoPath, patchedCargo)
}

if (problems.length > 0) {
  console.log(`Out of sync with upstream ${upstreamVersion}:`)
  problems.forEach(p => console.log(`- ${p}`))
  console.log("\n❌ Check failed, run 'pnpm check:upstream-version --fix'")
  process.exit(1)
}

console.log(`✅ In sync with upstream ${upstreamVersion}`)
