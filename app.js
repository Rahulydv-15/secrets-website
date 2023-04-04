//jshint esversion:6
require('dotenv').config()
const express = require("express");
const bodyparser = require("body-parser");
const app = express();
const ejs = require('ejs');
const mongoose = require('mongoose')
var findOrCreate = require("mongoose-findorcreate")
// var GoogleStrategy = require('passport-google-oidc');
//always write in same order
const session = require('express-session');
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose"); // it will use passport-local internally and it will be used as a plugin
const { use } = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;


//use this above connect statememnt
app.use(session({
    secret: 'My Secret Key.',
    resave: false,
    saveUninitialized: false,
    // cookie: { secure: true }
}));
app.use(passport.initialize());
app.use(passport.session());
mongoose.connect("mongodb://localhost:27017/secretsPersonDB", { family: 4 }).then(() => console.log("Connected")).catch(err => console.log(`Unable to Connect : ${err}`));
app.set("view engine", 'ejs');
app.use(bodyparser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


const User = new mongoose.model("User", userSchema);



// use static authenticate method of model in LocalStrategy
passport.use(User.createStrategy());

// use static serialize and deserialize of model for passport session support
passport.serializeUser(function (user, done) {
    done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
    user = await User.findById(id).exec();
    done(null, user);
});

passport.use(new GoogleStrategy({

    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,

    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: 'https://www.googleapis.com/oauth2/v3/userinfo',
    passReqToCallback: true
},
    function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));


// on clicking on google sign in button
app.get("/auth/google", function (req, res) {
    console.log("Signing in with google");
    
    // console.log(req);
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res);
    // console.log("***");
});
//on redirection
app.get('/auth/google/secrets',
    passport.authenticate('google', { failureRedirect: '/' }),
    function (req, res) {
        // Successful authentication, redirect home.
        console.log("helllo");
        res.redirect('/secrets');
    });



app.get("/", function (req, res) {
    res.render('home');
});

app.get("/login", function (req, res) {
    res.render('login');
});

app.get("/register", function (req, res) {
    res.render('register');
});
app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    }
    else {
        res.redirect("/login");
    }
});
 
app.post("/submit", async function (req, res) {
    if (req.isAuthenticated()) {
        let user = await User.findById(req.user.id).exec();
        if (user) {
            user.secret = req.body.secret;
            user.save();
        }

            res.redirect("secrets");


    }
    else {
        res.redirect("/login");
    }
})



app.post("/register", function (req, res) {
    // it is mandatory to use a variable named username here 
    User.register({ username: req.body.username }, req.body.password, function (err, user) {
        if (err) {
            console.log("hello hello");
            console.log(err);
            res.render("register");
        }
        else {
            // this will make local cookies for the user which will destroy on closing browser and closing server
            passport.authenticate("local")(req, res, function () {
                res.redirect("secrets");
            });
        }
    })

})


app.post("/login", async function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function (err) {
        if (err) { return next(err); }
        else {
            console.log("Yes");
            passport.authenticate("local")(req, res, function () {
                res.redirect("secrets");
            });
        }
    });



})

//user can only access this pag after authentication
app.get("/secrets",async function (req, res) {
    if (req.isAuthenticated()) {
        console.log("Authenticated");
        const users=await User.find({secret: {$ne: null}});
        res.render("secrets",{users: users});
    }
    else {
        console.log("Not Authenticated");
        res.render("home");
    }

});
app.get("/logout", function (req, res) {
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
})
app.listen(3000);
