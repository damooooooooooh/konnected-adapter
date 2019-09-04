'use strict';

const {Database} = require('gateway-addon');
const KonnectedAdapter = require('./lib/konnected-adapter');

// Scan the serial ports looking for an XBee adapter.
async function loadKonnectedAdapters(addonManager, manifest, errorCallback) {
  let promise;

  // Attempt to move to new config format
  if (Database) {
    const db = new Database(manifest.name);
    promise = db.open().then(() => {
      return db.loadConfig();
    }).then((config) => {
      if (config.hasOwnProperty('discoverAttributes')) {
        delete config.discoverAttributes;
      }

      if (config.hasOwnProperty('scanChannels') &&
          typeof config.scanChannels === 'string') {
        config.scanChannels = parseInt(config.scanChannels, 16);
      }
      allowFTDISerial = config.allowFTDISerial;

      if (config.hasOwnProperty('debug')) {
        console.log(`DEBUG config = '${config.debug}'`);
        require('./zb-debug').set(config.debug);
      }

      manifest.moziot.config = config;
      return db.saveConfig(config);
    });
  } else {
    promise = Promise.resolve();
  }
  await promise;

  const {DEBUG_serialProber} = require('./zb-debug');
  SerialProber.debug(DEBUG_serialProber);
  if (allowFTDISerial) {
    xbeeSerialProber.param.filter.push(XBEE_FTDI_FILTER);
  }
  SerialProber.probeAll(PROBERS).then((matches) => {
    if (matches.length == 0) {
      SerialProber.listAll().then(() => {
        errorCallback(manifest.name, 'No Zigbee dongle found');
      }).catch((err) => {
        errorCallback(manifest.name, err);
      });
      return;
    }
    // We put the driver requires here rather than at the top of
    // the file so that the debug config gets initialized before we
    // import the driver class.
    const XBeeDriver = require('./xbee-driver');
    const DeconzDriver = require('./deconz-driver');
    const driver = {
      [xbeeSerialProber.param.name]: XBeeDriver,
      [deconzSerialProber.param.name]: DeconzDriver,
    };
    for (const match of matches) {
      new driver[match.prober.param.name](addonManager,
                                          manifest,
                                          match.port.comName,
                                          match.serialPort);
    }
  }).catch((err) => {
    errorCallback(manifest.name, err);
  });
}



module.exports = (addonManager, manifest) => {
  const config = manifest.moziot.config;

  new KonnectedAdapter(addonManager, manifest);
};
