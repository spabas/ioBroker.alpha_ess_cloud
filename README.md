![Logo](admin/alpha_ess_cloud.png)
# ioBroker.alpha_ess_cloud

[![NPM version](https://img.shields.io/npm/v/iobroker.alpha_ess_cloud.svg)](https://www.npmjs.com/package/iobroker.alpha_ess_cloud)
[![Downloads](https://img.shields.io/npm/dm/iobroker.alpha_ess_cloud.svg)](https://www.npmjs.com/package/iobroker.alpha_ess_cloud)
![Number of Installations](https://iobroker.live/badges/alpha_ess_cloud-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/alpha_ess_cloud-stable.svg)
[![Dependency Status](https://img.shields.io/david/spabas/iobroker.alpha_ess_cloud.svg)](https://david-dm.org/spabas/iobroker.alpha_ess_cloud)

[![NPM](https://nodei.co/npm/iobroker.alpha_ess_cloud.png?downloads=true)](https://nodei.co/npm/iobroker.alpha_ess_cloud/)

**Tests:** ![Test and Release](https://github.com/spabas/ioBroker.alpha_ess_cloud/workflows/Test%20and%20Release/badge.svg)

## alpha_ess_cloud adapter for ioBroker

Getting PV data from Alpha ESS Cloud

## Changelog
<!--
	Placeholder for the next version (at the beginning of the line):
	### **WORK IN PROGRESS**
-->

### **WORK IN PROGRESS**
* Fetching device / system infos

### 0.0.24 (2022-11-26)
* Fetching Auth-Key again from State or fixed

### 0.0.23 (2022-11-01)
* Fetching Auth-Key from Alpha Cloud portal

### 0.0.22 (2022-10-31)
* Updated Auth-Key

### 0.0.21 (2022-10-30)
* Alpha ESS API changes: POST to GET

### 0.0.20 (2022-10-17)
* AuthSignature needed since 2022-10-16

### 0.0.19 (2022-10-17)
* AuthSignature needed since 2022-10-16

### 0.0.18 (2022-10-16)
* AuthToken as config for backup if login doesn't work

### 0.0.17 (2022-10-16)
* AuthToken as config for backup if login doesn't work

### 0.0.16 (2022-07-15)
* Missing object

### 0.0.15 (2022-07-14)
* Using external intervert information in ppv sum and consumption

### 0.0.14 (2022-07-03)
* AllTime Statistics

### 0.0.13 (2022-07-03)
* Changed URL of Alpha Cloud to https://cloud.alphaess.com

### 0.0.12 (2022-05-27)
* Update intervals can now be configured

### 0.0.11 (2022-05-26)
* Calculation of current load

### 0.0.10 (2022-05-26)
* New statistic values (fix for 0.0.9)

### 0.0.9 (2022-05-26)
* New statistic values

### 0.0.8 (2022-05-20)
* New statistic values

### 0.0.7 (2022-05-15)
* Handling login failure

### 0.0.6 (2022-05-15)
* Fix potential null reference

### 0.0.5 (2022-05-15)
* Daten direkt nach Adapter-Start abrufen 
* Intervalle bei Adapter-Ende löschen

### 0.0.4 (2022-05-15)
Getting statistics data

### 0.0.3 (2022-05-15)
Changed ReadMe

### 0.0.2 (2022-05-14)
Initial release  

## License
MIT License

Copyright (c) 2022 spabas <bastian.spaeth@gmx.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.