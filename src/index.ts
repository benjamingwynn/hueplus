import * as SerialPort from "serialport"

/** function that can be called via `await` in an `async` function to sleep. e.g. `await sleep(1000)` */
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

/** Different modes the HUE+ supports */
export enum HuePlusMode {
	/** Fixed colour. No effect */
	fixed = "0x00",
	/** Breathing effect */
	breathing = "0x07",
}

/** Channels on the device */
export enum HuePlusChannel {
	/** Target both channels */
	both = "0x00",
	/** Target channel 1 */
	one = "0x01",
	/** Target channel 2 */
	two = "0x02"
}

/** Converts a decimal (0-255) colour to a hex colour for use by the device */
function decColourToHex (decColour:number) {
	if (decColour < 0 || decColour > 255 || isNaN(decColour)) throw new Error("Colour must be in the range 0-255")
	return "0x"+(decColour).toString(16)
}

/** Returns true if a hex number equals a buffer */
function hexBufferEquals (buffer:Buffer, index:number, hex:string) {
	// console.log(buffer[index].toString(16))
	return buffer[index].toString(16) === hex.replace("0x", "")
}

/** Resets the port with serialport */
function resetPort (port:SerialPort) : Promise<void> {
	return new Promise ((resolve, reject) => {
		port.flush((error) => {
			if (error) {
				reject(error)
			} else {
				resolve()
			}
		})
	})
}

/**
 * Control the NZXT Hue+ from node.js with an easy to use `async/await` API.
 *
 * @author Benjamin Gwynn (http://xenxier.com)
*/
export class HuePlus {
	/** Serial port */
	private port:SerialPort

	/** Current LED colour payload to send to the device */
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

	/** Is the device connected */
	public connected:boolean = false

	/** Amount of time to wait between sending payloads (in ms). By default, this is set to a safe value from my testing. You may change this to whatever you wish, but the device may start to skip instructions if this is too low. */
	public waitPeriod:number = 300

	/**
	 * Declare a new NZXT Hue+ device
	 * @argument portAddress The address the port is on. On Windows systems, this will probably be `COM3`, on Linux systems this will probably be `/dev/ttyACM0`.
	 */
	constructor (portAddress:string) {
		this.port = new SerialPort(portAddress, {
			autoOpen: false,
			baudRate: 256000,
		})
	}

	/** Send data to the device */
	private send (data:Array<string>) : Promise <void> {
		return new Promise((resolve, reject) => {
			this.port.write(Buffer.from(data), (error) => {
				if (error) {
					reject(error)
				} else {
					this.port.drain((err) => {
						if (err) {
							reject(err)
						} else {
							resolve()
						}
					})
				}
			})
		})
	}

	/** Ping the device to attempt to activate it */
	private async ping () {
		await this.send(["0xc0"])
		console.log("Pinged Hue+ with 0xc0")
	}

	/** Disconnects from the device. Do this when you have finished sending commands. */
	public disconnect () : Promise <void> {
		console.log("Disconnecting...")

		return new Promise((resolve, reject) => {
			if (!this.connected) {
				console.log("Never connected to the device.")
				resolve()
				return
			}

			// safely close the port
			this.port.close()

			resolve()
		})
	}

	/** Connect to the device. Must be called after construction. */
	public connect () : Promise<void> {
		return new Promise((resolve, reject) => {
			this.port.open(async (error) => {
				if (error) {
					reject(error)
					return
				}

				console.log("Waiting for device...")

				let pingInterval = setInterval(() => {
					console.log("Still waiting on device...")
					this.ping()
				}, 3000)
				this.ping()

				let sentInitData:boolean = false

				this.port.on("data", async (data) => {
					console.log("Device is sending activity. Preparing it")
					console.log("->", data, [...data])

					// If we got one byte of data after pinging
					if (/*data.length === 1 && */!sentInitData/* && data[0] === 1*/) {
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
						console.log("Connected to the device. Ready to send payload.")
						this.connected = true
						resolve()

						return
					}
				})
			})

		})
	}

	/** Queues the setting a single LED colour. This will not apply until you update the Hue+ with `<HuePlus>.update` */
	public setLEDColour (ledIndex:number, colour:Colour) {
		if (ledIndex < 0 || ledIndex > 39 || isNaN(ledIndex)) throw new Error("LED index out of bounds")

		this.colourPayload[(ledIndex * 3) + 0] = decColourToHex(colour.green)
		this.colourPayload[(ledIndex * 3) + 1] = decColourToHex(colour.red)
		this.colourPayload[(ledIndex * 3) + 2] = decColourToHex(colour.blue)
	}

	/** Queues the setting of all LEDs to the given colour. This will not apply until you update the Hue+ with `<HuePlus>.update */
	public setAllLEDColours (colour: Colour) {
		for (let i = 0; i < 40; i += 1) {
			this.setLEDColour(i, colour)
		}
	}

	/** Queues the turning off all LEDs. This will not apply until you update the Hue+ with `<HuePlus>.update */
	public resetAllLEDColours () {
		for (let i = 0; i < 40; i += 1) {
			this.setLEDColour(i, {red:0, blue:0, green:0})
		}
	}

	/**
	 * Update the given channel with the updates you have passed.
	 * @argument channel The channel to update
	 * @argument mode The mode/effect to update the channel with. Defaults to fixed.
	*/
	public update (channel: HuePlusChannel, mode:HuePlusMode = HuePlusMode.fixed) : Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.connected) return reject("Cannot update because I'm not connected. Connect with <HuePlus>.connect() first")

			console.log("Sending LED instruction payload...")

			this.send([
				// Header
				"0x4b", // LED payload header - 0x4b
				channel, // Channel - 0x00: both, 0x01: C1, 0x02 c2
				mode, // Mode - 0x00: fixed, 0x07: breathing
				"0x01", // ???
				"0x02", // ???
			].concat(this.colourPayload))
			.catch(reject)
			.then(async () => {
				await sleep(this.waitPeriod)
				resolve()
			})
		})
	}
}

// DEV: testing
async function test () {
	try {
		const hue = new HuePlus("/dev/ttyACM0")

		await hue.connect()

		hue.setAllLEDColours({red: 255, green: 0, blue: 0})

		// await hue.update(HuePlusChannel.one)
		await hue.update(HuePlusChannel.both)

		hue.setLEDColour(1, {red: 100, green: 0, blue: 255})

		await hue.update(HuePlusChannel.two)

		hue.setAllLEDColours({red: 255, green: 255, blue: 255})

		await hue.update(HuePlusChannel.one, HuePlusMode.breathing)

		hue.setAllLEDColours({red: 100, green: 0, blue: 150})

		await hue.update(HuePlusChannel.both)

		await hue.disconnect()
	} catch (ex) {
		console.error(ex)
		throw ex
	}
}

test()
