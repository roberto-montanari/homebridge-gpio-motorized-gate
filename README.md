# homebridge-gpio-motorized-gate
Homebridge plugin to control motorized gates and garagedoors via Raspberry Pi GPIO pins.

## Disclaimer
This Homebidge plugin is an unofficial fork of [homebridge-rasppi-gpio-garagedoor](https://github.com/benlamonica/homebridge-rasppi-gpio-garagedoor) modified for my personal use, all credit goes to [benlamonica](https://github.com/benlamonica).

## Circuit
![Schematic](https://github.com/roberto-montanari/homebridge-gpio-motorized-gate/blob/master/images/circuit.png?raw=true)

## Installation

Install this plugin using: 
```
sudo npm install -g homebridge-gpio-motorized-gate --unsafe-perm
```


## Configuration

You will need to add the following accessory configuration to the Homebridge [config.json](https://github.com/nfarina/homebridge/blob/master/config-sample.json).

Configuration sample:

```JSON
{
    "bridge": {
        "name": "Raspberry Pi 2",
        "username": "CC:22:3D:E3:CE:32",
        "port": 51826,
        "pin": "031-45-154"
    },

    "accessories": [
        {
            "accessory": "MotorizedGate",
            "name": "Cancello",
            "doorSwitchPin": 13,
            "doorSwitchPressTimeInMs": 1000,
            "doorSwitchValue": 1,
            "closedDoorSensorPin": 16,
            "closedDoorSensorValue": 0,
            "doorPollInMs": 4000,
            "doorOpensInSeconds": 18
        }

    ],

    "platforms": []
}

```

Fields: 

* name - Can be anything (required).
* doorSwitchPin - The physical GPIO pin number that controls the relay to trigger the gate.
* doorSwitchPressTimeInMs - number of milliseconds to trigger the gate button. Defaults to 1000 millseconds (1 second) if not specified.
* doorSwitchValue - 1 = ACTIVE_HIGH, 0 = ACTIVE_LOW, defaults to 1 if not specified. Set to 0 if you have a relay that requires the signal to be 0v to trigger.
* closedDoorSensorPin - The physical GPIO pin that senses if the gate is closed, do not specify if no sensor present.
* closedDoorSensorValue - 1 = ACTIVE_HIGH, 0 = ACTIVE_LOW, defaults to 1 if not specified.
* doorPollInMs - Number of milliseconds to wait before polling the doorSensorPin to report if the gate is open or closed.
* doorOpensInSeconds - Number of seconds it takes your gate to open or close (err on the side of being longer than it actually takes).
