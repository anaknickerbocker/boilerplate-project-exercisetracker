const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require("body-parser");
require('dotenv').config()

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
});
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const MongoClient = require('mongodb').MongoClient;
const mongoose = require("mongoose");
const uri = process.env.MONGO_URI;
mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = mongoose.Schema({
    user: { type: String, required: true }
});
const exerciseSchema = mongoose.Schema({
    uid: { type: String, required: true },
    desc: { type: String, required: true },
    dur: { type: Number, required: true },
    date: { type: Date, required: true }
});

const User = mongoose.model("User", userSchema);
const Exercise = mongoose.model("Exercise", exerciseSchema);

// 1. I can create a user by posting form data username to
// /api/exercise/new-user
// and returned will be an object with username and _id.
app.post("/api/exercise/new-user", (req, res, _next) => {
    const user = req.body.username;
    const userDoc = new User({ user });
    userDoc.save((err) => {
        if (err) console.log(err.message);
    });
    res.json({ _id: userDoc["_id"], user: userDoc.user });
});

// 2. I can get an array of all users by getting
// api/exercise/users with the same info as when creating a user.
app.get("/api/exercise/users", (req, res, next) => {
    User.find({}, "-__v", (err, users) => {
        if (err) return next(err);
        res.json(users);
    });
});

// 3. I can add an exercise to any user by posting form data userId(_id),
// description, duration, and optionally date to /api/exercise/add.
// If no date supplied it will use current date.
// Returned will the the user object with also with the exercise fields added.
app.post("/api/exercise/add", (req, res) => {
    let uid = req.body.userId;
    let desc = req.body.description;
    let dur = req.body.duration;
    let dat = req.body.date || Date.now();

    User.findById(uid, "-__v")
        .populate("logDetails")
        .exec((err, userData) => {
            const logDoc = new Exercise({
                uid,
                desc,
                dur,
                date: dat
            });

            logDoc.save((err, data) => {
                if (err) console.log(err.message);
                res.json({
                    uid: userData._id,
                    user: userData.user,
                    desc: data.desc,
                    dur: data.dur,
                    date: data.date
                });
            });
        });
});

// 4. I can retrieve a full exercise log of any user by getting
// /api/exercise/log with a parameter of userId(_id).
// Return will be the user object with added array log and
// count (total exercise count).
app.get("/api/exercise/log", (req, res, next) => {
    let userId = req.query.userId;
    if (!userId) throw new Error("You must provide a User ID!");

    let from = new Date(req.query.from) || new Date(2000 - 01 - 01);
    let to = new Date(req.query.to) || new Date(3000 - 01 - 01);
    let limit = req.query.limit || 9999;
    let logData = [];

    User.findById(userId, (err, users) => {
        Exercise.find({}, "-uid -__v")
            // gt('date', from).
            // lt('date', to).
            // limit(limit).
            .exec((err, logs) => {
                logs.forEach(log => {
                    logData.push(log);
                });
                res.json({ users, logData });
            });
    });
});

// Not found middleware
app.use((req, res, next) => {
    return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, _req, res, _next) => {
    let errCode, errMessage;

    if (err.errors) {
        // mongoose validation error
        errCode = 400; // bad request
        const keys = Object.keys(err.errors);
        // report the first validation error
        errMessage = err.errors[keys[0]].message;
    } else {
        // generic or custom error
        errCode = err.status || 500;
        errMessage = err.message || "Internal Server Error";
    }
    res
        .status(errCode)
        .type("txt")
        .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
})
