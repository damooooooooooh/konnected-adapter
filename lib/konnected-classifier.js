'use strict';

const KONNECTED_TYPE_MAP = {
  'Siren/Strobe': 'ACTUATOR',
  'Switch': 'ACTUATOR',
  'Momentary Switch': 'ACTUATOR',
  'Beep/Blink': 'ACTUATOR',
  'Open/Close Sensor': 'SENSOR',
  'Motion Sensor': 'SENSOR',
  'Smoke Detector': 'SENSOR',
  'Carbon Monoxide Detector': 'SENSOR',
  'Panic Button': 'SENSOR',
  'Water Sensor': 'SENSOR',
  'Temperature & Humidity Sensor': 'DHT_SENSOR',
  'Temperature Probe(s)': 'DS18b20_SENSOR',
};

const KONNECTED_THING_MAP = {
  'Siren/Strobe': 'Alarm',
  'Switch': 'OnOffSwitch',
  'Momentary Switch': 'MultiLevelSwitch',
  'Beep/Blink': 'BinarySensor',
  'Open/Close Sensor': 'DoorSensor',
  'Motion Sensor': 'MotionSensor',
  'Smoke Detector': 'Alarm',
  'Carbon Monoxide Detector': 'Alarm',
  'Panic Button': 'PushButton',
  'Water Sensor': 'LeakSensor',
  'Temperature & Humidity Sensor': 'TemperatureSensor',
  'Temperature Probe(s)': 'TemperatureSensor',
};

const ZONE_ENUM = {
  1: '1',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: 'ALARM/OUT',
};

const ZONE_TO_PIN = {1: 1, 2: 2, 3: 5, 4: 6, 5: 7, 6: 9, 'ALARM/OUT': 8};
const PIN_TO_ZONE = {1: 1, 2: 2, 5: 3, 6: 4, 7: 5, 9: 6, 8: 'ALARM/OUT'};

function bool() {
  return {
    name: 'on',
    value: false,
    metadata: {
      title: 'On/Off',
      type: 'boolean',
      '@type': 'BooleanProperty',
      readOnly: true,
    },
  };
}

function on() {
  return {
    name: 'on',
    value: false,
    metadata: {
      title: 'On/Off',
      type: 'boolean',
      '@type': 'OnOffProperty',
    },
  };
}

function level(readOnly) {
  return {
    name: 'level',
    value: 0,
    metadata: {
      title: 'Level',
      type: 'number',
      '@type': 'LevelProperty',
      unit: 'percent',
      minimum: 0,
      maximum: 100,
      readOnly,
    },
  };
}

const Alarm = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['Alarm'],
  name: 'Konnected Alarm',
  properties: [
    {
      name: 'alarm',
      value: false,
      metadata: {
        title: 'Alarm',
        type: 'boolean',
        '@type': 'AlarmProperty',
      },
    },
    {
      name: 'alarmCutout',
      value: 1,
      metadata: {
        title: 'Alarm Cutout',
        type: 'integer',
        '@type': 'LevelProperty',
        unit: 'minutes',
        minimum: 1,
        maximum: 60,
      },
    },    
  ],
  actions: [
    {
      name: 'trigger',
      metadata: {
        title: 'Trigger',
        description: 'Trigger alarm',
      },
    },
    {
      name: 'silence',
      metadata: {
        title: 'Silence',
        description: 'Silence alarm',
      },
    },
  ],
  events: [
    {
      name: 'alarmEvent',
      metadata: {
        description: 'An alarm event was triggered!',
        type: 'string',
        '@type': 'AlarmEvent',
        readOnly: true,
      },
    },
    {
      name: 'alarmFailure',
      metadata: {
        description: 'An alarm event failed to trigger!',
        type: 'string',
        '@type': 'AlarmFailure',
        readOnly: true,
      },
    },
    {
      name: 'alarmCutout',
      metadata: {
        description: 'Alarm Cutout duration was met',
        type: 'string',
        '@type': 'AlarmCutout',
        readOnly: true,
      },
    },      
  ],
};

const MultiLevelSwitch = {
  type: 'multiLevelSwitch',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch', 'MultiLevelSwitch'],
  name: 'Virtual Multi-level Switch',
  properties: [
    level(false),
    on(),
  ],
  actions: [],
  events: [],
};

const OnOffSwitch = {
  type: 'onOffSwitch',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['OnOffSwitch'],
  name: 'Virtual On/Off Switch',
  properties: [
    on(),
  ],
  actions: [    
    {
      name: 'trigger',
      metadata: {
        title: 'Trigger',
        description: 'Trigger alarm',
      },
    }
  ],
  events: [],
};

const BinarySensor = {
  type: 'binarySensor',
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['BinarySensor'],
  name: 'Virtual Binary Sensor',
  properties: [
    bool(),
  ],
  actions: [],
  events: [],
};

const DoorSensor = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['DoorSensor'],
  name: 'Virtual Door Sensor',
  properties: [
    {
      name: 'open',
      value: false,
      metadata: {
        title: 'Open',
        type: 'boolean',
        '@type': 'OpenProperty',
        readOnly: true,
      },
    },
  ],
  actions: [],
  events: [],
};

const MotionSensor = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['MotionSensor'],
  name: 'Virtual Motion Sensor',
  properties: [
    {
      name: 'motion',
      value: false,
      metadata: {
        title: 'Motion',
        type: 'boolean',
        '@type': 'MotionProperty',
        readOnly: true,
      },
    },
  ],
  actions: [],
  events: [],
};

const LeakSensor = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['LeakSensor'],
  name: 'Virtual Leak Sensor',
  properties: [
    {
      name: 'leak',
      value: false,
      metadata: {
        title: 'Leak',
        type: 'boolean',
        '@type': 'LeakProperty',
        readOnly: true,
      },
    },
  ],
  actions: [],
  events: [],
};

const TemperatureSensor = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['TemperatureSensor'],
  name: 'Virtual Temperature Sensor',
  properties: [
    {
      name: 'temperature',
      value: 20,
      metadata: {
        title: 'Temperature',
        type: 'number',
        '@type': 'TemperatureProperty',
        unit: 'degree celsius',
        minimum: -20,
        maximum: 50,
        readOnly: true,
      },
    },
  ],
  actions: [],
  events: [],
};

const PushButton = {
  '@context': 'https://iot.mozilla.org/schemas',
  '@type': ['PushButton'],
  name: 'Virtual Push Button',
  properties: [
    {
      name: 'pushed',
      value: false,
      metadata: {
        title: 'Pushed',
        type: 'boolean',
        '@type': 'PushedProperty',
        readOnly: true,
      },
    },
  ],
  actions: [],
  events: [],
};

class KonnectedClassifier {

  getThingType(konnectedType) {
    return KONNECTED_THING_MAP[konnectedType];
  }

  getKonnectedClass(konnectedType) {
    return KONNECTED_TYPE_MAP[konnectedType];
  }

  mapZoneToPin(zone) {
    return ZONE_TO_PIN[zone];
  }

  mapPinToZone(pin) {
    return PIN_TO_ZONE[pin];
  }

  classify(konnectedType) {
    switch (konnectedType) {
      case 'Siren/Strobe':
        return Alarm;
      case 'Switch':
        return OnOffSwitch;
      case 'Momentary Switch':
        return MultiLevelSwitch;
      case 'Beep/Blink':
        return BinarySensor;
      case 'Open/Close Sensor':
        return DoorSensor;
      case 'Motion Sensor':
        return MotionSensor;
      case 'Smoke Detector':
        return Alarm;
      case 'Carbon Monoxide Detector':
        return Alarm;
      case 'Panic Button':
        return PushButton;
      case 'Water Sensor':
        return LeakSensor;
      case 'Temperature & Humidity Sensor':
        return TemperatureSensor;
      case 'Temperature Probe(s)':
        return TemperatureSensor;
    }
  }
} 
module.exports = new KonnectedClassifier();
module.exports.ZONE_ENUM = ZONE_ENUM;
