// `npm run dist` builds a Windows NSIS installer into release/.
// Set MODSPARK_UPDATE_URL to the folder where you upload releases (latest.yml + installer)
// to bake an update feed into the build; without it, auto-update stays off.
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
  publish: feed ? [{ provider: 'generic', url: feed }] : null,
}
