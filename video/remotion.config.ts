import { Config } from '@remotion/cli/config'

// Recorded frames are read straight from footage/ (see capture.mjs).
Config.setPublicDir('footage')
Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(95)
Config.setCodec('h264')
Config.setCrf(17)
Config.setOverwriteOutput(true)
