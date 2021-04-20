'use strict'

import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express()
dotenv.config()
app.use(cors())
app.use(express.static('public'))
app.get('/', (_req, res) => {
    res.sendFile(__dirname + '/views/index.html')
})
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

const uri = process.env.MONGO_URI
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'))

const userSchema = mongoose.Schema({
    username: { type: String, required: true },
})
const exerciseSchema = mongoose.Schema({
    uid: { type: String, required: true },
    desc: { type: String, required: true },
    dur: { type: Number, required: true },
    date: { type: Date, required: true },
})

const User = mongoose.model('User', userSchema)
const Exercise = mongoose.model('Exercise', exerciseSchema)

// 1. I can create a user by posting form data username to
// /api/exercise/new-user
// and returned will be an object with username and _id.
app.post('/api/exercise/new-user', async (req, res, _next) => {
    const username = req.body.username
    const userDoc = new User({ username })
    const user = await userDoc.save()
    res.json(user)
})

// 2. I can get an array of all users by getting
// api/exercise/users with the same info as when creating a user.
app.get('/api/exercise/users', async (_req, res, _next) => {
    const users = await User.find({})
    res.json(users)
})

// 3. I can add an exercise to any user by posting form data userId(_id),
// description, duration, and optionally date to /api/exercise/add.
// If no date supplied it will use current date.
// Returned will the the user object with also with the exercise fields added.
app.post('/api/exercise/add', async (req, res) => {
    const uid = req.body.userId
    const desc = req.body.description
    const dur = req.body.duration
    const date = req.body.date || Date.now()
    const user = await User.findOne({ _id: uid });
    if (user) {
        const exercise = new Exercise({
            uid,
            desc,
            dur,
            date,
        })

        await exercise.save()
        res.json({
            uid: exercise.uid,
            username: user.username,
            desc: exercise.desc,
            dur: exercise.dur,
            date: exercise.date,
        })
    } else {
        res.send('User not found.')
    }
})

// 4. I can retrieve a full exercise log of any user by getting
// /api/exercise/log with a parameter of userId(_id).
// Return will be the user object with added array log and
// count (total exercise count).
app.get('/api/exercise/log', async (req, res, _next) => {
    const userId = req.query.userId
    const from = req.query.from || '2000-01-01'
    const to = req.query.to || '3000-01-01'
    const limit = req.query.limit || 9999

    const user = User.find({ _id: userId });
    if (user) {
        const exercises = await Exercise.find({})
            .gt('date', new Date(from))
            .lt('date', new Date(to))
            .limit(limit)

        res.json({ count: exercises.length, exercises })
    }
})

// Not found middleware
app.use((_req, _res, next) => {
    return next({ status: 404, message: 'not found' })
})

// Error Handling middleware
app.use((err, _req, res, _next) => {
    let errCode
    let errMessage

    if (err.errors) {
        // mongoose validation error
        errCode = 400 // bad request
        const keys = Object.keys(err.errors)
        // report the first validation error
        errMessage = err.errors[keys[0]].message
    } else {
        // generic or custom error
        errCode = err.status || 500
        errMessage = err.message || 'Internal Server Error'
    }
    res.status(errCode).type('txt').send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
})
