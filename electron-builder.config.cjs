// `npm run dist` builds a Windows NSIS installer into release/ without publishing.
// `npm run release` (run by .github/workflows/release.yml on a v* tag) also uploads it to
// GitHub Releases. Installed copies auto-update from those releases.
// MODSPARK_UPDATE_URL overrides the feed with a generic host (a folder holding latest.yml + installer).
// Set CSC_LINK / CSC_KEY_PASSWORD (a code-signing certificate) to sign; unsigned builds
// work but Windows SmartScreen will warn users.
const feed = process.env.MODSPARK_UPDATE_URL

module.exports = {
  appId: 'dev.modspark.app',
  productName: 'ModSpark',
  directories: { output: 'release', buildResources: 'build' },
  files: ['dist/**', 'electron/**', 'package.json', 'LICENSE'],
  win: { target: [{ target: 'nsis', arch: ['x64'] }], icon: 'build/icon.ico' },
  nsis: { oneClick: false, perMachine: false, allowToChangeInstallationDirectory: true, deleteAppDataOnUninstall: false },
  publish: feed
    ? [{ provider: 'generic', url: feed }]
    : [{ provider: 'github', owner: 'xxjonathan1997xx', repo: 'modspark', releaseType: 'release' }],
}
