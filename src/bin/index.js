#!/usr/bin/env node

import fs from 'fs'
import youtubedl from 'youtube-dl'
import { exec } from 'child_process'
import range from 'lodash.range'
import moment from 'moment'
import async from 'async'
import remove from 'remove'
import path from 'path'
import exists from 'fs-exists-sync'

const url = process.argv[2].replace('https://', 'http://')
const clipLength = 1
const filename = process.argv[3] || 'output.mp4'

const tmpDir = path.join(__dirname, 'tmp')
const originalVideoPath = path.join(tmpDir, 'original.mp4')
const finishedFilePath = path.join(process.cwd(), filename)
const clipListPath = path.join(tmpDir, 'clip-list.txt')

const video = youtubedl(url, ['--format=18'])

let duration

if (exists(tmpDir)) { remove.removeSync(tmpDir) }
fs.mkdirSync(tmpDir)
video.pipe(fs.createWriteStream(originalVideoPath))

video.on('info', (info) => {
  duration = info.duration
})

video.on('end', (info) => {
  let tasks = range(duration).map((sec) => {
    return (cb) => {
      let startTime = moment().set({'hour': 0, 'minute': 0, 'second': sec}).format('HH:mm:ss')
      let cmd = `ffmpeg -i ${originalVideoPath} -ss ${startTime} -t 00:00:01 -async 1 ${path.join(tmpDir, 'cut-' + sec + '.mp4')}`
      exec(cmd, (err) => {
        if (err) cb(err)
        cb()
      })
    }
  })

  async.parallel(tasks, (err) => {
    if (err) throw err
    let filenamesToAppend = range(duration).reverse().map((sec) => `file ./cut-${sec}.mp4`)

    fs.openSync(clipListPath, 'w+')
    filenamesToAppend.forEach((filenameToAppend) => {
      fs.appendFileSync(clipListPath, filenameToAppend + '\n')
    })

    let cmd = `ffmpeg -f concat -i ${clipListPath} -vcodec copy -acodec copy -y ${finishedFilePath}`
    exec(cmd, (err) => {
      if (err) throw err
      remove.removeSync(tmpDir)
    })
  })
})