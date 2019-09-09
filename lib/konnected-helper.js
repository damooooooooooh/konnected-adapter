'use strict';

const os = require('os');

class KonnectedHelper {

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
}
module.exports = new KonnectedHelper()