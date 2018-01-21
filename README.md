# hueplus
(Experimental) control for the NZXT Hue+ from Node.js. This is a work-in-progress, but it seems to work okay for setting static/breathing LED colours. Right now, it only *really* supports controlling both channels at the same time, and there's no CLI.

If you're looking for a more tested alternative, try [this Python version written by kusti8](https://github.com/kusti8/hue-plus). Although I couldn't get it to work on my Raspberry Pi.

## Linux support

Right now, I can't seem to get this to work on my Arch Linux install or my Raspberry Pi. When probing `/dev/ttyACM0`, the HUE+ seems to just respond with `0xff` instead of the expected `0x01` after sending it `0xc0`. `dmesg` has nothing useful, Wireshark doesn't seem to reveal anything which I can spot as being wrong. Ignoring the `0xff` and sending the rest of the instructions anyway does nothing useful.

Log with waiting for 0xc0:

```
Port opened.
Pinged Hue+ with 0xc0
-> <Buffer ff> [ 255 ]
Pinged Hue+ with 0xc0
-> <Buffer ff> [ 255 ]
```

Log without waiting for 0xc0:

```
Port opened.
Pinged Hue+ with 0xc0
-> <Buffer ff> [ 255 ]
WARNING: unexpected result, this might be the hue+ telling us we sent it an invalid init command
Sending 0x8d 0x01
-> <Buffer ff> [ 255 ]
```

This might be related to [this issue](https://github.com/node-serialport/node-serialport/issues/1362), but I'm unsure.

## API

I'll put the API here once it's stable, but I'm sure you can work it out. Typescript typings are provided (as the project is written in Typescript).

### Example

Here's an example of the current API. You'll need to change `"COM3"` to the COM port the device is registered at. Check device manager for Windows PC's, or use the `/dev/whatever` path for Linux/OS X.

```
const hue = new HuePlus("COM3", HuePlusMode.fixed)

await hue.connect()

hue.setAllLEDColours({red: 255, green: 255, blue: 255})
hue.setLEDColour(0, {red: 255, green: 0, blue: 0})
hue.setLEDColour(3, {red: 0, green: 255, blue: 0})
hue.setLEDColour(18, {red: 0, green: 0, blue: 255})

await hue.update(HuePlusChannel.both)
await hue.disconnect()
```
## CLI

Not written yet, but maybe one day.
