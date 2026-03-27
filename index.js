"use strict";

var rpio = require("rpio");
var fs = require("fs");

var Service, Characteristic, DoorState;
let cpuInfoCache = "";
try { cpuInfoCache = fs.readFileSync("/proc/cpuinfo", "utf8"); } catch {}

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    DoorState = homebridge.hap.Characteristic.CurrentDoorState;
    homebridge.registerAccessory("homebridge-gpio-motorized-gate", "MotorizedGate", MotorizedGateAccessory);
};

function getSerial() {
    try {
        const line = cpuInfoCache.split("\n").find(l => l.startsWith("Serial"));
        return line ? line.split(":")[1].trim() : "UNKNOWN";
    } catch { return "UNKNOWN"; }
}

function getVal(config, key, def) { return config[key] == null ? def : config[key]; }

function MotorizedGateAccessory(log, config) {
    this.log = log;
    this.version = require("./package.json").version;

    this.name = config.name;
    this.doorSwitchPin = config.doorSwitchPin;
    this.relayOn = getVal(config, "doorSwitchValue", 1);
    this.relayOff = 1 - this.relayOn;

    this.closedDoorSensorPin = config.closedDoorSensorPin;
    this.closedDoorSensorValue = getVal(config, "closedDoorSensorValue", 1);

    this.openDoorSensorPin = config.openDoorSensorPin;
    this.openDoorSensorValue = getVal(config, "openDoorSensorValue", 1);

    this.doorSwitchPressTimeInMs = getVal(config, "doorSwitchPressTimeInMs", 500);
    this.sensorPollInMs = getVal(config, "doorPollInMs", 2000);
    this.doorOpensInSeconds = getVal(config, "doorOpensInSeconds", 25);

    if (!this.name || this.doorSwitchPin == null) {
        this.log.warn("⚠ MotorizedGateAccessory not configured correctly: name or doorSwitchPin missing. Plugin disabled.");
        this.disabled = true;
        return;
    }

    if (!/Raspberry Pi/i.test(cpuInfoCache)) this.log.warn("⚠ This plugin is intended for Raspberry Pi. Some features may not work.");

    this.log("MotorizedGateAccessory version: " + this.version);
    this.log("Door Switch Pin: " + this.doorSwitchPin);
    this.log("Door Switch Val: " + (this.relayOn == 1 ? "ACTIVE_HIGH" : "ACTIVE_LOW"));
    this.log("Door Switch Active Time in ms: " + this.doorSwitchPressTimeInMs);

    if (this.hasClosedSensor()) {
        this.log("Door Closed Sensor: Configured");
        this.log("Door Closed Sensor Pin: " + this.closedDoorSensorPin);
        this.log("Door Closed Sensor Val: " + (this.closedDoorSensorValue == 1 ? "ACTIVE_HIGH" : "ACTIVE_LOW"));
    } else this.log("Door Closed Sensor: Not Configured");

    if (this.hasOpenSensor()) {
        this.log("Door Open Sensor: Configured");
        this.log("Door Open Sensor Pin: " + this.openDoorSensorPin);
        this.log("Door Open Sensor Val: " + (this.openDoorSensorValue == 1 ? "ACTIVE_HIGH" : "ACTIVE_LOW"));
    } else this.log("Door Open Sensor: Not Configured");

    if (!this.hasClosedSensor() && !this.hasOpenSensor()) this.log("NOTE: Neither Open nor Closed sensor is configured. Will rely on last known state.");

    this.log("Sensor Poll in ms: " + this.sensorPollInMs);
    this.log("Door Opens in seconds: " + this.doorOpensInSeconds);

    this.initService();
}

MotorizedGateAccessory.prototype = {

    initPin: function(pin, mode, initialValue) {
        try {
            if (mode === rpio.OUTPUT) rpio.open(pin, mode, initialValue);
            else rpio.open(pin, mode);
        } catch (err) {
            this.log.error("GPIO init failed on pin " + pin + ": " + err.message);
            this.disabled = true;
            throw err;
        }
    },

    hasOpenSensor: function() { return this.openDoorSensorPin != null; },
    hasClosedSensor: function() { return this.closedDoorSensorPin != null; },

    readPin: function(pin) { return rpio.read(pin); },
    writePin: function(pin, val) { rpio.write(pin, val); },

    initService: function() {
        if (this.disabled) return;
        try {
            this.initPin(this.doorSwitchPin, rpio.OUTPUT, this.relayOff);
            if (this.hasClosedSensor()) this.initPin(this.closedDoorSensorPin, rpio.INPUT);
            if (this.hasOpenSensor()) this.initPin(this.openDoorSensorPin, rpio.INPUT);
        } catch { this.disabled = true; return; }

        this.garageDoorOpener = new Service.GarageDoorOpener(this.name, this.name);
        this.currentDoorState = this.garageDoorOpener.getCharacteristic(DoorState);
        this.currentDoorState.on("get", this.getState.bind(this));

        this.targetDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.TargetDoorState);
        this.targetDoorState.on("set", this.setState.bind(this));
        this.targetDoorState.on("get", this.getTargetState.bind(this));

        this.obstructionDetected = this.garageDoorOpener.getCharacteristic(Characteristic.ObstructionDetected);
        this.obstructionDetected.setValue(false);

        const isClosed = this.isClosed();
        this.targetState = isClosed ? DoorState.CLOSED : DoorState.OPEN;
        this.wasClosed = isClosed;
        this.operating = false;

        this.currentDoorState.setValue(this.targetState);
        this.targetDoorState.setValue(this.targetState);

        this.infoService = new Service.AccessoryInformation()
            .setCharacteristic(Characteristic.Manufacturer, "Roberto Montanari")
            .setCharacteristic(Characteristic.Model, "Motorized Gate GPIO")
            .setCharacteristic(Characteristic.SerialNumber, getSerial() + this.doorSwitchPin)
            .setCharacteristic(Characteristic.FirmwareRevision, this.version);

        if (this.hasClosedSensor() || this.hasOpenSensor()) this.monitorDoorState();
    },

    determineCurrentDoorState: function() {
        if (this.isClosed()) return DoorState.CLOSED;
        if (this.hasOpenSensor()) return this.isOpen() ? DoorState.OPEN : DoorState.STOPPED;
        return DoorState.OPEN;
    },

    getTargetState: function(callback) { callback(null, this.targetState); },

    getState: function(callback) {
        if (this.disabled) return callback(null, DoorState.STOPPED);
        if (this.operating) return callback(null, this.currentDoorState.value);

        const isClosed = this.isClosed();
        const isOpen = this.isOpen();
        const state = isClosed ? DoorState.CLOSED : isOpen ? DoorState.OPEN : DoorState.STOPPED;
        callback(null, state);
    },

    setState: function(state, callback) {
        if (this.disabled) return callback();
        this.targetState = state;
        const isClosed = this.isClosed();

        if ((state === DoorState.OPEN && isClosed) || (state === DoorState.CLOSED && !isClosed)) {
            this.operating = true;
            this.currentDoorState.setValue(state === DoorState.OPEN ? DoorState.OPENING : DoorState.CLOSING);
            this.switchOn();
            setTimeout(this.setFinalDoorState.bind(this), this.doorOpensInSeconds * 1000);
        }
        callback();
    },

    setFinalDoorState: function() {
        const isClosed = this.isClosed();
        const isOpen = this.isOpen();

        if ((this.targetState === DoorState.CLOSED && !isClosed) || (this.targetState === DoorState.OPEN && !isOpen)) {
            this.currentDoorState.setValue(DoorState.STOPPED);
            this.obstructionDetected.setValue(false);
        } else {
            this.wasClosed = this.targetState === DoorState.CLOSED;
            this.currentDoorState.setValue(this.targetState);
            this.obstructionDetected.setValue(false);
        }
        this.operating = false;
    },

    switchOn: function() {
        this.writePin(this.doorSwitchPin, this.relayOn);
        this.log("Turning on GarageDoor Relay, pin " + this.doorSwitchPin + " = " + this.relayOn);
        setTimeout(() => {
            this.writePin(this.doorSwitchPin, this.relayOff);
            this.log("Turning off GarageDoor Relay, pin " + this.doorSwitchPin + " = " + this.relayOff);
        }, this.doorSwitchPressTimeInMs);
    },

    isClosed: function() {
        if (this.hasClosedSensor()) return this.readPin(this.closedDoorSensorPin) === this.closedDoorSensorValue;
        if (this.hasOpenSensor()) return !this.isOpen();
        return this.wasClosed;
    },

    isOpen: function() {
        if (this.hasOpenSensor()) return this.readPin(this.openDoorSensorPin) === this.openDoorSensorValue;
        if (this.hasClosedSensor()) return !this.isClosed();
        return !this.wasClosed;
    },

    monitorDoorState: function() {
        if (this.disabled) return;
        const isClosed = this.isClosed();
        if (isClosed !== this.wasClosed && !this.operating) {
            this.wasClosed = isClosed;
            this.currentDoorState.setValue(this.determineCurrentDoorState());
        }
        setTimeout(this.monitorDoorState.bind(this), this.sensorPollInMs);
    },

    getServices: function() { return [this.infoService, this.garageDoorOpener]; }
};
