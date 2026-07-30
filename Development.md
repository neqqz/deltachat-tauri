# Hints for developers

## Useful Links

- https://tauri.app
- https://tauri.app/start/
- https://docs.rs/tauri/2.2.0/tauri/
- list of all tauri permissions - https://github.com/tauri-apps/tauri/tree/dev/crates/tauri/permissions
- alternative documentation site - https://tauri.by.simon.hyll.nu/backend/uri-scheme-protocol/htmx/

## Update core

Core is not pinned here directly — it follows the `upstream/` submodule, so that
the rust side and the frontend's `@deltachat/jsonrpc-client` always speak the
same protocol version. To update, move the submodule to an upstream release and
let the sync script pull the version through:

```
git -C upstream fetch --tags origin
git -C upstream checkout v<version>
pnpm check:upstream-version --fix
pnpm -C upstream install && pnpm install
```

That writes our `package.json` version, `src-tauri/Cargo.toml` (both the crate
version and the `deltachat` / `deltachat-jsonrpc` git tags) and the `catalog:`
entries in `pnpm-workspace.yaml`. Running `pnpm check:upstream-version` without
`--fix` reports drift instead of fixing it; CI runs it that way.

The weekly `bump-upstream` workflow does the same thing and opens a PR.

### update core manually if there is a dependency issue

Sometimes there are dependency conflicts, if there are you need to edit
`src-tauri/Cargo.toml` manually. Note that `pnpm check:upstream-version` will
then flag it until upstream catches up.

run `cargo update` in `src-tauri`.

## Quirks

- When you edit runtime or frontend code you need to restart the "tauri dev" command, otherwise the changes might not be picked up.

## Differences between devmode and release mode

- in devmode autostart is disabled by default, because the result would be unexpected for developers. In release mode this option is enabled by default.

## How to debug with CodeLLDB on packaged MacOS app

Sometimes you need to test the MacOS app in it's packaged/bundled and signed form,
because some features are only available then (notifications, universal app links).

Requirement is that you have access to a valid signing and provisioning profile (easist way is to do this via the apple developer portal websites).

add this to `bundle_resources/Entitlements.plist`:

```xml
<!-- for debugging, remove again before merging -->
<key>com.apple.security.cs.allow-dyld-environment-variables</key>
<true/>
<key>com.apple.security.cs.allow-insecure-serialization</key>
<true/>
<key>com.apple.security.get-task-allow</key>
<true/>
```

Then build the signed app in debug mode:

```sh
APPLE_SIGNING_IDENTITY=<code sign identity id> pnpm tauri build --debug
```

Then move the app to the `/Applications` folder.

Now you can start the debugging session in vscode/vscodium with the CodeLLDB plugin.
