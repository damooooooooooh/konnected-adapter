/**
 * Konnected adapter for Mozilla WebThings Gateway.
 */
'use strict';

const { Adapter } = require('gateway-addon');
const KonnectedDevice = require('./konnected-device');
const KonnectedDatabase = require('./konnected-database');
const KonnectedClassifier = require('./konnected-classifier');
const ssdp = require('node-ssdp').Client, client = new ssdp();
const express = require('express'), app = new express();
const os = require('os');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const uuid = require('uuidv4').default;

const SSDP_SERVICE = 'urn:schemas-konnected-io:device:Security:1';

/**
 * Adapter for Konnected Alarm devices.
 */
class KonnectedAdapter extends Adapter {
  /**
   * Initialize the object.
   *
   * @param {Object} addonManager - AddonManagerProxy object
   * @param {Object} manifest - Package manifest
   */
  constructor(addonManager, manifest) {
    super(addonManager, manifest.name, manifest.name);
    addonManager.addAdapter(this);

    this.config = manifest.moziot.config;
    this.pairing = false;

    this.ssdpInterval;
    this.ipAddress = this.getIpAddress();
    this.port;

    // client.on('notify', this.handleSSDPNotify);
    client.on('response', this.handleSSDPResponse.bind(this));

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    app.put('/device/:mac/:id', (req, res) => {
      console.log('put mac ', req.body)
      res.status(200).contentType('application/json').send(`${req.params.id}`);
    });

    app.put('/device/:mac', (req, res) => {
      console.log('put mac ', req.body)
      const state = req.body.state;
      const pin = req.body.pin;
      const deviceId = req.params.mac + '|' + pin;
      console.log('put mac ', req.body, state, pin, deviceId);
      res.status(200).contentType('application/json').send(`${req.params.id}`);
    });

    app.get('/ping', function (req, res) {
      console.log('ping ', req.body)
      res.status(200).contentType('application/json').send('')
    })

    app.get('/', function (req, res) {
      res.status(200).contentType('application/json').send('')
    })

    const server = app.listen(0, () => {
      console.log('Listening', server.address().port);
      this.port = server.address().port;

      const db = new KonnectedDatabase(this.packageName);
      db.open().then(() => {
        return db.loadConfig();
      }).then((config) => {
        config.adapter_api_endpoint = `http://${this.ipAddress}/${this.port}`;
        if (!config.adapter_api_token) {
          config.adapter_api_token = uuid();
        }
        this.config = config;
        return db.saveConfig(config);
      }).then(() => {
        this.updateEnabledKonnectedDevices().then(() => {
          console.log('Starting initial SSDP discovery');
          this.ssdpInterval = setInterval(this.scanForKonnectedDevices, 5000);
        });
      }).catch((e) => {
        console.error(`Failed to load update the API settings: ${e}`);
        return null;
        // TODO Need to probably shut the adapter down as the API wont be up to date.
      });
    });
  }

  updateEnabledKonnectedDevices() {
    return new Promise((resolve, reject) => {
      this.config.devices.forEach((device) => {
        let actuators = [];
        let sensors = [];
        let dht_sensors = [];
        let ds18b20_sensors = [];

        if (device.enabled) {
          // Extract the zone/pin settings and classify

          for (const key in KonnectedClassifier.ZONE_ENUM) {
            const zoneEnum = `zone${key}`;
            const konnectedType = device[zoneEnum];
            const zone = KonnectedClassifier.ZONE_ENUM[key];
            const pin = KonnectedClassifier.mapZoneToPin(zone);

            switch (KonnectedClassifier.getKonnectedClass(konnectedType)) {
              case 'ACTUATOR':
                actuators.push({ 'pin': pin });
                break;
              case 'SENSOR':
                sensors.push({ 'pin': pin });
                break;
              case 'DHT_SENSOR':
                dht_sensors.push({ 'pin': pin });
                break;
              case 'DS18b20_SENSOR':
                ds18b20_sensors.push({ 'pin': pin });
                break;
            }
          }
        }

        const data = {
          'sensors': sensors,
          'actuators': actuators,
          'dht_sensors': dht_sensors,
          'ds18b20_sensors': ds18b20_sensors,
          'blink': device.blink,
          'discovery': true,
          'endpoint': this.config.adapter_api_endpoint,
          'token': this.config.adapter_api_token
        }

        fetch(`${device.api_endpoint}/settings`, {
          credentials: 'omit',
          method: 'PUT',
          body: JSON.stringify(data),
          headers: {
            'Content-Type': 'application/json',
          },
        }).then((response) => {
          if (response.status != '200') {
            reject(response.statusText);
          }
        }).then(() => {
          console.log(`${device.mac_address} settings updated. Creating adapter devices.`);

          for (const key in KonnectedClassifier.ZONE_ENUM) {
            const zoneEnum = `zone${key}`;
            const deviceType = device[zoneEnum];
            const zone = KonnectedClassifier.ZONE_ENUM[key];
            const pin = KonnectedClassifier.mapZoneToPin(zone);
            const mac = device.mac_address.replace(/:/g, '');
            const boardType = device.device_type;
            const deviceId = `konnected-${mac}-${pin}`;

            if (device.enabled) {
              if (deviceType) {
                this.addDevice(deviceId, device.mac_address, pin,
                               device.ip_address, deviceType, boardType);
              }
            } else {
              if (this.devices[deviceId]) {
                console.log('removing device ', deviceId);
                this.removeDevice(deviceId);
              }
            }
          }
          resolve();
        }).catch((error) => {
          console.log(error);
          reject(error);
        });
      });
      resolve();
    });
  }

  scanForKonnectedDevices() {
    console.log('scanForKonnectedDevices Got a notification.')
    client.search(SSDP_SERVICE);
  }

  /**
   * Handle the SSDP Client Responses
   *
   *
   * @param {Array} headers TODO
   * @param {String} code TODO.
   * @param {Array} rinfo TODO.
   */
  handleSSDPResponse(headers, code, rinfo) {
    client.stop();
    clearInterval(this.ssdpInterval);

    console.log('SSDP Found konnected device: ', headers);

    // Here we need to find undiscovered
    const konnectedEndpoint = headers.LOCATION.replace('/Device.xml', '');

    this.fetchKonnectedStatus(konnectedEndpoint).then((json) => {
      // Extract the Konnected Device mac
      // and httpEndpoint, and store to the database
      const mac = json.mac;
      const macKey = json.mac.replace(/:/g, '');
      const ip = json.ip;
      const deviceName = `Konnected-${macKey}`;
      const deviceRSSI = json.rssi;

      const db = new KonnectedDatabase(this.packageName);
      db.open().then(async () => {
        const config = await db.loadConfig();

        if (!config.devices) {
          config.devices = [];
        }

        let device = config.devices.some((o) => o.mac_address === mac);
        if (!device) {
          console.log('handleSSDPResponse - adding ', mac,
                      ' to the knownDevices. ',
                      'Complete setup in the adapter settings.');
          device = {
            device_name: deviceName,
            enabled: false,
            mac_address: mac,
            ip_address: ip,
            api_endpoint: konnectedEndpoint,
            blink: true,
            rssi: deviceRSSI,
          };
          config.devices.push(device);
          db.saveConfig(config);
        } else {
          console.log('handleKonnectedSSDPResponse - device ',
                      mac, ' already known');
          // device["ip_address"] = ip;
          // device["api_endpoint"] = konnectedEndpoint;
          // TODO NEED TO UPDATE DEVICES IP IF ITS CHANGED
        }
      }).catch((e) => {
        console.error(`Failed to load pairing data: ${e}`);
        return null;
      });
    });
  }

  fetchKonnectedStatus(httpEndpoint) {
    return fetch(`${httpEndpoint}/status`).then((res) => {
      return res.json();
    });
  }

  /**
   * Find Konnected Board and get konnected device information for pairing
   *
   */
  findKonnectedDevices() {
    client.search(SSDP_SERVICE);
  }

  /**
 * Get the IP Address of the Host
 *
 *
 */
  getIpAddress() {
    const networkInterfaces = os.networkInterfaces();

    for (const name in networkInterfaces) {
      const networkInterface = networkInterfaces[name];

      for (const subInterfaceName in networkInterface) {
        const subInterface = networkInterface[subInterfaceName];

        if (subInterface.family == 'IPv4' && subInterface.internal == false) {
          console.log(`Found ip address ${subInterface.address}`);
          return subInterface.address;
        }
      }
    }

    throw 'No ip address found';
  }

  /**
   * Example process to add a new device to the adapter.
   *
   * The important part is to call: `this.handleDeviceAdded(device)`
   *
   * @param {string} deviceId The Adapter ID
   * @param {String} mac MAC Address of the node MCU
   * @param {String} pin The pin we are adding, not zone!
   * @param {String} ip The current IP Address if of the Node MC we are adding
   * @param {String} deviceType The Konnected Device Type we are adding
   * @param {String} boardType The Konnected Board Type
   * @return {Promise} which resolves to the device added.
   */
  addDevice(deviceId, mac, pin, ip, deviceType, boardType) {
    // Device ID format is konnected-mac-pin
    console.log('addDevice - ', deviceId, mac, pin, ip, deviceType, boardType);

    return new Promise((resolve, reject) => {
      const device = this.devices[deviceId];
      if (device) {
        if (device.properties.has('mac')) {
          const macProp = device.properties.get('mac');
          macProp.setCachedValue(mac);
          device.notifyPropertyChanged(macProp);
        }
        if (device.properties.has('pin')) {
          const pinProp = device.properties.get('pin');
          const pinValue = (boardType === 'Konnected Alarm Panel') ? KonnectedClassifier.mapPinToZone(pin) : pin;
          pinProp.setCachedValue(pinValue);
          device.notifyPropertyChanged(pinProp);
        }
        if (device.properties.has('ipaddress')) {
          const ipProp = device.properties.get('ipaddress');
          ipProp.setCachedValue(ip);
          device.notifyPropertyChanged(ipProp);
        }
      } else {
        const device = new KonnectedDevice(this, deviceId, deviceType, boardType);
        this.handleDeviceAdded(device);

        if (device.properties.has('mac')) {
          const macProp = device.properties.get('mac');
          macProp.setCachedValue(mac);
          device.notifyPropertyChanged(macProp);
        }
        if (device.properties.has('pin')) {
          const pinProp = device.properties.get('pin');
          const pinValue = (boardType === 'Konnected Alarm Panel') ? KonnectedClassifier.mapPinToZone(pin) : pin;
          pinProp.setCachedValue(pinValue);
          device.notifyPropertyChanged(pinProp);
        }
        if (device.properties.has('ipaddress')) {
          const ipProp = device.properties.get('ipaddress');
          ipProp.setCachedValue(ip);
          device.notifyPropertyChanged(ipProp);
        }

        resolve(device);
      }
    });
  }

  /**
   * Example process TO remove a device from the adapter.
   *
   * The important part is to call: `this.handleDeviceRemoved(device)`
   *
   * @param {String} deviceId ID of the device to .
   * @return {Promise} which resolves to the device removed.
   */
  removeDevice(deviceId) {
    console.log('konnected - removeDevice - ', deviceId);
    return new Promise((resolve, reject) => {
      const device = this.devices[deviceId];
      if (device) {
        this.handleDeviceRemoved(device);
        resolve(device);
      } else {
        reject(`Device: ${deviceId} not found.`);
      }
    });
  }

  /**
   * Clean up before shutting down this adapter.
   *
   * @returns {Promise} Promise which resolves when finished unloading.
   */
  unload() {
    clearTimeout(this.ssdpInterval);
    return super.unload();
  }

  /**
   * Start the pairing/discovery process.
   *
   * @param {Number} timeoutSeconds Number of seconds to run before timeout
   */
  startPairing(_timeoutSeconds) {
    console.log(this.name,
                'id', this.id, 'pairing started');

    this.pairing = true;
    // this.ssdpInterval = setInterval(this.findKonnectedDevices, 5000);

    // this.processDevices();
  }

  /**
   * Cancel the pairing/discovery process.
   */
  cancelPairing() {
    console.log(this.name, 'id', this.id,
                'pairing cancelled');
    this.pairing = true;
    clearInterval(this.ssdpInterval);
  }

  /**
   * Unpair the provided the device from the adapter.
   *
   * @param {Object} device Device to unpair with
   */
  removeThing(device) {
    console.log(this.name, 'id', this.id,
                'removeThing(', device.id, ') started');

    this.removeDevice(device.id).then(() => {
      console.log('KonnectedAdapter: device:', device.id, 'was unpaired.');
    }).catch((err) => {
      console.error('KonnectedDeviceAdapter: unpairing', device.id, 'failed');
      console.error(err);
    });
  }

  /**
   * Cancel unpairing process.
   *
   * @param {Object} device Device that is currently being paired
   */
  cancelRemoveThing(device) {
    console.log(this.name, 'id', this.id,
                'cancelRemoveThing(', device.id, ')');
    this.pairing = false;
  }

  handleDeviceAction(deviceId, value) {
    return new Promise((resolve, reject) => {
      const mac = deviceId.split('-')[1];
      const pin = deviceId.split('-')[2];
      this.setKonnectedDevicePin(mac, pin, value)
        .then((result) => {
          resolve();
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  setKonnectedDevicePin(mac, pin, value) {
    return new Promise((resolve, reject) => {
      const device = this.config.devices.find((o) => o.mac_address.replace(/:/g, '') === mac);
      const api_endpoint = `${device.api_endpoint}/device?pin=${pin}`;
      const data = [{ 'state': value, 'pin': pin }];

      fetch(api_endpoint, {
        credentials: 'omit',
        method: 'PUT',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json',
        },
      }).then((response) => {
        if (response.status != '200') {
          reject(response.status + response.statusText);
        } else {
          resolve(response.status);
        }
      }).catch((error) => {
        reject(error);
      });
    });
  }
}
module.exports = KonnectedAdapter;
