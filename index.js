'use strict';

var util = require('util');
var BoardIO = require('board-io');
var rest = require('rest');
var pathPrefixInterceptor = require('rest/interceptor/pathPrefix');
var mimeInterceptor = require('rest/interceptor/mime');
var errorCodeInterceptor = require('rest/interceptor/errorCode');

var priv = new Map();

var modes = {
  INPUT: 0,
  OUTPUT: 1,
  ANALOG: 2,
  PWM: 3,
  SERVO: 4
};

var pins = [
    { id: "D0", modes: [0, 1, 3, 4] },
    { id: "D1", modes: [0, 1, 3, 4] },
    { id: "D2", modes: [0, 1, 3, 4] },
    { id: "D3", modes: [0, 1, 3, 4] },
    { id: "D4", modes: [0, 1] },
    { id: "D5", modes: [0, 1] },
    { id: "D6", modes: [0, 1] },
    { id: "D7", modes: [0, 1] },

    { id: "", modes: [] },
    { id: "", modes: [] },

    { id: "A0", modes: [0, 1, 2, 3, 4] },
    { id: "A1", modes: [0, 1, 2, 3, 4] },
    { id: "A2", modes: [0, 1, 2] },
    { id: "A3", modes: [0, 1, 2] },
    { id: "A4", modes: [0, 1, 2, 3, 4] },
    { id: "A5", modes: [0, 1, 2, 3, 4] },
    { id: "A6", modes: [0, 1, 2, 3, 4] },
    { id: "A7", modes: [0, 1, 2, 3, 4] }
  ];

function TinkerIO(options) {

  // call super constructor
  // BoardIO.call(this);

  var self = this;
  self.MODES = modes;
  self.LOW = 0;
  self.HIGH = 1;
  self.options = options || {};

  self.restClient = rest.wrap(pathPrefixInterceptor, { prefix: 'https://api.particle.io/v1/devices/' + self.options.deviceId + '/'})
      .wrap(mimeInterceptor, { mime: 'application/json' })
      .wrap(errorCodeInterceptor);

  // connect to hardware and emit "connected" event
  process.nextTick(function(){
    self.emit("connected");
  });


  // .. configure pins
  this.pins = pins.map(function(pin) {
    return {
      name: pin.id,
      supportedModes: pin.modes,
      mode: pin.modes[0],
      value: 0
    };
  });

  self.analogPins = this.pins.slice(10).map(function(pin, i) {
    return i;
  });

  // all done, emit ready event
  process.nextTick(function(){
    self.emit("ready");
  });

  self.isReady = true;

};
util.inherits(TinkerIO, BoardIO);

function namePin(pin, prefix){
  pin = new String(pin);
  if(pin.length === 1){
    pin = prefix + pin;
  }
  return pin;
}

TinkerIO.prototype.pinMode = function(pin, mode) {
  var state = priv.get(this);
  var buffer;
  var offset;
  var pinInt;
  var sMode;

  sMode = mode = +mode;

  // Normalize when the mode is ANALOG (2)
  if (mode === 2) {
    // Normalize to pin string name if numeric pin
    if (typeof pin === "number") {
      pin = "A" + pin;
    }
  }

  // For PWM (3), writes will be executed via analogWrite
  if (mode === 3) {
    sMode = 1;
  }

  offset = pin[0] === "A" ? 10 : 0;
  pinInt = (pin.replace(/A|D/, "") | 0) + offset;

  // Throw if attempting to create a PWM or SERVO on an incapable pin
  // True PWM (3) is CONFIRMED available on:
  //
  //     D0, D1, A0, A1, A5
  //
  //
  if (this.pins[pinInt].supportedModes.indexOf(mode) === -1) {
    throw new Error("Unsupported pin mode: " + modesMap[mode] + " for " + pin);
  }

  // Track the mode that user expects to see.
  this.pins[pinInt].mode = mode;

  // console.log('pin mode set', pin, mode, pinInt);

  return this;
};


TinkerIO.prototype.digitalWrite = function(pin, value) {
  // console.log('digitalwrite', pin, value);

  pin = namePin(pin, 'D');
  var offset = pin[0] === "A" ? 10 : 0;
  var pinInt = (pin.replace(/A|D/, "") | 0) + offset;
  if(value === 'HIGH' || value === 1 || value === '1' || value === 'ON'){
    value = 'HIGH';
    this.pins[pinInt].value = 1;
  }else{
    value = 'LOW';
    this.pins[pinInt].value = 0;
  }

  var opts = {
    path: 'digitalwrite?access_token=' + this.options.token,
    method: 'POST',
    entity: {
      params: pin + ',' + value
    }
  };

  this.restClient(opts)
    .then(function(ok){
      // console.log('digitalwrite ok', ok.entity);
    }, function(err){
      console.log('digitalwrite err', err);
    });
};

TinkerIO.prototype.servoWrite = function(pin, value) {
  this.analogWrite(pin, value);
};

TinkerIO.prototype.analogWrite = function(pin, value) {
  // console.log('analogWrite', pin, value);

  pin = namePin(pin, 'A');

  var offset = pin[0] === "A" ? 10 : 0;
  var pinInt = (pin.replace(/A|D/, "") | 0) + offset;

  value = parseInt(value, 10);

  this.pins[pinInt].value = value;

  var opts = {
    path: 'analogwrite?access_token=' + this.options.token,
    method: 'POST',
    entity: {
      params: pin + ',' + value
    }
  };

  this.restClient(opts)
    .then(function(ok){
      // console.log('analogwrite ok', ok.entity);
    }, function(err){
      console.log('analogwrite err', err);
    });
};


TinkerIO.prototype.analogRead = function(pin, callback) {

  var opts = {
    path: 'analogread?access_token=' + this.options.token,
    method: 'POST',
    entity: {
      params: pin
    }
  };

  this.restClient(opts)
    .then(function(ok){
     callback(ok.entity.return_value);
    }, function(err){
      console.log('read err', err);
    });

};

TinkerIO.prototype.digitalRead = function(pin, callback) {


  var opts = {
    path: 'digitalread?access_token=' + this.options.token,
    method: 'POST',
    entity: {
      params: pin
    }
  };

  this.restClient(opts)
    .then(function(ok){
     callback(ok.entity.return_value);
    }, function(err){
      console.log('read err', err);
    });

};




module.exports = TinkerIO;