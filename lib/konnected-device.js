/**
 * Konnected device type.
 */
'use strict';

const {
  Device,
  Event,
} = require('gateway-addon');
const KonnectedProperty = require('./konnected-property');
const KonnectedClassifier = require('./konnected-classifier');

/**
 * Konnected device type.
 */
class KonnectedDevice extends Device {
  /**
   * Initialize the object.
   *
   * @param {Object} adapter - KonnectedAdapter instance
   * @param {String} id - Konnected DeviceId 
   * @param {String} konnectedDeviceType - the type of Konnected Device
   * @param {Object} konnectedBoardType - the Konnected Board Type
   */
  constructor(adapter, id, konnectedDeviceType, konnectedBoardType) {
    super(adapter, id);

    const template = KonnectedClassifier.classify(konnectedDeviceType);
    this.konnectedThingClass = KonnectedClassifier.getKonnectedClass(konnectedDeviceType);
    this.konnectedDeviceType = konnectedDeviceType;

    this.cutoutInterval;

    this.deviceId = id;
    this.name = id;
    this.description = 'Device Description...';
    this.ssdpInterval;
    this.type = template.type;
    this['@context'] = template['@context'];
    this['@type'] = template['@type'];

    for (const prop of template.properties) {
      this.properties.set(
        prop.name,
        new KonnectedProperty(this, prop.name, prop.metadata, prop.value));
    }

    for (const action of template.actions) {
      this.addAction(action.name, action.metadata);
    }

    for (const event of template.events) {
      this.addEvent(event.name, event.metadata);
    }

    this.properties.set(
      'pin',
      new KonnectedProperty(
        this,
        'pin',
        {
          label: (konnectedBoardType === 'Konnected Alarm Panel') ? 'Zone' : 'Pin',
          type: 'string',
          readOnly: true,
        },
        null
      )
    );

    this.properties.set(
      'mac',
      new KonnectedProperty(
        this,
        'mac',
        {
          label: 'Konnected MAC',
          type: 'string',
          readOnly: true,
        },
        null
      )
    );

    this.properties.set(
      'ipaddress',
      new KonnectedProperty(
        this,
        'ipaddress',
        {
          label: 'Konnected IP',
          type: 'string',
          readOnly: true,
        },
        null
      )
    );

    // Add the class specific properties, i,e momentary etc
    if (this.konnectedThingClass === 'ACTUATOR') {
      this.properties.set(
        'momentary',
        new KonnectedProperty(
          this,
          'momentary',
          {
            label: 'Momentary',
            type: 'integer',
            unit: 'minutes',
            minimum: 1,
            maximum: 60,
          },
          null
        )
      );
      this.properties.set(
        'pause',
        new KonnectedProperty(
          this,
          'pause',
          {
            label: 'Pause',
            type: 'integer',
            unit: 'minutes',
            minimum: 1,
            maximum: 60,
          },
          null
        )
      );
      this.properties.set(
        'times',
        new KonnectedProperty(
          this,
          'times',
          {
            label: 'Times',
            type: 'integer',
            unit: 'minutes',
            minimum: -1,
            maximum: 60,
          },
          null
        )
      );      
    }

    this.adapter.handleDeviceAdded(this);
  }

  /**
   * Perform an action.
   *
   * @param {Object} action - Action to perform
   */
  performAction(action) {
    console.log(`Performing action "${action.name}" with input:`, action.input);

    switch (action.name) {
      case 'basic':
        this.eventNotify(new Event(this,
                                   'virtualEvent',
                                   Math.floor(Math.random() * 100)));
        break;
      case 'trigger': {
        return new Promise((resolve, reject) => {
          action.start();
          const prop = this.properties.get('alarm');
          const backupValue = prop.value;
          prop.setCachedValue(true);
          this.notifyPropertyChanged(prop);
          this.adapter.handleDeviceAction(this.id, +true)
            .then(() => {
              this.eventNotify(new Event(this,
                                         'alarmEvent',
                                         'Alarm Triggered!'));
              this.cutoutInterval = setInterval(this.cutOutAlarm,
                                                (this.properties.get('alarmCutout').value * 60 * 1000));
              action.finish();
            })
            .catch((error) => {
              // The update failed raise the alert
              prop.setCachedValue(backupValue);
              this.notifyPropertyChanged(prop);
              this.eventNotify(new Event(this,
                                         'alarmFailure',
                                         error));
              action.status = 'error';
              this.actionNotify(action);
            });
        });
      }
      case 'silence': {
        return new Promise((resolve, reject) => {
          action.start();
          const prop = this.properties.get('alarm');
          const backupValue = prop.value;
          prop.setCachedValue(false);
          this.notifyPropertyChanged(prop);
          this.adapter.handleDeviceAction(this.id, +false)
            .then(() => {
              clearInterval(this.cutoutInterval);
              action.finish();
            })
            .catch((error) => {
              // The update failed raise the alert
              prop.setCachedValue(backupValue);
              this.notifyPropertyChanged(prop);
              this.eventNotify(new Event(this,
                                         'alarmFailure',
                                         error));

              action.status = 'error';
              this.actionNotify(action);
            });
        });
      }
    }
  }

  cutOutAlarm() {
    console.log('Alarm Cutout')
    if (this['@Type'] === 'Alarm') {
    }
  }

  updateDeviceActivity(state) {
    const thingType = KonnectedClassifier.getThingType(this.konnectedDeviceType);
    console.log(thingType, state);
    if (thingType == 'MotionSensor') {
      // Set the Motion Value
      // Value will be boolean
      const prop = this.properties.get('motion');
      prop.setCachedValue(!!state);
      this.notifyPropertyChanged(prop);
    }
  }
}
module.exports = KonnectedDevice;
