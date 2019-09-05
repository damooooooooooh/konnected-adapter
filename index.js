'use strict';

const KonnectedAdapter = require('./lib/konnected-adapter');

module.exports = (addonManager, manifest) => {
  const config = manifest.moziot.config;

  // TODO VALIDATION OF CONFIG
  new KonnectedAdapter(addonManager, manifest);
};
