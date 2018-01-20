import * as SerialPort from "serialport"
import { setTimeout, clearInterval } from "timers"

function sleep (t:number) {
	return new Promise((resolve) => {
		setTimeout(resolve, t)
	})
}

/** Red, green and blue colours. All must be in range 0-255 */
export interface Colour {
	/** Red colour (0-255) */
	red:number,
	/** Green colour (0-255) */
	green:number,
	/** Blue colour (0-255) */
	blue:number,
}

export enum HuePlusMode {
	fixed = "0x00",
	breathing = "0x07",
}

export enum HuePlusChannel {
	both = "0x00",
	one = "0x01",
	two = "0x02"
}

function decColourToHex (decColour:number) {
	if (decColour < 0 || decColour > 255 || isNaN(decColour)) throw new Error("Colour must be in the range 0-255")
	return "0x"+(decColour).toString(16)
}

export class HuePlus {
	private port:SerialPort

	private colourPayload = [
		// Set the LED colours in this channel as GREEN, RED, BLUE.
		// There are a maximum of 40 LEDs per channel
		"0x00", "0x00", "0x00", // LED 01
		"0x00", "0x00", "0x00", // LED 02
		"0x00", "0x00", "0x00", // LED 03
		"0x00", "0x00", "0x00", // LED 04
		"0x00", "0x00", "0x00", // LED 05
		"0x00", "0x00", "0x00", // LED 06
		"0x00", "0x00", "0x00", // LED 07
		"0x00", "0x00", "0x00", // LED 08
		"0x00", "0x00", "0x00", // LED 09
		"0x00", "0x00", "0x00", // LED 10

		"0x00", "0x00", "0x00", // LED 11
		"0x00", "0x00", "0x00", // LED 12
		"0x00", "0x00", "0x00", // LED 13
		"0x00", "0x00", "0x00", // LED 14
		"0x00", "0x00", "0x00", // LED 15
		"0x00", "0x00", "0x00", // LED 16
		"0x00", "0x00", "0x00", // LED 17
		"0x00", "0x00", "0x00", // LED 18
		"0x00", "0x00", "0x00", // LED 19
		"0x00", "0x00", "0x00", // LED 20

		"0x00", "0x00", "0x00", // LED 21
		"0x00", "0x00", "0x00", // LED 22
		"0x00", "0x00", "0x00", // LED 23
		"0x00", "0x00", "0x00", // LED 24
		"0x00", "0x00", "0x00", // LED 25
		"0x00", "0x00", "0x00", // LED 26
		"0x00", "0x00", "0x00", // LED 27
		"0x00", "0x00", "0x00", // LED 28
		"0x00", "0x00", "0x00", // LED 29
		"0x00", "0x00", "0x00", // LED 30

		"0x00", "0x00", "0x00", // LED 31
		"0x00", "0x00", "0x00", // LED 32
		"0x00", "0x00", "0x00", // LED 33
		"0x00", "0x00", "0x00", // LED 34
		"0x00", "0x00", "0x00", // LED 35
		"0x00", "0x00", "0x00", // LED 36
		"0x00", "0x00", "0x00", // LED 37
		"0x00", "0x00", "0x00", // LED 38
		"0x00", "0x00", "0x00", // LED 39
		"0x00", "0x00", "0x00", // LED 40
	]

	public connected:boolean

	constructor (portAddress:string, public mode:HuePlusMode = HuePlusMode.fixed) {
		this.port = new SerialPort(portAddress, {
			autoOpen: false,
			baudRate: 256000,
		})
	}

	private send (data:Array<string>) : Promise <void> {
		return new Promise((resolve, reject) => {
			this.port.write(Buffer.from(data), (error) => {
				if (error) {
					reject(error)
				} else {
					resolve()
				}
			})
		})
	}

	private async ping2c () {
		await this.send(["0xc0"])
		console.log("Pinged Hue+ with 0xc0")
	}

	public disconnect () : Promise <void> {
		console.log("Disconnecting...")

		return new Promise((resolve, reject) => {
			if (!this.connected) {
				reject("Cannot disconnect. Never successfully connected to the HUE+")
				return
			}

			// safely close the port
			this.port.close()

			resolve()
		})
	}

	public connect () : Promise<void> {
		return new Promise((resolve, reject) => {
			this.port.open(async (error) => {
				if (error) {
					reject(error)
					return
				}

				let pingInterval = setInterval(() => {this.ping2c()}, 3000)
				this.ping2c()

				let sentInitData:boolean = false

				console.log("Port opened.")

				function hexBufferEquals (buffer:Buffer, index:number, hex:string) {
					console.log(buffer[index].toString(16))
					return buffer[index].toString(16) === hex.replace("0x", "")
				}

				this.port.on('data', async (data) => {
					console.log("->", data, [...data])

					// If we got one byte of data after pinging
					if (data.length === 1 && !sentInitData) {
						if (data[0] === 1) {
							console.log("Expected result, int 1")
						} else {
							console.warn("WARNING: unexpected result, this might be the hue+ telling us we sent it an invalid init command")
						}

						// Stop pinging with 0xc0
						clearInterval(pingInterval)

						// send these instructions... i'm not sure what these do quite yet
						console.log("Sending 0x8d 0x01")
						await this.send(["0x8d", "0x01"])

						// never send this again
						sentInitData = true

						return
					}

					// If we get c0 back, send more instructions
					if (hexBufferEquals(data, 0, "0xc0")) {
						console.log("Hue+ sent 0xc0. Sending 0x8c 0x00...")
						await this.send(["0x8c", "0x00"])

						return
					}

					// The HUE+ then sends a bunch of information ending in 0x56
					if (hexBufferEquals(data, data.length - 1, "0x56")) {
						// console.log("Hue+ seems like it's ready to receieve the LED payload (got data ending in 0x56)")
						// await sendLEDPayload()
						// await disconnect()
						console.log("We're connected and ready to send LED paylaods!")
						this.connected = true
						resolve()

						return
					}

				})

				// ping the hue+ every three seconds with this until it responds

				// while (doPing) {
				// 	await sleep(3000)
				// }
			})

		})
	}

	public setLEDColour (ledIndex:number, colour:Colour) {
		if (ledIndex < 0 || ledIndex > 39 || isNaN(ledIndex)) throw new Error("LED index out of bounds")

		this.colourPayload[(ledIndex * 3) + 0] = decColourToHex(colour.green)
		this.colourPayload[(ledIndex * 3) + 1] = decColourToHex(colour.red)
		this.colourPayload[(ledIndex * 3) + 2] = decColourToHex(colour.blue)

		// console.log("Setting LED", ledIndex, colour)
	}

	public setAllLEDColours (colour: Colour) {
		for (let i = 0; i < 40; i += 1) {
			this.setLEDColour(i, colour)
		}
	}

	public resetAllLEDColours () {
		for (let i = 0; i < 40; i += 1) {
			this.setLEDColour(i, {red:0, blue:0, green:0})
		}
	}

	public update (channel: HuePlusChannel) : Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.connected) return reject("Cannot update because I'm not connected. Connect with <HuePlus>.connect() first")

			console.log("Sending LED instruction payload...")

			this.send([
				// Header
				"0x4b", // LED payload header - 0x4b
				channel, // Channel - 0x01: both, 0x01: C1, 0x02 c2
				this.mode, // Mode - 0x00: fixed, 0x07: breathing
				"0x01", // ???
				"0x02", // ???
			].concat(this.colourPayload))
			.catch(reject)
			.then(resolve)
		})
	}
}

// DEV: testing
async function test () {
	try {
		const hue = new HuePlus("COM3", HuePlusMode.fixed)

		await hue.connect()

		hue.setAllLEDColours({red: 255, green: 255, blue: 255})
		hue.setLEDColour(0, {red: 255, green: 0, blue: 0})
		hue.setLEDColour(3, {red: 255, green: 0, blue: 0})
		hue.setLEDColour(6, {red: 255, green: 0, blue: 0})
		hue.setLEDColour(9, {red: 255, green: 0, blue: 0})
		hue.setLEDColour(12, {red: 255, green: 0, blue: 0})
		hue.setLEDColour(15, {red: 255, green: 0, blue: 0})
		hue.setLEDColour(18, {red: 255, green: 0, blue: 0})

		// await hue.update(HuePlusChannel.one)
		await hue.update(HuePlusChannel.both)

		// hue.setLEDColour(18, {red: 100, green: 0, blue: 255})

		// await hue.update(HuePlusChannel.two)

		await hue.disconnect()
	} catch (ex) {
		throw ex
	}
}

// test()
