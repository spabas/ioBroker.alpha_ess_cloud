//"use strict";

/*
 * Created with @iobroker/create-adapter v2.1.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
//const request = require("request");
const axios = require("axios").default;

//const crypto = require("crypto");
const CryptoJS = require("crypto-js");

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
			"EselfConsumptionToday", "EselfSufficiencyToday", "EGrid2LoadToday", "EGridChargeToday", "EHomeLoadToday", "EbatToday", "EchargeToday", "EeffToday", "Epv2loadToday", "EpvchargeToday", "EpvTToday", "EoutToday", "EinputToday", "EloadToday",
			"EselfConsumptionAllTime", "EselfSufficiencyAllTime", "EGrid2LoadAllTime", "EGridChargeAllTime", "EHomeLoadAllTime", "EbatAllTime", "EchargeAllTime", "EeffAllTime", "Epv2loadAllTime", "EpvchargeAllTime", "EpvTAllTime", "EoutAllTime",
			"popv", "poinv"
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

		const deviceStates = [
			"systemId", "sys_sn", "mbat", "minv", "ems_status"
		];

		for (let i = 0; i < deviceStates.length; i++) {
			await this.setObjectNotExistsAsync(deviceStates[i], {
				type: "state",
				common: {
					name: stateNames[i],
					type: "string",
					role: "text",
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
				write: true,
			},
			native: {},
		});
		this.subscribeStates("x_signature_key");

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

		try {
			if (this.config.system && this.config.username && this.config.password)
			{
				await this.Login();

				await this.getPowerData();
				await this.getSummaryStatisticsData();
				await this.getPeriodStatisticsData();

				if (update_interval_live)
				{
					this.timer_data = this.setInterval(() => {
						instance.getPowerData();
					}, update_interval_live);
				}

				if (update_interval_statistics)
				{
					this.timer_statistics = this.setInterval(() => {
						instance.getSummaryStatisticsData();
						instance.getPeriodStatisticsData();
						instance.getAllTimeStatisticsData();
						instance.getDeviceData();
					}, update_interval_statistics);
				}
			}
			else
				instance.log.error("Missing credentials in config");
		}
		catch (error) {
			instance.log.error("Error while processing Alpha ESS API: " + error);
		}
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

			if (id == this.namespace + ".x_signature_key" && state.ack == false) {
				this.signatureKey = `${state.val}`;
				state.ack = true;
				this.log.info("using signature key: " + this.signatureKey);
			}

		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	async getPowerData() {
		const url = `https://cloud.alphaess.com/api/base/energyStorage/getLastPowerData?sysSn=${this.config.system}`;
		const config = {
			headers: this.GetHeaders({
				validateStatus: () => true,
				"Authorization": this.authToken,
			})
		};

		this.log.debug("Calling API with authorization token: " + this.authToken + " url: " + url);

		try {
			const result = await axios.get(url, config);

			if (result.status == 200)
			{
				const json = result.data;

				try {
					// this.setState("ppv1", parseFloat(json.data.ppv1), true);
					// this.setState("ppv2", parseFloat(json.data.ppv2), true);
					// this.setState("ppv3", parseFloat(json.data.ppv3), true);
					// this.setState("ppv4", parseFloat(json.data.ppv4), true);
					this.setState("ppv_sum",  parseFloat(json.data.ppv), true);

					this.setState("ppv_and_dc_sum",  parseFloat(json.data.ppv) +  parseFloat(json.data.ppvSlave), true);

					// this.setState("preal_l1", parseFloat(json.data.preal_l1), true);
					// this.setState("preal_l2", parseFloat(json.data.preal_l2), true);
					// this.setState("preal_l3", parseFloat(json.data.preal_l3), true);
					// this.setState("preal_sum", parseFloat(json.data.preal_l1) + parseFloat(json.data.preal_l2) + parseFloat(json.data.preal_l3), true);

					//Netz
					// this.setState("pmeter_l1", parseFloat(json.data.pmeter_l1), true);
					// this.setState("pmeter_l2", parseFloat(json.data.pmeter_l2), true);
					// this.setState("pmeter_l3", parseFloat(json.data.pmeter_l3), true);
					this.setState("pmeter_sum", parseFloat(json.data.pgrid), true);

					this.setState("pmeter_dc", parseFloat(json.data.ppvSlave), true);

					this.setState("soc", parseFloat(json.data.soc), true);
					this.setState("pbat", parseFloat(json.data.pbat), true);

					// this.setState("ev1_power", parseFloat(json.data.ev1_power), true);
					// this.setState("ev2_power", parseFloat(json.data.ev2_power), true);
					// this.setState("ev3_power", parseFloat(json.data.ev3_power), true);
					// this.setState("ev4_power", parseFloat(json.data.ev4_power), true);
					this.setState("ev_power_sum", parseFloat(json.data.pev), true);

					//Verbrauch
					this.setState("home_load", parseFloat(json.data.pload), true);

					this.setState("last_updated", new Date().getTime(), true);
				} catch (error) {
					this.log.debug("Error while reading / parsing fetched data: " + json.data);
				}
			}
			else if (result.status == 401) {
				this.log.debug("Unauthorized access, try loggin in: " + result.status + " - " + result.statusText);
				await this.Login();
			}
			else
			{
				this.log.error("Error Calling API: " + result.status + " - " + result.statusText);
			}
		} catch (error) {
			this.log.error(error);
		}
	}

	async getSummaryStatisticsData() {
		const today = new Date().toLocaleDateString("en-CA");
		const url = `https://cloud.alphaess.com/api/web/home/getSumDataForCustomer?sn=${this.config.system}&tday=${today}`;

		const config = {
			validateStatus: () => true,
			headers: this.GetHeaders({
				"Authorization": this.authToken,
			})
		};

		this.log.debug("Calling API with authorization token: " + this.authToken + " url: " + url);

		try {
			const result = await axios.get(url, config);

			if (result.status == 200)
			{
				const json = result.data;

				try {
					this.setState("EselfConsumption", parseFloat(json.data.eselfConsumption), true);
					this.setState("EselfSufficiency", parseFloat(json.data.eselfSufficiency), true);
					this.setState("Epvtotal", parseFloat(json.data.epvtotal), true);
					this.setState("Epvtoday", parseFloat(json.data.epvtoday), true);

					this.setState("statistics_last_updated", new Date().getTime(), true);
				} catch (error) {
					this.log.debug("Error while reading / parsing fetched data: " + json.data);
				}
			}
			else if (result.status == 401) {
				this.log.debug("Unauthorized access, try loggin in: " + result.status + " - " + result.statusText);
				await this.Login();
			}
			else
			{
				this.log.error("Error Calling API: " + result.status + " - " + result.statusText);
			}
		} catch (error) {
			this.log.error(error);
		}
	}

	async getPeriodStatisticsData() {
		const todayDate = new Date().toLocaleDateString("en-CA");
		const url = `https://cloud.alphaess.com/api/base/energy/getEnergyStatistics?beginDate=${todayDate}&endDate=${todayDate}&sysSn=${this.config.system}`;

		const config = {
			validateStatus: () => true,
			headers: this.GetHeaders({
				"Authorization": this.authToken,
			})
		};

		this.log.debug("Calling API with authorization token: " + this.authToken + " url: " + url);

		try {
			const result = await axios.get(url, config);

			if (result.status == 200)
			{
				const json = result.data;

				try {
					this.setState("EselfConsumptionToday", parseFloat(json.data.eselfConsumption), true);
					this.setState("EselfSufficiencyToday", parseFloat(json.data.eselfSufficiency), true);
					this.setState("EGrid2LoadToday", parseFloat(json.data.eGrid2Load), true);
					this.setState("EGridChargeToday", parseFloat(json.data.eGridCharge), true);
					this.setState("EHomeLoadToday", parseFloat(json.data.eHomeLoad), true);
					this.setState("EbatToday", parseFloat(json.data.ebat), true);
					this.setState("EchargeToday", parseFloat(json.data.echarge), true);
					this.setState("EeffToday", parseFloat(json.data.eeff), true);
					this.setState("Epv2loadToday", parseFloat(json.data.epv2load), true);
					this.setState("EpvchargeToday", parseFloat(json.data.epvcharge), true);
					this.setState("EpvTToday", parseFloat(json.data.epvT), true);
					this.setState("EoutToday", parseFloat(json.data.eout), true);
					this.setState("EinputToday", parseFloat(json.data.einput), true);
					this.setState("EloadToday", parseFloat(json.data.eload), true);

					this.setState("statistics_last_updated", new Date().getTime(), true);
				} catch (error) {
					this.log.debug("Error while reading / parsing fetched data: " + json.data);
				}
			}
			else if (result.status == 401) {
				this.log.debug("Unauthorized access, try loggin in: " + result.status + " - " + result.statusText);
				await this.Login();
			}
			else
			{
				this.log.error("Error Calling API: " + result.status + " - " + result.statusText);
			}
		} catch (error) {
			this.log.error(error);
		}
	}

	async getDeviceData() {
		const url = `https://cloud.alphaess.com/api/web/home/getCustomMenuEssList?pageSize=10000&pageIndex=1`;

		const config = {
			validateStatus: () => true,
			headers: this.GetHeaders({
				"Authorization": this.authToken,
			})
		};

		this.log.debug("Calling API with authorization token: " + this.authToken + " url: " + url);

		try {
			const result = await axios.get(url, config);

			if (result.status == 200)
			{
				const json = result.data;

				const data = json.data[0];
				this.setState("sys_sn", data.sysSn, true);
				this.setState("systemId", data.systemId, true);
				this.setState("popv", data.popv, true);
				this.setState("poinv", data.poinv, true);
				this.setState("mbat", data.mbat, true);
				this.setState("minv", data.minv, true);
				this.setState("ems_status", data.ems_status, true);
			}
			else if (result.status == 401) {
				this.log.debug("Unauthorized access, try loggin in: " + result.status + " - " + result.statusText);
				await this.Login();
			}
			else
			{
				this.log.error("Error Calling API: " + result.status + " - " + result.statusText);
			}
		} catch (error) {
			this.log.error(error);
		}
	}

	async getAllTimeStatisticsData() {
		const todayDate = new Date().toLocaleDateString("en-CA");
		const beginDate = new Date(2022, 4, 30).toLocaleDateString("en-CA"); //30.05.2022
		const url = `https://cloud.alphaess.com/api/Power/SticsByPeriod?beginDay=${beginDate}&endDay=${todayDate}&tDay=${todayDate}&isOEM=0&SN=${this.config.system}&userID=&noLoading=true`;

		const config = {
			validateStatus: () => true,
			headers: this.GetHeaders({
				"Authorization": this.authToken,
			})
		};

		this.log.debug("Calling API with authorization token: " + this.authToken + " url: " + url);

		try {
			const result = await axios.get(url, config);

			if (result.status == 200)
			{
				const json = result.data;

				try {
					this.setState("EselfConsumptionAllTime", parseFloat(json.data.EselfConsumption), true);
					this.setState("EselfSufficiencyAllTime", parseFloat(json.data.EselfSufficiency), true);
					this.setState("EGrid2LoadAllTime", parseFloat(json.data.EGrid2Load), true);
					this.setState("EGridChargeAllTime", parseFloat(json.data.EGridCharge), true);
					this.setState("EHomeLoadAllTime", parseFloat(json.data.EHomeLoad), true);
					this.setState("EbatAllTime", parseFloat(json.data.Ebat), true);
					this.setState("EchargeAllTime", parseFloat(json.data.Echarge), true);
					this.setState("EeffAllTime", parseFloat(json.data.Eeff), true);
					this.setState("Epv2loadAllTime", parseFloat(json.data.Epv2load), true);
					this.setState("EpvchargeAllTime", parseFloat(json.data.Epvcharge), true);
					this.setState("EpvTAllTime", parseFloat(json.data.EpvT), true);
					this.setState("EoutAllTime", parseFloat(json.data.Eout), true);

					this.setState("statistics_alltime_last_updated", new Date().getTime(), true);
				} catch (error) {
					this.log.debug("Error while reading / parsing fetched data: " + json.data);
				}
			}
			else if (result.status == 401) {
				this.log.debug("Unauthorized access, try loggin in: " + result.status + " - " + result.statusText);
				await this.Login();
			}
			else
			{
				this.log.error("Error Calling API: " + result.status + " - " + result.statusText);
			}
		} catch (error) {
			this.log.error(error);
		}
	}

	encryptPassword(password, username) {

		const aeskey = CryptoJS.SHA256(username);
		const iv = CryptoJS.MD5(username);
		const encrypted = CryptoJS.AES.encrypt(password, aeskey, {
			iv: iv,
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.Pkcs7,
		});

		return encrypted.toString();
	}

	async Login() {
		const instance = this;
		const url = "https://cloud.alphaess.com/api/base/user/login";
		const encryptedPassword = this.encryptPassword(this.config.password, this.config.username);

		const body = {
			"username": this.config.username,
			"password": encryptedPassword
		};
		const config = {
			validateStatus: () => true,
			headers: instance.GetHeaders()
		};

		instance.log.info("Start loggin in...");

		try {
			const result = await axios.post(url, body, config);

			if (result.status == 200) {
				const payload = result.data;
				const authToken = payload.data.token;

				if (authToken)
				{
					instance.authToken = authToken;

					instance.log.info("Successfully loged in");
					instance.log.info("Fetched access token: " + authToken);
					await instance.setStateAsync("x_auth_token", authToken, true);
				}
				else {
					instance.log.error("Login unsuccessfull - we didn't receive an auth token, wrong credantials?");
				}
			}
			else {
				instance.log.error("Error while loggin in: " + result.status + " - " + result.statusText);
			}
		} catch (error) {
			instance.log.info("Login request not successfull");
			this.log.error(error);
		}
	}


	GetHeaders(additionalHeaders) {
		const headers = {
			"Content-Type":"application/json",
			"Connection": "keep-alive",
			"Accept": "*/*",
			"Cache-Control": "no-cache",
		};

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