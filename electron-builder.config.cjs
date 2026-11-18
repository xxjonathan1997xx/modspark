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
  // Shown on each GitHub Release page; SignPath requires the policy link on download pages.
  releaseInfo: {
    releaseNotes: 'Download the `ModSpark-Setup-*.exe` installer below. Installed copies update automatically.\n\n' +
      '**Code signing policy:** see [README → Code signing policy](https://github.com/xxjonathan1997xx/modspark#code-signing-policy). ' +
      'Releases are currently unsigned while the SignPath Foundation application is pending, so SmartScreen may warn on first run.\n\n' +
      '**Privacy:** see [PRIVACY.md](https://github.com/xxjonathan1997xx/modspark/blob/main/PRIVACY.md).',
  },
  publish: feed
    ? [{ provider: 'generic', url: feed }]
    : [{ provider: 'github', owner: 'xxjonathan1997xx', repo: 'modspark', releaseType: 'release' }],
}
