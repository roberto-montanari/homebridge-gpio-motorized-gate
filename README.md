# homebridge-gpio-motorized-gate

![npm version](https://img.shields.io/npm/v/homebridge-gpio-electric-rim-lock)
![license](https://img.shields.io/npm/l/homebridge-gpio-electric-rim-lock)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red)

Homebridge plugin to control **automatic gates** and **garage doors** using Raspberry Pi GPIO pins.
This plugin allows you to open automatic gates or garage doors from **Apple HomeKit** by triggering a relay connected to a Raspberry Pi.


## Disclaimer

This Homebidge plugin is an unofficial fork of [homebridge-rasppi-gpio-garagedoor](https://github.com/benlamonica/homebridge-rasppi-gpio-garagedoor) modified for my personal use, all credit goes to [benlamonica](https://github.com/benlamonica).


## Compatibility

This plugin is designed to run **only on Raspberry Pi hardware** because it uses the `rpio` library to access GPIO pins.

⚠️ The plugin **will not work on**:

- non-Raspberry Pi Linux systems
- virtual machines
- Docker containers without GPIO access


## Hardware Setup

This plugin assumes that the Raspberry Pi controls an **automatic gate or garage door via a relay module**.

Automatic gates typically provide a **low-voltage control input** (often labeled START, STEP-BY-STEP, or PP) that is triggered by briefly closing a circuit.  
This input is commonly designed for a wall-mounted push button and operates as a **dry contact (no external voltage required)**, although some systems may use **12–24V AC/DC signaling**.

The Raspberry Pi **must not be connected directly to the gate control terminals**, as this could damage both the Pi and the control board.
Instead, a **relay module with dry contact output** should be used to safely emulate the button press.

When HomeKit sends the open command:

1. the GPIO pin activates the relay
2. the relay closes the circuit
3. the gate control unit detects the input as a button press
4. the gate starts its cycle (**open / close**, depending on its current state)
5. the relay is released after the configured delay


## Optional sensors (open/closed state)

For improved state detection, the system can optionally use position sensors to monitor whether the gate is fully open or fully closed.

This is typically done using magnetic reed switches, which act as dry contact sensors:

* a **closed sensor** detects when the gate is fully closed
* an **open sensor** detects when the gate is fully open

Each sensor is connected between the **3.3V supply** and a GPIO input pin on the Raspberry Pi, with a **10kΩ pull-down resistor** between the GPIO pin and GND.

In this configuration:

* when the reed switch is **open**, the GPIO is pulled **LOW** by the resistor
* when the reed switch is **closed** (magnet present), the GPIO is driven **HIGH (3.3V)**

This allows the software to reliably detect the gate position.

This setup enables:

* accurate status reporting in HomeKit
* detection of incomplete movements or obstructions
* better synchronization between the physical gate and the software state

If no sensors are installed, the system will rely on **timing-based estimation**, which is less reliable but still functional.


## Circuit Diagram

<img width="930" height="460" alt="schematic" src="https://github.com/user-attachments/assets/65839c8a-dbca-4b88-898a-251d7e605016" />


## Installation

### Install via Homebridge UI (Recommended)

1. Open the **Homebridge UI**
2. Navigate to **Plugins**
3. Search for: ``` homebridge-gpio-motorized-gate ```
4. Click **Install**

### Install via npm

```
npm install -g homebridge-gpio-motorized-gate
```

Restart **Homebridge** after installation.


## Configuration

### Using the Homebridge UI

The plugin includes a configuration interface.

Navigate to: Plugins → **Homebridge GPIO Motorized Gate** → Settings

### Manual Configuration

Add the following to your Homebridge `config.json`.

Example:

```json
{
    "accessories": [
        {
            "accessory": "MotorizedGate",
            "name": "Front Gate",
            "doorSwitchPin": 13,
            "doorSwitchPressTimeInMs": 500,
            "doorSwitchValue": 1,
            "closedDoorSensorPin": 16,
            "closedDoorSensorValue": 1,
            "openDoorSensorPin": 18,
            "openDoorSensorValue": 1,
            "doorPollInMs": 1000,
            "doorOpensInSeconds": 25
        }

    ]
}

```


## Configuration Options

| Field | Required | Description |
|------|------|------|
| `name` | yes | Name of the gate or garage door shown in HomeKit |
| `doorSwitchPin` | yes | Physical GPIO pin connected to the relay (recommended 11, 12, 13 or 15)|
| `doorSwitchPressTimeInMs` | no | Relay activation time in milliseconds (from 100 to 2000, default **500 ms**) |
| `doorSwitchValue` | no | Relay trigger logic: **1 = ACTIVE HIGH**, **0 = ACTIVE LOW** (default **1**) |
| `closedDoorSensorPin` | no | GPIO pin connected to the **closed position sensor** (recommended 16, 18 or 22) |
| `closedDoorSensorValue` | no | Sensor logic: **1 = ACTIVE HIGH**, **0 = ACTIVE LOW** (default **1**) |
| `openDoorSensorPin` | no | GPIO pin connected to the **open position sensor** (recommended 16, 18 or 22) |
| `openDoorSensorValue` | no | Sensor logic: **1 = ACTIVE HIGH**, **0 = ACTIVE LOW** (default **1**) |
| `doorPollInMs` | no | Interval in milliseconds to poll sensors for gate state updates (default **2000 ms**)|
| `doorOpensInSeconds` | no | Time in seconds for the gate to fully open/close (set slightly higher than actual time, default **25 s**) |


## Troubleshooting

### Plugin does not start

Make sure Homebridge is running on a **Raspberry Pi**.

You can verify this with:

```
cat /proc/cpuinfo
```

### Relay does not trigger

Check:

- correct GPIO **pin number**
- relay module **power supply**
- GPIO permissions

### GPIO permission errors

Run Homebridge with appropriate permissions or add the user to the `gpio` group.

Example:

```
sudo usermod -aG gpio homebridge
```

Restart the system after changing group permissions.


## Safety Notice

This plugin controls **physical gate locks**.

Always ensure:

- your wiring is correct  
- relay modules are properly isolated  
- the gate can still be operated manually in case of failure  
- all safety devices (photocells, stop circuits, etc.) are working correctly 

The author is **not responsible for damage or security issues** caused by improper installation.
