"use strict";

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const request = require("request");

// Load your modules here, e.g.:
// const fs = require("fs");

class AlphaEssCloud extends utils.Adapter {

	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "alpha_ess_cloud",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	async onReady() {
		this.log.info("config system: " + this.config.system);
		this.log.info("config username: " + this.config.username);
		this.log.info("config password: " + this.config.password.substring(0, 3) + "*******");
		this.authToken = "";

		const stateNames = [
			"ppv1", "ppv2", "ppv3", "ppv4", "ppv_sum",
			"preal_l1", "preal_l2", "preal_l3", "preal_sum",
			"pmeter_l1", "pmeter_l2", "pmeter_l3", "pmeter_sum",
			"pmeter_dc", "soc", "pbat",
			"ev1_power", "ev2_power", "ev3_power", "ev4_power", "ev_power_sum",
			"EselfConsumption", "EselfSufficiency", "Epvtotal", "Epvtoday"
		];

		for (let i = 0; i < stateNames.length; i++) {
			await this.setObjectNotExistsAsync(stateNames[i], {
				type: "state",
				common: {
					name: stateNames[i],
					type: "number",
					role: "value",
					read: true,
					write: false,
				},
				native: {},
			});
		}

		await this.setObjectNotExistsAsync("last_updated", {
			type: "state",
			common: {
				name: "last_updated",
				type: "number",
				role: "value.time",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("statistics_last_updated", {
			type: "state",
			common: {
				name: "statistics_last_updated",
				type: "number",
				role: "value.time",
				read: true,
				write: false,
			},
			native: {},
		});

		const instance = this;

		this.setInterval(() => {
			instance.getPowerData();
		}, 60000);

		this.setInterval(() => {
			instance.getStatisticsData();
		}, 300000);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	getPowerData() {
		const url = "https://www.alphaess.com/api/ESS/GetLastPowerDataBySN";
		const headers = {
			"Content-Type":"application/json",
			"Authorization":"Bearer " + this.authToken
		};

		const body = {
			sys_sn: this.config.system,
			noLoading: true
		};

		this.log.debug("Calling API with authorization token: " + this.authToken + " body: " + JSON.stringify(body));

		const instance = this;
		request({url: url, headers: headers, method: "POST", body: JSON.stringify(body)}, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				const json = JSON.parse(body);
				instance.setState("ppv1", parseFloat(json.data.ppv1), true);
				instance.setState("ppv2", parseFloat(json.data.ppv2), true);
				instance.setState("ppv3", parseFloat(json.data.ppv3), true);
				instance.setState("ppv4", parseFloat(json.data.ppv4), true);
				instance.setState("ppv_sum",  parseFloat(json.data.ppv1) +  parseFloat(json.data.ppv2) +  parseFloat(json.data.ppv3) + parseFloat(json.data.ppv4), true);

				instance.setState("preal_l1", parseFloat(json.data.preal_l1), true);
				instance.setState("preal_l2", parseFloat(json.data.preal_l2), true);
				instance.setState("preal_l3", parseFloat(json.data.preal_l3), true);
				instance.setState("preal_sum", parseFloat(json.data.preal_l1) + parseFloat(json.data.preal_l2) + parseFloat(json.data.preal_l3), true);

				instance.setState("pmeter_l1", parseFloat(json.data.pmeter_l1), true);
				instance.setState("pmeter_l2", parseFloat(json.data.pmeter_l2), true);
				instance.setState("pmeter_l3", parseFloat(json.data.pmeter_l3), true);
				instance.setState("pmeter_sum", parseFloat(json.data.pmeter_l1) + parseFloat(json.data.pmeter_l2) + parseFloat(json.data.pmeter_l3), true);
				instance.setState("pmeter_dc", parseFloat(json.data.pmeter_dc), true);

				instance.setState("soc", parseFloat(json.data.soc), true);
				instance.setState("pbat", parseFloat(json.data.pbat), true);

				instance.setState("ev1_power", parseFloat(json.data.ev1_power), true);
				instance.setState("ev2_power", parseFloat(json.data.ev2_power), true);
				instance.setState("ev3_power", parseFloat(json.data.ev3_power), true);
				instance.setState("ev4_power", parseFloat(json.data.ev4_power), true);
				instance.setState("ev_power_sum", parseFloat(json.data.ev1_power) + parseFloat(json.data.ev2_power) + parseFloat(json.data.ev3_power) + parseFloat(json.data.ev4_power), true);

				instance.setState("last_updated", new Date().getTime(), true);
			}
			else if (response.statusCode == 401) {
				instance.log.debug("Unauthorized access, try loggin in: " + response.statusCode + " - " + error);
				instance.Login();
			}
			else
			{
				instance.log.error("Error Calling API: " + response.statusCode + " - " + error);
			}
		});
	}

	getStatisticsData() {
		const url = "https://www.alphaess.com/api/ESS/SticsSummeryDataForCustomer";
		const headers = {
			"Content-Type":"application/json",
			"Authorization":"Bearer " + this.authToken
		};

		const body = {
			sys_sn: this.config.system,
			noLoading: true,
			showLoading: false,
			tday: new Date().toLocaleDateString("en-CA")
		};

		this.log.debug("Calling API with authorization token: " + this.authToken + " body: " + JSON.stringify(body));

		const instance = this;
		request({url: url, headers: headers, method: "POST", body: JSON.stringify(body)}, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				const json = JSON.parse(body);
				instance.setState("EselfConsumption", parseFloat(json.data.EselfConsumption), true);
				instance.setState("EselfSufficiency", parseFloat(json.data.EselfSufficiency), true);
				instance.setState("Epvtotal", parseFloat(json.data.Epvtotal), true);
				instance.setState("Epvtoday", parseFloat(json.data.Epvtoday), true);

				instance.setState("statistics_last_updated", new Date().getTime(), true);
			}
			else if (response.statusCode == 401) {
				instance.log.debug("Unauthorized access, try loggin in: " + response.statusCode + " - " + error);
				instance.Login();
			}
			else
			{
				instance.log.error("Error Calling API: " + response.statusCode + " - " + error);
			}
		});
	}

	Login() {
		const instance = this;
		const url = "https://www.alphaess.com/api/Account/Login";
		const headers = {
			"Content-Type":"application/json"
		};
		const body = {
			"username": this.config.username,
			"password": this.config.password
		};

		instance.log.debug("Start loggin in...");
		request({url: url, headers: headers, method: "POST", body: JSON.stringify(body)}, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				const json = JSON.parse(body);
				instance.authToken = json.data.AccessToken;
				instance.log.debug("Successfully fetched access token: " + instance.authToken);
			}
			else
			{
				instance.log.error("Error while loggin in: " + response.statusCode + " - " + error);
			}
		});
	}
}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new AlphaEssCloud(options);
} else {
	// otherwise start the instance directly
	new AlphaEssCloud();
}