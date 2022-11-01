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

		this.authToken = "";
		this.signatureKey = "";
	}

	async onReady() {
		this.log.info("config system: " + this.config.system);
		this.log.info("config username: " + this.config.username);
		this.log.info("config password: " + this.config.password.substring(0, 3) + "*******");
		this.log.info("config update_interval_live: " + this.config.update_interval_live);
		this.log.info("config update_interval_statistics: " + this.config.update_interval_statistics);
		this.timer_data = null;
		this.timer_statistics = null;

		let update_interval_live = 60000;
		if (this.config.update_interval_live > 0)
			update_interval_live = this.config.update_interval_live;

		let update_interval_statistics = 300000;
		if (this.config.update_interval_statistics > 0)
			update_interval_statistics = this.config.update_interval_statistics;

		const stateNames = [
			"ppv1", "ppv2", "ppv3", "ppv4", "ppv_sum", "ppv_and_dc_sum",
			"preal_l1", "preal_l2", "preal_l3", "preal_sum",
			"pmeter_l1", "pmeter_l2", "pmeter_l3", "pmeter_sum",
			"pmeter_dc", "soc", "pbat",
			"ev1_power", "ev2_power", "ev3_power", "ev4_power", "ev_power_sum", "home_load",
			"EselfConsumption", "EselfSufficiency", "Epvtotal", "Epvtoday",
			"EselfConsumptionToday", "EselfSufficiencyToday", "EGrid2LoadToday", "EGridChargeToday", "EHomeLoadToday", "EbatToday", "EchargeToday", "EeffToday", "Epv2loadToday", "EpvchargeToday", "EpvTToday", "EoutToday",
			"EselfConsumptionAllTime", "EselfSufficiencyAllTime", "EGrid2LoadAllTime", "EGridChargeAllTime", "EHomeLoadAllTime", "EbatAllTime", "EchargeAllTime", "EeffAllTime", "Epv2loadAllTime", "EpvchargeAllTime", "EpvTAllTime", "EoutAllTime"
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

		await this.setObjectNotExistsAsync("statistics_alltime_last_updated", {
			type: "state",
			common: {
				name: "statistics_alltime_last_updated",
				type: "number",
				role: "value.time",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("x_signature_key", {
			type: "state",
			common: {
				name: "x_signature_key",
				type: "string",
				role: "text",
				read: true,
				write: false,
			},
			native: {},
		});

		await this.setObjectNotExistsAsync("x_auth_token", {
			type: "state",
			common: {
				name: "x_auth_token",
				type: "string",
				role: "text",
				read: true,
				write: false,
			},
			native: {},
		});

		const instance = this;

		this.GetSignatureKey(function() {
			instance.Login(function() {
				instance.getPowerData();
				instance.getSummaryStatisticsData();
				instance.getPeriodStatisticsData();
				instance.timer_data = instance.setInterval(() => {
					instance.getPowerData();
				}, update_interval_live);

				instance.timer_statistics = instance.setInterval(() => {
					instance.getSummaryStatisticsData();
					instance.getPeriodStatisticsData();
					instance.getAllTimeStatisticsData();
				}, update_interval_statistics);
			});
		});
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			if (this.timer_data)
				this.clearInterval(this.timer_data);
			if (this.timer_statistics)
				this.clearInterval(this.timer_statistics);

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
		const url = `https://cloud.alphaess.com/api/ESS/GetLastPowerDataBySN?noLoading=true&sys_sn=${this.config.system}`;
		const headers = {
			"Authorization":"Bearer " + this.authToken,
		};

		this.log.debug("Calling API with authorization token: " + this.authToken + " url: " + url);

		const instance = this;
		request({url: url, headers: instance.GetHeaders(headers), method: "GET"}, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				const json = JSON.parse(body);
				instance.setState("ppv1", parseFloat(json.data.ppv1), true);
				instance.setState("ppv2", parseFloat(json.data.ppv2), true);
				instance.setState("ppv3", parseFloat(json.data.ppv3), true);
				instance.setState("ppv4", parseFloat(json.data.ppv4), true);
				instance.setState("ppv_sum",  parseFloat(json.data.ppv1) +  parseFloat(json.data.ppv2) +  parseFloat(json.data.ppv3) + parseFloat(json.data.ppv4), true);

				instance.setState("ppv_and_dc_sum",  parseFloat(json.data.ppv1) +  parseFloat(json.data.ppv2) +  parseFloat(json.data.ppv3) + parseFloat(json.data.ppv4) + parseFloat(json.data.pmeter_dc), true);

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

				instance.setState("home_load", parseFloat(json.data.ppv1) +  parseFloat(json.data.ppv2) +  parseFloat(json.data.ppv3) + parseFloat(json.data.ppv4) + parseFloat(json.data.pmeter_l1) + parseFloat(json.data.pmeter_l2) + parseFloat(json.data.pmeter_l3) + parseFloat(json.data.pbat) + parseFloat(json.data.pmeter_dc), true);

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

	getSummaryStatisticsData() {
		const today = new Date().toLocaleDateString("en-CA");
		const url = `https://cloud.alphaess.com/api/ESS/SticsSummeryDataForCustomer?noLoading=true&showLoading=false&sys_sn=${this.config.system}&tday=${today}`;
		const headers = {
			"Authorization":"Bearer " + this.authToken,
		};

		this.log.debug("Calling API with authorization token: " + this.authToken + " url: " + url);

		const instance = this;
		request({url: url, headers: instance.GetHeaders(headers), method: "GET"}, function(error, response, body) {
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

	getPeriodStatisticsData() {
		const todayDate = new Date().toLocaleDateString("en-CA");
		const url = `https://cloud.alphaess.com/api/Power/SticsByPeriod?beginDay=${todayDate}&endDay=${todayDate}&tDay=${todayDate}&isOEM=0&SN=${this.config.system}&userID=&noLoading=true`;
		const headers = {
			"Authorization":"Bearer " + this.authToken,
		};

		this.log.debug("Calling API with authorization token: " + this.authToken + " url: " +url);

		const instance = this;
		request({url: url, headers: instance.GetHeaders(headers), method: "GET"}, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				const json = JSON.parse(body);
				instance.setState("EselfConsumptionToday", parseFloat(json.data.EselfConsumption), true);
				instance.setState("EselfSufficiencyToday", parseFloat(json.data.EselfSufficiency), true);
				instance.setState("EGrid2LoadToday", parseFloat(json.data.EGrid2Load), true);
				instance.setState("EGridChargeToday", parseFloat(json.data.EGridCharge), true);
				instance.setState("EHomeLoadToday", parseFloat(json.data.EHomeLoad), true);
				instance.setState("EbatToday", parseFloat(json.data.Ebat), true);
				instance.setState("EchargeToday", parseFloat(json.data.Echarge), true);
				instance.setState("EeffToday", parseFloat(json.data.Eeff), true);
				instance.setState("Epv2loadToday", parseFloat(json.data.Epv2load), true);
				instance.setState("EpvchargeToday", parseFloat(json.data.Epvcharge), true);
				instance.setState("EpvTToday", parseFloat(json.data.EpvT), true);
				instance.setState("EoutToday", parseFloat(json.data.Eout), true);

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

	getAllTimeStatisticsData() {
		const todayDate = new Date().toLocaleDateString("en-CA");
		const beginDate = new Date(2022, 4, 30).toLocaleDateString("en-CA"); //30.05.2022
		const url = `https://cloud.alphaess.com/api/Power/SticsByPeriod?beginDay=${beginDate}&endDay=${todayDate}&tDay=${todayDate}&isOEM=0&SN=${this.config.system}&userID=&noLoading=true`;
		const headers = {
			"Authorization":"Bearer " + this.authToken,
		};

		this.log.debug("Calling API with authorization token: " + this.authToken + " url: " + url);

		const instance = this;
		request({url: url, headers: instance.GetHeaders(headers), method: "GET"}, function(error, response, body) {
			if (!error && response.statusCode == 200) {
				const json = JSON.parse(body);
				instance.setState("EselfConsumptionAllTime", parseFloat(json.data.EselfConsumption), true);
				instance.setState("EselfSufficiencyAllTime", parseFloat(json.data.EselfSufficiency), true);
				instance.setState("EGrid2LoadAllTime", parseFloat(json.data.EGrid2Load), true);
				instance.setState("EGridChargeAllTime", parseFloat(json.data.EGridCharge), true);
				instance.setState("EHomeLoadAllTime", parseFloat(json.data.EHomeLoad), true);
				instance.setState("EbatAllTime", parseFloat(json.data.Ebat), true);
				instance.setState("EchargeAllTime", parseFloat(json.data.Echarge), true);
				instance.setState("EeffAllTime", parseFloat(json.data.Eeff), true);
				instance.setState("Epv2loadAllTime", parseFloat(json.data.Epv2load), true);
				instance.setState("EpvchargeAllTime", parseFloat(json.data.Epvcharge), true);
				instance.setState("EpvTAllTime", parseFloat(json.data.EpvT), true);
				instance.setState("EoutAllTime", parseFloat(json.data.Eout), true);

				instance.setState("statistics_alltime_last_updated", new Date().getTime(), true);
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


	GetSignatureKey(callback = () => {}) {
		const url = "https://cloud.alphaess.com/";
		const instance = this;

		const APP_SRC = /<script src=(\/static\/js\/app\..*?\.js\?.*?)>/gis;
		const APP_KEY = /"(LS.*?CWSS)"/gis;

		this.log.info("Getting signature key from website: " + url);
		request({url: url, method: "GET" }, function(error, response, body) {
			if (!error && response.statusCode == 200) {

				const jsRegex = APP_SRC.exec(body);
				if (!jsRegex || jsRegex.length < 2) {
					throw "We got an unexpected body while getting application script source.";
				}

				const scriptFile = jsRegex[1];
				instance.log.info("We got the following application script source: " + scriptFile);

				request({url: url + scriptFile, method: "GET" }, function(error, response, body) {
					if (!error && response.statusCode == 200) {

						const keyRegex = APP_KEY.exec(body);
						if (!keyRegex || keyRegex.length < 2) {
							throw "We got an unexpected body while getting signature key.";
						}

						instance.signatureKey = keyRegex[1];
						instance.log.info("We got the following signature key: " + instance.signatureKey);
						instance.setState("x_signature_key", instance.signatureKey, true);

						if (callback)
							callback();

						return;
					}
					else {
						instance.log.error("Error while getting signature key: " + response.statusCode + " - " + error);
					}
				});
			}
			else {
				instance.log.error("Error while getting application script source: " + response.statusCode + " - " + error);
			}
		});
	}

	/**
	 * @param {() => void} callback
	 */
	Login(callback = () => {}) {
		const instance = this;
		const url = "https://cloud.alphaess.com/api/Account/Login";
		const body = {
			"username": this.config.username,
			"password": this.config.password
		};

		instance.log.info("Start loggin in...");
		request({url: url, headers: instance.GetHeaders(), method: "POST", body: JSON.stringify(body)}, function(error, response, body) {
			instance.log.debug("Body: " + body);
			if (!error && response.statusCode == 200) {
				const json = JSON.parse(body);
				if (json && json.data) {
					instance.authToken = json.data.AccessToken;
					instance.log.info("Successfully loged in");
					instance.log.info("Fetched access token: " + instance.authToken);
					instance.setState("x_auth_token", instance.authToken, true);

					if (callback)
						callback();

					return;
				}
				else {
					instance.log.error("Login unsuccessfull - wrong credantials?");
				}
			}
			else {
				instance.log.debug("Response: " + JSON.parse(response));
				instance.log.debug("Error: " + error);
				instance.log.error("Error while loggin in: " + response.statusCode + " - " + error);
			}
		});
	}

	GetHeaders(additionalHeaders) {
		const crypto = require("crypto");

		const headers = {
			"Content-Type":"application/json",
			"Connection": "keep-alive",
			"Accept": "*/*",
			"Cache-Control": "no-cache",
			"AuthTimestamp": parseInt("" + (new Date).getTime() / 1e3),
			"AuthSignature": ""
		};

		const data = this.signatureKey + headers.AuthTimestamp;
		const hash = crypto.createHash("sha512").update(data).digest("hex");
		headers.AuthSignature = "al8e4s" + hash + "ui893ed";

		return Object.assign({}, headers, additionalHeaders);
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