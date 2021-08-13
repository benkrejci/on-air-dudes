import fs from 'fs'
import path from 'path'
import YAML from 'yaml'
import * as OnAir from '@benkrejci/on-air'
import * as LedDudes from '@benkrejci/led-dudes'
import { Rgb } from '@benkrejci/led-dudes'

// led-dudes
const argv = require('yargs')
  .usage('Usage: $0 [on-air-config-file] [led-config-file]')
  .alias('d', 'dummy')
  .describe(
    'd',
    'Run terminal-simulated dummy LED strip instead of the real thing'
  )
  .alias('s', 'ignoreSchedule')
  .describe('s', 'Disable schedule checking')
  .demandCommand(1).argv

const onAirConfigPath = path.normalize(argv._[0])
if (!onAirConfigPath || !fs.existsSync(onAirConfigPath))
  throw new TypeError(
    `Unspecified or invalid on-air config argument (should be config path): ${onAirConfigPath}`
  )
const ledDudesConfigPath = path.normalize(argv._[1])
if (!ledDudesConfigPath || !fs.existsSync(ledDudesConfigPath))
  throw new TypeError(
    `Unspecified or invalid led-dudes config argument (should be config path): ${ledDudesConfigPath}`
  )

let onAirConfig: OnAir.Config
try {
  onAirConfig = OnAir.parseConfig(
    OnAir.validateRawConfig(
      YAML.parse(fs.readFileSync(onAirConfigPath, 'utf8'))
    )
  )
} catch (error) {
  console.error(`Error parsing on-air config file ${onAirConfigPath}:`, error)
  process.exit(0)
}
let ledDudesConfig: LedDudes.Config
try {
  ledDudesConfig = YAML.parse(fs.readFileSync(ledDudesConfigPath, 'utf8'))
} catch (error) {
  console.error(`Error parsing config file ${onAirConfigPath}:`, error)
  process.exit(0)
}

const ledDudes = LedDudes.start(ledDudesConfig, {
  dummyMode: argv.dummy,
  ignoreSchedule: argv.ignoreSchedule,
})

const service = OnAir.Service.create(onAirConfig)

// convert on-air box status output transforms (designed to control LEDs on GPIO pins) to RGB values
const onAirStatusToRgb = (status: string): Rgb => {
  const statusOutputs = onAirConfig.box.outputTransformsByStatus?.get(status)
  if (statusOutputs === undefined) throw Error(`Invalid or missing output transforms in box config for status ${status}`)
  const t = +new Date()
  const rgbTransforms = ['red', 'green', 'blue'].map((color) => {
    const transform = statusOutputs.get(color)
    if (transform === undefined) throw Error(`Missing color ${color} output transform in box config for status ${status}`)
    return transform
  })
  return rgbTransforms.map((config) => OnAir.transform(config, t)) as Rgb
}

let outputFunctionInterval: NodeJS.Timeout | null = null
const updateStatus = (status: string) => {
  console.log(`Service reported output status changed to ${status}`)
  // if status is the default status (off) resume normal led-dudes operation
  if (status === onAirConfig.defaultStatus) {
    ledDudes.resume()
    if (outputFunctionInterval !== null) {
      clearInterval(outputFunctionInterval)
    }
  } else {
    // otherwise, pause schedule and set up the output function loop to start updating pixels
    ledDudes.pause()
    if (outputFunctionInterval !== null) {
      clearInterval(outputFunctionInterval)
    }
    outputFunctionInterval = setInterval(() => {
      ledDudes.setAllPixels(onAirStatusToRgb(status))
    }, 0)
  }
}

// when remote on-air status is updated
service.on('outputStatus.update', updateStatus)
updateStatus(service.getOutputStatus())
