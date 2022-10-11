'use strict';

var Service;
var Characteristic;
var request = require('request');

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory('homebridge-synology-surveillance-homemode', 'SSHomeMode', HttpMultiswitch);
};

class HttpMultiswitch {
    constructor(log, config) {
        this.log = log;

        this.name = config.name || 'MultiSwitch';
        this.host = config.host;

        this.username = config.username || '';
        this.password = config.password || '';
        this.sessionToken = "";
    }

    async httpRequest(path) {
        const url = this.host + path;
        let that = this;
        return new Promise((resolve, reject) => {
            request(url, (error, response, body) => {
                if (error) {
                    that.log.error(error);
                    reject(error);
                }
                if (response.statusCode != 200) {
                    that.log.error('Invalid status code <' + response.statusCode + '>');
                    reject('Invalid status code <' + response.statusCode + '>');
                }
                resolve(body);
            });
        });
    }

    async login() {
        try {
            if (this.sessionToken !== "") {
                return true;
            }

            const path = "/webapi/auth.cgi?api=SYNO.API.Auth&method=login&version=6&account=" + this.username + "&passwd=" + this.password + "&session=SurveillanceStation&format=sid";
            const body = await this.httpRequest(path);
            const response = JSON.parse(body);
            if (response.success) {
                this.log.debug(response);
                this.sessionToken = response.data.sid;
            } else {
                this.log.error(path);
                this.log.error(body);
            }
            return response.success;

        } catch (e) {
            return false;
        }
    }

    async getState() {
        try {
            let isLoginSuccess = await this.login();
            if (!isLoginSuccess) {
                this.log.error(`getState login failed`);
                return false;
            }
            const path = "/webapi/entry.cgi?api=SYNO.SurveillanceStation.HomeMode&version=1&method=GetInfo&_sid=" + this.sessionToken;
            const body = await this.httpRequest(path);
            const response = JSON.parse(body);
            return (response.success && response.data.on ? true : false);
        } catch (e) {
            return false;
        }
    }

    async setState(state) {
        try {
            let isLoginSuccess = await this.login();
            if (!isLoginSuccess) {
                this.log.error(`setState login failed`);
                // return false;
            }
            const path = "/webapi/entry.cgi?api=SYNO.SurveillanceStation.HomeMode&version=1&method=Switch&on=" + (state ? "true" : "false") + "&_sid=" + this.sessionToken;
            const body = await this.httpRequest(path);
            this.log.debug(`calling setState(${state})`);
            this.log.debug(`path = (${path})`);
            // const response = JSON.parse(body);
            // return (response.success ? true : false);
        } catch (e) {
            // return false;
        }
    }

    getServices() {
        this.services = [];
        let that = this;

        let informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Synology')
            .setCharacteristic(Characteristic.Model, 'Surveillance Station');
        this.services.push(informationService);

        let switchService = new Service.Switch(this.name);
        switchService
            .getCharacteristic(Characteristic.On)
            .onGet(async () => {
                return await that.getState();
            })
            .onSet(async (state) => {
                await that.setState(state);
            });

        this.services.push(switchService);

        return this.services;
    }
}
